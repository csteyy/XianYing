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
}

export const MOOD_COLORS: Record<Mood, string> = {
  positive: '#22c55e',
  negative: '#ef4444',
  calm: '#3b82f6',
};

const SPEAKER_COLORS = [
  '#f59e0b',
  '#3b82f6',
  '#22c55e',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#f97316',
  '#14b8a6',
  '#a855f7',
];

const SPEAKER_DEFS: Omit<StormNode, 'group'>[] = [
  {
    id: 'alice',
    name: 'Alice',
    color: SPEAKER_COLORS[0],
    speakCount: 18,
    totalDuration: 540,
    avgDuration: 30,
    keywords: ['创新', '设计', '用户体验', '迭代'],
    topics: ['产品设计', '用户研究'],
    mainInteraction: '提问、引导讨论',
  },
  {
    id: 'bob',
    name: 'Bob',
    color: SPEAKER_COLORS[1],
    speakCount: 14,
    totalDuration: 630,
    avgDuration: 45,
    keywords: ['技术', '架构', '性能', '微服务'],
    topics: ['系统架构', '技术选型'],
    mainInteraction: '陈述、深入解释',
  },
  {
    id: 'charlie',
    name: 'Charlie',
    color: SPEAKER_COLORS[2],
    speakCount: 22,
    totalDuration: 550,
    avgDuration: 25,
    keywords: ['优化', '测试', '质量', '流程'],
    topics: ['质量保障', '流程改进'],
    mainInteraction: '反馈、建设性建议',
  },
  {
    id: 'diana',
    name: 'Diana',
    color: SPEAKER_COLORS[3],
    speakCount: 10,
    totalDuration: 450,
    avgDuration: 45,
    keywords: ['战略', '市场', '竞品', '定位'],
    topics: ['市场分析', '商业策略'],
    mainInteraction: '分析、总结',
  },
  {
    id: 'eve',
    name: 'Eve',
    color: SPEAKER_COLORS[4],
    speakCount: 16,
    totalDuration: 400,
    avgDuration: 25,
    keywords: ['数据', '指标', '增长', 'A/B测试'],
    topics: ['数据分析', '增长策略'],
    mainInteraction: '数据驱动论证',
  },
  {
    id: 'frank',
    name: 'Frank',
    color: SPEAKER_COLORS[5],
    speakCount: 12,
    totalDuration: 360,
    avgDuration: 30,
    keywords: ['协作', '排期', '资源', '里程碑'],
    topics: ['项目管理', '团队协作'],
    mainInteraction: '协调、推进',
  },
  {
    id: 'grace',
    name: 'Grace',
    color: SPEAKER_COLORS[6],
    speakCount: 8,
    totalDuration: 280,
    avgDuration: 35,
    keywords: ['品牌', '调性', '视觉', '一致性'],
    topics: ['品牌设计', '视觉规范'],
    mainInteraction: '提出观点、审美判断',
  },
  {
    id: 'hank',
    name: 'Hank',
    color: SPEAKER_COLORS[7],
    speakCount: 20,
    totalDuration: 500,
    avgDuration: 25,
    keywords: ['安全', '合规', '风控', '审计'],
    topics: ['信息安全', '合规治理'],
    mainInteraction: '提醒风险、质疑',
  },
  {
    id: 'ivy',
    name: 'Ivy',
    color: SPEAKER_COLORS[8],
    speakCount: 11,
    totalDuration: 330,
    avgDuration: 30,
    keywords: ['运营', '留存', '转化', '漏斗'],
    topics: ['用户运营', '转化优化'],
    mainInteraction: '案例分享、经验总结',
  },
  {
    id: 'jack',
    name: 'Jack',
    color: SPEAKER_COLORS[9],
    speakCount: 9,
    totalDuration: 270,
    avgDuration: 30,
    keywords: ['前端', '动画', '交互', '组件'],
    topics: ['前端开发', '交互实现'],
    mainInteraction: '技术细节讨论',
  },
];

export const stormNodes: StormNode[] = SPEAKER_DEFS.map((s, i) => ({
  ...s,
  group: Math.floor(i / 3),
}));

