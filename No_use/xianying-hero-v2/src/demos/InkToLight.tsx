import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const BG = '#faf9f7';
const INK = '#1a1a1a';
const MUTED = '#737373';
const COLORS = ['#4a7c8a', '#7a6b8a', '#8a7a5a', '#5a8a6a'];

const LINES = [
  { speaker: 0, text: '我觉得这个方案还有优化的空间' },
  { speaker: 1, text: '对，数据采集那一层需要重新设计' },
  { speaker: 2, text: '隐私合规必须前置处理' },
  { speaker: 0, text: '那我们先确定最小可行版本' },
  { speaker: 3, text: '互动结构的提取是核心' },
  { speaker: 1, text: '同意，先做可视化输出的闭环' },
];

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
  size: number;
  vx: number;
  vy: number;
  life: number;
}

const InkToLight = () => {
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

    const nodes = [
      { x: W * 0.5, y: H * 0.32, color: COLORS[0], label: 'A' },
      { x: W * 0.22, y: H * 0.52, color: COLORS[1], label: 'B' },
      { x: W * 0.78, y: H * 0.52, color: COLORS[2], label: 'C' },
      { x: W * 0.5, y: H * 0.7, color: COLORS[3], label: 'D' },
    ];

    const connections = [
      [0, 1], [0, 2], [1, 3], [2, 3], [0, 3], [1, 2],
    ];

    let particles: Particle[] = [];

    const state = {
      phase: 0,        // 0=typing, 1=dissolve, 2=gather, 3=network, 4=fadeout
      typingProgress: 0,
      dissolveProgress: 0,
      gatherProgress: 0,
      networkProgress: 0,
      fadeOut: 0,
      breathe: 0,
      globalTime: 0,
    };

    function spawnParticles() {
      particles = [];
      for (let i = 0; i < 200; i++) {
        const nodeIdx = i % nodes.length;
        const node = nodes[nodeIdx];
        particles.push({
          x: 30 + Math.random() * (W - 60),
          y: 80 + Math.random() * 200,
          targetX: node.x + (Math.random() - 0.5) * 30,
          targetY: node.y + (Math.random() - 0.5) * 30,
          color: node.color,
          size: Math.random() * 2.5 + 1,
          vx: (Math.random() - 0.5) * 3,
          vy: -Math.random() * 4 - 1,
          life: Math.random(),
        });
      }
    }
    spawnParticles();

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });

    tl.to(state, { typingProgress: 1, duration: 2.5, ease: 'none' })
      .to(state, { dissolveProgress: 1, duration: 1.2, ease: 'power2.in' }, '+=0.3')
      .to(state, { gatherProgress: 1, duration: 1.8, ease: 'power3.inOut' }, '-=0.3')
      .to(state, { networkProgress: 1, duration: 1.0, ease: 'power2.out' })
      .to(state, { breathe: 1, duration: 2.5, ease: 'sine.inOut', yoyo: true, repeat: 1 })
      .to(state, { fadeOut: 1, duration: 1.2, ease: 'power2.inOut' })
      .set(state, {
        typingProgress: 0,
        dissolveProgress: 0,
        gatherProgress: 0,
        networkProgress: 0,
        fadeOut: 0,
        breathe: 0,
      })
      .call(() => spawnParticles());

    function drawText() {
      const totalChars = LINES.reduce((s, l) => s + l.text.length, 0);
      const charsToShow = Math.floor(state.typingProgress * totalChars);
      let charCount = 0;

      ctx.font = '13px Georgia, "Songti SC", serif';

      LINES.forEach((line, lineIdx) => {
        const y = 100 + lineIdx * 32;
        const lineChars = Math.max(0, Math.min(line.text.length, charsToShow - charCount));
        charCount += line.text.length;

        if (lineChars <= 0) return;

        const dissolveLineProgress = Math.max(0, state.dissolveProgress * 1.5 - lineIdx * 0.1);
        const alpha = Math.max(0, 1 - dissolveLineProgress);
        if (alpha <= 0) return;

        // Speaker color bar
        ctx.fillStyle = COLORS[line.speaker];
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillRect(20, y - 10, 3, 16);

        // Text
        const visibleText = line.text.substring(0, lineChars);
        ctx.fillStyle = INK;
        ctx.globalAlpha = alpha;
        ctx.fillText(visibleText, 30, y);

        // Typing cursor on last visible line
        if (lineChars < line.text.length && lineChars > 0 && state.dissolveProgress < 0.1) {
          const cursorX = 30 + ctx.measureText(visibleText).width + 2;
          ctx.fillStyle = MUTED;
          ctx.globalAlpha = alpha * (Math.sin(state.globalTime * 6) * 0.5 + 0.5);
          ctx.fillRect(cursorX, y - 10, 1.5, 14);
        }
      });
      ctx.globalAlpha = 1;
    }

    function drawParticles() {
      if (state.dissolveProgress <= 0) return;
      const showAlpha = Math.min(1, state.dissolveProgress * 2) * (1 - state.fadeOut);
      if (showAlpha <= 0) return;

      for (const p of particles) {
        // During dissolve: drift from text position
        const dx = p.vx * state.dissolveProgress * 15;
        const dy = p.vy * state.dissolveProgress * 12;
        const dissolvedX = p.x + dx;
        const dissolvedY = p.y + dy;

        // During gather: lerp toward target
        const gp = state.gatherProgress;
        const eased = gp * gp * (3 - 2 * gp); // smoothstep
        const cx = dissolvedX + (p.targetX - dissolvedX) * eased;
        const cy = dissolvedY + (p.targetY - dissolvedY) * eased;

        // Jitter when gathered
        const jx = gp > 0.9 ? Math.sin(state.globalTime * 3 + p.life * 20) * 1.5 : 0;
        const jy = gp > 0.9 ? Math.cos(state.globalTime * 2.5 + p.life * 15) * 1.5 : 0;

        const finalX = cx + jx;
        const finalY = cy + jy;

        // Draw glow
        const glowSize = p.size * (2 + state.gatherProgress * 3);
        const grad = ctx.createRadialGradient(finalX, finalY, 0, finalX, finalY, glowSize);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.globalAlpha = showAlpha * 0.4;
        ctx.beginPath();
        ctx.arc(finalX, finalY, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Draw core
        ctx.fillStyle = p.color;
        ctx.globalAlpha = showAlpha * 0.8;
        ctx.beginPath();
        ctx.arc(finalX, finalY, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawNetwork() {
      if (state.networkProgress <= 0) return;
      const np = state.networkProgress * (1 - state.fadeOut);
      if (np <= 0) return;

      // Draw connection lines
      for (const [i, j] of connections) {
        const a = nodes[i];
        const b = nodes[j];
        const thickness = 0.5 + state.breathe * 1.5 + Math.sin(state.globalTime * 2 + i + j) * 0.5;

        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, a.color);
        grad.addColorStop(1, b.color);

        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(0.3, thickness);
        ctx.globalAlpha = np * (0.15 + state.breathe * 0.25);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Draw node cores
      for (const node of nodes) {
        const pulse = 1 + state.breathe * 0.4 + Math.sin(state.globalTime * 3 + nodes.indexOf(node)) * 0.1;
        const radius = 5 * pulse;

        // Outer glow
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 5);
        glow.addColorStop(0, node.color + '60');
        glow.addColorStop(0.5, node.color + '15');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.globalAlpha = np;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 5, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = node.color;
        ctx.globalAlpha = np;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // White center
        ctx.fillStyle = '#faf9f7';
        ctx.globalAlpha = np * 0.9;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = node.color;
        ctx.globalAlpha = np * 0.7;
        ctx.font = '11px Georgia, "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y - radius * 5 - 4);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'start';
    }

    function draw() {
      state.globalTime += 0.016;

      // Clear with warm paper background
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // Subtle paper texture (light noise)
      ctx.globalAlpha = 0.03;
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#d0c8b8' : '#e8e0d0';
        ctx.fillRect(
          Math.random() * W,
          Math.random() * H,
          Math.random() * 3 + 1,
          Math.random() * 3 + 1
        );
      }
      ctx.globalAlpha = 1;

      // Title
      const titleAlpha = Math.max(0, 1 - state.dissolveProgress * 2) * (1 - state.fadeOut);
      if (titleAlpha > 0) {
        ctx.fillStyle = INK;
        ctx.globalAlpha = titleAlpha * 0.3;
        ctx.font = 'bold 16px Georgia, "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText('实时转录', W / 2, 55);
        ctx.textAlign = 'start';
        ctx.globalAlpha = 1;
      }

      drawText();
      drawParticles();
      drawNetwork();

      // "BEFORE" / "AFTER" subtle labels
      if (state.dissolveProgress < 0.3) {
        ctx.fillStyle = MUTED;
        ctx.globalAlpha = 0.2 * (1 - state.dissolveProgress * 3);
        ctx.font = '10px Georgia, "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText('B E F O R E', W / 2, H - 30);
        ctx.textAlign = 'start';
        ctx.globalAlpha = 1;
      }
      if (state.networkProgress > 0.5 && state.fadeOut < 0.5) {
        ctx.fillStyle = MUTED;
        ctx.globalAlpha = 0.2 * Math.min(1, (state.networkProgress - 0.5) * 2) * (1 - state.fadeOut * 2);
        ctx.font = '10px Georgia, "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText('A F T E R', W / 2, H - 30);
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

export default InkToLight;
