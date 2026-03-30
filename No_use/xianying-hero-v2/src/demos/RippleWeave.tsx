import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const BG = '#1a1a1a';
const COLORS = ['#4a7c8a', '#7a6b8a', '#8a7a5a', '#5a8a6a'];

interface RippleSource {
  x: number;
  y: number;
  color: string;
  freq: number;
  label: string;
}

const RippleWeave = () => {
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

    const sources: RippleSource[] = [
      { x: W * 0.3, y: H * 0.25, color: COLORS[0], freq: 1.2, label: 'A' },
      { x: W * 0.72, y: H * 0.35, color: COLORS[1], freq: 0.9, label: 'B' },
      { x: W * 0.25, y: H * 0.6, color: COLORS[2], freq: 1.5, label: 'C' },
      { x: W * 0.7, y: H * 0.7, color: COLORS[3], freq: 1.1, label: 'D' },
    ];

    const connections = [
      [0, 1], [0, 2], [1, 3], [2, 3], [0, 3],
    ];

    const state = {
      rippleTime: 0,
      rippleAlpha: 1,
      freezeProgress: 0,
      contractProgress: 0,
      nodeAlpha: 0,
      lineProgress: 0,
      breathe: 0,
      fadeOut: 0,
      globalTime: 0,
    };

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });

    // Ripples expand
    tl.to(state, { rippleTime: 1, duration: 3.0, ease: 'none' })
      // Freeze at peak
      .to(state, { freezeProgress: 1, duration: 0.4, ease: 'power4.in' })
      .to(state, { rippleAlpha: 0, duration: 0.01 }, '>-0.05')
      // Contract to nodes
      .to(state, { contractProgress: 1, duration: 1.2, ease: 'power3.inOut' })
      // Nodes and lines appear
      .to(state, { nodeAlpha: 1, duration: 0.6, ease: 'power2.out' }, '-=0.4')
      .to(state, { lineProgress: 1, duration: 1.2, ease: 'power2.inOut' })
      // Breathe
      .to(state, { breathe: 1, duration: 2.0, ease: 'sine.inOut', yoyo: true, repeat: 1 })
      // Fade out
      .to(state, { fadeOut: 1, duration: 1.5, ease: 'power2.inOut' })
      .set(state, {
        rippleTime: 0,
        rippleAlpha: 1,
        freezeProgress: 0,
        contractProgress: 0,
        nodeAlpha: 0,
        lineProgress: 0,
        breathe: 0,
        fadeOut: 0,
      });

    function hexToRgb(hex: string) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    }

    function drawRipples() {
      if (state.rippleAlpha <= 0) return;

      const maxRadius = 180;
      const rings = 5;

      for (const src of sources) {
        const rgb = hexToRgb(src.color);

        for (let ring = 0; ring < rings; ring++) {
          const phase = (state.rippleTime * src.freq + ring / rings) % 1;
          const radius = phase * maxRadius;
          const alpha = state.rippleAlpha * Math.max(0, 1 - phase) * 0.25;

          if (alpha <= 0) continue;

          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
          ctx.lineWidth = 1.5 * (1 - phase);
          ctx.beginPath();
          ctx.arc(src.x, src.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    function drawContraction() {
      if (state.contractProgress <= 0 || state.contractProgress >= 1) return;

      const cp = state.contractProgress;
      const rings = 3;

      for (const src of sources) {
        const rgb = hexToRgb(src.color);

        for (let ring = 0; ring < rings; ring++) {
          const startRadius = 120 - ring * 25;
          const radius = startRadius * (1 - cp * cp);
          const alpha = 0.3 * (1 - cp);

          if (alpha <= 0 || radius <= 0) continue;

          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(src.x, src.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    function drawNetwork() {
      const na = state.nodeAlpha * (1 - state.fadeOut);
      if (na <= 0) return;

      // Connection lines
      for (const [i, j] of connections) {
        const a = sources[i];
        const b = sources[j];
        const lp = Math.max(0, state.lineProgress);
        if (lp <= 0) continue;

        const thickness = 0.5 + state.breathe * 1.2;
        const alpha = na * lp * (0.12 + state.breathe * 0.2);

        // Animated draw: partial line
        const ex = a.x + (b.x - a.x) * lp;
        const ey = a.y + (b.y - a.y) * lp;

        const grad = ctx.createLinearGradient(a.x, a.y, ex, ey);
        grad.addColorStop(0, a.color);
        grad.addColorStop(1, b.color);

        ctx.strokeStyle = grad;
        ctx.lineWidth = thickness;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      // Nodes
      for (let si = 0; si < sources.length; si++) {
        const src = sources[si];
        const pulse = 1 + state.breathe * 0.3 + Math.sin(state.globalTime * src.freq * 3 + si) * 0.15;
        const r = 5 * pulse;

        // Glow
        const glow = ctx.createRadialGradient(src.x, src.y, 0, src.x, src.y, r * 6);
        glow.addColorStop(0, src.color + '50');
        glow.addColorStop(0.4, src.color + '18');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.globalAlpha = na;
        ctx.beginPath();
        ctx.arc(src.x, src.y, r * 6, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = src.color;
        ctx.globalAlpha = na;
        ctx.beginPath();
        ctx.arc(src.x, src.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright point
        ctx.fillStyle = '#faf9f7';
        ctx.globalAlpha = na * 0.8;
        ctx.beginPath();
        ctx.arc(src.x, src.y, r * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = src.color;
        ctx.globalAlpha = na * 0.5;
        ctx.font = '10px Georgia, "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText(src.label, src.x, src.y - r * 6 - 5);
      }

      ctx.globalAlpha = 1;
      ctx.textAlign = 'start';
    }

    function draw() {
      state.globalTime += 0.016;

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      drawRipples();
      drawContraction();
      drawNetwork();

      // Before / After labels
      if (state.rippleAlpha > 0.5 && state.freezeProgress < 0.3) {
        ctx.fillStyle = '#faf9f7';
        ctx.globalAlpha = 0.12;
        ctx.font = '10px Georgia, "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText('B E F O R E', W / 2, H - 35);
        ctx.textAlign = 'start';
        ctx.globalAlpha = 1;
      }
      if (state.nodeAlpha > 0.5 && state.fadeOut < 0.3) {
        ctx.fillStyle = '#faf9f7';
        ctx.globalAlpha = 0.12;
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

export default RippleWeave;
