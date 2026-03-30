import { useEffect, useRef } from 'react';
import { createCombinedAnimation, type CombinedTheme } from './combinedEngine';

const theme: CombinedTheme = {
  bg: '#1a1a1a',
  bgGradient: ['#1a1a1a', '#2a2520'],
  textColor: '#faf9f7',
  mutedColor: '#6d6358',
  speakerColors: ['#c9956b', '#9bb89a', '#7f9bb8', '#b89a9b'],
  showSpeakerBar: false,
  colorizeText: true,
  rippleAlphaBase: 0.22,
  rippleGlow: true,
  nodeGlowRadius: 5.5,
  lineAlphaBase: 0.14,
  labelColor: '#8a8078',
};

const CombinedC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    return createCombinedAnimation(canvasRef.current, theme);
  }, []);

  return <canvas ref={canvasRef} className="block" />;
};

export default CombinedC;
