import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, Upload, ChevronLeft, Hand, Pause, StopCircle,
  Sparkles, Home, BookOpen, Image, Settings, ArrowRight,
  Edit2, Users, ChevronDown, ChevronUp, ChevronRight,
  Play, Volume2, VolumeX, Video, Loader2,
  CheckCircle2,
} from 'lucide-react';
import StormVisualization, { ModeBar, TimelineBar, type ViewMode } from './components/StormVisualization';
import { getMockStormData, type TransformedStormData } from './utils/transformAnnotatedToStorm';
import { getSpeakerColor } from './utils/speakerColors';

/* ════════════════════════════════════════════════════════
   Mock Data
   ════════════════════════════════════════════════════════ */

const TRANSCRIPTS = [
  { speaker: '阿林', text: '大家都到了吧？咱们开始讨论新功能的方案', time: '00:00:00', emotion: '平静', dur: 5.2 },
  { speaker: '小夏', text: '到了到了。我觉得这次要重点优化录音页面的体验', time: '00:00:06', emotion: '积极', dur: 5.5 },
  { speaker: '大鹏', text: '同意。但我更关心数据分析那块，图表加载太慢了', time: '00:00:12', emotion: '消极', dur: 5.8 },
  { speaker: 'Mia', text: '加载慢可能是后端接口的问题，不一定是前端', time: '00:00:18', emotion: '平静', dur: 4.5 },
  { speaker: '大鹏', text: '不是，我测了，后端响应很快，是渲染 3D 可视化卡的', time: '00:00:24', emotion: '消极', dur: 6.2 },
  { speaker: '阿林', text: '那这样，我们分两步：先解决性能，再加新功能', time: '00:00:31', emotion: '平静', dur: 5.5 },
  { speaker: '小夏', text: '等等，我还没说完。录音页面用户不知道怎么操作', time: '00:00:37', emotion: '消极', dur: 6.8 },
  { speaker: '阿林', text: '好好好，你说你说', time: '00:00:44', emotion: '平静', dur: 2.0 },
  { speaker: '小夏', text: '我们应该加一个引导教程，新用户第一次打开自动弹出', time: '00:00:47', emotion: '积极', dur: 7.0 },
  { speaker: 'Mia', text: '这个好！我之前也想过，可以做成卡片式的步骤引导', time: '00:00:55', emotion: '积极', dur: 6.0 },
];

const SPEAKER_META = {
  '阿林': { count: 3, avgDur: 4, interaction: '总结、提问', keywords: ['方案', '功能', '分工'], reaction: '平静' },
  '小夏': { count: 3, avgDur: 6, interaction: '提问、打断', keywords: ['录音', '体验', '引导'], reaction: '积极' },
  '大鹏': { count: 2, avgDur: 6, interaction: '反驳、陈述', keywords: ['性能', '渲染', '3D'], reaction: '消极' },
  'Mia': { count: 2, avgDur: 5, interaction: '补充、回应', keywords: ['后端', '卡片', '原型'], reaction: '积极' },
};

const HISTORY = [
  { name: '功能讨论会', date: '2026-03-25', dur: '00:02:12', people: ['阿林','小夏','大鹏','Mia'] },
  { name: '毕业设计答辩', date: '2026-03-18', dur: '00:45:32', people: ['Alice','Bob','Charlie','Diana','Eve'] },
  { name: '小组讨论', date: '2026-03-17', dur: '00:32:15', people: ['Alice','Bob','Frank'] },
  { name: '项目评审会', date: '2026-03-15', dur: '01:12:40', people: ['Alice','Charlie','Diana'] },
];

const GALLERY = [
  { title: '功能讨论可视化', date: '2026-03-25', dur: '02:12', people: ['阿林','小夏','大鹏','Mia'], src: '功能讨论会' },
  { title: '团队会议可视化', date: '2026-03-18', dur: '45:30', people: ['Alice','Bob','Charlie'], src: '毕业设计答辩' },
  { title: '创意讨论场域', date: '2026-03-17', dur: '32:15', people: ['Alice','Bob','Frank'], src: '小组讨论' },
];

/* ════════════════════════════════════════════════════════
   Step definitions
   ════════════════════════════════════════════════════════ */

