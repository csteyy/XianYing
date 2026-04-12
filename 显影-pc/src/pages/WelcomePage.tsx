import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, BarChart3, Sparkles, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

interface WelcomePageProps {
  onComplete: () => void;
}

const steps = [
  {
    key: 'brand',
    icon: null,
    title: '显·影',
    subtitle: '让不可见的互动，显影为艺术',
    description: '一款将多人对话场景转化为数据洞察与艺术可视化的桌面工具。\n录制、分析、呈现 —— 重新看见每一次交流。',
  },
  {
    key: 'record',
    icon: Mic,
    title: '实时录制与识别',
    subtitle: '捕捉每一个声音',
    description: '接入麦克风进行实时录音，AI 语音引擎自动完成转录并分离发言人。\n支持上传音频文件，批量处理历史对话。',
  },
  {
    key: 'analysis',
    icon: BarChart3,
    title: '多维数据分析',
    subtitle: '洞察对话深层脉络',
    description: '自动标注情绪、互动类型与话题转折，\n可视化每位参与者的发言分布、情感走向与关键事件。',
  },
  {
    key: 'visualization',
    icon: Sparkles,
    title: '3D 艺术可视化',
    subtitle: '数据化为光与粒子',
    description: '基于 Three.js 将对话数据映射为粒子风暴，\n节点代表参与者，光束呈现互动能量，可保存为作品。',
  },
];

export function WelcomePage({ onComplete }: WelcomePageProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const isLast = current === steps.length - 1;
  const step = steps[current];

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= steps.length) return;
    setDirection(idx > current ? 1 : -1);
    setCurrent(idx);
  }, [current]);

  const goNext = useCallback(() => {
    if (isLast) { onComplete(); return; }
    goTo(current + 1);
  }, [current, isLast, onComplete, goTo]);

  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'Escape') { e.preventDefault(); onComplete(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onComplete]);

  const slideVariants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 80 : -80, scale: 0.96 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -80 : 80, scale: 0.96 }),
  };

  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--color-surface-0)] overflow-hidden select-none">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }} />
      </div>

      {/* Skip button */}
      {!isLast && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={onComplete}
          className="absolute top-6 right-8 z-10 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-1)] transition-colors"
        >
          跳过 <ArrowRight className="w-3.5 h-3.5" />
        </motion.button>
      )}

      {/* Step content */}
      <div className="relative flex items-center justify-center w-full max-w-xl px-8" style={{ minHeight: 360 }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step.key}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
          >
            {/* Icon or brand glyph */}
            {current === 0 ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mb-8"
              >
                <div className="w-24 h-24 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center mx-auto"
                  style={{ boxShadow: '0 0 60px 8px var(--color-accent-glow)' }}>
                  <span className="text-4xl font-serif font-bold text-[var(--primary-foreground)]">影</span>
                </div>
              </motion.div>
            ) : Icon ? (
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="mb-8"
              >
                <div className="w-20 h-20 rounded-2xl border border-[var(--color-accent-dim)] bg-[var(--color-accent-glow)] flex items-center justify-center mx-auto">
                  <Icon className="w-9 h-9 text-[var(--color-accent)]" strokeWidth={1.6} />
                </div>
              </motion.div>
            ) : null}

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="font-serif text-4xl font-semibold tracking-tight"
              style={current === 0 ? { letterSpacing: '0.15em' } : undefined}
            >
              {step.title}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 text-base text-[var(--color-accent)]"
            >
              {step.subtitle}
            </motion.p>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 text-sm leading-relaxed text-[var(--color-ink-muted)] max-w-md whitespace-pre-line"
            >
              {step.description}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="relative z-10 flex flex-col items-center gap-6 mt-4">
        {/* Dots */}
        <div className="flex items-center gap-2">
          {steps.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${i === current ? 'w-8 h-1.5 bg-[var(--color-accent)]' : 'w-1.5 h-1.5 bg-[var(--color-ink-faint)] hover:bg-[var(--color-ink-muted)]'}`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button onClick={goPrev} disabled={current === 0}
            className="w-10 h-10 rounded-xl border border-[var(--border)] flex items-center justify-center text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-1)] hover:text-[var(--color-ink)] transition-colors disabled:opacity-20 disabled:pointer-events-none">
            <ChevronLeft className="w-5 h-5" />
          </button>

          {isLast ? (
            <motion.button
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              onClick={onComplete}
              className="flex items-center gap-2 px-8 py-2.5 rounded-xl btn-primary text-sm font-medium focus-ring"
            >
              开始使用 <ArrowRight className="w-4 h-4" />
            </motion.button>
          ) : (
            <button onClick={goNext}
              className="flex items-center gap-2 px-8 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-1)] hover:text-[var(--color-ink)] transition-colors">
              下一步 <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Keyboard hint */}
        <p className="text-[10px] text-[var(--color-ink-faint)] tracking-wide">
          方向键翻页 · Enter 继续 · Esc 跳过
        </p>
      </div>
    </div>
  );
}
