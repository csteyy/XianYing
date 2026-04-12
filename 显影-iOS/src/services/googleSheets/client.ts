import { GSHEETS_CONFIG } from './config';
import { isNative } from '../platform';
import { isDirectSheetsAvailable } from './auth';
import { createSheet, writeValues, readValues } from './sheetsApi';
import { generateSessionId, generateAIFormulas, annotateLocally, type RawRow } from './annotate';

export interface TranscriptForSheet {
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

export interface AnnotatedRecord {
  record_id: string;
  index: number;
  text: string;
  speaker: string;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  gender: string;
  asrEmotion: string;
  speechRate: number;
  volume: number;
  targetSpeaker: string;
  emotion: string;
  interactionType: string;
  detailedInteraction: string;
  topic: string;
  isTurningPoint: boolean;
}

interface WriteResponse {
  sheetName: string;
  rowCount: number;
}

interface ReadResponse {
  status: 'done' | 'pending';
  records: AnnotatedRecord[];
}

function useDirectApi(): boolean {
  const native = isNative();
  const sheetsAvail = isDirectSheetsAvailable();
  const result = native && sheetsAvail;
  console.log('[GSheets Client] useDirectApi:', result, '| native:', native, '| sheetsAvail:', sheetsAvail);
  return result;
}

// ---------------------------------------------------------------------------
// Header row used when writing a new sheet
// ---------------------------------------------------------------------------

const HEADER_ROW = [['序号', '发言内容', '说话人', '开始时间(s)', '结束时间(s)', '发言时长(s)', '性别', 'ASR情绪', '语速(token/s)', '音量(dB)', '对谁说话', '对话情绪', '是否被打断', '互动类型', '话题标签', '对话转折']];

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

async function writeViaProxy(
  transcripts: TranscriptForSheet[],
  sessionId?: string,
): Promise<WriteResponse> {
  const res = await fetch(GSHEETS_CONFIG.proxyWritePath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcripts, sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Write failed: ${res.status}`);
  }
  return res.json();
}

async function writeDirect(
  transcripts: TranscriptForSheet[],
  sessionId?: string,
): Promise<WriteResponse> {
  const sheetName = sessionId || generateSessionId();
  console.log('[GSheets Client] writeDirect: sheetName =', sheetName, '| rows =', transcripts.length);

  try {
    await createSheet(sheetName);
    console.log('[GSheets Client] Sheet created');
  } catch (err) {
    console.error('[GSheets Client] createSheet failed:', err);
    throw err;
  }

  await writeValues(`${sheetName}!A1:P1`, HEADER_ROW);

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
  await writeValues(`${sheetName}!A2:J${dataRows.length + 1}`, dataRows);
  console.log('[GSheets Client] Data rows written');

  const formulas = generateAIFormulas(dataRows.length);
  await writeValues(`${sheetName}!K2:P${formulas.length + 1}`, formulas, 'USER_ENTERED');
  console.log('[GSheets Client] AI formulas written');

  return { sheetName, rowCount: dataRows.length };
}

export async function writeTranscriptsToSheet(
  transcripts: TranscriptForSheet[],
  sessionId?: string,
): Promise<WriteResponse> {
  if (useDirectApi()) return writeDirect(transcripts, sessionId);
  return writeViaProxy(transcripts, sessionId);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

const PENDING_PATTERNS = ['Loading...', '#VALUE!', '#ERROR!', '#REF!', ''];
const isUncomputed = (v: string) =>
  PENDING_PATTERNS.includes(v) || v.startsWith('=AI(') || v.startsWith('=ai(');
const clean = (v: string) => (v.startsWith('=AI(') || v.startsWith('=ai(') ? '' : v);

const INTERACTION_EN_TO_CN: Record<string, string> = {
  question: '提问', response: '回应', rebuttal: '反驳',
  supplement: '补充', summary: '总结', interruption: '打断',
};
const mapInteraction = (v: string) => INTERACTION_EN_TO_CN[v.toLowerCase()] ?? v;

function parseSheetRows(rows: (string | number)[][]): ReadResponse {
  if (rows.length === 0) return { status: 'pending', records: [] };

  let allDone = true;
  const records: AnnotatedRecord[] = rows.map((row, i) => {
    const rawTarget = String(row[10] ?? '');
    const rawEmotion = String(row[11] ?? '');
    const rawInterrupted = String(row[12] ?? '');
    const rawDetailed = String(row[13] ?? '');
    const rawTopic = String(row[14] ?? '');
    const rawTurning = String(row[15] ?? '');

    if (isUncomputed(rawTarget) || isUncomputed(rawEmotion) || isUncomputed(rawInterrupted)) {
      allDone = false;
    }

    return {
      record_id: `gs-${i}`,
      index: i,
      text: String(row[1] ?? ''),
      speaker: String(row[2] ?? ''),
      startTimeSec: Number(row[3]) || 0,
      endTimeSec: Number(row[4]) || 0,
      durationSec: Number(row[5]) || 0,
      gender: String(row[6] ?? ''),
      asrEmotion: String(row[7] ?? ''),
      speechRate: Number(row[8]) || 0,
      volume: Number(row[9]) || 0,
      targetSpeaker: clean(rawTarget),
      emotion: clean(rawEmotion),
      interactionType: clean(rawInterrupted).toLowerCase() === 'yes' ? '打断' : '',
      detailedInteraction: mapInteraction(clean(rawDetailed)),
      topic: clean(rawTopic),
      isTurningPoint: clean(rawTurning).toLowerCase() === 'yes',
    };
  });

  return { status: allDone ? 'done' : 'pending', records };
}

async function readViaProxy(sheetName: string): Promise<ReadResponse> {
  const res = await fetch(GSHEETS_CONFIG.proxyReadPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Read failed: ${res.status}`);
  }
  return res.json();
}

