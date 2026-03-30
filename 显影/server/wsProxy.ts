/**
 * Lightweight WebSocket + HTTP proxy for Volcengine ASR APIs.
 *
 * Solves the browser limitation where WebSocket handshake cannot carry
 * custom headers. The proxy injects auth headers server-side.
 *
 * Usage:
 *   npx tsx server/wsProxy.ts
 *
 * Endpoints:
 *   ws://localhost:3001/asr-stream?connect_id=xxx&resource_id=xxx   → streams to bigmodel_async
 *   POST http://localhost:3001/asr-file/submit                       → proxies file submit
 *   POST http://localhost:3001/asr-file/query                        → proxies file query
 *   POST http://localhost:3001/upload-audio                          → upload WAV to TOS, return public URL
 */
import { createServer, type IncomingMessage, type ServerResponse as HttpResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { readFileSync } from 'fs';
import { join } from 'path';
import Busboy from 'busboy';
import TOS from '@volcengine/tos-sdk';
import { GoogleAuth } from 'google-auth-library';

const PORT = Number(process.env.PROXY_PORT ?? 3001);
const API_KEY = process.env.VITE_VOLCENGINE_API_KEY ?? '';

if (!API_KEY) {
  console.error('[proxy] Missing VITE_VOLCENGINE_API_KEY env var.');
  console.error('[proxy] Create .env.local and source it, or pass as env vars.');
}

// --- TOS configuration ---

const TOS_AK = process.env.TOS_ACCESS_KEY_ID ?? '';
const TOS_SK = process.env.TOS_SECRET_ACCESS_KEY ?? '';
const TOS_REGION = process.env.TOS_REGION ?? 'cn-beijing';
const TOS_BUCKET = process.env.TOS_BUCKET ?? '';
const TOS_ENDPOINT = process.env.TOS_ENDPOINT ?? `tos-${TOS_REGION}.volces.com`;

let tosClient: TOS | null = null;

if (TOS_AK && TOS_SK && TOS_BUCKET) {
  tosClient = new TOS({
    accessKeyId: TOS_AK,
    accessKeySecret: TOS_SK,
    region: TOS_REGION,
    endpoint: TOS_ENDPOINT,
  });
  console.log(`[proxy] TOS configured: bucket=${TOS_BUCKET}, region=${TOS_REGION}`);
} else {
  console.warn('[proxy] TOS not configured. Set TOS_ACCESS_KEY_ID, TOS_SECRET_ACCESS_KEY, TOS_BUCKET to enable audio upload.');
}

const VOLCENGINE_STREAM_BASE = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async';
const VOLCENGINE_FILE_BASE = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel';

// --- Google Sheets configuration ---

const GSHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = process.env.VITE_GOOGLE_SPREADSHEET_ID ?? '';

let gsheetsAuth: GoogleAuth | null = null;

try {
  const keyPath = join(import.meta.dirname ?? __dirname, 'google-service-account.json');
  const keyFile = JSON.parse(readFileSync(keyPath, 'utf-8'));
  gsheetsAuth = new GoogleAuth({
    credentials: keyFile,
    scopes: GSHEETS_SCOPES,
  });
  console.log(`[proxy] Google Sheets configured: spreadsheet=${SPREADSHEET_ID}`);
  console.log(`[proxy]   Service account: ${keyFile.client_email}`);
} catch {
  console.warn('[proxy] Google Sheets not configured. Place google-service-account.json in server/.');
}

async function gsheetsRequest(method: string, path: string, body?: unknown) {
  if (!gsheetsAuth) throw new Error('Google Sheets auth not configured');
  const client = await gsheetsAuth.getClient();
  const token = await client.getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sheets API ${res.status}: ${errText}`);
  }
  return res.json();
}

function generateSessionId(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${ts}_${rand}`;
}

function computeContextWindow(row: number, totalDataRows: number): { start: number; end: number } {
  const firstDataRow = 2;
  const lastDataRow = firstDataRow + totalDataRows - 1;
  let start = Math.max(firstDataRow, row - 2);
  let end = start + 4;
  if (end > lastDataRow) {
    end = lastDataRow;
    start = Math.max(firstDataRow, end - 4);
  }
  return { start, end };
}

function computeForwardWindow(row: number, totalDataRows: number): { start: number; end: number } {
  const firstDataRow = 2;
  const lastDataRow = firstDataRow + totalDataRows - 1;
  const end = Math.min(row + 2, lastDataRow);
  return { start: row, end };
}

function generateAIFormulas(rowCount: number): string[][] {
  const formulas: string[][] = [];
  for (let i = 0; i < rowCount; i++) {
    const r = i + 2;
    const { start, end } = computeContextWindow(r, rowCount);
    const fwd = computeForwardWindow(r, rowCount);

    const kFormula = `=AI("Column B is the spoken content. Column C is the speaker. Using B${start}:C${end} as context, infer who the speaker in row ${r} is talking to. Output only the listener concisely.", B${start}:C${end})`;
    const lFormula = `=AI("Analyze the emotional tone of the sentence in row ${r}. Use B${start}:B${end} as context. Output only one: Positive, Negative, Neutral.", B${start}:B${end})`;
    const mFormula = `=AI("Determine if the speaker in row ${r} was interrupted by the next speaker. Use B${fwd.start}:C${fwd.end} as context. Output only one: Yes, No.", B${fwd.start}:C${fwd.end})`;
    const nFormula = `=AI("Classify the interaction type of the sentence in row ${r}. Column B is content, Column C is speaker. Use B${start}:C${end} as context. Output exactly one: Question, Response, Rebuttal, Supplement, Summary, Interruption.", B${start}:C${end})`;
    const oFormula = `=AI("Extract the main discussion topic of the sentence in row ${r}. Column B is content. Use B${start}:B${end} as context. Output a concise topic label in 2-4 Chinese characters.", B${start}:B${end})`;
    const pFormula = `=AI("Determine if the sentence in row ${r} marks a turning point in the conversation mood or topic. Use B${start}:B${end} as context. Output only one: Yes, No.", B${start}:B${end})`;

    formulas.push([kFormula, lFormula, mFormula, nFormula, oFormula, pFormula]);
  }
  return formulas;
}

interface TranscriptPayload {
  speaker: string;
  text: string;
  timestamp: string;
  startTimeMs?: number;
  endTimeMs?: number;
  durationSec?: number;
  emotion?: string;
  gender?: string;
  speechRate?: number;
  volume?: number;
}

async function handleGSheetsWrite(req: IncomingMessage, res: HttpResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const { transcripts, sessionId: customId } = JSON.parse(Buffer.concat(chunks).toString()) as {
    transcripts: TranscriptPayload[];
    sessionId?: string;
  };

  const sessionId = customId || generateSessionId();

  try {
    await gsheetsRequest('POST', ':batchUpdate', {
      requests: [{ addSheet: { properties: { title: sessionId } } }],
    });

    const headerRow = [['序号', '发言内容', '说话人', '开始时间(s)', '结束时间(s)', '发言时长(s)', '性别', 'ASR情绪', '语速(token/s)', '音量(dB)', '对谁说话', '对话情绪', '是否被打断', '互动类型', '话题标签', '对话转折']];
    await gsheetsRequest('PUT',
      `/values/${encodeURIComponent(sessionId)}!A1:P1?valueInputOption=RAW`,
      { values: headerRow },
    );

    const dataRows = transcripts.map((t, i) => {
      const startSec = t.startTimeMs != null ? Math.round(t.startTimeMs / 100) / 10 : '';
      const endSec = t.endTimeMs != null ? Math.round(t.endTimeMs / 100) / 10 : '';
      const dur = t.durationSec ?? (typeof startSec === 'number' && typeof endSec === 'number'
        ? Math.round((endSec - startSec) * 10) / 10
        : Math.max(1, Math.round(t.text.length / 4)));
      return [
        i + 1,
        t.text,
        t.speaker,
        startSec,
        endSec,
        dur,
        t.gender ?? '',
        t.emotion ?? '',
        t.speechRate ?? '',
        t.volume ?? '',
      ];
    });
    await gsheetsRequest('PUT',
      `/values/${encodeURIComponent(sessionId)}!A2:J${dataRows.length + 1}?valueInputOption=RAW`,
      { values: dataRows },
    );

    const formulas = generateAIFormulas(dataRows.length);
    await gsheetsRequest('PUT',
      `/values/${encodeURIComponent(sessionId)}!K2:P${formulas.length + 1}?valueInputOption=USER_ENTERED`,
      { values: formulas },
    );

    console.log(`[proxy] GSheets write: ${dataRows.length} rows → sheet "${sessionId}"`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sheetName: sessionId, rowCount: dataRows.length }));
  } catch (err) {
    console.error('[proxy] GSheets write error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'GSheets write failed', detail: String(err) }));
  }
}

