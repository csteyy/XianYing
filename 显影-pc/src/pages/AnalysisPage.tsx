import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Sparkles, Users, MessageSquare, Zap } from 'lucide-react';
import type { AnnotatedRecord } from '@mobile/utils/transformAnnotatedToStorm';
import { extractKeywords } from '@mobile/utils/transformAnnotatedToStorm';
import { getSpeakerColor } from '@mobile/utils/speakerColors';

interface AnalysisPageProps {
  onNavigate: (page: string, data?: any) => void;
  pageData?: any;
}

const MOOD_MAP: Record<string, string> = {
  Positive: '积极', positive: '积极', happy: '积极',
  Negative: '消极', negative: '消极', angry: '消极', sad: '消极',
  Neutral: '平静', neutral: '平静', calm: '平静',
  '正面': '积极', '负面': '消极', '中性': '平静',
};

function normalizeMood(raw?: string): string {
  if (!raw) return '平静';
  return MOOD_MAP[raw.trim()] ?? raw;
}

function mode(arr: string[]): string | undefined {
  if (arr.length === 0) return undefined;
  const freq = new Map<string, number>();
  for (const v of arr) freq.set(v, (freq.get(v) ?? 0) + 1);
  let best = '';
  let max = 0;
  for (const [k, c] of freq) { if (c > max) { best = k; max = c; } }
  return best;
}

const MOOD_COLORS: Record<string, string> = {
  '积极': 'var(--color-positive)',
  '平静': 'var(--color-accent)',
  '消极': 'var(--color-negative)',
};