const STEPS = [
  { id: 'home', label: '首页', title: '首页', desc: '粒子预览与打字机效果展示产品理念，一键开始新的对话记录。', ms: 5000 },
  { id: 'mode', label: '启动模式', title: '选择启动模式', desc: '设备检测通过后选择"手动启动"，系统自动识别发言人。', ms: 4500 },
  { id: 'recording', label: '录制中', title: '实时录制', desc: '语音识别逐字流式输出，声音波形实时跳动，支持暂停与结束。', ms: 12000 },
  { id: 'edit', label: '会后编辑', title: '会后编辑', desc: '校对转录文本，管理发言人姓名，预览全部对话内容。', ms: 5000 },
  { id: 'analysis', label: '数据分析', title: '数据分析', desc: '个人累计数据、单条发言详情、气氛转折事件三维解读。', ms: 5500 },
  { id: 'viz', label: '3D 可视化', title: '3D 可视化', desc: '粒子代表发言人，电流代表对话，情绪映射为色彩——对话显影为艺术。', ms: 8000 },
  { id: 'history', label: '历史记录', title: '历史记录', desc: '浏览过往录制记录，支持搜索、筛选和排序。', ms: 4000 },
  { id: 'gallery', label: '作品库', title: '作品库', desc: '已生成的可视化艺术作品集合，可查看、导出、分享。', ms: 4000 },
];

/* ════════════════════════════════════════════════════════
   Utility Components
   ════════════════════════════════════════════════════════ */

function SpeakerAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const c = getSpeakerColor(name);
  const initial = name === 'Mia' ? 'M' : name.charAt(name.length - 1);
  return (
    <div
      style={{ width: size, height: size, borderRadius: '50%', background: c.bg, color: c.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, fontWeight: 500, flexShrink: 0 }}
    >
      {initial}
    </div>
  );
}

function EmotionBadge({ emotion }: { emotion: string }) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    '积极': { bg: 'rgba(34,197,94,0.1)', text: '#16a34a', border: 'rgba(34,197,94,0.3)' },
    '消极': { bg: 'rgba(239,68,68,0.1)', text: '#dc2626', border: 'rgba(239,68,68,0.3)' },
    '平静': { bg: 'rgba(59,130,246,0.1)', text: '#2563eb', border: 'rgba(59,130,246,0.3)' },
  };
  const s = map[emotion] || map['平静'];
  return (
    <span style={{ padding: '1px 6px', borderRadius: 9999, fontSize: 10, fontWeight: 500,
      background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      {emotion}
    </span>
  );
}

function BottomNav({ active }: { active: string }) {
  const items = [
    { id: 'home', label: '首页', Icon: Home },
    { id: 'history', label: '记录', Icon: BookOpen },
    { id: 'gallery', label: '作品库', Icon: Image },
    { id: 'settings', label: '设置', Icon: Settings },
  ];
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: 'var(--card)', borderTop: '1px solid var(--border)', paddingBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: 8, minHeight: 52 }}>
        {items.map(({ id, label, Icon }) => (
          <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '6px 16px', borderRadius: 12, position: 'relative',
            background: id === active ? 'rgba(26,26,26,0.08)' : 'transparent' }}>
            <Icon size={20} style={{ color: id === active ? 'var(--primary)' : 'var(--muted-foreground)' }} />
            <span style={{ fontSize: 10, color: id === active ? 'var(--primary)' : 'var(--muted-foreground)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Screen: Home (pixel-matched to real HomePage)
   ════════════════════════════════════════════════════════ */

const PREVIEW_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#8b5cf6', '#ef4444'];
const INSIGHT_QUESTIONS = ['谁主导了这场对话？', '情绪在哪一刻发生了转折？', '每个人的发言风格是什么？', '互动背后隐藏了什么模式？'];

function ScreenHome() {
  const [twText, setTwText] = useState('');

  useEffect(() => {
    let qIdx = 0, cIdx = 0, del = false, timer: any;
    function tick() {
      const full = INSIGHT_QUESTIONS[qIdx];
      if (!del) {
        cIdx++;
        setTwText(full.slice(0, cIdx));
        if (cIdx >= full.length) { timer = setTimeout(() => { del = true; tick(); }, 1500); return; }
        timer = setTimeout(tick, 80);
      } else {
        cIdx--;
        if (cIdx <= 0) { del = false; qIdx = (qIdx + 1) % INSIGHT_QUESTIONS.length; timer = setTimeout(tick, 300); return; }
        setTwText(full.slice(0, cIdx));
        timer = setTimeout(tick, 40);
      }
    }
    tick();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100%', background: 'var(--background)' }}>
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
        backgroundSize: '48px 48px' }} />
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 50% at 50% 40%, transparent 0%, var(--background) 100%)' }} />
      <div style={{ position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column', minHeight: '100%', paddingTop: 60 }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          style={{ textAlign: 'center', padding: '0 24px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500 }}>
            让不可见的互动，显影为艺术
          </h2>
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--muted-foreground)', opacity: 0.6, letterSpacing: '0.04em' }}>
            记录群体对话 · 转化为粒子与光的可视化作品
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 1 }}
          style={{ margin: '12px auto 0', width: '78%', maxWidth: 340, aspectRatio: '1', pointerEvents: 'none' }}>
          <StormPreview />
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 1 }}
          style={{ textAlign: 'center', padding: '12px 0', minHeight: 48, flexShrink: 0,
            fontSize: 15, color: 'var(--muted-foreground)', opacity: 0.6, letterSpacing: '0.04em' }}>
          {twText}<span style={{ display: 'inline-block', width: 1.5, height: 18, background: 'var(--muted-foreground)',
            opacity: 0.5, marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s infinite' }} />
        </motion.div>

        <div style={{ flex: 1 }} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6 }}
          style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 384, margin: '0 auto', width: '100%' }}>
          <button className="showcase-btn-primary"><Mic size={16} /> 新建记录</button>
          <button className="showcase-btn-outline"><Upload size={16} /> 上传录音文件</button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, color: 'var(--muted-foreground)', opacity: 0.5, fontSize: 14 }}>
            <BookOpen size={16} /> 使用指南
          </div>
        </motion.div>
      </div>
      <BottomNav active="home" />
    </div>
  );
}

