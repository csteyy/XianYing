import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { getSpeakerColor } from '../utils/speakerColors';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

import type { AnnotatedRecord } from '../utils/transformAnnotatedToStorm';

interface TranscriptItem {
  id: number;
  speaker: string;
  text: string;
  timestamp: string;
  emotion?: string;
}

interface SpeakerData {
  id: string;
  name: string;
  color: string;
  speechCount: number;
}

interface DataAnalysisPageProps {
  onNavigate: (page: string, data?: any) => void;
  readOnly?: boolean;
  from?: string;
  transcripts?: TranscriptItem[];
  speakers?: SpeakerData[];
  annotatedData?: AnnotatedRecord[];
}

export function DataAnalysisPage({
  onNavigate,
  readOnly,
  from,
  transcripts,
  speakers,
  annotatedData,
}: DataAnalysisPageProps) {
  const [expandedItems, setExpandedItems] = useState<number[]>([]);
  const [speakerFilter, setSpeakerFilter] = useState('all');
  const [moodFilter, setMoodFilter] = useState('all');

  const hasAnnotated = !!(annotatedData && annotatedData.length > 0);
  const hasTranscripts = !!(transcripts && transcripts.length > 0);

  const participants = hasAnnotated
    ? buildParticipants(annotatedData)
    : hasTranscripts
      ? buildParticipantsFromTranscripts(transcripts, speakers)
      : [
          { name: 'Alice', speakCount: 12, avgDuration: 30, mainInteraction: '提问、回应', keywords: ['创新', '设计', '用户体验'], reactions: '积极认同' },
          { name: 'Bob', speakCount: 8, avgDuration: 45, mainInteraction: '陈述、解释', keywords: ['技术', '实现', '架构'], reactions: '深入讨论' },
          { name: 'Charlie', speakCount: 15, avgDuration: 25, mainInteraction: '反馈、建议', keywords: ['优化', '改进', '测试'], reactions: '建设性意见' },
        ];

  const speeches = hasAnnotated
    ? annotatedData.map((r) => ({
        speaker: r.speaker,
        receiver: r.targetSpeaker || 'All',
        duration: 0,
        mood: r.emotion || '平静',
        time: r.timestamp,
        text: r.text,
      }))
    : hasTranscripts
      ? transcripts.map((t) => ({
          speaker: t.speaker,
          receiver: 'All',
          duration: 0,
          mood: t.emotion || '平静',
          time: t.timestamp,
          text: t.text,
        }))
      : [
          { speaker: 'Alice', receiver: 'All', duration: 28, mood: '积极', time: '00:02:15' },
          { speaker: 'Bob', receiver: 'Alice', duration: 42, mood: '平静', time: '00:03:20' },
          { speaker: 'Charlie', receiver: 'Bob', duration: 22, mood: '积极', time: '00:04:55' },
          { speaker: 'Alice', receiver: 'Charlie', duration: 35, mood: '积极', time: '00:06:10' },
        ];

  const turningPoints = [
    { time: '00:05:30', trigger: 'Bob', impact: '气氛由讨论转为热烈辩论' },
    { time: '00:12:45', trigger: 'Charlie', impact: '达成共识，气氛缓和' },
  ];

  const toggleExpand = (index: number) => {
    setExpandedItems((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  const filteredSpeeches = speeches.filter((speech) => {
    if (speakerFilter !== 'all' && speech.speaker !== speakerFilter) return false;
    if (moodFilter !== 'all' && speech.mood !== moodFilter) return false;
    return true;
  });

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case '积极':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case '平静':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case '消极':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="bg-background text-foreground" style={{ minHeight: '100dvh' }}>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate(from === 'gallery' ? 'gallery' : from === 'home' ? 'home' : 'history')}
            className="w-11 h-11"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h2 className="font-serif">数据分析结果{readOnly ? '（只读）' : ''}</h2>
          <div className="w-11" />
        </div>
      </div>

      <div className="px-6 py-6 max-w-2xl mx-auto">
        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="personal">个人累计数据</TabsTrigger>
            <TabsTrigger value="speeches">单条发言详情</TabsTrigger>
            <TabsTrigger value="events">气氛转折事件</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4">
            {participants.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">暂无参与者数据</div>
            )}
            {participants.map((participant, index) => {
              const speakerColor = getSpeakerColor(participant.name);
              return (
                <motion.div
                  key={participant.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border border-border rounded-lg overflow-hidden bg-card"
                >
                  <button
                    onClick={() => toggleExpand(index)}
                    className="w-full p-4 flex items-center justify-between active:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: speakerColor.bg }}
                      >
                        <span className="font-medium" style={{ color: speakerColor.text }}>
                          {participant.name.charAt(0)}
                        </span>
                      </div>
                      <div className="text-left">
                        <h4>{participant.name}</h4>
                        <p className="text-muted-foreground">
                          发言 {participant.speakCount} 次 · 平均 {participant.avgDuration} 秒
                        </p>
                      </div>
                    </div>
                    {expandedItems.includes(index) ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>

                  <AnimatePresence>
                  {expandedItems.includes(index) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="px-4 pb-4 border-t border-border space-y-3 overflow-hidden"
                    >
                      <div className="pt-4 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-muted-foreground mb-1">主要互动类型</p>
                          <p>{participant.mainInteraction}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">他人主要反应</p>
                          <p>{participant.reactions}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-2">反复使用的词汇</p>
                        <div className="flex flex-wrap gap-2">
                          {(participant.keywords ?? []).length > 0
                            ? participant.keywords.map((keyword) => (
                                <Badge key={keyword} variant="secondary">{keyword}</Badge>
                              ))
                            : <span className="text-muted-foreground/60">暂无</span>
                          }
                        </div>
                      </div>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </TabsContent>

          <TabsContent value="speeches" className="space-y-4">
            <div className="flex gap-3 mb-4">
              <Select value={speakerFilter} onValueChange={setSpeakerFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="筛选发言者" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部发言者</SelectItem>
                  {participants.map((p) => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={moodFilter} onValueChange={setMoodFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="筛选情绪" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部情绪</SelectItem>
                  <SelectItem value="积极">积极</SelectItem>
                  <SelectItem value="平静">平静</SelectItem>
                  <SelectItem value="消极">消极</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredSpeeches.map((speech, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-lg border border-border bg-card active:border-primary/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{speech.speaker}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-muted-foreground">{speech.receiver}</span>
                  </div>
                  <span className="text-muted-foreground">{speech.time}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">时长: {speech.duration}s</span>
                  <Badge className={getMoodColor(speech.mood)}>
                    {speech.mood}
                  </Badge>
                </div>
              </motion.div>
            ))}

            {filteredSpeeches.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                没有符合条件的记录
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            {turningPoints.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">暂无气氛转折事件</div>
            )}
            {turningPoints.map((event, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 rounded-lg border border-border bg-card active:border-primary/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4>转折点 {index + 1}</h4>
                  <span className="text-muted-foreground">{event.time}</span>
                </div>
                <p className="text-muted-foreground mb-1">触发者: {event.trigger}</p>
                <p>{event.impact}</p>
              </motion.div>
            ))}
          </TabsContent>
        </Tabs>

        {/* Call to Action - Generate Visualization (hidden in readOnly mode) */}
        {!readOnly && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 mb-20 p-6 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/20">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="mb-2">准备好生成艺术作品了吗？</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  基于上述数据分析，我们可以生成粒子系统和光束网络的可视化艺术作品，将对话数据转化为动态的视觉呈现。
                </p>
                <Button onClick={() => onNavigate('visualization', { annotatedData: annotatedData || transcriptsToAnnotated(transcripts, speakers) })} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  进入可视化设置
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build participant summary from Feishu annotated records
// ---------------------------------------------------------------------------

function buildParticipants(data: AnnotatedRecord[]) {
  const map = new Map<string, { count: number; totalDur: number; emotions: string[]; interactions: string[] }>();

  for (const r of data) {
    const name = r.speaker || '未知';
    const entry = map.get(name) ?? { count: 0, totalDur: 0, emotions: [], interactions: [] };
    entry.count++;
    entry.totalDur += r.durationSec ?? 0;
    if (r.emotion) entry.emotions.push(r.emotion);
    const interaction = r.detailedInteraction || r.interactionType;
    if (interaction) entry.interactions.push(interaction);
    map.set(name, entry);
  }

  return Array.from(map.entries()).map(([name, info]) => {
    const topEmotion = mode(info.emotions) || '平静';
    const topInteraction = mode(info.interactions) || '--';
    return {
      name,
      speakCount: info.count,
      avgDuration: info.count > 0 ? Math.round(info.totalDur / info.count) : 0,
      mainInteraction: topInteraction,
      keywords: [] as string[],
      reactions: topEmotion,
    };
  });
}

function mode(arr: string[]): string | undefined {
  if (arr.length === 0) return undefined;
  const freq = new Map<string, number>();
  for (const v of arr) freq.set(v, (freq.get(v) ?? 0) + 1);
  let best = '';
  let max = 0;
  for (const [k, c] of freq) {
    if (c > max) { best = k; max = c; }
  }
  return best;
}

function buildParticipantsFromTranscripts(
  items: TranscriptItem[],
  speakerList?: SpeakerData[],
) {
  const map = new Map<string, { count: number; emotions: string[] }>();
  for (const t of items) {
    const entry = map.get(t.speaker) ?? { count: 0, emotions: [] };
    entry.count++;
    if (t.emotion) entry.emotions.push(t.emotion);
    map.set(t.speaker, entry);
  }
  return Array.from(map.entries()).map(([name, info]) => {
    const sp = speakerList?.find((s) => s.name === name);
    return {
      name,
      speakCount: sp?.speechCount ?? info.count,
      avgDuration: 0,
      mainInteraction: '--',
      keywords: [] as string[],
      reactions: mode(info.emotions) || '平静',
    };
  });
}

function transcriptsToAnnotated(
  items?: TranscriptItem[],
  speakerList?: SpeakerData[],
): AnnotatedRecord[] | undefined {
  if (!items || items.length === 0) return undefined;
  return items.map((t, i) => {
    const sp = speakerList?.find((s) => s.name === t.speaker);
    return {
      record_id: `t-${t.id}`,
      index: i,
      speaker: t.speaker,
      text: t.text,
      timestamp: t.timestamp,
      emotion: t.emotion || '平静',
      interactionType: '--',
      targetSpeaker: '',
      speakerColor: sp?.color || '#888',
    } as AnnotatedRecord;
  });
}