export function AnalysisPage({ onNavigate, pageData }: AnalysisPageProps) {
  const [activePanel, setActivePanel] = useState<'participants' | 'speeches' | 'events'>('participants');
  const [speakerFilter, setSpeakerFilter] = useState('all');

  const annotatedData: AnnotatedRecord[] | undefined = pageData?.annotatedData;
  const transcripts = pageData?.transcripts;
  const speakers = pageData?.speakers;
  const sessionId = pageData?.sessionId;
  const readOnly = pageData?.readOnly;
  const from = pageData?.from;

  const hasAnnotated = !!(annotatedData && annotatedData.length > 0);
  const hasTranscripts = !!(transcripts && transcripts.length > 0);

  const participants = hasAnnotated ? buildParticipants(annotatedData) : hasTranscripts ? buildFromTranscripts(transcripts, speakers) : [];
  const speeches = hasAnnotated
    ? annotatedData.map(r => ({ speaker: r.speaker, text: r.text, mood: normalizeMood(r.emotion), time: r.timestamp, interaction: (r as any).detailedInteraction || '', topic: (r as any).topic || '', target: r.targetSpeaker || 'All' }))
    : hasTranscripts
      ? transcripts.map((t: any) => ({ speaker: t.speaker, text: t.text, mood: normalizeMood(t.emotion), time: t.timestamp, interaction: '', topic: '', target: 'All' }))
      : [];

  const turningPoints = hasAnnotated
    ? annotatedData.filter(r => (r as any).isTurningPoint).map(r => ({ time: r.timestamp, trigger: r.speaker, impact: `${normalizeMood(r.emotion)} — ${r.text.slice(0, 50)}`, topic: (r as any).topic || '' }))
    : [];

  const filteredSpeeches = speakerFilter === 'all' ? speeches : speeches.filter((s: any) => s.speaker === speakerFilter);

  const panels = [
    { id: 'participants' as const, label: '参与者', icon: Users, count: participants.length },
    { id: 'speeches' as const, label: '发言', icon: MessageSquare, count: speeches.length },
    { id: 'events' as const, label: '转折点', icon: Zap, count: turningPoints.length },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 h-14 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <button onClick={() => {
            if (from === 'gallery') onNavigate('gallery');
            else if (from === 'dashboard') onNavigate('dashboard');
            else onNavigate('history');
          }} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors">
            <ChevronLeft className="w-5 h-5 text-[var(--color-ink-muted)]" />
          </button>
          <h2 className="font-serif">数据分析{readOnly ? '（只读）' : ''}</h2>
        </div>
        {!readOnly && (
          <button
            onClick={() => onNavigate('visualization', { annotatedData, sessionId, from: 'analysis' })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--primary-foreground)] text-sm font-medium hover:brightness-110 transition-all"
          >
            <Sparkles className="w-4 h-4" /> 生成可视化
          </button>
        )}
      </div>

      {/* Body: three-column */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: panel selector */}
        <div className="w-52 shrink-0 border-r border-[var(--border)] bg-[var(--color-surface-1)] py-4 px-3 space-y-1">
          {panels.map(p => {
            const Icon = p.icon;
            const active = activePanel === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePanel(p.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? 'bg-[var(--color-accent-glow)] text-[var(--color-accent)]' : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{p.label}</span>
                <span className="text-xs tabular-nums opacity-60">{p.count}</span>
              </button>
            );
          })}

          {activePanel === 'speeches' && (
            <div className="pt-3 mt-3 border-t border-[var(--border)]">
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-ink-faint)] px-3 mb-2">筛选</p>
              <select
                value={speakerFilter}
                onChange={e => setSpeakerFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--border)] text-xs focus:outline-none"
              >
                <option value="all">全部发言者</option>
                {participants.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Right: content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {activePanel === 'participants' && participants.map((p, i) => {
            const sc = getSpeakerColor(p.name);
            return (
              <motion.div key={p.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="p-5 rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)] space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">发言 {p.speakCount} 次 · 平均 {p.avgDuration}s</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><p className="text-[var(--color-ink-faint)] text-xs mb-1">互动类型</p><p>{p.mainInteraction}</p></div>
                  <div><p className="text-[var(--color-ink-faint)] text-xs mb-1">他人反应</p><p>{p.reactions}</p></div>
                  {p.mainTopic && <div><p className="text-[var(--color-ink-faint)] text-xs mb-1">主要话题</p><p>{p.mainTopic}</p></div>}
                </div>
                {p.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.keywords.map(kw => (
                      <span key={kw} className="px-2 py-0.5 rounded-md bg-[var(--color-surface-2)] text-xs text-[var(--color-ink-muted)]">{kw}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}

          {activePanel === 'speeches' && filteredSpeeches.map((s: any, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)]"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{s.speaker}</span>
                  <span className="text-[var(--color-ink-faint)]">→ {s.target}</span>
                </div>
                <span className="text-xs text-[var(--color-ink-faint)]">{s.time}</span>
              </div>
              <p className="text-sm text-[var(--color-ink)] mb-2">{s.text}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: `color-mix(in oklab, ${MOOD_COLORS[s.mood] || 'var(--color-ink-faint)'} 15%, transparent)`, color: MOOD_COLORS[s.mood] || 'var(--color-ink-faint)' }}>{s.mood}</span>
                {s.interaction && <span className="px-2 py-0.5 rounded-md bg-[var(--color-surface-2)] text-xs">{s.interaction}</span>}
                {s.topic && <span className="px-2 py-0.5 rounded-md bg-[var(--color-surface-2)] text-xs">{s.topic}</span>}
              </div>
            </motion.div>
          ))}

          {activePanel === 'events' && turningPoints.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--color-ink-faint)] text-sm">
              <Zap className="w-6 h-6 mb-2 opacity-40" />暂无气氛转折事件
            </div>
          )}
          {activePanel === 'events' && turningPoints.map((e, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="p-5 rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)]"
            >
              <div className="flex items-center justify-between mb-2">
                <h4>转折点 {i + 1}</h4>
                <span className="text-xs text-[var(--color-ink-faint)]">{e.time}</span>
              </div>
              <p className="text-sm text-[var(--color-ink-muted)] mb-1">触发者: {e.trigger}</p>
              <p className="text-sm">{e.impact}</p>
            </motion.div>
          ))}

          {((activePanel === 'participants' && participants.length === 0) ||
            (activePanel === 'speeches' && filteredSpeeches.length === 0)) && (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--color-ink-faint)] text-sm">
              暂无数据
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildParticipants(data: AnnotatedRecord[]) {
  const map = new Map<string, { count: number; totalDur: number; emotions: string[]; interactions: string[]; texts: string[]; topics: string[] }>();
  for (const r of data) {
    const name = r.speaker || '未知';
    const entry = map.get(name) ?? { count: 0, totalDur: 0, emotions: [], interactions: [], texts: [], topics: [] };
    entry.count++;
    entry.totalDur += (r as any).durationSec ?? 0;
    if (r.emotion) entry.emotions.push(normalizeMood(r.emotion));
    const interaction = (r as any).detailedInteraction || r.interactionType;
    if (interaction && interaction !== '--') entry.interactions.push(interaction);
    entry.texts.push(r.text);
    if ((r as any).topic) entry.topics.push((r as any).topic);
    map.set(name, entry);
  }
  const reactionMap = new Map<string, string[]>();
  for (const r of data) {
    const target = r.targetSpeaker;
    if (!target) continue;
    const arr = reactionMap.get(target) ?? [];
    if (r.emotion) arr.push(normalizeMood(r.emotion));
    reactionMap.set(target, arr);
  }
  return Array.from(map.entries()).map(([name, info]) => ({
    name,
    speakCount: info.count,
    avgDuration: info.count > 0 ? Math.round(info.totalDur / info.count) : 0,
    mainInteraction: mode(info.interactions) || '--',
    keywords: extractKeywords(info.texts, 4),
    reactions: mode(reactionMap.get(name) ?? []) || mode(info.emotions) || '平静',
    mainTopic: mode(info.topics) || '',
  }));
}

function buildFromTranscripts(items: any[], speakerList?: any[]) {
  const map = new Map<string, { count: number; emotions: string[]; texts: string[] }>();
  for (const t of items) {
    const entry = map.get(t.speaker) ?? { count: 0, emotions: [], texts: [] };
    entry.count++;
    if (t.emotion) entry.emotions.push(normalizeMood(t.emotion));
    entry.texts.push(t.text);
    map.set(t.speaker, entry);
  }
  return Array.from(map.entries()).map(([name, info]) => ({
    name,
    speakCount: speakerList?.find((s: any) => s.name === name)?.speechCount ?? info.count,
    avgDuration: 0,
    mainInteraction: '--',
    keywords: extractKeywords(info.texts, 4),
    reactions: mode(info.emotions) || '平静',
    mainTopic: '',
  }));
}