function StormPreview() {
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

    interface PNode { angle: number; orbitR: number; speed: number; color: string; size: number; x: number; y: number; }
    interface PBolt { from: number; to: number; color: string; path: { x: number; y: number }[]; pulse: number; pulseSpeed: number; }

    const nodes: PNode[] = PREVIEW_COLORS.map((color, i) => ({
      angle: (i / 5) * Math.PI * 2, orbitR: 0.35 + i * 0.12,
      speed: 0.15 + i * 0.035, color, size: 5 + i * 0.5, x: 0, y: 0,
    }));

    const pairs = [[0,1],[1,2],[2,3],[3,4],[4,0],[0,2],[1,3]];
    const bolts: PBolt[] = pairs.map(([from, to], i) => ({
      from, to, color: PREVIEW_COLORS[from], path: [],
      pulse: Math.random(), pulseSpeed: 0.25 + (i % 3) * 0.08,
    }));

    const jag = (x1: number, y1: number, x2: number, y2: number) => {
      const pts = [{ x: x1, y: y1 }];
      const segs = 7;
      for (let s = 1; s < segs; s++) {
        const t = s / segs;
        pts.push({ x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 10, y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 10 });
      }
      pts.push({ x: x2, y: y2 });
      return pts;
    };

    let tick = 0, frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h * 0.53, R = Math.min(w, h) * 0.48;
      tick += 0.007;

      ctx.strokeStyle = 'rgba(128,128,128,0.10)'; ctx.lineWidth = 0.5;
      for (let r = 0.22; r <= 0.95; r += 0.18) { ctx.beginPath(); ctx.arc(cx, cy, R * r, 0, Math.PI * 2); ctx.stroke(); }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.12, cy + Math.sin(a) * R * 0.12);
        ctx.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); ctx.stroke();
      }

      for (const n of nodes) { n.angle += n.speed * 0.007; n.x = cx + Math.cos(n.angle) * R * n.orbitR; n.y = cy + Math.sin(n.angle) * R * n.orbitR; }

      for (const b of bolts) {
        const a = nodes[b.from], z = nodes[b.to];
        if (frame % 30 === 0 || b.path.length === 0) { b.path = jag(a.x, a.y, z.x, z.y); }
        else { b.path[0] = { x: a.x, y: a.y }; b.path[b.path.length - 1] = { x: z.x, y: z.y }; }

        ctx.strokeStyle = b.color + '30'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(b.path[0].x, b.path[0].y);
        for (let i = 1; i < b.path.length; i++) ctx.lineTo(b.path[i].x, b.path[i].y);
        ctx.stroke();

        b.pulse = (b.pulse + b.pulseSpeed * 0.007) % 1;
        const idx = b.pulse * (b.path.length - 1);
        const si = Math.floor(idx), sf = idx - si;
        if (si < b.path.length - 1) {
          const px = b.path[si].x + (b.path[si + 1].x - b.path[si].x) * sf;
          const py = b.path[si].y + (b.path[si + 1].y - b.path[si].y) * sf;
          const g = ctx.createRadialGradient(px, py, 0, px, py, 7);
          g.addColorStop(0, b.color + 'aa'); g.addColorStop(1, b.color + '00');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
        }
      }

      for (const n of nodes) {
        const breath = 0.6 + 0.4 * Math.sin(tick * 2.5 + n.angle * 2);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.size * 4);
        const alpha = Math.round(breath * 50).toString(16).padStart(2, '0');
        g.addColorStop(0, n.color + alpha); g.addColorStop(1, n.color + '00');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, n.size * 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.7 + 0.3 * breath;
        ctx.fillStyle = n.color; ctx.beginPath(); ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      frame++;
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
}

/* ════════════════════════════════════════════════════════
   Screen: Recording with streaming text
   ════════════════════════════════════════════════════════ */