async function readDirect(sheetName: string): Promise<ReadResponse> {
  const rows = await readValues(`${sheetName}!A2:P`);
  return parseSheetRows(rows);
}

export async function readAnnotationsFromSheet(sheetName: string): Promise<ReadResponse> {
  if (useDirectApi()) return readDirect(sheetName);
  return readViaProxy(sheetName);
}

// ---------------------------------------------------------------------------
// Annotate (rule-based fallback)
// ---------------------------------------------------------------------------

async function annotateViaProxy(sheetName: string): Promise<{ status: string; annotated: number }> {
  const res = await fetch(GSHEETS_CONFIG.proxyAnnotatePath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Annotate failed: ${res.status}`);
  }
  return res.json();
}

async function annotateDirect(sheetName: string): Promise<{ status: string; annotated: number }> {
  const rows = await readValues(`${sheetName}!A2:J`);
  if (rows.length === 0) return { status: 'empty', annotated: 0 };

  const parsed: RawRow[] = rows.map((row, i) => ({
    index: i,
    text: String(row[1] ?? ''),
    speaker: String(row[2] ?? ''),
    asrEmotion: String(row[7] ?? ''),
  }));

  const annotations = annotateLocally(parsed);

  await writeValues(
    `${sheetName}!K2:P${annotations.length + 1}`,
    annotations,
  );

  return { status: 'done', annotated: annotations.length };
}

export async function triggerAnnotation(
  sheetName: string,
): Promise<{ status: string; annotated: number }> {
  if (useDirectApi()) return annotateDirect(sheetName);
  return annotateViaProxy(sheetName);
}

// ---------------------------------------------------------------------------
// Poll (shared logic, delegates to read above)
// ---------------------------------------------------------------------------

export async function pollForAnnotations(
  sheetName: string,
  intervalMs = 5000,
  timeoutMs = 180_000,
): Promise<{ status: 'done' | 'timeout'; records: AnnotatedRecord[] }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await readAnnotationsFromSheet(sheetName);
    if (result.status === 'done') return { status: 'done', records: result.records };
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  const final = await readAnnotationsFromSheet(sheetName);
  return {
    status: final.status === 'done' ? 'done' : 'timeout',
    records: final.records,
  };
}