async function handleGSheetsRead(req: IncomingMessage, res: HttpResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const { sheetName } = JSON.parse(Buffer.concat(chunks).toString()) as { sheetName: string };

  try {
    const range = `${sheetName}!A2:P`;
    const data = await gsheetsRequest('GET',
      `/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
    );

    const rows: string[][] = data.values ?? [];
    if (rows.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'pending', records: [] }));
      return;
    }

    // AI formula columns: K=10, L=11, M=12, N=13, O=14, P=15
    const pendingPatterns = ['Loading...', '#VALUE!', '#ERROR!', '#REF!', ''];
    const isUncomputed = (v: string) =>
      pendingPatterns.includes(v) || v.startsWith('=AI(') || v.startsWith('=ai(');
    const clean = (v: string) => (v.startsWith('=AI(') || v.startsWith('=ai(') ? '' : v);

    const interactionEnToCn: Record<string, string> = {
      question: '提问', response: '回应', rebuttal: '反驳',
      supplement: '补充', summary: '总结', interruption: '打断',
    };
    const mapInteraction = (v: string) =>
      interactionEnToCn[v.toLowerCase()] ?? v;

    let allDone = true;
    const records = rows.map((row, i) => {
      const rawTarget = row[10] ?? '';
      const rawEmotion = row[11] ?? '';
      const rawInterrupted = row[12] ?? '';
      const rawDetailed = row[13] ?? '';
      const rawTopic = row[14] ?? '';
      const rawTurning = row[15] ?? '';

      if (isUncomputed(rawTarget) || isUncomputed(rawEmotion) || isUncomputed(rawInterrupted)) {
        allDone = false;
      }

      const targetSpeaker = clean(rawTarget);
      const aiEmotion = clean(rawEmotion);
      const interrupted = clean(rawInterrupted);
      const detailedInteraction = clean(rawDetailed);
      const topic = clean(rawTopic);
      const turningPoint = clean(rawTurning);

      return {
        record_id: `gs-${i}`,
        index: i,
        text: row[1] ?? '',
        speaker: row[2] ?? '',
        startTimeSec: Number(row[3]) || 0,
        endTimeSec: Number(row[4]) || 0,
        durationSec: Number(row[5]) || 0,
        gender: row[6] ?? '',
        asrEmotion: row[7] ?? '',
        speechRate: Number(row[8]) || 0,
        volume: Number(row[9]) || 0,
        targetSpeaker,
        emotion: aiEmotion,
        interactionType: interrupted.toLowerCase() === 'yes' ? '打断' : '',
        detailedInteraction: mapInteraction(detailedInteraction),
        topic,
        isTurningPoint: turningPoint.toLowerCase() === 'yes',
      };
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: allDone ? 'done' : 'pending', records }));
  } catch (err) {
    console.error('[proxy] GSheets read error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'GSheets read failed', detail: String(err) }));
  }
}

// --- CORS helper ---

function setCorsHeaders(res: HttpResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Connect-Id, X-Resource-Id, X-Request-Id, X-Sequence');
}

// --- HTTP proxy for file recognition ---

async function handleFileProxy(req: IncomingMessage, res: HttpResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const action = url.pathname.endsWith('/submit') ? 'submit' : 'query';
  const targetUrl = `${VOLCENGINE_FILE_BASE}/${action}`;

  const requestId = (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
  const resourceId = (req.headers['x-resource-id'] as string) ?? 'volc.seedasr.auc';

  // Read body
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = Buffer.concat(chunks);

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'X-Api-Resource-Id': resourceId,
        'X-Api-Request-Id': requestId,
        'X-Api-Sequence': '-1',
      },
      body,
    });

    const statusCode = upstream.headers.get('x-api-status-code') ?? '';
    const apiMessage = upstream.headers.get('x-api-message') ?? '';
    const logId = upstream.headers.get('x-tt-logid') ?? '';

    res.setHeader('X-Api-Status-Code', statusCode);
    res.setHeader('X-Api-Message', apiMessage);
    res.setHeader('X-Tt-Logid', logId);
    res.setHeader('Content-Type', 'application/json');

    const responseBody = await upstream.text();
    res.writeHead(upstream.status);
    res.end(responseBody);
  } catch (err) {
    console.error(`[proxy] File ${action} error:`, err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy upstream error', detail: String(err) }));
  }
}

// --- Audio upload to TOS ---

async function handleUploadAudio(req: IncomingMessage, res: HttpResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!tosClient) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'TOS not configured on server' }));
    return;
  }

  try {
    const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const bb = Busboy({ headers: req.headers });

      bb.on('file', (_fieldname, stream) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });

      bb.on('error', reject);
      req.pipe(bb);
    });

    const key = `recordings/recording-${crypto.randomUUID()}.wav`;

    await tosClient.putObject({
      bucket: TOS_BUCKET,
      key,
      body: fileBuffer,
      contentType: 'audio/wav',
      acl: 'public-read' as any,
    });

    const publicUrl = `https://${TOS_BUCKET}.${TOS_ENDPOINT}/${key}`;
    console.log(`[proxy] Uploaded ${fileBuffer.length} bytes → ${publicUrl}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: publicUrl }));
  } catch (err) {
    console.error('[proxy] Upload error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upload failed', detail: String(err) }));
  }
}

// --- Rule-based annotation fallback (when =AI() is unavailable) ---

interface RawRow {
  index: number;
  text: string;
  speaker: string;
  asrEmotion: string;
}

function inferTargetSpeaker(rows: RawRow[], current: number): string {
  const cur = rows[current];
  const prev = current > 0 ? rows[current - 1] : null;
  const next = current < rows.length - 1 ? rows[current + 1] : null;

  if (prev && prev.speaker !== cur.speaker) return prev.speaker;
  if (next && next.speaker !== cur.speaker) return next.speaker;

  const speakers = [...new Set(rows.map((r) => r.speaker))].filter((s) => s !== cur.speaker);
  return speakers[0] ?? cur.speaker;
}

function inferEmotion(text: string, asrEmotion: string): string {
  if (asrEmotion && asrEmotion !== 'Neutral') {
    return asrEmotion;
  }
  const positiveHints = ['好', '太好了', '棒', '同意', '赞', '没问题', '可以', '不错', '开心', '喜欢', '支持'];
  const negativeHints = ['不', '不行', '不同意', '反对', '差', '烦', '难', '慢', '问题', '卡', '糟', '别'];
  const lower = text.toLowerCase();
  const posScore = positiveHints.filter((h) => lower.includes(h)).length;
  const negScore = negativeHints.filter((h) => lower.includes(h)).length;
  if (posScore > negScore) return 'Positive';
  if (negScore > posScore) return 'Negative';
  return 'Neutral';
}

function inferInterrupted(rows: RawRow[], current: number): boolean {
  if (current >= rows.length - 1) return false;
  const cur = rows[current];
  const next = rows[current + 1];
  if (cur.speaker === next.speaker) return false;
  const interruptHints = ['等等', '别说了', '我不同意', '打断', '等一下'];
  return interruptHints.some((h) => next.text.includes(h));
}

function inferDetailedInteraction(text: string, isInterrupted: boolean): string {
  if (isInterrupted) return '打断';
  if (text.includes('？') || text.includes('吗') || text.includes('行不行') || text.includes('要不要')) return '提问';
  const summaryHints = ['总结', '那就', '定下来', '散会', '并行推进', '分两步', '排个优先级'];
  if (summaryHints.some((h) => text.includes(h))) return '总结';
  const rebuttalHints = ['不是', '不同意', '不对', '但是', '但我'];
  if (rebuttalHints.some((h) => text.includes(h))) return '反驳';
  const supplementHints = ['也', '而且', '还有', '另外', '补充', '可以做'];
  if (supplementHints.some((h) => text.includes(h))) return '补充';
  return '回应';
}

function inferTopic(text: string): string {
  const topicMap: [string[], string][] = [
    [['性能', '加载', '卡', '渲染', '优化', '快', '慢'], '性能优化'],
    [['引导', '教程', '新用户', '弹出', '步骤'], '引导教程'],
    [['录音', '音频', '麦克风'], '录音体验'],
    [['方案', '讨论', '分工', '协调', '散会'], '方案讨论'],
    [['优先级', '紧急', '重要', '关键'], '优先级'],
    [['原型', '设计', '交互'], '产品设计'],
    [['技术', 'Google', 'AI', '公式', '接口'], '技术方案'],
  ];
  for (const [keywords, topic] of topicMap) {
    if (keywords.some((k) => text.includes(k))) return topic;
  }
  return '综合讨论';
}

function inferTurningPoint(rows: RawRow[], current: number): boolean {
  if (current === 0 || current >= rows.length - 1) return false;
  const prev = rows[current - 1];
  const cur = rows[current];
  const prevEmo = inferEmotion(prev.text, prev.asrEmotion);
  const curEmo = inferEmotion(cur.text, cur.asrEmotion);
  if (prevEmo !== curEmo && (curEmo === 'Positive' || curEmo === 'Negative')) return true;
  const topicShiftHints = ['那这样', '要不这样', '冷静', '好了', '换个'];
  return topicShiftHints.some((h) => cur.text.includes(h));
}

async function handleGSheetsAnnotate(req: IncomingMessage, res: HttpResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const { sheetName, force } = JSON.parse(Buffer.concat(chunks).toString()) as {
    sheetName: string;
    force?: boolean;
  };

  try {
    // Read A-J (raw data) and K column (first AI field) to check existing state
    const fullRange = `${sheetName}!A2:P`;
    const data = await gsheetsRequest('GET',
      `/values/${encodeURIComponent(fullRange)}?valueRenderOption=FORMATTED_VALUE`,
    );

    const rawRows: string[][] = data.values ?? [];
    if (rawRows.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'empty', annotated: 0 }));
      return;
    }

    // Skip if K column already has computed AI results (non-empty, non-formula)
    if (!force) {
      const hasComputedResults = rawRows.some((row) => {
        const k = row[10] ?? '';
        return k !== '' && !k.startsWith('=AI(') && !k.startsWith('=ai(');
      });
      if (hasComputedResults) {
        console.log(`[proxy] GSheets annotate: skipped "${sheetName}" — AI results already present. Use force=true to override.`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'skipped', annotated: 0, reason: 'AI results already computed' }));
        return;
      }
    }

    const parsed: RawRow[] = rawRows.map((row, i) => ({
      index: i,
      text: row[1] ?? '',
      speaker: row[2] ?? '',
      asrEmotion: row[7] ?? '',
    }));

    const annotations: string[][] = parsed.map((row, i) => {
      const target = inferTargetSpeaker(parsed, i);
      const emotion = inferEmotion(row.text, row.asrEmotion);
      const interrupted = inferInterrupted(parsed, i);
      const detailed = inferDetailedInteraction(row.text, interrupted);
      const topic = inferTopic(row.text);
      const turning = inferTurningPoint(parsed, i);

      return [
        target,
        emotion,
        interrupted ? 'Yes' : 'No',
        detailed,
        topic,
        turning ? 'Yes' : 'No',
      ];
    });

    await gsheetsRequest('PUT',
      `/values/${encodeURIComponent(sheetName)}!K2:P${annotations.length + 1}?valueInputOption=RAW`,
      { values: annotations },
    );

    console.log(`[proxy] GSheets annotate: ${annotations.length} rows in "${sheetName}"${force ? ' (forced)' : ''}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'done', annotated: annotations.length }));
  } catch (err) {
    console.error('[proxy] GSheets annotate error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'GSheets annotate failed', detail: String(err) }));
  }
}