function ScreenRecording({ active }: { active: boolean }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [streamIdx, setStreamIdx] = useState(0);
  const [streamChars, setStreamChars] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) { setVisibleCount(0); setStreamIdx(0); setStreamChars(0); return; }
    let msgIdx = 0, charIdx = 0;
    let timer: any;

    function streamNext() {
      const t = TRANSCRIPTS[msgIdx];
      if (!t) return;
      setStreamIdx(msgIdx);
      charIdx++;
      setStreamChars(charIdx);

      if (charIdx >= t.text.length) {
        setVisibleCount(msgIdx + 1);
        msgIdx++;
        charIdx = 0;
        if (msgIdx < TRANSCRIPTS.length) {
          timer = setTimeout(streamNext, 400 + Math.random() * 200);
        }
        return;
      }
      timer = setTimeout(streamNext, 30 + Math.random() * 30);
    }

    timer = setTimeout(streamNext, 600);
    return () => clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [visibleCount, streamChars]);

  const recTime = useMemo(() => {
    if (visibleCount === 0 && streamChars === 0) return '00:00:00';
    const idx = Math.min(streamIdx, TRANSCRIPTS.length - 1);
    return TRANSCRIPTS[idx].time;
  }, [visibleCount, streamIdx, streamChars]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(250,249,247,0.95)',
        backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            borderRadius: 9999, fontSize: 12, fontWeight: 500, background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }} />
            录制中
          </span>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500 }}>功能讨论会</div>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'var(--muted-foreground)',
            background: 'var(--muted)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
            {recTime}
          </span>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 88, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {TRANSCRIPTS.map((t, i) => {
          const isComplete = i < visibleCount;
          const isStreaming = i === streamIdx && i >= visibleCount;
          if (!isComplete && !isStreaming) return null;

          return (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', gap: 10 }}>
              <SpeakerAvatar name={t.speaker} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{t.time}</span>
                  {isComplete && <EmotionBadge emotion={t.emotion} />}
                  {isStreaming && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px',
                      borderRadius: 9999, fontSize: 10, fontWeight: 500,
                      background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.4)' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
                      识别中
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 15, color: 'rgba(26,26,26,0.9)', lineHeight: 1.6 }}>
                  {isComplete ? t.text : t.text.slice(0, streamChars)}
                  {isStreaming && <span style={{ display: 'inline-block', width: 1.5, height: 16,
                    background: 'var(--primary)', marginLeft: 1, verticalAlign: 'middle', animation: 'blink 0.8s infinite' }} />}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        background: 'rgba(250,249,247,0.95)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)', padding: '8px 16px 28px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <SoundBarsAnim />
          <button className="showcase-btn-outline" style={{ flex: 1, height: 40 }}><Pause size={18} /> 暂停</button>
          <button className="showcase-btn-destructive" style={{ flex: 1, height: 40 }}><StopCircle size={18} /> 结束</button>
        </div>
      </div>
    </div>
  );
}