const nodeIds = stormNodes.map((n) => n.id);
const moods: Mood[] = ['positive', 'negative', 'calm'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickOther(exclude: string): string {
  let t: string;
  do {
    t = pick(nodeIds);
  } while (t === exclude);
  return t;
}

function generateEvents(): SpeechEvent[] {
  const events: SpeechEvent[] = [];
  let ts = 0;

  const templates: Array<{
    src: string;
    tgt: string;
    mood: Mood;
    dur: number;
    intr?: { by: string };
  }> = [
    { src: 'alice', tgt: 'bob', mood: 'calm', dur: 28 },
    { src: 'bob', tgt: 'alice', mood: 'calm', dur: 42 },
    { src: 'charlie', tgt: 'eve', mood: 'positive', dur: 20 },
    { src: 'diana', tgt: 'frank', mood: 'calm', dur: 38 },
    { src: 'eve', tgt: 'charlie', mood: 'positive', dur: 15 },
    { src: 'hank', tgt: 'bob', mood: 'negative', dur: 35, intr: { by: 'bob' } },
    { src: 'frank', tgt: 'alice', mood: 'calm', dur: 22 },
    { src: 'grace', tgt: 'diana', mood: 'positive', dur: 30 },
    { src: 'alice', tgt: 'charlie', mood: 'positive', dur: 18 },
    { src: 'bob', tgt: 'hank', mood: 'negative', dur: 40 },
    { src: 'ivy', tgt: 'jack', mood: 'calm', dur: 25 },
    { src: 'jack', tgt: 'ivy', mood: 'positive', dur: 20 },
    { src: 'charlie', tgt: 'alice', mood: 'positive', dur: 15, intr: { by: 'alice' } },
    { src: 'diana', tgt: 'bob', mood: 'calm', dur: 45 },
    { src: 'eve', tgt: 'frank', mood: 'negative', dur: 30 },
    { src: 'hank', tgt: 'grace', mood: 'calm', dur: 28 },
    { src: 'frank', tgt: 'eve', mood: 'positive', dur: 22 },
    { src: 'alice', tgt: 'diana', mood: 'calm', dur: 35 },
    { src: 'bob', tgt: 'charlie', mood: 'positive', dur: 18, intr: { by: 'charlie' } },
    { src: 'grace', tgt: 'hank', mood: 'negative', dur: 25 },
    { src: 'jack', tgt: 'alice', mood: 'calm', dur: 32 },
    { src: 'ivy', tgt: 'bob', mood: 'positive', dur: 20 },
    { src: 'charlie', tgt: 'diana', mood: 'calm', dur: 28 },
    { src: 'eve', tgt: 'hank', mood: 'negative', dur: 18, intr: { by: 'hank' } },
    { src: 'alice', tgt: 'frank', mood: 'positive', dur: 22 },
    { src: 'bob', tgt: 'eve', mood: 'calm', dur: 38 },
    { src: 'hank', tgt: 'alice', mood: 'negative', dur: 30 },
    { src: 'diana', tgt: 'charlie', mood: 'positive', dur: 25 },
    { src: 'frank', tgt: 'grace', mood: 'calm', dur: 20 },
    { src: 'jack', tgt: 'charlie', mood: 'positive', dur: 15 },
  ];

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    ts += 1500 + Math.random() * 1000;
    events.push({
      id: `evt-${i}`,
      source: t.src,
      target: t.tgt,
      duration: t.dur,
      mood: t.mood,
      interrupted: !!t.intr,
      interruptedBy: t.intr?.by,
      timestamp: ts,
    });
  }

  return events;
}

export const speechEvents = generateEvents();

export function getNodeById(id: string): StormNode | undefined {
  return stormNodes.find((n) => n.id === id);
}

// ── Aggregated edges ──

export interface AggregatedEdge {
  source: string;
  target: string;
  count: number;
  dominantMood: Mood;
  avgDuration: number;
}

function computeAggregatedEdges(): AggregatedEdge[] {
  const map = new Map<
    string,
    { source: string; target: string; moods: Mood[]; durations: number[] }
  >();

  speechEvents.forEach((evt) => {
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

export const aggregatedEdges = computeAggregatedEdges();
