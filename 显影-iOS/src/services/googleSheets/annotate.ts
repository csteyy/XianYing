/**
 * Rule-based annotation logic and AI formula generation.
 * Migrated from server/wsProxy.ts so the iOS app can run
 * without a proxy server.
 */

export interface RawRow {
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

/**
 * Run rule-based annotation on raw transcript rows.
 * Returns an array of [target, emotion, interrupted, detailed, topic, turning]
 * per row, ready to be written to columns K-P.
 */
export function annotateLocally(rows: RawRow[]): string[][] {
  return rows.map((row, i) => {
    const target = inferTargetSpeaker(rows, i);
    const emotion = inferEmotion(row.text, row.asrEmotion);
    const interrupted = inferInterrupted(rows, i);
    const detailed = inferDetailedInteraction(row.text, interrupted);
    const topic = inferTopic(row.text);
    const turning = inferTurningPoint(rows, i);

    return [
      target,
      emotion,
      interrupted ? 'Yes' : 'No',
      detailed,
      topic,
      turning ? 'Yes' : 'No',
    ];
  });
}

// --- AI formula generation (same as wsProxy.ts) ---

function computeContextWindow(row: number, totalDataRows: number) {
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

function computeForwardWindow(row: number, totalDataRows: number) {
  const firstDataRow = 2;
  const lastDataRow = firstDataRow + totalDataRows - 1;
  const end = Math.min(row + 2, lastDataRow);
  return { start: row, end };
}

export function generateAIFormulas(rowCount: number): string[][] {
  const formulas: string[][] = [];
  for (let i = 0; i < rowCount; i++) {
    const r = i + 2;
    const { start, end } = computeContextWindow(r, rowCount);
    const fwd = computeForwardWindow(r, rowCount);

    formulas.push([
      `=AI("Column B is the spoken content. Column C is the speaker. Using B${start}:C${end} as context, infer who the speaker in row ${r} is talking to. Output only the listener concisely.", B${start}:C${end})`,
      `=AI("Analyze the emotional tone of the sentence in row ${r}. Use B${start}:B${end} as context. Output only one: Positive, Negative, Neutral.", B${start}:B${end})`,
      `=AI("Determine if the speaker in row ${r} was interrupted by the next speaker. Use B${fwd.start}:C${fwd.end} as context. Output only one: Yes, No.", B${fwd.start}:C${fwd.end})`,
      `=AI("Classify the interaction type of the sentence in row ${r}. Column B is content, Column C is speaker. Use B${start}:C${end} as context. Output exactly one: Question, Response, Rebuttal, Supplement, Summary, Interruption.", B${start}:C${end})`,
      `=AI("Extract the main discussion topic of the sentence in row ${r}. Column B is content. Use B${start}:B${end} as context. Output a concise topic label in 2-4 Chinese characters.", B${start}:B${end})`,
      `=AI("Determine if the sentence in row ${r} marks a turning point in the conversation mood or topic. Use B${start}:B${end} as context. Output only one: Yes, No.", B${start}:B${end})`,
    ]);
  }
  return formulas;
}

export function generateSessionId(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${ts}_${rand}`;
}
