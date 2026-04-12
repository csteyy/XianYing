import { motion } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Users, Edit2, Check, X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { toast } from 'sonner';
import { getSpeakerColor } from '../utils/speakerColors';
import { useFileASR } from '../hooks/useFileASR';
import { canUploadAudio } from '../services/platform';
import { isGSheetsAvailable } from '../services/googleSheets/config';
import { writeTranscriptsToSheet, pollForAnnotations, triggerAnnotation, readAnnotationsFromSheet } from '../services/googleSheets/client';
import { annotateLocally } from '../services/googleSheets/annotate';
import { saveSession, type SavedSession } from '../services/sessionStore';
import { getSettings } from '../services/settingsStore';
import { generateTitleInBackground } from '../services/titleGenerator';

interface TranscriptItem {
  id: number;
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

interface SpeakerData {
  id: string;
  name: string;
  color: string;
  speechCount: number;
  gender?: string;
}

interface PostRecordingEditPageProps {
  onNavigate: (page: string, data?: any) => void;
  transcripts?: TranscriptItem[];
  speakers?: SpeakerData[];
  mode?: 'manual' | 'nfc';
  sceneName?: string;
  titleEditedByUser?: boolean;
  recordingTime?: number;
  /** WAV audio buffer from recording, used for file recognition with speaker diarization */
  wavBuffer?: ArrayBuffer | null;
  /** Streaming ASR text as fallback display */
  streamingText?: string;
}

export function PostRecordingEditPage({
  onNavigate,
  transcripts = [],
  speakers: initialSpeakers = [],
  mode = 'manual',
  sceneName: initialSceneName = '未命名标题',
  titleEditedByUser: initialTitleEdited = false,
  recordingTime = 0,
  wavBuffer,
  streamingText,
}: PostRecordingEditPageProps) {
  const [speakers, setSpeakers] = useState<SpeakerData[]>(initialSpeakers);
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>(transcripts);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [sceneName, setSceneName] = useState(initialSceneName);
  const [isEditingSceneName, setIsEditingSceneName] = useState(false);
  const [tempSceneName, setTempSceneName] = useState(initialSceneName);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const userEditedTitle = useRef(initialTitleEdited);
  const sessionIdRef = useRef(`s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);

  const fileASR = useFileASR();

  // Submit WAV to file recognition on mount for speaker-separated results
  useEffect(() => {
    if (!wavBuffer || wavBuffer.byteLength === 0) return;
    if (!canUploadAudio()) return;

    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    fileASR.submit(blob).then((result) => {
      if (!result?.result?.utterances) return;

      const formatTime = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };

      const newTranscripts: TranscriptItem[] = result.result.utterances.map((u, i) => ({
        id: Date.now() + i,
        speaker: `Speaker ${(u.speaker ?? 0) + 1}`,
        text: u.text,
        timestamp: formatTime(u.start_time),
        startTimeMs: u.start_time,
        endTimeMs: u.end_time,
        durationSec: Math.round((u.end_time - u.start_time) / 100) / 10,
        emotion: u.additions?.emotion,
        gender: u.additions?.gender,
        speechRate: u.additions?.speech_rate,
        volume: u.additions?.volume,
      }));

      const speakerAgg = new Map<string, { count: number; gender?: string }>();
      newTranscripts.forEach((t) => {
        const prev = speakerAgg.get(t.speaker);
        speakerAgg.set(t.speaker, {
          count: (prev?.count ?? 0) + 1,
          gender: t.gender || prev?.gender,
        });
      });

      const newSpeakers: SpeakerData[] = Array.from(speakerAgg.entries()).map(([name, data], i) => {
        const color = getSpeakerColor(name);
        return {
          id: `speaker${i + 1}`,
          name,
          color: color.bg,
          speechCount: data.count,
          gender: data.gender,
        };
      });

      setTranscriptItems(newTranscripts);
      setSpeakers(newSpeakers);
      toast.success('语音识别完成', { description: `识别到 ${newSpeakers.length} 位发言人` });

      if (!userEditedTitle.current) {
        setIsGeneratingTitle(true);
        const durationMin = Math.max(1, Math.round(recordingTime / 60));
        generateTitleInBackground(
          newTranscripts.map((t) => ({ speaker: t.speaker, text: t.text })),
          newSpeakers.length,
          durationMin,
          sessionIdRef.current,
        )
          .then((title) => {
            if (!userEditedTitle.current) {
              setSceneName(title);
              setTempSceneName(title);
            }
          })
          .finally(() => setIsGeneratingTitle(false));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When file ASR is not available, generate title from existing streaming transcripts
  useEffect(() => {
    if (wavBuffer && wavBuffer.byteLength > 0 && canUploadAudio()) return;
    if (transcripts.length === 0 || userEditedTitle.current) return;

    setIsGeneratingTitle(true);
    const durationMin = Math.max(1, Math.round(recordingTime / 60));
    generateTitleInBackground(
      transcripts.map((t) => ({ speaker: t.speaker, text: t.text })),
      initialSpeakers.length || 1,
      durationMin,
      sessionIdRef.current,
    )
      .then((title) => {
        if (!userEditedTitle.current) {
          setSceneName(title);
          setTempSceneName(title);
        }
      })
      .finally(() => setIsGeneratingTitle(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 开始编辑发言人名称
  const handleStartEditSpeaker = (speaker: SpeakerData) => {
    setEditingSpeakerId(speaker.id);
    setEditingName(speaker.name);
  };

  // 保存发言人名称（支持合并）
  const handleSaveSpeakerName = () => {
    if (!editingSpeakerId || !editingName.trim()) return;

    const newName = editingName.trim();
    const currentSpeaker = speakers.find(s => s.id === editingSpeakerId);
    
    if (!currentSpeaker) return;

    // 检查是否有其他发言人已经使用这个名字
    const existingSpeaker = speakers.find(s => s.name === newName && s.id !== editingSpeakerId);

    const oldName = currentSpeaker.name;

    if (existingSpeaker) {
      // 合并发言人
      setSpeakers(prev => {
        return prev
          .map(s => {
            if (s.id === existingSpeaker.id) {
              return { ...s, speechCount: s.speechCount + currentSpeaker.speechCount };
            }
            return s;
          })
          .filter(s => s.id !== editingSpeakerId);
      });

      setTranscriptItems(prev =>
        prev.map(t => t.speaker === oldName ? { ...t, speaker: newName } : t)
      );

      toast.success('发言人已合并', {
        description: `${oldName} 已合并到 ${newName}`,
      });
    } else {
      // 只是重命名
      setSpeakers(prev =>
        prev.map(s => (s.id === editingSpeakerId ? { ...s, name: newName } : s))
      );

      if (oldName !== newName) {
        setTranscriptItems(prev =>
          prev.map(t => t.speaker === oldName ? { ...t, speaker: newName } : t)
        );
        toast.success('名称已更新');
      }
    }

    setEditingSpeakerId(null);
    setEditingName('');
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingSpeakerId(null);
    setEditingName('');
  };

  // 保存场景名称
  const handleSaveSceneName = () => {
    if (tempSceneName.trim()) {
      userEditedTitle.current = true;
      setSceneName(tempSceneName.trim());
      setIsEditingSceneName(false);
      toast.success('场景名称已更新');
    }
  };

  const [syncStatus, setSyncStatus] = useState<
    'idle' | 'writing' | 'polling' | 'reading' | 'done' | 'error'
  >('idle');
  const [syncError, setSyncError] = useState('');

  const persistSession = (annotated?: any[], sheetName?: string): string => {
    const id = sessionIdRef.current;
    const { saveTranscripts } = getSettings();
    const session: SavedSession = {
      id,
      sceneName,
      mode,
      recordingTime,
      createdAt: new Date().toISOString(),
      speakers,
      transcripts: saveTranscripts ? transcriptItems : [],
      annotatedData: annotated,
      sheetName,
    };
    saveSession(session);
    return id;
  };

  const handleComplete = async () => {
    if (!isGSheetsAvailable() || transcriptItems.length === 0) {
      const rawRows = transcriptItems.map((t, i) => ({
        index: i,
        text: t.text,
        speaker: t.speaker,
        asrEmotion: t.emotion || '',
      }));
      const localAnnotations = annotateLocally(rawRows);

      const annotatedData = transcriptItems.map((t, i) => {
        const [target, emotion, interrupted, detailed, topic, turning] = localAnnotations[i];
        return {
          record_id: `t-${t.id}`,
          index: i,
          speaker: t.speaker,
          text: t.text,
          timestamp: t.timestamp,
          startTimeSec: t.startTimeMs != null ? t.startTimeMs / 1000 : undefined,
          endTimeSec: t.endTimeMs != null ? t.endTimeMs / 1000 : undefined,
          durationSec: t.durationSec,
          gender: t.gender,
          asrEmotion: t.emotion,
          speechRate: t.speechRate,
          volume: t.volume,
          emotion: emotion || t.emotion || '平静',
          interactionType: interrupted === 'Yes' ? '打断' : '',
          detailedInteraction: detailed,
          targetSpeaker: target,
          topic,
          isTurningPoint: turning === 'Yes',
          speakerColor: speakers.find((s) => s.name === t.speaker)?.color || '#888',
        };
      });
      const sid = persistSession(annotatedData);
      onNavigate('data-analysis', {
        transcripts: transcriptItems, speakers, annotatedData,
        from: 'home', sceneName, mode, recordingTime, sessionId: sid,
      });
      return;
    }

    try {
      setSyncStatus('writing');
      const sheetsPayload = transcriptItems.map((t) => ({
        speaker: t.speaker,
        text: t.text,
        timestamp: t.timestamp,
        startTimeMs: t.startTimeMs,
        endTimeMs: t.endTimeMs,
        durationSec: t.durationSec,
        emotion: t.emotion,
        gender: t.gender,
        speechRate: t.speechRate,
        volume: t.volume,
      }));
      const { sheetName } = await writeTranscriptsToSheet(sheetsPayload);
      toast.success('数据已写入 Google Sheets');

      setSyncStatus('polling');
      toast('正在等待 AI 标注，请在浏览器中打开 Google Sheet 加速计算', { duration: 10000 });
      const pollResult = await pollForAnnotations(sheetName, 5000, 180_000);

      let records = pollResult.records;
      if (pollResult.status === 'timeout') {
        toast('AI 公式未就绪，正在使用规则引擎标注...', { duration: 5000 });
        await triggerAnnotation(sheetName);
        const fallback = await readAnnotationsFromSheet(sheetName);
        records = fallback.records;
      }
      toast.success('AI 标注完成');

      setSyncStatus('reading');
      const annotatedData = records.map((r, i) => ({
        record_id: r.record_id,
        index: i,
        speaker: r.speaker,
        text: r.text,
        timestamp: transcriptItems[i]?.timestamp ?? '',
        startTimeSec: r.startTimeSec,
        endTimeSec: r.endTimeSec,
        durationSec: r.durationSec,
        gender: r.gender,
        asrEmotion: r.asrEmotion,
        speechRate: r.speechRate,
        volume: r.volume,
        emotion: r.emotion || 'Neutral',
        interactionType: r.interactionType || '',
        detailedInteraction: r.detailedInteraction || '',
        targetSpeaker: r.targetSpeaker || '',
        topic: r.topic || '',
        isTurningPoint: r.isTurningPoint ?? false,
        speakerColor: speakers.find((s) => s.name === r.speaker)?.color || '#888',
      }));

      const sid = persistSession(annotatedData, sheetName);

      setSyncStatus('done');
      onNavigate('data-analysis', {
        transcripts: transcriptItems, speakers, annotatedData,
        from: 'home', sceneName, mode, recordingTime, sessionId: sid,
      });
    } catch (err) {
      console.error('[GSheets] sync error:', err);
      setSyncStatus('error');
      setSyncError(String(err));
      toast.error('Google Sheets 同步失败', { description: String(err) });
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-full bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 py-3" style={{ minHeight: '68px' }}>
          <div className="w-11" />
          <h2 className="font-serif">会后编辑</h2>
          <div className="w-11" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 pb-20 space-y-8">
        {/* 文件识别状态 */}
        {wavBuffer && fileASR.status !== 'idle' && fileASR.status !== 'done' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {fileASR.status === 'uploading' && '正在上传音频...'}
                  {fileASR.status === 'queued' && '排队中，等待处理...'}
                  {fileASR.status === 'processing' && '正在识别语音并分析发言人...'}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  识别完成后将自动更新转录结果和发言人信息
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {fileASR.status === 'error' && (
          <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              语音文件识别失败: {fileASR.error}。当前显示的是实时识别结果。
            </p>
          </div>
        )}

        {/* 场景信息 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-foreground rounded-full" />
            <h3>场景信息</h3>
          </div>

          <div className="p-6 rounded-lg border border-border bg-card space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-muted-foreground text-sm mb-1">录制时长</p>
                <p className="font-mono text-lg">{formatTime(recordingTime)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-1">启动模式</p>
                <Badge variant="secondary">
                  {mode === 'manual' ? '手动启动' : 'NFC 触发'}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-1">对话记录</p>
                <p className="text-lg">{transcriptItems.length} 条</p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <Label>场景名称</Label>
              {isEditingSceneName ? (
                <div className="flex gap-2 mt-2">
                  <Input
                    value={tempSceneName}
                    onChange={(e) => setTempSceneName(e.target.value)}
                    placeholder="输入场景名称"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveSceneName();
                      if (e.key === 'Escape') setIsEditingSceneName(false);
                    }}
                    autoFocus
                  />
                  <Button size="icon" className="w-11 h-11" onClick={handleSaveSceneName}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="w-11 h-11"
                    onClick={() => {
                      setTempSceneName(sceneName);
                      setIsEditingSceneName(false);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 px-3 py-2 rounded-md bg-muted/50 border border-border">
                    {isGeneratingTitle ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        标题生成中…
                      </span>
                    ) : (
                      <span>{sceneName}</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditingSceneName(true);
                      setTempSceneName(sceneName);
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* 发言人管理 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-foreground rounded-full" />
            <h3>发言人管理</h3>
            <Badge variant="secondary" className="ml-2">
              <Users className="w-3 h-3 mr-1" />
              {speakers.length} 人
            </Badge>
          </div>

          <div className="space-y-3">
            {speakers.map((speaker, index) => {
              const speakerColor = getSpeakerColor(speaker.name);
              return (
                <motion.div
                  key={speaker.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className="p-4 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center font-medium"
                      style={{ 
                        backgroundColor: speakerColor.bg,
                        color: speakerColor.text
                      }}
                    >
                      {speaker.name.charAt(0)}
                    </div>

                    {editingSpeakerId === speaker.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="输入发言人姓名"
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveSpeakerName();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          autoFocus
                        />
                        <Button size="icon" className="w-11 h-11" onClick={handleSaveSpeakerName}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="w-11 h-11" onClick={handleCancelEdit}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{speaker.name}</p>
                            {speaker.gender && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                {speaker.gender === 'male' ? '男' : '女'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {speaker.speechCount} 次发言
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEditSpeaker(speaker)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          编辑
                        </Button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <p className="text-sm text-muted-foreground leading-relaxed">
              💡 提示：点击"编辑"可以修改发言人姓名。如果将两个发言人的姓名改为相同，系统会自动合并他们的发言记录。
            </p>
          </div>
        </motion.div>

        {/* 对话预览 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-foreground rounded-full" />
            <h3>对话预览</h3>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="max-h-96 overflow-y-auto p-4 space-y-3">
              {transcriptItems.slice(0, 10).map((item, index) => {
                const speakerColor = getSpeakerColor(item.speaker);
                return (
                  <div key={item.id} className="flex gap-3">
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                      style={{ 
                        backgroundColor: speakerColor.bg,
                        color: speakerColor.text
                      }}
                    >
                      {item.speaker.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-sm">{item.speaker}</span>
                        <span className="text-muted-foreground text-xs">{item.timestamp}</span>
                        {item.durationSec != null && (
                          <span className="text-muted-foreground text-xs">{item.durationSec}s</span>
                        )}
                        {item.gender && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {item.gender === 'male' ? '男' : '女'}
                          </Badge>
                        )}
                        {item.emotion && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                            {item.emotion}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                );
              })}
              {transcriptItems.length > 10 && (
                <p className="text-center text-muted-foreground text-sm py-2">
                  还有 {transcriptItems.length - 10} 条对话记录...
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Google Sheets sync status */}
      {syncStatus !== 'idle' && syncStatus !== 'done' && (
        <div className="max-w-2xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 mb-4"
          >
            <div className="flex items-center gap-3">
              {syncStatus !== 'error' && (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {syncStatus === 'writing' && '正在写入 Google Sheets...'}
                  {syncStatus === 'polling' && '等待 AI 标注中（每 5 秒检查一次）...'}
                  {syncStatus === 'reading' && '正在读取标注结果...'}
                  {syncStatus === 'error' && `同步失败: ${syncError}`}
                </p>
                {syncStatus === 'polling' && (
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Google Sheets AI 正在分析对话内容，最长等待 3 分钟
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-2 bg-background/95 backdrop-blur-lg border-t border-border safe-bottom" style={{ minHeight: '68px' }}>
        <div className="max-w-2xl mx-auto">
          <Button
            onClick={handleComplete}
            className="w-full h-10"
            disabled={syncStatus !== 'idle' && syncStatus !== 'error' && syncStatus !== 'done'}
          >
            {syncStatus === 'idle' || syncStatus === 'done' || syncStatus === 'error' ? (
              <>
                完成编辑，查看数据分析
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                AI 标注处理中...
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}