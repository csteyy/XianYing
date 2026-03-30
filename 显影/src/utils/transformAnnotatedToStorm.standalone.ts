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

export interface StormNode {
  id: string;
  label: string;
  speakCount: number;
  totalDuration: number;
  avgDuration: number;
  keywords: string[];
  gender?: string;
}

export interface SpeechEvent {
  source: string;
  target: string;
  emotion: string;
  duration: number;
  interrupted: boolean;
  interruptedBy?: string;
  text: string;
}

export interface AggregatedEdge {
  source: string;
  target: string;
  count: number;
  avgDuration: number;
  dominantEmotion: string;
}

export interface StormData {
  nodes: StormNode[];
  events: SpeechEvent[];
  edges: AggregatedEdge[];
}

const EMOTION_MAP: Record<string, string> = {
  '积极': 'positive',
  '消极': 'negative',
  '平静': 'calm',
  Positive: 'positive',
  Negative: 'negative',
  Neutral: 'calm',
  positive: 'positive',
  negative: 'negative',
  neutral: 'calm',
  calm: 'calm',
  surprise: 'positive',
  sad: 'negative',
  happy: 'positive',
  angry: 'negative',
};

export function mapEmotion(raw?: string): string {
  if (!raw) return 'calm';
  return EMOTION_MAP[raw.trim()] ?? 'calm';
}

export function transformAnnotatedToStorm(records: AnnotatedRecord[]): StormData {
  const speakerMap = new Map<string, { texts: string[]; durations: number[]; gender?: string }>();

  const events: SpeechEvent[] = records.map((r) => {
    const duration = r.durationSec ?? Math.max(1, Math.round(r.text.length / 4));
    const emotion = mapEmotion(r.emotion);
    const interrupted = (r.interactionType ?? '').includes('打断');

    if (!speakerMap.has(r.speaker)) {
      speakerMap.set(r.speaker, { texts: [], durations: [] });
    }
    const entry = speakerMap.get(r.speaker)!;
    entry.texts.push(r.text);
    entry.durations.push(duration);
    if (r.gender) entry.gender = r.gender;

    return {
      source: r.speaker,
      target: r.targetSpeaker || 'All',
      emotion,
      duration,
      interrupted,
      interruptedBy: interrupted ? findNextSpeaker(records, r.index, r.speaker) : undefined,
      text: r.text,
    };
  });

  const nodes: StormNode[] = Array.from(speakerMap.entries()).map(([id, data]) => {
    const totalDuration = data.durations.reduce((a, b) => a + b, 0);
    return {
      id,
      label: id,
      speakCount: data.texts.length,
      totalDuration,
      avgDuration: totalDuration / data.texts.length,
      keywords: extractKeywords(data.texts),
      gender: data.gender,
    };
  });

  const edgeKey = (s: string, t: string) => `${s}→${t}`;
  const edgeAgg = new Map<string, { source: string; target: string; emotions: string[]; durations: number[]; count: number }>();

  for (const ev of events) {
    const k = edgeKey(ev.source, ev.target);
    if (!edgeAgg.has(k)) {
      edgeAgg.set(k, { source: ev.source, target: ev.target, emotions: [], durations: [], count: 0 });
    }
    const agg = edgeAgg.get(k)!;
    agg.emotions.push(ev.emotion);
    agg.durations.push(ev.duration);
    agg.count++;
  }

  const edges: AggregatedEdge[] = Array.from(edgeAgg.values()).map((agg) => ({
    source: agg.source,
    target: agg.target,
    count: agg.count,
    avgDuration: agg.durations.reduce((a, b) => a + b, 0) / agg.count,
    dominantEmotion: mode(agg.emotions),
  }));

  return { nodes, events, edges };
}

function findNextSpeaker(records: AnnotatedRecord[], currentIndex: number, currentSpeaker: string): string | undefined {
  for (let i = currentIndex + 1; i < records.length; i++) {
    if (records[i].speaker !== currentSpeaker) return records[i].speaker;
  }
  return undefined;
}

function mode(arr: string[]): string {
  const freq = new Map<string, number>();
  for (const v of arr) freq.set(v, (freq.get(v) ?? 0) + 1);
  let best = arr[0] ?? 'calm';
  let bestCount = 0;
  for (const [k, c] of freq) {
    if (c > bestCount) { best = k; bestCount = c; }
  }
  return best;
}

function extractKeywords(texts: string[], topN = 5): string[] {
  const freq = new Map<string, number>();
  const stopwords = new Set(['的', '了', '是', '在', '我', '你', '他', '她', '它', '们', '这', '那', '就', '也', '都', '和', '不', '有', '人', '对', '说', '到', '着', '把', '让', '被', '吧', '吗', '呢', '啊', '哦', '嗯', '呀', '哈', '嘿']);

  for (const text of texts) {
    const chars = text.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '');
    for (let i = 0; i < chars.length - 1; i++) {
      const bigram = chars.slice(i, i + 2);
      if (!stopwords.has(bigram[0]) && !stopwords.has(bigram[1])) {
        freq.set(bigram, (freq.get(bigram) ?? 0) + 1);
      }
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k]) => k);
}
