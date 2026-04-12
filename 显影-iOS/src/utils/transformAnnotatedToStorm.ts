import { getSpeakerColor } from './speakerColors';

export interface AnnotatedRecord {
  record_id: string;
  text: string;
  speaker: string;
  timestamp: string;
  index: number;
  startTimeSec?: number;
  endTimeSec?: number;
  durationSec?: number;
  gender?: string;
  asrEmotion?: string;
  speechRate?: number;
  volume?: number;
  targetSpeaker?: string;
  emotion?: string;
  interactionType?: string;
  detailedInteraction?: string;
  topic?: string;
  isTurningPoint?: boolean;
  [key: string]: unknown;
}
import type { StormNode, SpeechEvent, AggregatedEdge, Mood } from '../data/stormTypes';
import { computeAggregatedEdges } from '../data/stormTypes';

const EMOTION_MAP: Record<string, Mood> = {
  '积极': 'positive',
  '消极': 'negative',
  '平静': 'calm',
  '正面': 'positive',
  '负面': 'negative',
  '中性': 'calm',
  positive: 'positive',
  negative: 'negative',
  calm: 'calm',
  Positive: 'positive',
  Negative: 'negative',
  Neutral: 'calm',
  neutral: 'calm',
  happy: 'positive',
  sad: 'negative',
  angry: 'negative',
  surprise: 'positive',
};

function estimateDuration(text: string): number {
  return Math.max(5, Math.round(text.length / 4));
}

/**
 * Extract top-N keywords from a collection of texts using simple frequency counting.
 * Filters out common stop-words and single-character tokens.
 */
export function extractKeywords(texts: string[], topN = 4): string[] {
  const STOP = new Set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
    '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有',
    '看', '好', '自己', '这', '他', '她', '它', '们', '那', '个', '把', '让',
    '从', '为', '对', '吧', '被', '比', '做', '与', '可以', '这个', '那个',
    '什么', '怎么', '但是', '因为', '所以', '如果', '虽然', '还是', '或者',
    '而且', '不过', '然后', '已经', '其实', '可能', '应该', '觉得', '知道',
  ]);

  const freq = new Map<string, number>();
  for (const t of texts) {
    const words = t
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !STOP.has(w));
    for (const w of words) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([w]) => w);
}

function mode(arr: string[]): string {
  if (arr.length === 0) return '--';
  const f = new Map<string, number>();
  for (const v of arr) f.set(v, (f.get(v) ?? 0) + 1);
  let best = '';
  let max = 0;
  for (const [k, c] of f) {
    if (c > max) { best = k; max = c; }
  }
  return best;
}

export interface TransformedStormData {
  nodes: StormNode[];
  events: SpeechEvent[];
  aggregatedEdges: AggregatedEdge[];
}

