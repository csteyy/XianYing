import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Upload, FileAudio, Loader2, X, Clock, ArrowRight, Users } from 'lucide-react';
import { toast } from 'sonner';
import { listSessions, saveSession, type SavedSession } from '@mobile/services/sessionStore';
import { useFileASR } from '@mobile/hooks/useFileASR';
import { annotateLocally } from '@mobile/services/googleSheets/annotate';
import { getSettings } from '@mobile/services/settingsStore';
import { getSpeakerColor } from '@mobile/utils/speakerColors';

interface DashboardPageProps {
  onNavigate: (page: string, data?: any) => void;
  pageData?: any;
}

const ACCEPTED_FORMATS = '.mp3,.mp4,.m4a,.wav,.aac';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return '今天';
  if (diff < 172800000) return '昨天';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── StormPreview: 2D canvas particle animation (ported from mobile HomePage) ──

const PREVIEW_COLORS = ['#5eead4', '#818cf8', '#f472b6', '#fbbf24', '#34d399'];

interface PNode { angle: number; orbitR: number; speed: number; color: string; size: number; x: number; y: number }
interface PBolt { from: number; to: number; color: string; path: { x: number; y: number }[]; pulse: number; pulseSpeed: number }

const StormPreview = React.memo(function StormPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const nodes: PNode[] = PREVIEW_COLORS.map((color, i) => ({
      angle: (i / 5) * Math.PI * 2, orbitR: 0.28 + i * 0.12, speed: 0.12 + i * 0.03,
      color, size: 4 + i * 0.6, x: 0, y: 0,
    }));
    const pairs = [[0,1],[1,2],[2,3],[3,4],[4,0],[0,2],[1,3]];
    const bolts: PBolt[] = pairs.map(([from, to], i) => ({
      from, to, color: PREVIEW_COLORS[from], path: [],
      pulse: Math.random(), pulseSpeed: 0.2 + (i % 3) * 0.06,
    }));

    const jag = (x1: number, y1: number, x2: number, y2: number) => {
      const pts = [{ x: x1, y: y1 }];
      for (let s = 1; s < 7; s++) {
        const t = s / 7;
        pts.push({ x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 10, y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 10 });
      }
      pts.push({ x: x2, y: y2 });
      return pts;
    };

    let tick = 0, frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) * 0.42;
      tick += 0.006;

      ctx.strokeStyle = 'rgba(128,128,128,0.06)';
      ctx.lineWidth = 0.5;
      for (let r = 0.2; r <= 0.9; r += 0.18) { ctx.beginPath(); ctx.arc(cx, cy, R * r, 0, Math.PI * 2); ctx.stroke(); }

      for (const n of nodes) { n.angle += n.speed * 0.006; n.x = cx + Math.cos(n.angle) * R * n.orbitR; n.y = cy + Math.sin(n.angle) * R * n.orbitR; }

      for (const b of bolts) {
        const a = nodes[b.from], z = nodes[b.to];
        if (frame % 30 === 0 || b.path.length === 0) b.path = jag(a.x, a.y, z.x, z.y);
        else { b.path[0] = { x: a.x, y: a.y }; b.path[b.path.length - 1] = { x: z.x, y: z.y }; }
        ctx.strokeStyle = b.color + '20'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(b.path[0].x, b.path[0].y);
        for (let i = 1; i < b.path.length; i++) ctx.lineTo(b.path[i].x, b.path[i].y);
        ctx.stroke();
        b.pulse = (b.pulse + b.pulseSpeed * 0.006) % 1;
        const idx = b.pulse * (b.path.length - 1), si = Math.floor(idx), sf = idx - si;
        if (si < b.path.length - 1) {
          const px = b.path[si].x + (b.path[si+1].x - b.path[si].x) * sf;
          const py = b.path[si].y + (b.path[si+1].y - b.path[si].y) * sf;
          const g = ctx.createRadialGradient(px, py, 0, px, py, 6);
          g.addColorStop(0, b.color + '99'); g.addColorStop(1, b.color + '00');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
        }
      }

      for (const n of nodes) {
        const breath = 0.6 + 0.4 * Math.sin(tick * 2.5 + n.angle * 2);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.size * 3.5);
        const alpha = Math.round(breath * 40).toString(16).padStart(2, '0');
        g.addColorStop(0, n.color + alpha); g.addColorStop(1, n.color + '00');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, n.size * 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.7 + 0.3 * breath;
        ctx.fillStyle = n.color; ctx.beginPath(); ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      frame++;
      rafRef.current = requestAnimationFrame(draw);
    };

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq.matches) draw();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
});

// ── TypewriterLine ──

const INSIGHT_QUESTIONS = ['谁主导了这场对话？', '情绪在哪一刻发生了转折？', '每个人的发言风格是什么？', '互动背后隐藏了什么模式？'];

