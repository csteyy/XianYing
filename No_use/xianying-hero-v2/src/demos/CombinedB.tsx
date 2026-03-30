import { useEffect, useRef } from 'react';
import { createCombinedAnimation, type CombinedTheme } from './combinedEngine';

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

const CombinedB = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    return createCombinedAnimation(canvasRef.current, theme);
  }, []);

  return <canvas ref={canvasRef} className="block" />;
};

export default CombinedB;