export function transformAnnotatedToStorm(records: AnnotatedRecord[]): TransformedStormData {
  // ── 1. Aggregate speakers → StormNode[] ──

  const speakerMap = new Map<string, {
    texts: string[];
    durations: number[];
    emotions: string[];
    interactions: string[];
    targets: string[];
    speechRates: number[];
    volumes: number[];
    gender?: string;
    topics: string[];
  }>();

  for (const r of records) {
    const name = r.speaker || '未知';
    const entry = speakerMap.get(name) ?? {
      texts: [], durations: [], emotions: [], interactions: [], targets: [],
      speechRates: [], volumes: [], topics: [],
    };
    const dur = r.durationSec ?? estimateDuration(r.text);
    entry.texts.push(r.text);
    entry.durations.push(dur);
    if (r.emotion) entry.emotions.push(r.emotion);
    if (r.interactionType) entry.interactions.push(r.interactionType);
    if (r.detailedInteraction) entry.interactions.push(r.detailedInteraction);
    if (r.targetSpeaker) entry.targets.push(r.targetSpeaker);
    if (r.speechRate) entry.speechRates.push(r.speechRate);
    if (r.volume) entry.volumes.push(r.volume);
    if (r.gender) entry.gender = r.gender;
    if (r.topic) entry.topics.push(r.topic);
    speakerMap.set(name, entry);
  }

  const speakerNames = Array.from(speakerMap.keys());
  const nodes: StormNode[] = speakerNames.map((name, i) => {
    const info = speakerMap.get(name)!;
    const totalDuration = info.durations.reduce((s, d) => s + d, 0);
    const avgSpeechRate = info.speechRates.length
      ? Math.round((info.speechRates.reduce((s, v) => s + v, 0) / info.speechRates.length) * 10) / 10
      : undefined;
    const avgVolume = info.volumes.length
      ? Math.round(info.volumes.reduce((s, v) => s + v, 0) / info.volumes.length)
      : undefined;
    const uniqueTopics = [...new Set(info.topics)];
    return {
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      color: getSpeakerColor(name).bg,
      speakCount: info.texts.length,
      totalDuration,
      avgDuration: info.texts.length ? Math.round(totalDuration / info.texts.length) : 0,
      keywords: extractKeywords(info.texts),
      topics: uniqueTopics,
      mainInteraction: mode(info.interactions) || '--',
      group: Math.floor(i / 3),
      avgSpeechRate,
      avgVolume,
      gender: info.gender,
    };
  });

  const nameToId = new Map<string, string>();
  nodes.forEach((n) => nameToId.set(n.name, n.id));

  // ── 2. Each AnnotatedRecord → SpeechEvent ──

  let ts = 0;
  const hasRealTimestamps = records.some((r) => r.startTimeSec && r.startTimeSec > 0);
  const events: SpeechEvent[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const sourceName = r.speaker || '未知';
    const sourceId = nameToId.get(sourceName) ?? sourceName;
    const targetName = r.targetSpeaker || '';
    let targetId = nameToId.get(targetName) ?? '';

    if (!targetId || targetId === sourceId) {
      const others = nodes.filter((n) => n.id !== sourceId);
      targetId = others.length > 0
        ? others[Math.floor(Math.random() * others.length)].id
        : sourceId;
    }

    const rawEmotion = r.emotion || r.asrEmotion || '平静';
    const mood: Mood = EMOTION_MAP[rawEmotion] ?? 'calm';
    const duration = r.durationSec ?? estimateDuration(r.text);
    const interactionStr = (r.interactionType ?? '').toString();
    const isInterrupted = interactionStr.includes('打断')
      || interactionStr.toLowerCase() === 'yes';

    let interruptedBy: string | undefined;
    if (isInterrupted && i + 1 < records.length) {
      const nextSpeaker = records[i + 1].speaker || '未知';
      interruptedBy = nameToId.get(nextSpeaker);
    }

    if (hasRealTimestamps && r.startTimeSec) {
      ts = r.startTimeSec * 1000;
    } else {
      ts += 1500 + Math.random() * 1000;
    }

    events.push({
      id: `evt-${i}`,
      source: sourceId,
      target: targetId,
      duration,
      mood,
      interrupted: isInterrupted,
      interruptedBy,
      timestamp: ts,
      speechRate: r.speechRate,
      volume: r.volume,
      topic: r.topic,
      isTurningPoint: r.isTurningPoint,
      detailedInteraction: r.detailedInteraction,
    });
  }

  // ── 3. Compute aggregated edges ──

  const aggregatedEdges = computeAggregatedEdges(events);

  return { nodes, events, aggregatedEdges };
}

// ── Mock data: realistic Chinese meeting scenario ──

