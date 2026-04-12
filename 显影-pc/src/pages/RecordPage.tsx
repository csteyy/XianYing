import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Pause, Play, StopCircle, Loader2, ArrowRight, Edit2, Check, X, Users, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAudioCapture } from '@mobile/hooks/useAudioCapture';
import { useStreamingASR } from '@mobile/hooks/useStreamingASR';
import { useFileASR } from '@mobile/hooks/useFileASR';
import type { ASRUtterance } from '@mobile/services/volcengine/types';
import { canUploadAudio } from '@mobile/services/platform';
import { isGSheetsAvailable } from '@mobile/services/googleSheets/config';
import { writeTranscriptsToSheet, pollForAnnotations, triggerAnnotation, readAnnotationsFromSheet } from '@mobile/services/googleSheets/client';
import { annotateLocally } from '@mobile/services/googleSheets/annotate';
import { saveSession, type SavedSession } from '@mobile/services/sessionStore';
import { getSettings } from '@mobile/services/settingsStore';
import { generateTitle } from '@mobile/services/titleGenerator';
import { getSpeakerColor } from '@mobile/utils/speakerColors';

interface RecordPageProps {
  onNavigate: (page: string, data?: any) => void;
  pageData?: any;
}

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

type Step = 'setup' | 'recording' | 'edit';

