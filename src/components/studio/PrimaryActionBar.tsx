import React from 'react';
import { Pencil, Sparkles, Play, Info } from 'lucide-react';

interface PrimaryActionBarProps {
  activeStage: 'draw' | 'analyzing' | 'play';
  hasStrokes: boolean;
  hasAnalyzedCharacter: boolean;
  isAnalyzing: boolean;
  onDrawClick: () => void;
  onAnalyzeClick: () => void;
  onPlayClick: () => void;
}

export const PrimaryActionBar: React.FC<PrimaryActionBarProps> = ({
  activeStage,
  hasStrokes,
  hasAnalyzedCharacter,
  isAnalyzing,
  onDrawClick,
  onAnalyzeClick,
  onPlayClick,
}) => {
  return (
    <div className="w-full bg-[#0a0e1c]/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-3 shadow-xl">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Stage Title & Hint */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <div>
            <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Studio Pipeline
            </div>
            <div className="text-[11px] text-slate-400">
              Draw ➔ Analyze AI ➔ Play in 2D Engine
            </div>
          </div>
        </div>

        {/* Center / Right: The 3 Primary Actions */}
        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
          {/* Action 1: Draw Character */}
          <button
            type="button"
            onClick={onDrawClick}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
              activeStage === 'draw'
                ? 'bg-slate-800 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-950/40'
                : 'bg-slate-900/90 text-slate-300 border-slate-700/60 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Pencil className="w-3.5 h-3.5 text-cyan-400" />
            <span>1. Draw Character</span>
          </button>

          {/* Action 2: Analyze Drawing */}
          <div className="relative group">
            <button
              type="button"
              disabled={!hasStrokes || isAnalyzing}
              onClick={onAnalyzeClick}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-lg focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none ${
                !hasStrokes || isAnalyzing
                  ? 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-purple-500/30 shadow-purple-900/30 cursor-pointer active:scale-95'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                  <span>2. Analyze Drawing</span>
                </>
              )}
            </button>

            {/* Prerequisite Tooltip when Disabled */}
            {!hasStrokes && (
              <div className="absolute right-0 -top-11 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-slate-300 text-[11px] border border-slate-700 shadow-xl whitespace-nowrap z-50 pointer-events-none">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Draw on canvas or load a preset first</span>
              </div>
            )}
          </div>

          {/* Action 3: Play Character */}
          <div className="relative group">
            <button
              type="button"
              disabled={!hasAnalyzedCharacter}
              onClick={onPlayClick}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-lg focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
                !hasAnalyzedCharacter
                  ? 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed opacity-60'
                  : activeStage === 'play'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400 shadow-emerald-950/40 ring-1 ring-emerald-400'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-500/40 shadow-emerald-900/30 cursor-pointer active:scale-95'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current text-white" />
              <span>3. Play Character</span>
            </button>

            {/* Prerequisite Tooltip when Disabled */}
            {!hasAnalyzedCharacter && (
              <div className="absolute right-0 -top-11 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-slate-300 text-[11px] border border-slate-700 shadow-xl whitespace-nowrap z-50 pointer-events-none">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Run Image AI analysis first to synthesize character physics</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