// --- HTTP server ---

const server = createServer((req, res) => {
  const url = req.url ?? '/';
  if (url.startsWith('/upload-audio')) {
    handleUploadAudio(req, res);
  } else if (url.startsWith('/asr-file')) {
    handleFileProxy(req, res);
  } else if (url.startsWith('/gsheets/annotate')) {
    handleGSheetsAnnotate(req, res);
  } else if (url.startsWith('/gsheets/write')) {
    handleGSheetsWrite(req, res);
  } else if (url.startsWith('/gsheets/read')) {
    handleGSheetsRead(req, res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// --- WebSocket proxy for streaming ASR ---

const wss = new WebSocketServer({ server, path: '/asr-stream' });

wss.on('connection', (clientWs: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const connectId = url.searchParams.get('connect_id') ?? crypto.randomUUID();
  const resourceId = url.searchParams.get('resource_id') ?? 'volc.seedasr.sauc.duration';

  console.log(`[proxy] New streaming connection: connect_id=${connectId}`);

  const upstreamWs = new WebSocket(VOLCENGINE_STREAM_BASE, {
    headers: {
      'x-api-key': API_KEY,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Connect-Id': connectId,
    },
  });

  upstreamWs.binaryType = 'arraybuffer';

  upstreamWs.on('open', () => {
    console.log(`[proxy] Upstream connected: connect_id=${connectId}`);
  });

  // Pipe: upstream → client
  upstreamWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data);
    }
  });

  upstreamWs.on('close', (code, reason) => {
    console.log(`[proxy] Upstream closed: ${code} ${reason?.toString()}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(code, reason?.toString());
    }
  });

  upstreamWs.on('error', (err) => {
    console.error(`[proxy] Upstream error:`, err.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Upstream error');
    }
  });

  // Pipe: client → upstream
  clientWs.on('message', (data) => {
    if (upstreamWs.readyState === WebSocket.OPEN) {
      upstreamWs.send(data);
    }
  });

  clientWs.on('close', () => {
    console.log(`[proxy] Client disconnected: connect_id=${connectId}`);
    if (upstreamWs.readyState === WebSocket.OPEN) {
      upstreamWs.close();
    }
  });

  clientWs.on('error', (err) => {
    console.error(`[proxy] Client error:`, err.message);
    if (upstreamWs.readyState === WebSocket.OPEN) {
      upstreamWs.close();
    }
  });
});

// --- Start ---

server.listen(PORT, () => {
  console.log(`[proxy] Proxy running on http://localhost:${PORT}`);
  console.log(`[proxy]   WebSocket:      ws://localhost:${PORT}/asr-stream`);
  console.log(`[proxy]   File submit:    POST http://localhost:${PORT}/asr-file/submit`);
  console.log(`[proxy]   File query:     POST http://localhost:${PORT}/asr-file/query`);
  console.log(`[proxy]   Audio upload:   POST http://localhost:${PORT}/upload-audio`);
  console.log(`[proxy]   GSheets write:    POST http://localhost:${PORT}/gsheets/write`);
  console.log(`[proxy]   GSheets read:     POST http://localhost:${PORT}/gsheets/read`);
  console.log(`[proxy]   GSheets annotate: POST http://localhost:${PORT}/gsheets/annotate`);
});