const MOCK_ANNOTATED: AnnotatedRecord[] = [
  { record_id: 'm-0', index: 0, speaker: '阿林', text: '大家都到了吧？咱们开始讨论新功能的方案', timestamp: '00:00:00', startTimeSec: 0, endTimeSec: 5.2, durationSec: 5.2, emotion: 'Neutral', gender: '男', speechRate: 3.8, volume: 62, targetSpeaker: '小夏', detailedInteraction: '提问', topic: '方案讨论' },
  { record_id: 'm-1', index: 1, speaker: '小夏', text: '到了到了。我觉得这次要重点优化录音页面的体验', timestamp: '00:00:06', startTimeSec: 6, endTimeSec: 11.5, durationSec: 5.5, emotion: 'Positive', gender: '女', speechRate: 4.2, volume: 58, targetSpeaker: '阿林', detailedInteraction: '回应', topic: '录音体验' },
  { record_id: 'm-2', index: 2, speaker: '大鹏', text: '同意。但我更关心数据分析那块，图表加载太慢了', timestamp: '00:00:12', startTimeSec: 12, endTimeSec: 17.8, durationSec: 5.8, emotion: 'Negative', gender: '男', speechRate: 3.5, volume: 65, targetSpeaker: '小夏', detailedInteraction: '反驳', topic: '性能优化' },
  { record_id: 'm-3', index: 3, speaker: 'Mia', text: '加载慢可能是后端接口的问题，不一定是前端', timestamp: '00:00:18', startTimeSec: 18.5, endTimeSec: 23, durationSec: 4.5, emotion: 'Neutral', gender: '女', speechRate: 4.0, volume: 55, targetSpeaker: '大鹏', detailedInteraction: '补充', topic: '性能优化' },
  { record_id: 'm-4', index: 4, speaker: '大鹏', text: '不是，我测了，后端响应很快，是渲染 3D 可视化卡的', timestamp: '00:00:24', startTimeSec: 24, endTimeSec: 30.2, durationSec: 6.2, emotion: 'Negative', gender: '男', speechRate: 4.5, volume: 70, targetSpeaker: 'Mia', detailedInteraction: '反驳', topic: '性能优化' },
  { record_id: 'm-5', index: 5, speaker: '阿林', text: '那这样，我们分两步：先解决性能，再加新功能', timestamp: '00:00:31', startTimeSec: 31, endTimeSec: 36.5, durationSec: 5.5, emotion: 'Neutral', gender: '男', speechRate: 3.6, volume: 63, targetSpeaker: '大鹏', detailedInteraction: '总结', topic: '方案讨论', isTurningPoint: true },
  { record_id: 'm-6', index: 6, speaker: '小夏', text: '等等，我还没说完呢。录音页面的问题是用户不知道怎么操作', timestamp: '00:00:37', startTimeSec: 37, endTimeSec: 43.8, durationSec: 6.8, emotion: 'Negative', gender: '女', speechRate: 4.8, volume: 68, targetSpeaker: '阿林', interactionType: '打断', detailedInteraction: '打断', topic: '录音体验' },
  { record_id: 'm-7', index: 7, speaker: '阿林', text: '好好好，你说你说', timestamp: '00:00:44', startTimeSec: 44.5, endTimeSec: 46.5, durationSec: 2.0, emotion: 'Neutral', gender: '男', speechRate: 5.0, volume: 50, targetSpeaker: '小夏', detailedInteraction: '回应', topic: '录音体验' },
  { record_id: 'm-8', index: 8, speaker: '小夏', text: '我们应该加一个引导教程，新用户第一次打开的时候自动弹出', timestamp: '00:00:47', startTimeSec: 47, endTimeSec: 54, durationSec: 7.0, emotion: 'Positive', gender: '女', speechRate: 4.3, volume: 60, targetSpeaker: '阿林', detailedInteraction: '提问', topic: '引导教程' },
  { record_id: 'm-9', index: 9, speaker: 'Mia', text: '这个好！我之前也想过，可以做成卡片式的步骤引导', timestamp: '00:00:55', startTimeSec: 55, endTimeSec: 61, durationSec: 6.0, emotion: 'Positive', gender: '女', speechRate: 4.1, volume: 64, targetSpeaker: '小夏', detailedInteraction: '补充', topic: '引导教程' },
  { record_id: 'm-10', index: 10, speaker: '大鹏', text: '引导教程优先级没那么高吧，性能问题更紧急', timestamp: '00:01:02', startTimeSec: 62, endTimeSec: 67.5, durationSec: 5.5, emotion: 'Negative', gender: '男', speechRate: 3.8, volume: 72, targetSpeaker: '小夏', detailedInteraction: '反驳', topic: '优先级' },
  { record_id: 'm-11', index: 11, speaker: '小夏', text: '我不同意！用户留存才是关键，连怎么用都不知道还谈什么性能', timestamp: '00:01:08', startTimeSec: 68, endTimeSec: 75.5, durationSec: 7.5, emotion: 'Negative', gender: '女', speechRate: 5.2, volume: 75, targetSpeaker: '大鹏', interactionType: '打断', detailedInteraction: '打断', topic: '优先级', isTurningPoint: true },
  { record_id: 'm-12', index: 12, speaker: '阿林', text: '冷静冷静。两个都重要，我们排个优先级', timestamp: '00:01:16', startTimeSec: 76, endTimeSec: 81, durationSec: 5.0, emotion: 'Neutral', gender: '男', speechRate: 3.4, volume: 58, targetSpeaker: '小夏', detailedInteraction: '总结', topic: '优先级' },
  { record_id: 'm-13', index: 13, speaker: 'Mia', text: '要不这样：大鹏先搞性能优化，小夏和我做引导教程，并行推进', timestamp: '00:01:22', startTimeSec: 82, endTimeSec: 90, durationSec: 8.0, emotion: 'Positive', gender: '女', speechRate: 4.0, volume: 60, targetSpeaker: '阿林', detailedInteraction: '补充', topic: '分工', isTurningPoint: true },
  { record_id: 'm-14', index: 14, speaker: '大鹏', text: '可以。那 3D 可视化这边我大概需要三天', timestamp: '00:01:31', startTimeSec: 91, endTimeSec: 96, durationSec: 5.0, emotion: 'Neutral', gender: '男', speechRate: 3.6, volume: 62, targetSpeaker: 'Mia', detailedInteraction: '回应', topic: '分工' },
  { record_id: 'm-15', index: 15, speaker: '小夏', text: '好的，那我们这边也同步开始。Mia 你画原型，我写交互逻辑？', timestamp: '00:01:37', startTimeSec: 97, endTimeSec: 104, durationSec: 7.0, emotion: 'Positive', gender: '女', speechRate: 4.5, volume: 59, targetSpeaker: 'Mia', detailedInteraction: '提问', topic: '分工' },
  { record_id: 'm-16', index: 16, speaker: 'Mia', text: '没问题，今晚就出初稿', timestamp: '00:01:45', startTimeSec: 105, endTimeSec: 108.5, durationSec: 3.5, emotion: 'Positive', gender: '女', speechRate: 4.0, volume: 56, targetSpeaker: '小夏', detailedInteraction: '回应', topic: '分工' },
  { record_id: 'm-17', index: 17, speaker: '阿林', text: '太好了。那我来协调资源，周三我们再同步一次进度', timestamp: '00:01:49', startTimeSec: 109, endTimeSec: 116, durationSec: 7.0, emotion: 'Positive', gender: '男', speechRate: 3.9, volume: 64, targetSpeaker: '小夏', detailedInteraction: '总结', topic: '分工' },
  { record_id: 'm-18', index: 18, speaker: '大鹏', text: '等一下，还有个问题。Google Sheet 的 AI 公式延迟挺大的，要不要换方案？', timestamp: '00:01:57', startTimeSec: 117, endTimeSec: 125, durationSec: 8.0, emotion: 'Neutral', gender: '男', speechRate: 4.2, volume: 66, targetSpeaker: '阿林', detailedInteraction: '提问', topic: '技术方案' },
  { record_id: 'm-19', index: 19, speaker: '阿林', text: '这个后面再讨论。今天先把分工定下来，散会！', timestamp: '00:02:06', startTimeSec: 126, endTimeSec: 132, durationSec: 6.0, emotion: 'Positive', gender: '男', speechRate: 4.0, volume: 68, targetSpeaker: '大鹏', detailedInteraction: '总结', topic: '方案讨论' },
];

export function getMockStormData(): TransformedStormData {
  return transformAnnotatedToStorm(MOCK_ANNOTATED);
}

export { MOCK_ANNOTATED };
