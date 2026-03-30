import gsap from 'gsap';

// ── Theme config ──
export interface CombinedTheme {
  bg: string;
  bgGradient?: [string, string]; // top, bottom
  textColor: string;
  mutedColor: string;
  speakerColors: string[];
  showSpeakerBar: boolean;      // color bar left of text
  colorizeText: boolean;        // text itself in speaker color
  rippleAlphaBase: number;      // 0-1
  rippleGlow: boolean;          // glow blend on ripples
  nodeGlowRadius: number;       // multiplier
  lineAlphaBase: number;
  labelColor: string;
}

export interface AnimationOptions {
  once?: boolean;
  onComplete?: () => void;
}

export const GRAPH_CANVAS = {
  width: 300,
  height: 600,
} as const;

export const GRAPH_NODE_LAYOUT_2D = [
  { x: 0.5, y: 0.35 },
  { x: 0.2, y: 0.55 },
  { x: 0.8, y: 0.55 },
  { x: 0.5, y: 0.73 },
] as const;

// ── Data (exported for 3D reuse) ──
export const SPEAKER_LINES = [
  { speaker: 0, text: '我觉得这个方案还有优化的空间' },
  { speaker: 1, text: '对，数据采集那一层需要重新设计' },
  { speaker: 2, text: '隐私合规必须前置处理' },
  { speaker: 0, text: '那我们先确定最小可行版本' },
  { speaker: 3, text: '互动结构的提取是核心' },
  { speaker: 1, text: '同意，先做可视化输出的闭环' },
];

export const GRAPH_NODES = [
  { label: 'A', speakerIdx: 0 },
  { label: 'B', speakerIdx: 1 },
  { label: 'C', speakerIdx: 2 },
  { label: 'D', speakerIdx: 3 },
];

export const GRAPH_CONNECTIONS = [
  { from: 0, to: 1, weight: 0.8 },
  { from: 0, to: 2, weight: 0.6 },
  { from: 1, to: 3, weight: 0.9 },
  { from: 2, to: 3, weight: 0.5 },
  { from: 0, to: 3, weight: 0.7 },
  { from: 1, to: 2, weight: 0.4 },
];

interface TextLine {
  speaker: number;
  text: string;
  startX: number;
  startY: number;
}