function TypewriterLine() {
  const [text, setText] = useState('');
  const [idx, setIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const full = INSIGHT_QUESTIONS[idx];
    let timeout: ReturnType<typeof setTimeout>;
    if (isDeleting) {
      if (text.length > 0) timeout = setTimeout(() => setText(full.substring(0, text.length - 1)), 35);
      else { setIsDeleting(false); setIdx(p => (p + 1) % INSIGHT_QUESTIONS.length); }
    } else {
      if (text.length < full.length) timeout = setTimeout(() => setText(full.substring(0, text.length + 1)), 70);
      else timeout = setTimeout(() => setIsDeleting(true), 1800);
    }
    return () => clearTimeout(timeout!);
  }, [text, isDeleting, idx]);

  return (
    <p className="text-sm text-[var(--color-ink-faint)] tracking-wider">
      {text}<span className="inline-block w-[1.5px] h-[14px] bg-[var(--color-ink-faint)] ml-0.5 align-middle animate-pulse" />
    </p>
  );
}

// ── DashboardPage ──

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileASR = useFileASR();
  const isProcessing = fileASR.status !== 'idle' && fileASR.status !== 'done' && fileASR.status !== 'error';

  const [sessions, setSessions] = useState(listSessions);
  const recentSessions = sessions.slice(0, 5);
  const totalSessions = sessions.length;
  const totalDuration = sessions.reduce((sum, s) => sum + s.recordingTime, 0);
  const totalSpeakers = new Set(sessions.flatMap(s => s.speakers.map(sp => sp.name))).size;

  useEffect(() => { setSessions(listSessions()); }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) { toast.error('文件过大', { description: '请选择 500MB 以内的文件' }); return; }
    setSelectedFile(file);
  };

  const handleStartProcessing = async () => {
    if (!selectedFile) return;
    try {
      const result = await fileASR.submit(selectedFile);
      if (!result?.result?.utterances) { toast.error('识别失败', { description: '未获取到识别结果' }); return; }
      const fmtTime = (ms: number) => { const t = Math.floor(ms / 1000); return `${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor((t%3600)/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`; };
      const transcripts = result.result.utterances.map((u, i) => ({
        id: Date.now() + i, speaker: `Speaker ${(u.speaker ?? 0) + 1}`, text: u.text, timestamp: fmtTime(u.start_time),
        startTimeMs: u.start_time, endTimeMs: u.end_time, durationSec: Math.round((u.end_time - u.start_time) / 100) / 10,
        emotion: u.additions?.emotion, gender: u.additions?.gender, speechRate: u.additions?.speech_rate, volume: u.additions?.volume,
      }));
      const speakerAgg = new Map<string, { count: number; gender?: string }>();
      transcripts.forEach(t => { const prev = speakerAgg.get(t.speaker); speakerAgg.set(t.speaker, { count: (prev?.count ?? 0) + 1, gender: t.gender || prev?.gender }); });
      const speakers = Array.from(speakerAgg.entries()).map(([name, data], i) => ({ id: `speaker${i+1}`, name, color: getSpeakerColor(name).bg, speechCount: data.count, gender: data.gender }));
      const rawRows = transcripts.map((t, i) => ({ index: i, text: t.text, speaker: t.speaker, asrEmotion: t.emotion || '' }));
      const localAnnotations = annotateLocally(rawRows);
      const annotatedData = transcripts.map((t, i) => {
        const [target, emotion, interrupted, detailed, topic, turning] = localAnnotations[i];
        return { record_id: `t-${t.id}`, index: i, speaker: t.speaker, text: t.text, timestamp: t.timestamp,
          startTimeSec: t.startTimeMs != null ? t.startTimeMs / 1000 : undefined, endTimeSec: t.endTimeMs != null ? t.endTimeMs / 1000 : undefined,
          durationSec: t.durationSec, gender: t.gender, asrEmotion: t.emotion, speechRate: t.speechRate, volume: t.volume,
          emotion: emotion || t.emotion || '平静', interactionType: interrupted === 'Yes' ? '打断' : '',
          detailedInteraction: detailed, targetSpeaker: target, topic, isTurningPoint: turning === 'Yes',
          speakerColor: speakers.find(s => s.name === t.speaker)?.color || '#888',
        };
      });
      const audioDuration = result.audio_info?.duration ?? 0;
      const { saveTranscripts } = getSettings();
      const sid = `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const session: SavedSession = { id: sid, sceneName: selectedFile.name.replace(/\.[^.]+$/, ''), mode: 'manual',
        recordingTime: Math.round(audioDuration), createdAt: new Date().toISOString(), speakers, transcripts: saveTranscripts ? transcripts : [], annotatedData };
      saveSession(session);
      setSessions(listSessions());
      toast.success('处理完成');
      onNavigate('analysis', { from: 'dashboard', transcripts, speakers, annotatedData, sessionId: sid });
      setSelectedFile(null);
    } catch (err) { toast.error('处理失败', { description: String(err) }); }
  };

  const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1200px] mx-auto px-8 py-6">
        <div className="grid grid-cols-5 gap-6" style={{ minHeight: 'calc(100vh - 48px)' }}>

          {/* ── Left: Brand hero + actions ── */}
          <div className="col-span-3 flex flex-col">
            {/* Storm canvas + brand overlay */}
            <div className="relative flex-1 min-h-[320px] rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--color-surface-1)]">
              <div className="absolute inset-0"><StormPreview /></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-8">
                <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}
                  className="font-serif text-3xl font-semibold tracking-wide text-center leading-snug">
                  让不可见的<span className="text-[var(--color-accent)]">互动</span>，显影为<span className="text-[var(--color-accent)]">艺术</span>
                </motion.h1>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.8, ease }} className="mt-4">
                  <TypewriterLine />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5, ease }}
                  className="flex gap-3 mt-8">
                  <button onClick={() => onNavigate('record')} className="flex items-center gap-2 px-6 py-2.5 rounded-xl btn-primary text-sm font-medium focus-ring">
                    <Mic className="w-4 h-4" /> 新建录制
                  </button>
                  <input ref={fileInputRef} type="file" accept={ACCEPTED_FORMATS} onChange={handleFileSelect} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors">
                    <Upload className="w-4 h-4" /> 上传文件
                  </button>
                </motion.div>
              </div>
            </div>

            {/* File processing card (shown when file selected) */}
            <AnimatePresence>
              {selectedFile && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)] p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center shrink-0">
                      <FileAudio className="w-4.5 h-4.5 text-[var(--color-ink-muted)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-[var(--color-ink-faint)]">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    {!isProcessing && (
                      <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors">
                        <X className="w-4 h-4 text-[var(--color-ink-faint)]" />
                      </button>
                    )}
                  </div>
                  {isProcessing ? (
                    <div className="flex items-center gap-3 text-sm text-[var(--color-ink-muted)]">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
                      {fileASR.status === 'uploading' && '上传中…'}
                      {fileASR.status === 'queued' && '排队等待…'}
                      {fileASR.status === 'processing' && '识别处理中…'}
                    </div>
                  ) : (
                    <button onClick={handleStartProcessing}
                      className="w-full py-2 rounded-lg bg-[var(--color-accent)] text-[var(--primary-foreground)] text-sm font-medium hover:brightness-110 transition-all">
                      开始处理
                    </button>
                  )}
                  {fileASR.status === 'error' && <p className="text-xs text-[var(--color-negative)]">{fileASR.error}</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right: Stats + recent sessions ── */}
          <div className="col-span-2 flex flex-col gap-4">
            {/* Stats */}
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: '会话总数', value: totalSessions, icon: Clock, suffix: '次' },
                { label: '总录制时长', value: formatDuration(totalDuration), icon: Mic, suffix: '' },
                { label: '累计参与者', value: totalSpeakers, icon: Users, suffix: '人' },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.35, ease }}
                    className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-1)] border border-[var(--border)] card-hover">
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-accent-glow)] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[var(--color-accent)]" strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="text-lg font-semibold tabular-nums leading-tight">
                        {stat.value}{stat.suffix && <span className="text-xs font-normal text-[var(--color-ink-muted)] ml-1">{stat.suffix}</span>}
                      </p>
                      <p className="text-[11px] text-[var(--color-ink-faint)]">{stat.label}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Recent sessions */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs text-[var(--color-ink-faint)] uppercase tracking-widest">最近会话</h4>
                <button onClick={() => onNavigate('history')} className="text-[11px] text-[var(--color-ink-faint)] hover:text-[var(--color-accent)] transition-colors flex items-center gap-0.5">
                  全部 <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {recentSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-xs text-[var(--color-ink-faint)]">还没有录制记录</p>
                  </div>
                ) : recentSessions.map((s, i) => (
                  <motion.button key={s.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.04 }}
                    onClick={() => onNavigate('analysis', { from: 'history', readOnly: true, transcripts: s.transcripts, speakers: s.speakers, annotatedData: s.annotatedData, sessionId: s.id })}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--color-surface-1)] border border-[var(--border)] hover:border-[var(--color-accent-dim)] hover:bg-[var(--color-surface-2)] transition-all group text-left">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center group-hover:bg-[var(--color-accent-glow)] transition-colors shrink-0">
                      <Mic className="w-3.5 h-3.5 text-[var(--color-ink-faint)] group-hover:text-[var(--color-accent)] transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.sceneName || '未命名'}</p>
                      <p className="text-[11px] text-[var(--color-ink-faint)]">{s.speakers.length}人 · {formatDuration(s.recordingTime)} · {formatDate(s.createdAt)}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--color-ink-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
