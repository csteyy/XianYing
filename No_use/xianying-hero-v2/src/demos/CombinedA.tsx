import { useEffect, useRef } from 'react';
import { createCombinedAnimation, type CombinedTheme } from './combinedEngine';

const theme: CombinedTheme = {
  bg: '#faf9f7',
  textColor: '#1a1a1a',
  mutedColor: '#737373',
  speakerColors: ['#4a7c8a', '#7a6b8a', '#8a7a5a', '#5a8a6a'],
  showSpeakerBar: true,
  colorizeText: false,
  rippleAlphaBase: 0.15,
  rippleGlow: false,
  nodeGlowRadius: 5,
  lineAlphaBase: 0.12,
  labelColor: '#737373',
};

const CombinedA = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    return createCombinedAnimation(canvasRef.current, theme);
  }, []);

  return <canvas ref={canvasRef} className="block" />;
};

export default CombinedA;