function SoundBarsAnim() {
  const [heights, setHeights] = useState([4,4,4,4,4]);
  useEffect(() => {
    const iv = setInterval(() => {
      setHeights(Array.from({ length: 5 }, () => 4 + Math.random() * 20));
    }, 130);
    return () => clearInterval(iv);
  }, []);
  return (
    <div style={{ width: 40, height: 40, border: '1px solid var(--border)', borderRadius: 8,
      background: 'var(--card)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, padding: '8px 6px', flexShrink: 0 }}>
      {heights.map((h, i) => (
        <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: 'var(--primary)', transition: 'height 0.12s' }} />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Screen: 3D Visualization (REAL StormVisualization)
   ════════════════════════════════════════════════════════ */

function ScreenViz() {
  const stormData: TransformedStormData = useMemo(() => getMockStormData(), []);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [eventIdx, setEventIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const manualScrubRef = useRef(false);
  const nodeColors = useMemo(() => {
    const c: Record<string, string> = {};
    stormData.nodes.forEach(n => { c[n.id] = n.color; });
    return c;
  }, [stormData]);

  const vizProps = {
    nodes: stormData.nodes,
    events: stormData.events,
    aggregatedEdges: stormData.aggregatedEdges,
    nodeColors,
    speedMultiplier: 1,
    autoRotate: true,
    showLabels: true,
    particleSize: 1,
    viewMode,
    selectedNode,
    onNodeSelect: setSelectedNode,
    eventIdx,
    onEventIdxChange: setEventIdx,
    isPlaying,
    onPlayingChange: setIsPlaying,
    onViewModeChange: setViewMode as (m: 'summary' | 'timeline') => void,
    manualScrubRef,
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--background)', overflow: 'hidden' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(250,249,247,0.95)',
        backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <ChevronLeft size={24} style={{ color: 'var(--foreground)' }} />
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500 }}>3D 可视化</span>
          <div style={{ width: 24 }} />
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <div style={{ padding: '12px 16px 0', display: 'flex', gap: 4, background: 'var(--muted)', borderRadius: 10, margin: '0 16px' }}>
          <button style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 500,
            background: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
            <Sparkles size={14} /> 艺术化呈现
          </button>
          <button style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 500,
            background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Settings size={14} /> 可视化设置
          </button>
        </div>

        {/* REAL 3D Visualization */}
        <div style={{ margin: '12px 16px', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)',
          aspectRatio: '1', position: 'relative' }}>
          <StormVisualization {...vizProps} compact />
        </div>

        <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <ModeBar mode={viewMode} setMode={setViewMode} />
          {viewMode === 'timeline' && (
            <div className="viz-timeline-wrap" style={{ width: '100%' }}>
              <TimelineBar
                eventIdx={eventIdx}
                setEventIdx={(idx) => { manualScrubRef.current = true; setEventIdx(idx); }}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                total={stormData.events.length}
                events={stormData.events}
                nodes={stormData.nodes}
                nodeColors={nodeColors}
                onManualScrub={() => { manualScrubRef.current = true; }}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%' }}>
            {[{ n: stormData.nodes.length, l: '参与者' }, { n: stormData.events.length, l: '发言事件' }, { n: stormData.aggregatedEdges.length, l: '互动连线' }].map(s => (
              <div key={s.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 10,
                borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)' }}>
                <span style={{ fontSize: 18, fontWeight: 600 }}>{s.n}</span>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Other Screens (Mode Select, Edit, Analysis, History, Gallery)
   ════════════════════════════════════════════════════════ */

function ScreenMode() {
  const [phase, setPhase] = useState<'request' | 'checking' | 'done'>('request');
  const [audioStatus, setAudioStatus] = useState<'checking' | 'success'>('checking');
  const [videoStatus, setVideoStatus] = useState<'checking' | 'success'>('checking');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('checking'), 1500);
    const t2 = setTimeout(() => setAudioStatus('success'), 2500);
    const t3 = setTimeout(() => setVideoStatus('success'), 3400);
    const t4 = setTimeout(() => setPhase('done'), 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const DeviceCard = ({ icon: Icon, label, sublabel, status }: { icon: any; label: string; sublabel: string; status: 'checking' | 'success' }) => (
    <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${status === 'success' ? 'rgba(22,163,74,0.3)' : 'var(--border)'}`,
      background: status === 'success' ? 'rgba(240,253,244,0.5)' : 'var(--card)', transition: 'all 0.4s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0,
          background: status === 'success' ? '#dcfce7' : 'var(--muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.4s' }}>
          <Icon size={24} style={{ color: status === 'success' ? '#16a34a' : 'var(--muted-foreground)', transition: 'color 0.4s' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 2 }}>{label}</div>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{sublabel}</p>
        </div>
        <div style={{ flexShrink: 0 }}>
          {status === 'checking'
            ? <Loader2 size={20} style={{ color: 'var(--muted-foreground)', animation: 'spin 1s linear infinite' }} />
            : <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
          }
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(250,249,247,0.95)',
        backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <ChevronLeft size={24} />
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500 }}>选择启动模式</span>
          <div style={{ width: 24 }} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', paddingBottom: 88, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <AnimatePresence mode="wait">
          {phase === 'request' && (
            <motion.div key="request" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 3, height: 20, background: 'var(--foreground)', borderRadius: 2 }} />
                  <span style={{ fontSize: 16, fontWeight: 500 }}>设备权限请求</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
                  为了正常录制，我们需要访问您的麦克风和摄像头。
                </p>
              </div>
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Mic size={24} style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 2 }}>麦克风权限</div>
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>用于录制音频和识别对话内容</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Video size={24} style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 2 }}>摄像头权限</div>
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>用于录制视频和捕捉交互场景</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: 'var(--muted)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.6 }}>
                  🔒 您的隐私很重要。所有录制内容仅保存在本地设备。
                </p>
              </div>
              <button className="showcase-btn-primary" style={{ height: 44 }}>开始检测设备</button>
            </motion.div>
          )}

          {phase === 'checking' && (
            <motion.div key="checking" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 3, height: 20, background: 'var(--foreground)', borderRadius: 2 }} />
                  <span style={{ fontSize: 16, fontWeight: 500 }}>设备检测</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>正在检测音频和视频设备，请稍候...</p>
              </div>
              <DeviceCard icon={Mic} label="音频设备" sublabel={audioStatus === 'success' ? 'MacBook Pro 麦克风' : '检测麦克风...'} status={audioStatus} />
              <DeviceCard icon={Video} label="视频设备" sublabel={videoStatus === 'success' ? 'FaceTime HD 摄像头' : '检测摄像头...'} status={videoStatus} />
            </motion.div>
          )}

          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#15803d' }}>
                <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                设备检测通过！请选择启动模式继续。
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 3, height: 20, background: 'var(--foreground)', borderRadius: 2 }} />
                  <span style={{ fontSize: 16, fontWeight: 500 }}>选择启动模式</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>系统将自动识别对话和发言人</p>
              </div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                style={{ padding: 20, borderRadius: 16, border: '1px solid #93c5fd', background: '#eff6ff' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#2563eb' }}>
                    <Hand size={24} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 6 }}>手动启动</div>
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>手动启动录制，系统自动识别发言人，会后可编辑姓名。</p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd' }}>简单直观</span>
                      <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd' }}>适合小型会议</span>
                    </div>
                  </div>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                style={{ padding: 20, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)', opacity: 0.65 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--muted-foreground)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><path d="M16.5 7.5a6 6 0 0 1 0 9"/><path d="M7.5 7.5a6 6 0 0 0 0 9"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 6 }}>NFC 触发</div>
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>通过 NFC 标签自动识别参与者身份并记录发言人。</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {phase === 'done' && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 16px 28px',
          background: 'rgba(250,249,247,0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)' }}>
          <button className="showcase-btn-primary" style={{ height: 40 }}>下一步</button>
        </div>
      )}
    </div>
  );
}

function ScreenEdit() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(250,249,247,0.95)',
        backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500 }}>会后编辑</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', paddingBottom: 88, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 3, height: 20, background: 'var(--foreground)', borderRadius: 2 }} />
            <span style={{ fontSize: 16, fontWeight: 500 }}>场景信息</span>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div><div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 4 }}>录制时长</div><div style={{ fontSize: 18, fontFamily: 'ui-monospace, monospace' }}>02:12</div></div>
              <div><div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 4 }}>启动模式</div><span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 12, background: 'var(--muted)', border: '1px solid var(--border)' }}>手动启动</span></div>
              <div><div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 4 }}>对话记录</div><div style={{ fontSize: 18 }}>10 条</div></div>
            </div>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 3, height: 20, background: 'var(--foreground)', borderRadius: 2 }} />
            <span style={{ fontSize: 16, fontWeight: 500 }}>发言人管理</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 9999, fontSize: 12, background: 'var(--muted)', border: '1px solid var(--border)', marginLeft: 4 }}>
              <Users size={12} /> 4 人
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(SPEAKER_META).map(([name, meta]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)' }}>
                <SpeakerAvatar name={name} size={44} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 15 }}>{name}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{meta.count} 次发言</div>
                </div>
                <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer' }}>
                  <Edit2 size={14} /> 编辑
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 3, height: 20, background: 'var(--foreground)', borderRadius: 2 }} />
            <span style={{ fontSize: 16, fontWeight: 500 }}>对话预览</span>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {TRANSCRIPTS.slice(0, 4).map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <SpeakerAvatar name={t.speaker} size={28} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{t.speaker}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{t.time}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.9)', lineHeight: 1.6 }}>{t.text}</p>
                </div>
              </div>
            ))}
            <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>还有 6 条对话记录...</p>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 16px 28px',
        background: 'rgba(250,249,247,0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)' }}>
        <button className="showcase-btn-primary" style={{ height: 40, gap: 6 }}>完成编辑，查看数据分析 <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function ScreenAnalysis() {
  const [expanded, setExpanded] = useState(0);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(250,249,247,0.95)',
        backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <ChevronLeft size={24} />
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500 }}>数据分析结果</span>
          <div style={{ width: 24 }} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', paddingBottom: 40 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, background: 'var(--muted)', borderRadius: 10, padding: 3, marginBottom: 20 }}>
          <button style={{ padding: '8px 4px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 500, background: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', cursor: 'pointer' }}>个人累计数据</button>
          <button style={{ padding: '8px 4px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 500, background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer' }}>单条发言详情</button>
          <button style={{ padding: '8px 4px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 500, background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer' }}>气氛转折事件</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(SPEAKER_META).map(([name, meta], i) => (
            <div key={name} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card)' }}>
              <div onClick={() => setExpanded(expanded === i ? -1 : i)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <SpeakerAvatar name={name} size={36} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 15 }}>{name}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>发言 {meta.count} 次 · 平均 {meta.avgDur} 秒</div>
                  </div>
                </div>
                {expanded === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              {expanded === i && (
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 14 }}>
                    <div><div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 2 }}>主要互动类型</div><div style={{ fontSize: 14 }}>{meta.interaction}</div></div>
                    <div><div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 2 }}>他人主要反应</div><div style={{ fontSize: 14 }}>{meta.reaction}</div></div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 6 }}>反复使用的词汇</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {meta.keywords.map(k => <span key={k} style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 12, background: 'var(--muted)' }}>{k}</span>)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, background: 'linear-gradient(135deg, rgba(26,26,26,0.06), rgba(120,120,120,0.06))',
          border: '1px solid rgba(26,26,26,0.12)', borderRadius: 16, padding: 20, display: 'flex', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(26,26,26,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>准备好生成艺术作品了吗？</div>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6, marginBottom: 12 }}>
              基于数据分析，生成粒子系统和光束网络的可视化艺术作品。
            </p>
            <button className="showcase-btn-primary" style={{ height: 36, width: 'auto', display: 'inline-flex', fontSize: 13, padding: '0 16px' }}>
              <Sparkles size={14} /> 进入可视化设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListCard({ title, meta, people }: { title: string; meta: string; people: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--card)' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Sparkles size={18} style={{ color: 'var(--muted-foreground)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{meta}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {people.slice(0, 3).map(p => <SpeakerAvatar key={p} name={p} size={22} />)}
          {people.length > 3 && <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--muted-foreground)' }}>+{people.length - 3}</div>}
        </div>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
    </div>
  );
}

function ScreenHistory() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(250,249,247,0.95)',
        backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500 }}>历史记录</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, paddingBottom: 88, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {HISTORY.map((r, i) => <ListCard key={i} title={r.name} meta={`${r.date} · ${r.dur}`} people={r.people} />)}
      </div>
      <BottomNav active="history" />
    </div>
  );
}

function ScreenGallery() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(250,249,247,0.95)',
        backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500 }}>作品库</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, paddingBottom: 88, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {GALLERY.map((g, i) => <ListCard key={i} title={g.title} meta={`${g.date} · ${g.dur} · 来源: ${g.src}`} people={g.people} />)}
      </div>
      <BottomNav active="gallery" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Showcase Root
   ════════════════════════════════════════════════════════ */

function renderScreen(step: number) {
  switch (step) {
    case 0: return <ScreenHome />;
    case 1: return <ScreenMode />;
    case 2: return <ScreenRecording active />;
    case 3: return <ScreenEdit />;
    case 4: return <ScreenAnalysis />;
    case 5: return <ScreenViz />;
    case 6: return <ScreenHistory />;
    case 7: return <ScreenGallery />;
    default: return <ScreenHome />;
  }
}

export function ShowcaseApp() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timerRef = useRef<any>(null);
  const [phoneScale, setPhoneScale] = useState(1);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const goTo = useCallback((idx: number) => {
    clearTimeout(timerRef.current);
    setStep(idx);
  }, []);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setTimeout(() => {
      setStep(prev => (prev + 1) % STEPS.length);
    }, STEPS[step].ms);
    return () => clearTimeout(timerRef.current);
  }, [step, playing]);

  useEffect(() => {
    const tryPlay = () => {
      const a = audioRef.current;
      if (a && a.paused) { a.volume = 0.15; a.play().catch(() => {}); }
      document.removeEventListener('click', tryPlay);
    };
    document.addEventListener('click', tryPlay);
    return () => document.removeEventListener('click', tryPlay);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    function calc() {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const hScale = Math.min(1, (vh - 120) / 844);
      const wScale = Math.min(1, (vw - 520) / 390);
      setPhoneScale(Math.min(hScale, wScale, 1));
    }
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  return (
    <div className="showcase-root">
      {/* Info Panel */}
      <div className="showcase-info">
        <h1 style={{ fontFamily: "'Songti SC', Georgia, serif", fontSize: 56, fontWeight: 500, letterSpacing: '0.08em', marginBottom: 12 }}>显·影</h1>
        <p style={{ fontSize: 15, color: '#8a8a8a', letterSpacing: '0.06em', marginBottom: 48 }}>让不可见的互动，显影为艺术。</p>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}
            style={{ minHeight: 140 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#8a8a8a', marginBottom: 8 }}>
              STEP {step + 1} / {STEPS.length}
            </div>
            <h2 style={{ fontFamily: "'Songti SC', Georgia, serif", fontSize: 24, fontWeight: 500, marginBottom: 12 }}>{STEPS[step].title}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: '#8a8a8a' }}>{STEPS[step].desc}</p>
          </motion.div>
        </AnimatePresence>
        <div style={{ width: '100%', height: 2, background: '#232323', borderRadius: 1, marginTop: 36, overflow: 'hidden' }}>
          <motion.div animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ duration: 0.4 }}
            style={{ height: '100%', background: '#d4c5a9', borderRadius: 1 }} />
        </div>
      </div>

      {/* iPhone Mockup */}
      <div style={{ flexShrink: 0, position: 'relative', transform: `scale(${phoneScale})`, transformOrigin: 'center center' }}>
        <div style={{ width: 390, height: 844, borderRadius: 55, background: '#0a0a0a', padding: 10, position: 'relative',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.1), 0 0 0 2px rgba(0,0,0,0.3), 0 30px 100px rgba(0,0,0,0.5)' }}>
          {/* Side buttons */}
          <div style={{ position: 'absolute', right: -3, top: 168, width: 3, height: 56, background: '#1a1a1a', borderRadius: '0 2px 2px 0' }} />
          <div style={{ position: 'absolute', left: -3, top: 140, width: 3, height: 32, background: '#1a1a1a', borderRadius: '2px 0 0 2px' }} />
          <div style={{ position: 'absolute', left: -3, top: 192, width: 3, height: 32, background: '#1a1a1a', borderRadius: '2px 0 0 2px' }} />
          <div style={{ position: 'absolute', left: -3, top: 232, width: 3, height: 32, background: '#1a1a1a', borderRadius: '2px 0 0 2px' }} />

          <div style={{ width: '100%', height: '100%', borderRadius: 46, overflow: 'hidden', position: 'relative', background: 'var(--background)', color: 'var(--foreground)' }}>
            {/* Dynamic Island */}
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
              width: 126, height: 36, background: '#000', borderRadius: 20, zIndex: 100 }} />
            {/* Home Indicator */}
            <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
              width: 134, height: 5, background: 'rgba(0,0,0,0.2)', borderRadius: 3, zIndex: 100 }} />

            {/* Screen */}
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35 }}
                style={{ position: 'absolute', inset: 0 }}>
                {renderScreen(step)}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Step Tags */}
      <div className="showcase-steps">
        {STEPS.map((s, i) => (
          <button key={s.id} onClick={() => goTo(i)}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, whiteSpace: 'nowrap', cursor: 'pointer',
              border: `1px solid ${i === step ? '#d4c5a9' : 'rgba(255,255,255,0.1)'}`,
              background: i === step ? '#d4c5a9' : 'rgba(255,255,255,0.04)',
              color: i === step ? '#1a1a1a' : '#8a8a8a',
              transition: 'all 0.25s', fontFamily: 'inherit' }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ position: 'fixed', top: 24, right: 32, display: 'flex', gap: 8 }}>
        <button onClick={() => setMuted(m => !m)}
          style={{ width: 40, height: 40, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
            color: '#8a8a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button onClick={() => setPlaying(p => !p)}
          style={{ width: 40, height: 40, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
            color: '#8a8a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>
      <audio ref={audioRef} src="/showcase-bgm.mp3" loop preload="auto" />

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .viz-timeline-wrap > div { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
        .showcase-root {
          width: 100vw; height: 100vh; overflow: hidden;
          display: flex; align-items: center; justify-content: center; gap: 80px;
          padding: 40px 60px;
          background: #1a1a1a;
          background-image: radial-gradient(ellipse 80% 60% at 30% 20%, rgba(60,55,45,0.25) 0%, transparent 60%),
                            radial-gradient(ellipse 50% 40% at 75% 80%, rgba(40,35,30,0.15) 0%, transparent 50%);
          font-family: system-ui, -apple-system, 'PingFang SC', sans-serif;
          color: #e8e6e3;
        }
        .showcase-info { max-width: 400px; flex-shrink: 0; }
        .showcase-steps {
          position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
          display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; max-width: 750px;
        }
        @media (max-height: 920px) {
          .showcase-root { gap: 48px; padding: 24px 40px; }
          .showcase-info h1 { font-size: 40px !important; }
        }
        @media (max-width: 1100px) {
          .showcase-root { gap: 40px; padding: 24px 32px; }
          .showcase-info { max-width: 320px; }
        }
        @media (max-width: 900px) {
          .showcase-root { flex-direction: column; gap: 24px; padding: 20px 16px 72px; }
          .showcase-info { max-width: 100%; text-align: center; }
          .showcase-info h1 { font-size: 32px !important; margin-bottom: 4px !important; }
          .showcase-info > p { margin-bottom: 16px !important; }
          .showcase-steps { gap: 4px; }
          .showcase-steps button { padding: 6px 10px !important; font-size: 11px !important; }
        }
        .showcase-btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          border: none; cursor: pointer; font-family: inherit; font-weight: 500; font-size: 15px;
          border-radius: 12px; background: var(--primary); color: var(--primary-foreground);
          height: 48px; width: 100%; padding: 0 20px;
        }
        .showcase-btn-outline {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer; font-family: inherit; font-weight: 500; font-size: 15px;
          border-radius: 12px; background: transparent; color: var(--foreground);
          border: 1px solid var(--border); height: 48px; width: 100%; padding: 0 20px;
        }
        .showcase-btn-destructive {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          border: none; cursor: pointer; font-family: inherit; font-weight: 500; font-size: 15px;
          border-radius: 12px; background: #dc2626; color: #fff;
          height: 40px; flex: 1; padding: 0 16px;
        }
      `}</style>
    </div>
  );
}
