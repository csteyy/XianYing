import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Upload, FileAudio, Loader2, X, BookOpen } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { toast } from 'sonner';

interface HomePageProps {
  onNavigate: (page: string, data?: any) => void;
  onShowGuide: () => void;
}

const ACCEPTED_FORMATS = '.mp3,.mp4,.m4a,.wav,.aac';

const PROCESSING_MESSAGES = [
  '捕捉声音的形状…',
  '为每个人上色…',
  '编织互动脉络…',
  '寻找转折瞬间…',
  '描绘对话光谱…',
];

const ease = [0.22, 1, 0.36, 1] as const;

const PREVIEW_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#8b5cf6', '#ef4444'];

interface PNode {
  angle: number;
  orbitR: number;
  speed: number;
  color: string;
  size: number;
  x: number;
  y: number;
}

interface PBolt {
  from: number;
  to: number;
  color: string;
  path: { x: number; y: number }[];
  pulse: number;
  pulseSpeed: number;
}

const StormPreview = React.memo(function StormPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const nodes: PNode[] = PREVIEW_COLORS.map((color, i) => ({
      angle: (i / 5) * Math.PI * 2,
      orbitR: 0.35 + i * 0.12,
      speed: 0.15 + i * 0.035,
      color,
      size: 5 + i * 0.5,
      x: 0,
      y: 0,
    }));

    const pairs = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2], [1, 3],
    ];
    const bolts: PBolt[] = pairs.map(([from, to], i) => ({
      from,
      to,
      color: PREVIEW_COLORS[from],
      path: [],
      pulse: Math.random(),
      pulseSpeed: 0.25 + (i % 3) * 0.08,
    }));

    const jag = (x1: number, y1: number, x2: number, y2: number) => {
      const pts = [{ x: x1, y: y1 }];
      const segs = 7;
      for (let s = 1; s < segs; s++) {
        const t = s / segs;
        pts.push({
          x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 10,
          y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 10,
        });
      }
      pts.push({ x: x2, y: y2 });
      return pts;
    };

    let tick = 0;
    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h * 0.53;
      const R = Math.min(w, h) * 0.48;
      tick += 0.007;

      ctx.strokeStyle = 'rgba(128,128,128,0.10)';
      ctx.lineWidth = 0.5;
      for (let r = 0.22; r <= 0.95; r += 0.18) {
        ctx.beginPath();
        ctx.arc(cx, cy, R * r, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 0.12, cy + Math.sin(a) * R * 0.12);
        ctx.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95);
        ctx.stroke();
      }

      for (const n of nodes) {
        n.angle += n.speed * 0.007;
        n.x = cx + Math.cos(n.angle) * R * n.orbitR;
        n.y = cy + Math.sin(n.angle) * R * n.orbitR;
      }

      for (const b of bolts) {
        const a = nodes[b.from];
        const z = nodes[b.to];
        if (frame % 30 === 0 || b.path.length === 0) {
          b.path = jag(a.x, a.y, z.x, z.y);
        } else {
          b.path[0] = { x: a.x, y: a.y };
          b.path[b.path.length - 1] = { x: z.x, y: z.y };
        }

        ctx.strokeStyle = b.color + '30';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.path[0].x, b.path[0].y);
        for (let i = 1; i < b.path.length; i++) ctx.lineTo(b.path[i].x, b.path[i].y);
        ctx.stroke();

        b.pulse = (b.pulse + b.pulseSpeed * 0.007) % 1;
        const idx = b.pulse * (b.path.length - 1);
        const si = Math.floor(idx);
        const sf = idx - si;
        if (si < b.path.length - 1) {
          const px = b.path[si].x + (b.path[si + 1].x - b.path[si].x) * sf;
          const py = b.path[si].y + (b.path[si + 1].y - b.path[si].y) * sf;
          const g = ctx.createRadialGradient(px, py, 0, px, py, 7);
          g.addColorStop(0, b.color + 'aa');
          g.addColorStop(1, b.color + '00');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const n of nodes) {
        const breath = 0.6 + 0.4 * Math.sin(tick * 2.5 + n.angle * 2);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.size * 4);
        const alpha = Math.round(breath * 50).toString(16).padStart(2, '0');
        g.addColorStop(0, n.color + alpha);
        g.addColorStop(1, n.color + '00');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.7 + 0.3 * breath;
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      frame++;
      rafRef.current = requestAnimationFrame(draw);
    };

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq.matches) draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
});

const INSIGHT_QUESTIONS = [
  '谁主导了这场对话？',
  '情绪在哪一刻发生了转折？',
  '每个人的发言风格是什么？',
  '互动背后隐藏了什么模式？',
];

function TypewriterLine() {
  const [text, setText] = useState('');
  const [idx, setIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const currentFullText = INSIGHT_QUESTIONS[idx];

    if (isDeleting) {
      if (text.length > 0) {
        timeout = setTimeout(() => {
          setText(currentFullText.substring(0, text.length - 1));
        }, 40);
      } else {
        setIsDeleting(false);
        setIdx((prev) => (prev + 1) % INSIGHT_QUESTIONS.length);
      }
    } else {
      if (text.length < currentFullText.length) {
        timeout = setTimeout(() => {
          setText(currentFullText.substring(0, text.length + 1));
        }, 80);
      } else {
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 1500);
      }
    }

    return () => clearTimeout(timeout);
  }, [text, isDeleting, idx]);

  return (
    <div className="flex-shrink-0 py-4 flex items-center justify-center">
      <p className="text-base text-muted-foreground/60 tracking-wider">
        {text}
        <span className="inline-block w-[1.5px] h-[18px] bg-muted-foreground/50 ml-0.5 align-middle animate-pulse" />
      </p>
    </div>
  );
}

