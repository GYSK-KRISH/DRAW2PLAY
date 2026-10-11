import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  FastForward,
  Ghost,
} from 'lucide-react';
import type { PlaybackSpeed } from '../../game/replay/ghostPlayback.js';

interface GhostControlsBarProps {
  ghostName?: string;
  bestDurationMs?: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSetSpeed: (speed: PlaybackSpeed) => void;
}

export const GhostControlsBar: React.FC<GhostControlsBarProps> = ({
  ghostName = 'Ghost',
  bestDurationMs,
  onPause,
  onResume,
  onStop,
  onSetSpeed,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  const durationStr = bestDurationMs ? `${(bestDurationMs / 1000).toFixed(1)}s` : '';

  const togglePlay = () => {
    if (isPlaying) {
      onPause();
      setIsPlaying(false);
    } else {
      onResume();
      setIsPlaying(true);
    }
  };

  const cycleSpeed = () => {
    const nextSpeed: PlaybackSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    onSetSpeed(nextSpeed);
  };

  return (
    <div
      id="ghost-controls-bar"
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/40 backdrop-blur-md shadow-lg shadow-cyan-950/30 text-xs text-cyan-200"
    >
      <div className="flex items-center gap-1.5 font-medium pr-1 border-r border-slate-700/60">
        <Ghost className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        <span className="text-slate-300">Ghost:</span>
        <span className="text-cyan-300 font-semibold">{ghostName}</span>
        {durationStr && <span className="text-cyan-400/80 font-mono text-[10px]">({durationStr})</span>}
      </div>

      {/* Play / Pause Toggle */}
      <button
        type="button"
        onClick={togglePlay}
        className="p-1 rounded-full hover:bg-cyan-500/20 text-cyan-300 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-400"
        title={isPlaying ? 'Pause Ghost' : 'Resume Ghost'}
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>

      {/* Speed Multiplier Pill */}
      <button
        type="button"
        onClick={cycleSpeed}
        className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-slate-800 hover:bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 transition-colors"
        title="Cycle playback speed (1x, 1.5x, 2x)"
      >
        <span className="flex items-center gap-0.5">
          <FastForward className="w-2.5 h-2.5" />
          {speed}x
        </span>
      </button>

      {/* Stop / Dismiss */}
      <button
        type="button"
        onClick={onStop}
        className="p-1 rounded-full hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors focus:outline-none"
        title="Dismiss Ghost"
      >
        <Square className="w-3 h-3" />
      </button>
    </div>
  );
};
