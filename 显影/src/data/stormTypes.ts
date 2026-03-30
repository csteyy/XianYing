export type Mood = 'positive' | 'negative' | 'calm';

export interface StormNode {
  id: string;
  name: string;
  color: string;
  speakCount: number;
  totalDuration: number;
  avgDuration: number;
  keywords: string[];
  topics: string[];
  mainInteraction: string;
  group: number;
  avgSpeechRate?: number;
  avgVolume?: number;
  gender?: string;
}

export interface SpeechEvent {
  id: string;
  source: string;
  target: string;
  duration: number;
  mood: Mood;
  interrupted: boolean;
  interruptedBy?: string;
  timestamp: number;
  speechRate?: number;
  volume?: number;
  topic?: string;
  isTurningPoint?: boolean;
  detailedInteraction?: string;
}

export const MOOD_COLORS: Record<Mood, string> = {
  positive: '#22c55e',
  negative: '#ef4444',
  calm: '#3b82f6',
};

export interface AggregatedEdge {
  source: string;
  target: string;
  count: number;
  dominantMood: Mood;
  avgDuration: number;
}

export function computeAggregatedEdges(events: SpeechEvent[]): AggregatedEdge[] {
  const map = new Map<
    string,
    { source: string; target: string; moods: Mood[]; durations: number[] }
  >();

  events.forEach((evt) => {
    const key = [evt.source, evt.target].sort().join('|');
    if (!map.has(key)) {
      const [a, b] = key.split('|');
      map.set(key, { source: a, target: b, moods: [], durations: [] });
    }
    const entry = map.get(key)!;
    entry.moods.push(evt.mood);
    entry.durations.push(evt.duration);
  });

  return Array.from(map.values()).map((e) => {
    const moodCounts: Record<Mood, number> = { positive: 0, negative: 0, calm: 0 };
    e.moods.forEach((m) => moodCounts[m]++);
    const dominantMood = (Object.entries(moodCounts) as [Mood, number][]).sort(
      (a, b) => b[1] - a[1],
    )[0][0];
    const avgDuration =
      e.durations.reduce((s, d) => s + d, 0) / e.durations.length;
    return {
      source: e.source,
      target: e.target,
      count: e.moods.length,
      dominantMood,
      avgDuration,
    };
  });
}
