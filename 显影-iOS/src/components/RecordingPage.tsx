import { motion, AnimatePresence } from 'motion/react';
import { Pause, Play, StopCircle, Mic, MicOff } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { SoundBars } from './SoundBars';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { useStreamingASR } from '../hooks/useStreamingASR';
import type { ASRUtterance } from '../services/volcengine/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface RecordingPageProps {
  onNavigate: (page: string, data?: any) => void;
  mode?: 'manual' | 'nfc';
  sceneName?: string;
}

export function RecordingPage({ onNavigate, mode = 'manual', sceneName = '未命名标题' }: RecordingPageProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [title, setTitle] = useState(sceneName);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const wavBufferRef = useRef<ArrayBuffer | null>(null);

  const audioCapture = useAudioCapture();
  const streamingASR = useStreamingASR();

  // Start recording + ASR on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Start ASR connection
        streamingASR.start();

        // Small delay to let WebSocket connect
        await new Promise((r) => setTimeout(r, 500));

        // Start audio capture, routing PCM chunks to ASR
        await audioCapture.start((pcmChunk) => {
          streamingASR.sendAudio(pcmChunk);
        });

        if (!cancelled) {
          setHasStarted(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[RecordingPage] Failed to start:', err);
          setStartError(err instanceof Error ? err.message : '无法启动录音');
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recording timer
  useEffect(() => {
    if (!hasStarted || isPaused) return;

    const interval = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [hasStarted, isPaused]);

  // Auto scroll transcripts
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamingASR.utterances, streamingASR.text]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleTogglePause = useCallback(async () => {
    if (isPaused) {
      await audioCapture.resume();
      setIsPaused(false);
    } else {
      audioCapture.pause();
      setIsPaused(true);
    }
  }, [isPaused, audioCapture]);

  const handleStopRecording = useCallback(() => {
    setShowStopDialog(false);
    setIsProcessing(true);

    // Signal end of stream to ASR
    streamingASR.finish();

    // Stop audio capture, get WAV buffer
    const wav = audioCapture.stop();
    wavBufferRef.current = wav;

    // Simulate brief processing delay for UX
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 10;
      setProcessingProgress(progress);

      if (progress >= 100) {
        clearInterval(progressInterval);
        streamingASR.disconnect();

        setTimeout(() => {
          // Build transcript items from ASR utterances for post-edit page
          const utterances = streamingASR.utterances;
          const transcripts = utterances.map((u, i) => ({
            id: Date.now() + i,
            speaker: `Speaker ${(u as any).speaker ?? 1}`,
            text: u.text,
            timestamp: formatTime(Math.floor(u.start_time / 1000)),
          }));

          // Collect unique speakers
          const speakerSet = new Set(transcripts.map((t) => t.speaker));
          const speakers = Array.from(speakerSet).map((name, i) => ({
            id: `speaker${i + 1}`,
            name,
            color: '',
            speechCount: transcripts.filter((t) => t.speaker === name).length,
          }));

          onNavigate('post-recording-edit', {
            transcripts,
            speakers,
            mode,
            sceneName: title,
            titleEditedByUser: title !== sceneName,
            recordingTime,
            wavBuffer: wavBufferRef.current,
            streamingText: streamingASR.text,
          });
        }, 300);
      }
    }, 100);
  }, [streamingASR, audioCapture, onNavigate, mode, title, recordingTime]);

  // Derive display data from streaming ASR results
  const displayUtterances = streamingASR.utterances;
  const currentText = (() => {
    // Show the tail of the current (non-definite) text as "typing"
    const definiteTexts = displayUtterances.filter((u) => u.definite).map((u) => u.text);
    const fullText = streamingASR.text;
    const definiteConcat = definiteTexts.join('');
    if (fullText.length > definiteConcat.length) {
      return fullText.slice(definiteConcat.length);
    }
    return '';
  })();

  if (startError) {
    return (
      <div className="bg-background text-foreground flex items-center justify-center p-6" style={{ minHeight: '100dvh' }}>
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
            <MicOff className="w-8 h-8 text-red-600" />
          </div>
          <div className="space-y-2">
            <h3>录音启动失败</h3>
            <p className="text-muted-foreground">{startError}</p>
          </div>
          <Button onClick={() => onNavigate('home')}>返回首页</Button>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="bg-background text-foreground flex items-center justify-center p-6" style={{ minHeight: '100dvh' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-6 text-center"
        >
          <div className="relative w-32 h-32 mx-auto">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary"
            />
          </div>

          <div className="space-y-2">
            <h3>数据处理中</h3>
            <p className="text-muted-foreground">
              预计剩余 {Math.ceil((100 - processingProgress) / 10 * 0.1)} 秒
            </p>
          </div>

          <Progress value={processingProgress} className="h-2" />
        </motion.div>
      </div>
    );
  }

  const isActive = hasStarted && !isPaused;

  return (
    <div className="bg-background text-foreground flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex-shrink-0 z-20 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center px-4 py-3" style={{ minHeight: '68px' }}>
          <Badge variant={isActive ? 'default' : 'outline'} className="gap-2 transition-colors duration-300 flex-shrink-0 mr-3">
            {isActive ? (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: '#ef4444' }}
              />
            ) : (
              <MicOff className="w-3 h-3" />
            )}
            {isActive ? '录制中' : '已暂停'}
          </Badge>

          {isEditingTitle ? (
            <input
              autoFocus
              maxLength={20}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (!title.trim()) setTitle(sceneName);
                setIsEditingTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (!title.trim()) setTitle(sceneName);
                  setIsEditingTitle(false);
                }
              }}
              className="flex-1 min-w-0 bg-transparent text-center outline-none border-b border-primary/30 mx-6"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className={`flex-1 min-w-0 transition-colors text-center ${
                title === sceneName ? 'text-muted-foreground' : 'text-foreground'
              }`}
            >
              <h2 className={`font-serif ${title.length > 10 ? 'text-base' : ''}`}>{title}</h2>
            </button>
          )}

          <Badge variant="secondary" className="font-mono flex-shrink-0 ml-3">
            {formatTime(recordingTime)}
          </Badge>
        </div>
      </div>

      {/* Scrollable Transcript Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence>
          {/* Definite (finalized) utterances */}
          {displayUtterances
            .filter((u) => u.definite)
            .map((item, index) => (
              <motion.div
                key={`utt-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex gap-3"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-muted-foreground text-sm">
                      {formatTime(Math.floor(item.start_time / 1000))}
                    </span>
                  </div>
                  <p className="text-foreground/90 leading-relaxed">{item.text}</p>
                </div>
              </motion.div>
            ))}

          {/* Currently recognizing text (non-definite tail) */}
          {currentText && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full border-2 border-primary/30 bg-primary/5 flex items-center justify-center">
                <Mic className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs"
                    style={{ borderColor: 'rgba(34,197,94,0.4)', color: '#16a34a', backgroundColor: 'rgba(34,197,94,0.1)' }}>
                    <span className="w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: '#22c55e' }} />
                    识别中
                  </Badge>
                </div>
                <p className="text-foreground/90 leading-relaxed">
                  {currentText}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="inline-block w-1 h-4 bg-primary ml-1 align-middle"
                  />
                </p>
              </div>
            </motion.div>
          )}

          {/* Placeholder when no text yet */}
          {!streamingASR.text && hasStarted && !streamingASR.error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center py-12 text-muted-foreground"
            >
              <p>等待语音输入...</p>
            </motion.div>
          )}

          {/* ASR connection error */}
          {streamingASR.error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
              <p className="text-sm text-red-800 dark:text-red-200">
                ASR 服务错误: {streamingASR.error.message} (code: {streamingASR.error.code})
              </p>
            </div>
          )}
        </AnimatePresence>
        <div ref={transcriptEndRef} />
      </div>

      {/* Bottom Control Bar */}
      <div className="flex-shrink-0 z-20 bg-background/95 backdrop-blur-lg border-t border-border px-4 py-2 safe-bottom" style={{ minHeight: '68px' }}>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center">
            <SoundBars isActive={isActive} volume={audioCapture.volume} className="w-6 h-6" />
          </div>

          <Button
            variant={isActive ? 'outline' : 'default'}
            onClick={handleTogglePause}
            className="flex-1 h-10"
            disabled={!hasStarted}
          >
            {isPaused ? (
              <>
                <Play className="w-5 h-5 mr-2" />
                继续
              </>
            ) : (
              <>
                <Pause className="w-5 h-5 mr-2" />
                暂停
              </>
            )}
          </Button>

          <Button
            variant="destructive"
            onClick={() => setShowStopDialog(true)}
            className="flex-1 h-10"
            disabled={!hasStarted}
          >
            <StopCircle className="w-5 h-5 mr-2" />
            结束
          </Button>
        </div>
      </div>

      <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定结束记录？</AlertDialogTitle>
            <AlertDialogDescription>
              结束后将自动进入数据分析环节
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleStopRecording}>
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