export function HomePage({ onNavigate, onShowGuide }: HomePageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMsgIdx, setProcessingMsgIdx] = useState(0);

  useEffect(() => {
    if (!isProcessing) return;
    const t = setInterval(() => {
      setProcessingMsgIdx((i) => (i + 1) % PROCESSING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(t);
  }, [isProcessing]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) {
      toast.error('文件过大', { description: '请选择 500MB 以内的文件' });
      return;
    }
    setSelectedFile(file);
  };

  const handleStartProcessing = () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setProcessingProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12 + 3;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          toast.success('处理完成', { description: `${selectedFile.name} 分析完毕` });
          const mockTranscripts = [
            { id: 1, speaker: 'Alice', text: '我觉得这个设计方向很有潜力', timestamp: '00:02:15', emotion: '积极' },
            { id: 2, speaker: 'Bob', text: '从技术实现角度来看是可行的', timestamp: '00:03:20', emotion: '平静' },
            { id: 3, speaker: 'Charlie', text: '我们可以先做一个原型测试', timestamp: '00:04:55', emotion: '积极' },
          ];
          const mockSpeakers = [
            { id: '1', name: 'Alice', color: '#ef4444', speechCount: 12 },
            { id: '2', name: 'Bob', color: '#3b82f6', speechCount: 8 },
            { id: '3', name: 'Charlie', color: '#22c55e', speechCount: 15 },
          ];
          const annotatedData = mockTranscripts.map((t, i) => ({
            record_id: `t-${t.id}`,
            index: i,
            speaker: t.speaker,
            text: t.text,
            timestamp: t.timestamp,
            emotion: t.emotion || '平静',
            interactionType: '--',
            targetSpeaker: '',
            speakerColor: mockSpeakers.find((s) => s.name === t.speaker)?.color || '#888',
          }));
          onNavigate('data-analysis', {
            fileName: selectedFile.name,
            from: 'home',
            transcripts: mockTranscripts,
            speakers: mockSpeakers,
            annotatedData,
          });
          setSelectedFile(null);
          setIsProcessing(false);
          setProcessingProgress(0);
        }, 400);
      }
      setProcessingProgress(Math.min(progress, 100));
    }, 300);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setIsProcessing(false);
    setProcessingProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="relative bg-background text-foreground overflow-x-hidden" style={{ minHeight: '100dvh' }}>
      {/* Grid background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage:
            'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 40%, transparent 0%, var(--background) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 safe-top flex flex-col" style={{ minHeight: '100dvh' }}>
        <div style={{ height: '3vh' }} />

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="text-center px-6"
        >
          <h2 className="font-serif">
            让不可见的
            <span style={{ fontFamily: 'var(--font-accent)' }}>互动</span>
            ，显影为
            <span style={{ fontFamily: 'var(--font-accent)' }}>艺术</span>
          </h2>
          <p className="mt-2 text-xs text-muted-foreground/60 tracking-wide">
            记录群体对话 · 转化为粒子与光的可视化作品
          </p>
        </motion.div>

        {/* Storm-style 2D canvas preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 1, ease }}
          className="relative mx-auto mt-6 pointer-events-none"
          style={{ width: '78vw', height: '78vw', maxWidth: 340, maxHeight: 340 }}
        >
          <StormPreview />
        </motion.div>

        {/* Typewriter line filling the empty space */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 1, ease }}
        >
          <TypewriterLine />
        </motion.div>

        <div className="flex-1" />

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6, ease }}
          className="w-full max-w-sm mx-auto px-6 pb-24"
        >
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => onNavigate('recording-mode-selection')}
              className="w-full h-12 gap-2.5 text-[15px] rounded-xl"
            >
              <Mic className="w-4 h-4" />
              新建记录
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FORMATS}
              onChange={handleFileSelect}
              className="hidden"
            />

            <AnimatePresence mode="wait">
              {!selectedFile ? (
                <motion.div key="upload-idle" exit={{ opacity: 0 }}>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-12 gap-2.5 text-[15px] rounded-xl"
                  >
                    <Upload className="w-4 h-4" />
                    上传录音文件
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="upload-active"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-border bg-card p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-foreground/[0.06] flex items-center justify-center flex-shrink-0">
                      <FileAudio className="w-4 h-4 text-foreground/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    {!isProcessing && (
                      <button onClick={handleClearFile} className="p-2 -mr-1 rounded-lg active:bg-muted transition-colors">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  {isProcessing ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <motion.span
                          key={processingMsgIdx}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-muted-foreground flex items-center gap-2"
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {PROCESSING_MESSAGES[processingMsgIdx]}
                        </motion.span>
                        <span className="text-muted-foreground tabular-nums">{Math.round(processingProgress)}%</span>
                      </div>
                      <Progress value={processingProgress} className="h-1.5" />
                    </div>
                  ) : (
                    <Button onClick={handleStartProcessing} className="w-full h-10 rounded-xl">
                      开始处理
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={onShowGuide}
            className="mx-auto flex items-center gap-2 text-sm text-muted-foreground/50 mt-8 active:text-muted-foreground transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            使用指南
          </button>
        </motion.div>
      </div>
    </div>
  );
}
