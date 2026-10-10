import React from 'react';
import {
  Sparkles,
  Undo2,
  Redo2,
  Trash2,
  Download,
  HelpCircle,
  Cpu,
  Gamepad2,
} from 'lucide-react';

interface TopBarProps {
  canUndo: boolean;
  canRedo: boolean;
  strokeCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onClearClick: () => void;
  onExportClick: () => void;
  onAnalyzeClick: () => void;
  onQuickPlayClick?: () => void;
  onHelpClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  canUndo,
  canRedo,
  strokeCount,
  onUndo,
  onRedo,
  onClearClick,
  onExportClick,
  onAnalyzeClick,
  onQuickPlayClick,
  onHelpClick,
}) => {
  return (
    <header className="w-full bg-[#070a13]/95 backdrop-blur-xl border-b border-slate-800/90 sticky top-0 z-40 px-4 sm:px-6 py-2.5">
      <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Wordmark & Studio Status */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            {/* Original Vector Emblem */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-purple-900/30">
              <div className="w-full h-full bg-[#0a0e1c] rounded-[11px] flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-5 h-5 text-cyan-400"
                >
                  <path
                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19.5 4.5l-2.25 2.25 3.75 3.75L23.25 8.25a2.121 2.121 0 000-3l-0.75-0.75a2.121 2.121 0 00-3 0z"
                    fill="currentColor"
                    fillOpacity="0.8"
                  />
                  <circle cx="8" cy="18" r="1.5" fill="#a855f7" />
                </svg>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">
                  Draw2Play <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">AI</span>
                </span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Playable Studio
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5 hidden sm:block">
                Sketch-to-Physics Level Engine & Gemini Vision
              </p>
            </div>
          </div>

          {/* Engine Status Tag */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Phaser 4 Engine: <strong>Ready</strong></span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Center / Right: Action Controls */}
        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto justify-end">
          {/* Undo Button */}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo last stroke (Ctrl+Z)"
            aria-label="Undo last stroke"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[#0e1424] hover:bg-slate-800 text-slate-300 disabled:opacity-35 disabled:cursor-not-allowed border border-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Undo</span>
          </button>

          {/* Redo Button */}
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo stroke (Ctrl+Y)"
            aria-label="Redo stroke"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[#0e1424] hover:bg-slate-800 text-slate-300 disabled:opacity-35 disabled:cursor-not-allowed border border-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Redo</span>
          </button>

          {/* Clear Canvas Action */}
          <button
            type="button"
            onClick={onClearClick}
            disabled={strokeCount === 0}
            title="Clear entire canvas"
            aria-label="Clear Canvas"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[#0e1424] hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 disabled:opacity-35 disabled:cursor-not-allowed border border-slate-800 hover:border-rose-800/40 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          {/* Export Action */}
          <button
            type="button"
            onClick={onExportClick}
            disabled={strokeCount === 0}
            title="Export sketch as PNG or structured JSON"
            aria-label="Export Sketch"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[#0e1424] hover:bg-slate-800 text-slate-200 disabled:opacity-35 disabled:cursor-not-allowed border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export</span>
          </button>

          {/* Help Button */}
          <button
            type="button"
            onClick={onHelpClick}
            title="Studio Guide & Shortcuts"
            aria-label="Open Studio Guide"
            className="p-2 rounded-xl text-xs font-semibold bg-[#0e1424] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Optional Quick Play Button (Instant Local Physics) */}
          {strokeCount > 0 && onQuickPlayClick && (
            <button
              type="button"
              onClick={onQuickPlayClick}
              title="Launch level immediately with local vector physics"
              className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white border border-emerald-500/40 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer active:scale-95"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-emerald-200" />
              <span>Quick Play</span>
            </button>
          )}

          {/* Primary Analyze Sketch Button */}
          <button
            type="button"
            onClick={onAnalyzeClick}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 border shadow-lg transition-all focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none ${
              strokeCount === 0
                ? 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 cursor-pointer'
                : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white border-purple-500/40 shadow-purple-950/40 cursor-pointer active:scale-95'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
            <span>Analyze Sketch</span>
          </button>
        </div>
      </div>
    </header>
  );
};