export function RecordPage({ onNavigate }: RecordPageProps) {
  const [step, setStep] = useState<Step>('setup');
  const [selectedMode, setSelectedMode] = useState<'manual' | 'nfc'>('manual');
  const [sceneName, setSceneName] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const audioCapture = useAudioCapture();
  const streamingASR = useStreamingASR();
  const fileASR = useFileASR();

  const wavBufferRef = useRef<ArrayBuffer | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const userEditedTitle = useRef(false);

  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);
  const [speakers, setSpeakers] = useState<SpeakerData[]>([]);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'writing' | 'polling' | 'reading' | 'done' | 'error'>('idle');

  // --- Recording timer ---
  useEffect(() => {
    if (step !== 'recording' || !hasStarted || isPaused) return;
    const interval = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [step, hasStarted, isPaused]);

  // --- Auto-scroll transcript ---
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamingASR.utterances, streamingASR.text]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // --- Start recording + ASR ---
  const handleStartRecording = useCallback(async () => {
    setStep('recording');
    try {
      streamingASR.start();
      await new Promise(r => setTimeout(r, 500));
      await audioCapture.start(pcmChunk => {
        streamingASR.sendAudio(pcmChunk);
      });
      setHasStarted(true);
    } catch (err) {
      console.error('[RecordPage] Failed to start:', err);
      setStartError(err instanceof Error ? err.message : '无法启动录音');
    }
  }, [audioCapture, streamingASR]);

  // --- Pause / Resume ---
  const handleTogglePause = useCallback(async () => {
    if (isPaused) {
      await audioCapture.resume();
      setIsPaused(false);
    } else {
      audioCapture.pause();
      setIsPaused(true);
    }
  }, [isPaused, audioCapture]);

  // --- Stop recording ---
  const handleStopRecording = useCallback(() => {
    setShowStopConfirm(false);
    streamingASR.finish();
    const wav = audioCapture.stop();
    wavBufferRef.current = wav;

    const utterances = streamingASR.utterances;
    const transcripts = utterances.map((u, i) => ({
      id: Date.now() + i,
      speaker: `Speaker ${((u as any).speaker ?? 0) + 1}`,
      text: u.text,
      timestamp: formatTime(Math.floor(u.start_time / 1000)),
    }));

    const speakerSet = new Set(transcripts.map(t => t.speaker));
    const initialSpeakers = Array.from(speakerSet).map((name, i) => ({
      id: `speaker${i + 1}`,
      name,
      color: getSpeakerColor(name).bg,
      speechCount: transcripts.filter(t => t.speaker === name).length,
    }));

    setTranscriptItems(transcripts);
    setSpeakers(initialSpeakers);
    streamingASR.disconnect();
    setStep('edit');
    toast.success('录制已结束');
  }, [streamingASR, audioCapture]);

  // --- File ASR on edit mount ---
  useEffect(() => {
    if (step !== 'edit') return;
    const wav = wavBufferRef.current;
    if (!wav || wav.byteLength === 0) return;
    if (!canUploadAudio()) return;

    const blob = new Blob([wav], { type: 'audio/wav' });
    fileASR.submit(blob).then(result => {
      if (!result?.result?.utterances) return;

      const fmtTime = (ms: number) => {
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
        timestamp: fmtTime(u.start_time),
        startTimeMs: u.start_time,
        endTimeMs: u.end_time,
        durationSec: Math.round((u.end_time - u.start_time) / 100) / 10,
        emotion: u.additions?.emotion,
        gender: u.additions?.gender,
        speechRate: u.additions?.speech_rate,
        volume: u.additions?.volume,
      }));

      const speakerAgg = new Map<string, { count: number; gender?: string }>();
      newTranscripts.forEach(t => {
        const prev = speakerAgg.get(t.speaker);
        speakerAgg.set(t.speaker, { count: (prev?.count ?? 0) + 1, gender: t.gender || prev?.gender });
      });
      const newSpeakers: SpeakerData[] = Array.from(speakerAgg.entries()).map(([name, data], i) => ({
        id: `speaker${i + 1}`, name, color: getSpeakerColor(name).bg, speechCount: data.count, gender: data.gender,
      }));

      setTranscriptItems(newTranscripts);
      setSpeakers(newSpeakers);
      toast.success('语音识别完成', { description: `识别到 ${newSpeakers.length} 位发言人` });

      if (!userEditedTitle.current) {
        setIsGeneratingTitle(true);
        const durationMin = Math.max(1, Math.round(recordingTime / 60));
        generateTitle(
          newTranscripts.map(t => ({ speaker: t.speaker, text: t.text })),
          newSpeakers.length, durationMin,
        ).then(title => {
          if (!userEditedTitle.current) { setSceneName(title); }
        }).finally(() => setIsGeneratingTitle(false));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // --- Speaker editing ---
  const handleStartEditSpeaker = (speaker: SpeakerData) => {
    setEditingSpeakerId(speaker.id);
    setEditingName(speaker.name);
  };
  const handleSaveSpeakerName = () => {
    if (!editingSpeakerId || !editingName.trim()) return;
    const newName = editingName.trim();
    const currentSpeaker = speakers.find(s => s.id === editingSpeakerId);
    if (!currentSpeaker) return;
    const oldName = currentSpeaker.name;
    const existingSpeaker = speakers.find(s => s.name === newName && s.id !== editingSpeakerId);

    if (existingSpeaker) {
      setSpeakers(prev => prev.map(s => s.id === existingSpeaker.id ? { ...s, speechCount: s.speechCount + currentSpeaker.speechCount } : s).filter(s => s.id !== editingSpeakerId));
      setTranscriptItems(prev => prev.map(t => t.speaker === oldName ? { ...t, speaker: newName } : t));
      toast.success('发言人已合并', { description: `${oldName} 已合并到 ${newName}` });
    } else {
      setSpeakers(prev => prev.map(s => s.id === editingSpeakerId ? { ...s, name: newName } : s));
      if (oldName !== newName) {
        setTranscriptItems(prev => prev.map(t => t.speaker === oldName ? { ...t, speaker: newName } : t));
        toast.success('名称已更新');
      }
    }
    setEditingSpeakerId(null);
    setEditingName('');
  };

  // --- Complete editing: annotate + persist ---
  const handleCompleteEdit = async () => {
    if (transcriptItems.length === 0) {
      toast.error('没有转录数据');
      return;
    }

    const persistSession = (annotated?: any[], sheetName?: string): string => {
      const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const { saveTranscripts } = getSettings();
      const session: SavedSession = {
        id, sceneName: sceneName || '未命名会话', mode: selectedMode, recordingTime,
        createdAt: new Date().toISOString(), speakers,
        transcripts: saveTranscripts ? transcriptItems : [],
        annotatedData: annotated, sheetName,
      };
      saveSession(session);
      return id;
    };

    if (!isGSheetsAvailable() || transcriptItems.length === 0) {
      const rawRows = transcriptItems.map((t, i) => ({ index: i, text: t.text, speaker: t.speaker, asrEmotion: t.emotion || '' }));
      const localAnnotations = annotateLocally(rawRows);
      const annotatedData = transcriptItems.map((t, i) => {
        const [target, emotion, interrupted, detailed, topic, turning] = localAnnotations[i];
        return {
          record_id: `t-${t.id}`, index: i, speaker: t.speaker, text: t.text,
          timestamp: t.timestamp, startTimeSec: t.startTimeMs != null ? t.startTimeMs / 1000 : undefined,
          endTimeSec: t.endTimeMs != null ? t.endTimeMs / 1000 : undefined,
          durationSec: t.durationSec, gender: t.gender, asrEmotion: t.emotion,
          speechRate: t.speechRate, volume: t.volume,
          emotion: emotion || t.emotion || '平静',
          interactionType: interrupted === 'Yes' ? '打断' : '',
          detailedInteraction: detailed, targetSpeaker: target, topic,
          isTurningPoint: turning === 'Yes',
          speakerColor: speakers.find(s => s.name === t.speaker)?.color || '#888',
        };
      });
      const sid = persistSession(annotatedData);
      onNavigate('analysis', { transcripts: transcriptItems, speakers, annotatedData, from: 'dashboard', sceneName, mode: selectedMode, recordingTime, sessionId: sid });
      return;
    }

    try {
      setSyncStatus('writing');
      const sheetsPayload = transcriptItems.map(t => ({
        speaker: t.speaker, text: t.text, timestamp: t.timestamp,
        startTimeMs: t.startTimeMs, endTimeMs: t.endTimeMs, durationSec: t.durationSec,
        emotion: t.emotion, gender: t.gender, speechRate: t.speechRate, volume: t.volume,
      }));
      const { sheetName } = await writeTranscriptsToSheet(sheetsPayload);
      toast.success('数据已写入 Google Sheets');

      setSyncStatus('polling');
      toast('正在等待 AI 标注…', { duration: 10000 });
      const pollResult = await pollForAnnotations(sheetName, 5000, 180_000);
      let records = pollResult.records;
      if (pollResult.status === 'timeout') {
        toast('AI 公式未就绪，使用规则引擎标注…', { duration: 5000 });
        await triggerAnnotation(sheetName);
        const fallback = await readAnnotationsFromSheet(sheetName);
        records = fallback.records;
      }
      toast.success('AI 标注完成');

      setSyncStatus('reading');
      const annotatedData = records.map((r: any, i: number) => ({
        record_id: r.record_id, index: i, speaker: r.speaker, text: r.text,
        timestamp: transcriptItems[i]?.timestamp ?? '',
        startTimeSec: r.startTimeSec, endTimeSec: r.endTimeSec, durationSec: r.durationSec,
        gender: r.gender, asrEmotion: r.asrEmotion, speechRate: r.speechRate, volume: r.volume,
        emotion: r.emotion || 'Neutral', interactionType: r.interactionType || '',
        detailedInteraction: r.detailedInteraction || '', targetSpeaker: r.targetSpeaker || '',
        topic: r.topic || '', isTurningPoint: r.isTurningPoint ?? false,
        speakerColor: speakers.find(s => s.name === r.speaker)?.color || '#888',
      }));
      const sid = persistSession(annotatedData, sheetName);
      setSyncStatus('done');
      onNavigate('analysis', { transcripts: transcriptItems, speakers, annotatedData, from: 'dashboard', sceneName, mode: selectedMode, recordingTime, sessionId: sid });
    } catch (err) {
      setSyncStatus('error');
      toast.error('标注失败', { description: String(err) });
    }
  };

  // ─── Render: Setup ───
  if (step === 'setup') {
    return (
      <div className="h-full flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg space-y-8 px-6">
          <div>
            <button onClick={() => onNavigate('dashboard')} className="flex items-center gap-1 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)] transition-colors mb-6">
              <ChevronLeft className="w-4 h-4" /> 返回工作台
            </button>
            <h1 className="font-serif">新建录制</h1>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">设置录制参数后开始</p>
          </div>
          <div className="space-y-4">
            <label className="block text-sm text-[var(--color-ink-muted)]">场景名称</label>
            <input value={sceneName} onChange={e => { setSceneName(e.target.value); userEditedTitle.current = true; }}
              placeholder="例如：产品评审会、头脑风暴..."
              className="w-full px-4 py-3 rounded-lg bg-[var(--color-surface-1)] border border-[var(--border)] text-sm placeholder:text-[var(--color-ink-faint)] focus:outline-none focus:border-[var(--color-accent-dim)] transition-colors" />
          </div>
          <div className="space-y-3">
            <label className="block text-sm text-[var(--color-ink-muted)]">启动模式</label>
            <div className="grid grid-cols-2 gap-3">
              {([{ id: 'manual' as const, label: '手动启动', desc: '点击按钮开始录制' }, { id: 'nfc' as const, label: 'NFC 触发', desc: '通过 NFC 标签触发' }]).map(mode => (
                <button key={mode.id} onClick={() => setSelectedMode(mode.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${selectedMode === mode.id ? 'border-[var(--color-accent)] bg-[var(--color-accent-glow)]' : 'border-[var(--border)] bg-[var(--color-surface-1)] hover:border-[var(--color-ink-faint)]'}`}>
                  <p className="text-sm font-medium">{mode.label}</p>
                  <p className="text-xs text-[var(--color-ink-faint)] mt-1">{mode.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleStartRecording} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg btn-primary font-medium focus-ring">
            <Mic className="w-4 h-4" /> 开始录制
          </button>
        </motion.div>
      </div>
    );
  }

  // ─── Render: Recording error ───
  if (startError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-md space-y-6 text-center px-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-negative)]/10 flex items-center justify-center">
            <MicOff className="w-8 h-8 text-[var(--color-negative)]" />
          </div>
          <h3>录音启动失败</h3>
          <p className="text-sm text-[var(--color-ink-muted)]">{startError}</p>
          <button onClick={() => { setStartError(null); setStep('setup'); }} className="px-6 py-2 rounded-lg btn-primary text-sm font-medium">返回</button>
        </div>
      </div>
    );
  }

  // ─── Render: Recording ───
  if (step === 'recording') {
    const isActive = hasStarted && !isPaused;
    const displayUtterances = streamingASR.utterances.filter(u => u.definite);
    const currentText = (() => {
      const definiteTexts = displayUtterances.map(u => u.text);
      const fullText = streamingASR.text;
      const definiteConcat = definiteTexts.join('');
      return fullText.length > definiteConcat.length ? fullText.slice(definiteConcat.length) : '';
    })();

    return (
      <div className="h-full flex flex-col">
        <div className="shrink-0 flex items-center justify-between px-6 h-14 border-b border-[var(--border)] bg-[var(--color-surface-1)]">
          <div className="flex items-center gap-3">
            {isActive ? (
              <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-2.5 h-2.5 rounded-full bg-red-500" />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-ink-faint)]" />
            )}
            <span className="text-sm font-medium">{isActive ? '录制中' : '已暂停'}</span>
            <span className="text-sm font-mono text-[var(--color-ink-muted)] tabular-nums">{formatTime(recordingTime)}</span>
            {streamingASR.isConnected && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-positive)]/15 text-[var(--color-positive)]">ASR</span>}
          </div>
          <p className="text-sm text-[var(--color-ink-muted)]">{sceneName || '未命名会话'}</p>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
            {displayUtterances.map((u, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
                  <Mic className="w-3.5 h-3.5 text-[var(--color-ink-faint)]" />
                </div>
                <div>
                  <span className="text-xs text-[var(--color-ink-faint)]">{formatTime(Math.floor(u.start_time / 1000))}</span>
                  <p className="text-sm text-[var(--color-ink)] mt-0.5">{u.text}</p>
                </div>
              </motion.div>
            ))}
            {currentText && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 text-[var(--color-ink-faint)] animate-spin" />
                </div>
                <p className="text-sm text-[var(--color-ink-muted)] mt-2">{currentText}</p>
              </motion.div>
            )}
            {displayUtterances.length === 0 && !currentText && hasStarted && (
              <div className="flex items-center justify-center h-full text-[var(--color-ink-faint)] text-sm">等待语音输入…</div>
            )}
            <div ref={transcriptEndRef} />
          </div>

          <div className="w-72 shrink-0 border-l border-[var(--border)] bg-[var(--color-surface-1)] flex flex-col items-center justify-center gap-4 px-6">
            <div className="w-20 h-20 rounded-full border-2 border-[var(--color-accent)] flex items-center justify-center"
              style={{ animation: isActive ? 'pulse-glow 2s ease-in-out infinite' : 'none' }}>
              <Mic className="w-8 h-8 text-[var(--color-accent)]" />
            </div>
            {audioCapture.volume > 0 && (
              <div className="w-full h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                <motion.div className="h-full rounded-full bg-[var(--color-accent)]" animate={{ width: `${Math.min(audioCapture.volume * 100, 100)}%` }} transition={{ duration: 0.1 }} />
              </div>
            )}
            <div className="flex gap-3 w-full">
              <button onClick={handleTogglePause}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--color-surface-2)] transition-colors">
                {isPaused ? <><Play className="w-4 h-4" /> 继续</> : <><Pause className="w-4 h-4" /> 暂停</>}
              </button>
              <button onClick={() => setShowStopConfirm(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--color-negative)] text-white text-sm hover:brightness-110 transition-all">
                <StopCircle className="w-4 h-4" /> 结束
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showStopConfirm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-80 p-6 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--border)] space-y-4">
                <h3>确定结束录制？</h3>
                <p className="text-sm text-[var(--color-ink-muted)]">结束后将进入编辑和数据分析环节</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowStopConfirm(false)} className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--color-surface-3)] transition-colors">取消</button>
                  <button onClick={handleStopRecording} className="flex-1 py-2 rounded-lg bg-[var(--color-negative)] text-white text-sm hover:brightness-110 transition-all">确认结束</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Render: Edit ───
  const isAsrRunning = fileASR.status !== 'idle' && fileASR.status !== 'done' && fileASR.status !== 'error';
  const isSyncing = syncStatus !== 'idle' && syncStatus !== 'done' && syncStatus !== 'error';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-8 space-y-8">
        <div>
          <h1 className="font-serif">会后编辑</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            录制时长 {formatTime(recordingTime)} · {selectedMode === 'manual' ? '手动启动' : 'NFC 触发'}
          </p>
        </div>

        {/* File ASR status */}
        {isAsrRunning && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)]">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
            <span className="text-sm text-[var(--color-ink-muted)]">
              {fileASR.status === 'uploading' && '上传音频中…'}
              {fileASR.status === 'queued' && '排队中…'}
              {fileASR.status === 'processing' && '识别处理中…'}
            </span>
          </div>
        )}
        {fileASR.status === 'error' && (
          <div className="p-4 rounded-xl border border-[var(--color-negative)] bg-[var(--color-negative)]/5 text-sm text-[var(--color-negative)]">
            文件识别失败: {fileASR.error}
          </div>
        )}

        {/* Scene name */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[var(--color-ink-muted)]">场景名称</h3>
            {isGeneratingTitle && <Loader2 className="w-3 h-3 animate-spin text-[var(--color-ink-faint)]" />}
          </div>
          <input value={sceneName} onChange={e => { setSceneName(e.target.value); userEditedTitle.current = true; }}
            placeholder="输入场景名称"
            className="w-full px-4 py-3 rounded-lg bg-[var(--color-surface-1)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--color-accent-dim)] transition-colors" />
        </div>

        {/* Speakers */}
        <div className="space-y-3">
          <h3 className="text-[var(--color-ink-muted)]">发言人管理 ({speakers.length})</h3>
          {speakers.length === 0 ? (
            <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)] text-center text-sm text-[var(--color-ink-faint)]">
              <Users className="w-6 h-6 mx-auto mb-2 opacity-50" />
              {isAsrRunning ? '语音识别中，请稍候…' : '暂无发言人数据'}
            </div>
          ) : (
            <div className="space-y-2">
              {speakers.map(sp => {
                const sc = getSpeakerColor(sp.name);
                const isEditing = editingSpeakerId === sp.id;
                return (
                  <div key={sp.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)]">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0" style={{ backgroundColor: sc.bg, color: sc.text }}>
                      {sp.name.charAt(0)}
                    </div>
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveSpeakerName(); if (e.key === 'Escape') { setEditingSpeakerId(null); setEditingName(''); } }}
                          className="flex-1 px-2 py-1 rounded bg-[var(--color-surface-2)] border border-[var(--border)] text-sm focus:outline-none" />
                        <button onClick={handleSaveSpeakerName} className="p-1 rounded hover:bg-[var(--color-surface-2)]"><Check className="w-4 h-4 text-[var(--color-positive)]" /></button>
                        <button onClick={() => { setEditingSpeakerId(null); setEditingName(''); }} className="p-1 rounded hover:bg-[var(--color-surface-2)]"><X className="w-4 h-4 text-[var(--color-ink-faint)]" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sp.name}</p>
                          <p className="text-xs text-[var(--color-ink-faint)]">{sp.speechCount} 条发言{sp.gender ? ` · ${sp.gender}` : ''}</p>
                        </div>
                        <button onClick={() => handleStartEditSpeaker(sp)} className="p-1.5 rounded hover:bg-[var(--color-surface-2)] transition-colors">
                          <Edit2 className="w-3.5 h-3.5 text-[var(--color-ink-faint)]" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Transcript preview */}
        {transcriptItems.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[var(--color-ink-muted)]">转录预览 ({transcriptItems.length} 条)</h3>
            <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)] p-4">
              {transcriptItems.slice(0, 20).map((t, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="text-[var(--color-ink-faint)] shrink-0 text-xs pt-0.5">{t.timestamp}</span>
                  <span className="text-[var(--color-accent)] shrink-0 text-xs font-medium pt-0.5">{t.speaker}</span>
                  <span className="text-[var(--color-ink)]">{t.text}</span>
                </div>
              ))}
              {transcriptItems.length > 20 && <p className="text-xs text-[var(--color-ink-faint)] text-center pt-2">…还有 {transcriptItems.length - 20} 条</p>}
            </div>
          </div>
        )}

        {/* Sync status */}
        {isSyncing && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)]">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
            <span className="text-sm text-[var(--color-ink-muted)]">
              {syncStatus === 'writing' && '写入 Google Sheets…'}
              {syncStatus === 'polling' && '等待 AI 标注…'}
              {syncStatus === 'reading' && '读取标注结果…'}
            </span>
          </div>
        )}

        <button onClick={handleCompleteEdit} disabled={isAsrRunning || isSyncing || transcriptItems.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[var(--color-accent)] text-[var(--primary-foreground)] font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:pointer-events-none">
          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          完成编辑，查看数据分析 <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
