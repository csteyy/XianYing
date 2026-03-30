import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const COLORS = ['#4a7c8a', '#7a6b8a', '#8a7a5a', '#5a8a6a', '#8a5a5a'];

const SUBTITLES = [
  { speaker: 0, text: '我觉得方案还有优化空间' },
  { speaker: 1, text: '数据采集需要重新设计' },
  { speaker: 2, text: '隐私合规必须前置' },
  { speaker: 3, text: '互动结构是核心' },
  { speaker: 4, text: '情绪标注优先级最高' },
  { speaker: 0, text: '先做可视化闭环' },
  { speaker: 1, text: '同意分阶段推进' },
  { speaker: 2, text: '用户场景需要细化' },
  { speaker: 3, text: '音频质量是前提' },
  { speaker: 4, text: '关系映射驱动一切' },
];

interface FallingLine {
  x: number;
  y: number;
  speed: number;
  text: string;
  color: string;
  speakerIdx: number;
  targetX: number;
  targetY: number;
}

const SubtitleGalaxy = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const dpr = window.devicePixelRatio || 1;
    const W = 300;
    const H = 600;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const nodePositions = [
      { x: W * 0.5, y: H * 0.3 },
      { x: W * 0.2, y: H * 0.45 },
      { x: W * 0.8, y: H * 0.42 },
      { x: W * 0.3, y: H * 0.65 },
      { x: W * 0.7, y: H * 0.68 },
    ];

    const connections = [
      [0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [0, 4], [1, 2],
    ];

    let lines: FallingLine[] = [];

    function initLines() {
      lines = SUBTITLES.map((sub, i) => {
        const nodeTarget = nodePositions[sub.speaker];
        return {
          x: 15 + Math.random() * (W - 100),
          y: -30 - i * 55 - Math.random() * 30,
          speed: 0.8 + Math.random() * 0.6,
          text: sub.text,
          color: COLORS[sub.speaker],
          speakerIdx: sub.speaker,
          targetX: nodeTarget.x,
          targetY: nodeTarget.y,
        };
      });
    }
    initLines();

    const state = {
      fallTime: 0,
      fallAlpha: 1,
      freezeProgress: 0,
      collapseProgress: 0,
      networkAlpha: 0,
      lineDrawProgress: 0,
      rotation: 0,
      breathe: 0,
      fadeOut: 0,
      globalTime: 0,
    };

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });

    tl.to(state, { fallTime: 1, duration: 3.5, ease: 'none' })
      // Freeze all lines
      .to(state, { freezeProgress: 1, duration: 0.5, ease: 'power3.in' })
      // Text fades, collapse to points
      .to(state, { fallAlpha: 0, duration: 0.6, ease: 'power2.in' }, '-=0.1')
      .to(state, { collapseProgress: 1, duration: 1.5, ease: 'power3.inOut' }, '-=0.3')
      // Network appears
      .to(state, { networkAlpha: 1, duration: 0.8, ease: 'power2.out' }, '-=0.3')
      .to(state, { lineDrawProgress: 1, duration: 1.0, ease: 'power2.inOut' })
      // Slow rotation + breathe
      .to(state, { rotation: Math.PI * 0.15, breathe: 1, duration: 3.0, ease: 'sine.inOut', yoyo: true, repeat: 0 })
      // Fade out
      .to(state, { fadeOut: 1, duration: 1.2, ease: 'power2.inOut' })
      .set(state, {
        fallTime: 0,
        fallAlpha: 1,
        freezeProgress: 0,
        collapseProgress: 0,
        networkAlpha: 0,
        lineDrawProgress: 0,
        rotation: 0,
        breathe: 0,
        fadeOut: 0,
      })
      .call(() => initLines());

    function hexToRgb(hex: string) {
      return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
      };
    }

    function drawFallingText() {
      const freeze = state.freezeProgress;

      for (const line of lines) {
        // Calculate fall position
        const rawY = line.y + state.fallTime * 600 * line.speed;
        const fallY = freeze > 0 ? rawY : rawY; // Freeze halts further movement via timeline
        const fallX = line.x;

        // During collapse: lerp from current to target
        const cp = state.collapseProgress;
        const eased = cp * cp * (3 - 2 * cp);
        const cx = fallX + (line.targetX - fallX) * eased;
        const cy = fallY + (line.targetY - fallY) * eased;

        // Draw text (fades during collapse)
        const textAlpha = state.fallAlpha * (1 - state.fadeOut);
        if (textAlpha > 0.01 && cy > -20 && cy < H + 20) {
          // Color bar
          const rgb = hexToRgb(line.color);
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${textAlpha * 0.5})`;
          ctx.fillRect(cx - 2, cy - 8, 2, 12);

          // Text
          ctx.fillStyle = `rgba(250, 249, 247, ${textAlpha * 0.7})`;
          ctx.font = '11px Georgia, "Songti SC", serif';
          ctx.fillText(line.text, cx + 4, cy);
        }

        // Draw collapsing point (appears as text fades)
        const pointAlpha = Math.max(0, cp - 0.2) * 1.25 * (1 - state.fadeOut);
        if (pointAlpha > 0.01) {
          const pointSize = 1.5 + cp * 2;
          const rgb = hexToRgb(line.color);

          // Glow
          const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, pointSize * 4);
          glow.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${pointAlpha * 0.5})`);
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(cx, cy, pointSize * 4, 0, Math.PI * 2);
          ctx.fill();

          // Core point
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${pointAlpha})`;
          ctx.beginPath();
          ctx.arc(cx, cy, pointSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function drawNetwork() {
      const na = state.networkAlpha * (1 - state.fadeOut);
      if (na <= 0.01) return;

      const centerX = W / 2;
      const centerY = H / 2;
      const rot = state.rotation;

      // Apply subtle rotation by offsetting node positions
      const rotatedNodes = nodePositions.map((n) => {
        const dx = n.x - centerX;
        const dy = n.y - centerY;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        return {
          x: centerX + dx * cos - dy * sin,
          y: centerY + dx * sin + dy * cos,
        };
      });

      // Lines
      for (const [i, j] of connections) {
        const a = rotatedNodes[i];
        const b = rotatedNodes[j];
        const lp = Math.min(1, state.lineDrawProgress);
        if (lp <= 0) continue;

        const ex = a.x + (b.x - a.x) * lp;
        const ey = a.y + (b.y - a.y) * lp;

        const thickness = 0.4 + state.breathe * 1.0;
        const alpha = na * (0.1 + state.breathe * 0.15);

        const grad = ctx.createLinearGradient(a.x, a.y, ex, ey);
        grad.addColorStop(0, COLORS[i % COLORS.length]);
        grad.addColorStop(1, COLORS[j % COLORS.length]);

        ctx.strokeStyle = grad;
        ctx.lineWidth = thickness;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      // Nodes
      for (let ni = 0; ni < rotatedNodes.length; ni++) {
        const n = rotatedNodes[ni];
        const color = COLORS[ni];
        const pulse = 1 + state.breathe * 0.3 + Math.sin(state.globalTime * 2.5 + ni * 1.5) * 0.12;
        const r = 4.5 * pulse;
        const rgb = hexToRgb(color);

        // Outer glow
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 7);
        glow.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${na * 0.35})`);
        glow.addColorStop(0.4, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${na * 0.08})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 7, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = color;
        ctx.globalAlpha = na;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Inner light
        ctx.fillStyle = '#faf9f7';
        ctx.globalAlpha = na * 0.7;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }

    function drawStarfield() {
      // Subtle background stars
      ctx.globalAlpha = 0.04;
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 73 + 17) % W);
        const sy = ((i * 127 + 41) % H);
        ctx.fillStyle = '#faf9f7';
        ctx.beginPath();
        ctx.arc(sx, sy, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function draw() {
      state.globalTime += 0.016;

      // Dark gradient background
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#141414');
      grad.addColorStop(0.5, '#1a1a1a');
      grad.addColorStop(1, '#111111');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      drawStarfield();
      drawFallingText();
      drawNetwork();

      // Before / After
      if (state.fallAlpha > 0.5 && state.freezeProgress < 0.3) {
        ctx.fillStyle = '#faf9f7';
        ctx.globalAlpha = 0.1;
        ctx.font = '10px Georgia, "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText('B E F O R E', W / 2, H - 35);
        ctx.textAlign = 'start';
        ctx.globalAlpha = 1;
      }
      if (state.networkAlpha > 0.5 && state.fadeOut < 0.3) {
        ctx.fillStyle = '#faf9f7';
        ctx.globalAlpha = 0.1;
        ctx.font = '10px Georgia, "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText('A F T E R', W / 2, H - 35);
        ctx.textAlign = 'start';
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      tl.kill();
    };
  }, []);

  return <canvas ref={canvasRef} className="block" />;
};

export default SubtitleGalaxy;
