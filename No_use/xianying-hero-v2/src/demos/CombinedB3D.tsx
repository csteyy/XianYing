import { useEffect, useRef, useState, useCallback } from 'react';
import { createCombinedAnimation, type CombinedTheme } from './combinedEngine';
import SpatialGraph from './SpatialGraph';

const theme: CombinedTheme = {
  bg: '#1a1a1a',
  textColor: '#e8e4df',
  mutedColor: '#555555',
  speakerColors: ['#4a7c8a', '#7a6b8a', '#8a7a5a', '#5a8a6a'],
  showSpeakerBar: true,
  colorizeText: false,
  rippleAlphaBase: 0.3,
  rippleGlow: true,
  nodeGlowRadius: 6,
  lineAlphaBase: 0.18,
  labelColor: '#888888',
};

const CombinedB3D = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const phaseRef = useRef<'intro' | 'transition' | 'spatial'>('intro');
  const transitionTimerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<'intro' | 'transition' | 'spatial'>('intro');

  const onComplete = useCallback(() => {
    if (phaseRef.current !== 'intro') return;
    phaseRef.current = 'transition';
    setPhase('transition');
    transitionTimerRef.current = window.setTimeout(() => {
      phaseRef.current = 'spatial';
      setPhase('spatial');
    }, 1200);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    cleanupRef.current = createCombinedAnimation(canvasRef.current, theme, {
      once: true,
      onComplete,
    });
    return () => {
      cleanupRef.current?.();
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, [onComplete]);

  return (
    <div style={{ position: 'relative', width: 300, height: 600, overflow: 'hidden' }}>
      {/* 3D layer (pre-mounted for smooth transition) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: phase === 'intro' ? 0 : 1,
          transition: 'opacity 1.2s ease-in-out',
          pointerEvents: phase === 'spatial' ? 'auto' : 'none',
        }}
      >
        <SpatialGraph
          theme={theme}
          showStardust
          active={phase !== 'intro'}
          interactive={phase === 'spatial'}
        />
      </div>

      {/* 2D intro layer */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          transition: 'opacity 1.2s ease-in-out',
          opacity: phase === 'intro' ? 1 : 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default CombinedB3D;