// ── Main factory ──
export function createCombinedAnimation(
  canvas: HTMLCanvasElement,
  theme: CombinedTheme,
  options?: AnimationOptions,
) {
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const W = GRAPH_CANVAS.width;
  const H = GRAPH_CANVAS.height;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const C = theme.speakerColors;

  // Node positions (where each speaker's text will cluster)
  const nodes = GRAPH_NODES.map((node, idx) => {
    const anchor = GRAPH_NODE_LAYOUT_2D[idx];
    return {
      x: W * anchor.x,
      y: H * anchor.y,
      color: C[node.speakerIdx],
      label: node.label,
    };
  });

  // Text line starting positions
  const textLines: TextLine[] = SPEAKER_LINES.map((l, i) => ({
    speaker: l.speaker,
    text: l.text,
    startX: 30,
    startY: 110 + i * 34,
  }));

  // ── Animated state ──
  const s = {
    // Phase 1: Typing
    typingProgress: 0,
    // Phase 2: Cluster (text slides to node)
    clusterProgress: 0,
    // Phase 3: Ripple (ripples emanate from nodes)
    rippleTime: 0,
    rippleAlpha: 0,
    // Phase 4: Condense (ripples reverse, node brightens)
    condenseProgress: 0,
    // Phase 5: Connect + breathe
    lineGrowProgress: 0,
    breathe: 0,
    nodeAlpha: 0,
    // Phase 6: Fade out
    fadeOut: 0,
    // Shared
    t: 0,
  };

  // ── GSAP Timeline ──
  const once = options?.once ?? false;
  const tl = gsap.timeline(once ? {} : { repeat: -1, repeatDelay: 0.5 });

  // Phase 1: Typing (2.5s)
  tl.to(s, { typingProgress: 1, duration: 2.5, ease: 'none' })

    // Phase 2: Cluster (1.8s)
    .to(s, { clusterProgress: 1, duration: 1.8, ease: 'power2.inOut' }, '-=0.2')

    // Phase 3: Ripple
    .to(s, { rippleAlpha: 1, duration: 0.5, ease: 'power2.out' }, '-=0.3')
    .to(s, { rippleTime: 1, duration: 2.0, ease: 'none' }, '<')

    // Phase 4: Condense
    .to(s, { condenseProgress: 1, duration: 1.2, ease: 'power3.inOut' })
    .to(s, { rippleAlpha: 0, duration: 0.8, ease: 'power2.in' }, '<')
    .to(s, { nodeAlpha: 1, duration: 0.8, ease: 'power2.out' }, '<+0.4')

    // Phase 5: Connect + breathe
    .to(s, { lineGrowProgress: 1, duration: 1.2, ease: 'power2.out' })
    .to(s, { breathe: 1, duration: 2.5, ease: 'sine.inOut', yoyo: true, repeat: 1 });

  if (once) {
    // In once mode, fire onComplete after Phase 5 breathe, then stop
    tl.call(() => { options?.onComplete?.(); });
  } else {
    // In loop mode, fade out and reset
    tl.to(s, { fadeOut: 1, duration: 1.5, ease: 'power2.inOut' })
      .set(s, {
        typingProgress: 0,
        clusterProgress: 0,
        rippleTime: 0,
        rippleAlpha: 0,
        condenseProgress: 0,
        lineGrowProgress: 0,
        breathe: 0,
        nodeAlpha: 0,
        fadeOut: 0,
      });
  }

  // ── Helpers ──
  function hexToRgb(hex: string) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }

  function smoothstep(x: number) {
    const c = Math.max(0, Math.min(1, x));
    return c * c * (3 - 2 * c);
  }

  // ── Draw functions ──

  function drawBackground() {
    if (theme.bgGradient) {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, theme.bgGradient[0]);
      grad.addColorStop(1, theme.bgGradient[1]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = theme.bg;
    }
    ctx.fillRect(0, 0, W, H);
  }

  function drawTextPhase() {
    // Text is visible from typing start until cluster completes
    const totalChars = textLines.reduce((sum, l) => sum + l.text.length, 0);
    const charsToShow = Math.floor(s.typingProgress * totalChars);
    let charCount = 0;

    ctx.font = '13px Georgia, "Songti SC", serif';

    for (let li = 0; li < textLines.length; li++) {
      const line = textLines[li];
      const lineChars = Math.max(0, Math.min(line.text.length, charsToShow - charCount));
      charCount += line.text.length;
      if (lineChars <= 0) continue;

      const node = nodes[line.speaker];
      const cp = smoothstep(s.clusterProgress);

      // Interpolate position: startPos -> nodePos
      const curX = line.startX + (node.x - 30 - line.startX) * cp;
      const curY = line.startY + (node.y - line.startY) * cp;

      // Scale shrinks as it clusters
      const scale = 1 - cp * 0.7;

      // Alpha fades in the second half of clustering
      const textAlpha = Math.max(0, 1 - cp * 1.3) * (1 - s.fadeOut);
      if (textAlpha <= 0.01) continue;

      ctx.save();
      ctx.translate(curX, curY);
      ctx.scale(scale, scale);

      // Speaker color bar
      if (theme.showSpeakerBar) {
        ctx.fillStyle = C[line.speaker];
        ctx.globalAlpha = textAlpha * 0.5;
        ctx.fillRect(-10, -10, 3, 16);
      }

      // Text
      const visibleText = line.text.substring(0, lineChars);
      ctx.fillStyle = theme.colorizeText ? C[line.speaker] : theme.textColor;
      ctx.globalAlpha = textAlpha;
      ctx.fillText(visibleText, 0, 0);

      // Typing cursor
      if (lineChars < line.text.length && lineChars > 0 && s.clusterProgress < 0.05) {
        const cw = ctx.measureText(visibleText).width;
        ctx.fillStyle = theme.mutedColor;
        ctx.globalAlpha = textAlpha * (Math.sin(s.t * 6) * 0.5 + 0.5);
        ctx.fillRect(cw + 2, -10, 1.5, 14);
      }

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawClusterGlow() {
    // As clustering completes, a soft glow appears at each node position
    const glowAlpha = smoothstep(s.clusterProgress * 2 - 0.6) * (1 - s.fadeOut);
    if (glowAlpha <= 0.01) return;

    for (const node of nodes) {
      const rgb = hexToRgb(node.color);
      const r = 8 + s.clusterProgress * 10;
      const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
      grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${glowAlpha * 0.6})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRipples() {
    if (s.rippleAlpha <= 0.01) return;
    const overallAlpha = s.rippleAlpha * (1 - s.fadeOut);

    const maxRadius = 100;
    const ringCount = 4;

    // During condense, ripples shrink back
    const condenseScale = 1 - s.condenseProgress;

    for (const node of nodes) {
      const rgb = hexToRgb(node.color);
      const freq = 1 + nodes.indexOf(node) * 0.2;

      for (let ring = 0; ring < ringCount; ring++) {
        const phase = (s.rippleTime * freq + ring / ringCount) % 1;
        let radius = phase * maxRadius * condenseScale;
        if (radius <= 0) continue;

        const ringAlpha = overallAlpha
          * Math.max(0, 1 - phase)
          * theme.rippleAlphaBase;

        if (ringAlpha <= 0.005) continue;

        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${ringAlpha})`;
        ctx.lineWidth = (1.5 - phase) * (theme.rippleGlow ? 2 : 1);

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Glow effect for dark themes
        if (theme.rippleGlow && ringAlpha > 0.02) {
          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${ringAlpha * 0.3})`;
          ctx.lineWidth = (1.5 - phase) * 4;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  function drawNodes() {
    const na = s.nodeAlpha * (1 - s.fadeOut);
    if (na <= 0.01) return;

    for (let ni = 0; ni < nodes.length; ni++) {
      const node = nodes[ni];
      const rgb = hexToRgb(node.color);
      const pulse = 1 + s.breathe * 0.35 + Math.sin(s.t * 2.5 + ni * 1.7) * 0.1;
      const r = 5.5 * pulse;
      const gr = theme.nodeGlowRadius;

      // Outer glow
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * gr);
      glow.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${na * 0.45})`);
      glow.addColorStop(0.4, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${na * 0.1})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * gr, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = node.color;
      ctx.globalAlpha = na;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright spot
      ctx.fillStyle = theme.bg === '#faf9f7' ? '#faf9f7' : '#ffffff';
      ctx.globalAlpha = na * 0.8;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = theme.labelColor;
      ctx.globalAlpha = na * 0.5;
      ctx.font = '10px Georgia, "Songti SC", serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y - r * gr - 3);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
  }

  function drawConnections() {
    const lp = s.lineGrowProgress;
    if (lp <= 0.01) return;
    const la = (1 - s.fadeOut);
    if (la <= 0.01) return;

    for (const conn of GRAPH_CONNECTIONS) {
      const a = nodes[conn.from];
      const b = nodes[conn.to];

      const thickness = (0.4 + s.breathe * conn.weight * 2)
        + Math.sin(s.t * 1.8 + conn.from + conn.to) * 0.3;

      // Line grows outward from A to B
      const ex = a.x + (b.x - a.x) * lp;
      const ey = a.y + (b.y - a.y) * lp;

      const grad = ctx.createLinearGradient(a.x, a.y, ex, ey);
      grad.addColorStop(0, a.color);
      grad.addColorStop(1, b.color);

      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(0.3, thickness);
      ctx.globalAlpha = la * lp * (theme.lineAlphaBase + s.breathe * 0.2);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawLabels() {
    // BEFORE label
    const beforeAlpha = Math.max(0, 1 - s.clusterProgress * 2.5) * (1 - s.fadeOut);
    if (beforeAlpha > 0.01) {
      ctx.fillStyle = theme.mutedColor;
      ctx.globalAlpha = beforeAlpha * 0.18;
      ctx.font = '10px Georgia, "Songti SC", serif';
      ctx.textAlign = 'center';
      ctx.fillText('B E F O R E', W / 2, H - 32);
      ctx.textAlign = 'start';
      ctx.globalAlpha = 1;
    }

    // AFTER label
    const afterAlpha = Math.max(0, s.nodeAlpha - 0.3) * 1.4 * Math.max(0, 1 - s.fadeOut * 2);
    if (afterAlpha > 0.01) {
      ctx.fillStyle = theme.mutedColor;
      ctx.globalAlpha = afterAlpha * 0.18;
      ctx.font = '10px Georgia, "Songti SC", serif';
      ctx.textAlign = 'center';
      ctx.fillText('A F T E R', W / 2, H - 32);
      ctx.textAlign = 'start';
      ctx.globalAlpha = 1;
    }
  }

  // ── Main loop ──
  let raf = 0;

  function draw() {
    s.t += 0.016;

    drawBackground();
    drawTextPhase();
    drawClusterGlow();
    drawRipples();
    drawNodes();
    drawConnections();
    drawLabels();

    raf = requestAnimationFrame(draw);
  }

  raf = requestAnimationFrame(draw);

  // Return cleanup function
  return () => {
    cancelAnimationFrame(raf);
    tl.kill();
  };
}
