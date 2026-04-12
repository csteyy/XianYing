import { useEffect, useState } from 'react';

interface SoundBarsProps {
  isActive: boolean;
  /** Real volume level from AnalyserNode, 0-100. Falls back to random animation if undefined. */
  volume?: number;
  className?: string;
}

export function SoundBars({ isActive, volume, className = '' }: SoundBarsProps) {
  const [heights, setHeights] = useState([30, 50, 35]);

  useEffect(() => {
    if (!isActive) {
      setHeights([30, 50, 35]);
      return;
    }

    if (volume !== undefined) {
      // Driven by real volume data
      const base = Math.max(15, volume * 0.6);
      setHeights([
        base * (0.6 + Math.random() * 0.4),
        base * (0.8 + Math.random() * 0.4),
        base * (0.5 + Math.random() * 0.4),
      ]);
      return;
    }

    // Fallback: random animation when no volume data
    const updateHeights = () => {
      setHeights([
        25 + Math.random() * 45,
        30 + Math.random() * 50,
        20 + Math.random() * 40,
      ]);
    };

    updateHeights();
    const interval = setInterval(updateHeights, 120);
    return () => clearInterval(interval);
  }, [isActive, volume]);

  return (
    <div className={`flex items-center justify-center gap-1 h-full ${className}`}>
      {heights.map((height, index) => (
        <div
          key={index}
          className="w-1 rounded-full transition-all ease-in-out"
          style={{
            height: `${Math.min(95, Math.max(15, height))}%`,
            minHeight: '15%',
            transitionDuration: '120ms',
            backgroundColor: isActive ? '#22c55e' : '#a3a3a3',
          }}
        />
      ))}
    </div>
  );
}
