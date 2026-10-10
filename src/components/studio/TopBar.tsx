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
  BookmarkPlus,
  Layers,
  Volume2,
  VolumeX,
  Boxes,
} from 'lucide-react';
import { audioService } from '../../services/audioService.js';

interface TopBarProps {
  canUndo: boolean;
  canRedo: boolean;
  strokeCount: number;
  savedCreationsCount?: number;
  isMuted?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearClick: () => void;
  onExportClick: () => void;
  onAnalyzeClick: () => void;
  onReferenceIntakeClick?: () => void;
  onQuickPlayClick?: () => void;
  onOpenCreationsClick?: () => void;
  onSaveClick?: () => void;
  onToggleMute?: () => void;
  onHelpClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  canUndo,
  canRedo,
  strokeCount,
  savedCreationsCount = 0,
  isMuted = false,
  onUndo,
  onRedo,
  onClearClick,
  onExportClick,
  onAnalyzeClick,
  onReferenceIntakeClick,
  onQuickPlayClick,
  onOpenCreationsClick,
  onSaveClick,
  onToggleMute,
  onHelpClick,
}) => {
  return (
    <header className="w-full bg-[#070a13]/95 backdrop-blur-xl border-b border-slate-800/90 sticky top-0 z-40 px-3 sm:px-6 py-2.5">
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
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 w-full md:w-auto justify-end">
          {/* Audio Mute/Unmute Toggle */}
          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              title={isMuted ? 'Unmute audio' : 'Mute audio'}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              className="p-2 rounded-xl text-xs font-semibold bg-[#0e1424] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            </button>
          )}

          {/* My Creations Gallery Modal Button */}
          {onOpenCreationsClick && (
            <button
              type="button"
              onClick={() => {
                audioService.playClick();
                onOpenCreationsClick();
              }}
              title="Open My Saved Creations Gallery"
              aria-label="Open Saved Creations"
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[#0e1424] hover:bg-purple-950/40 text-slate-300 hover:text-purple-300 border border-slate-800 hover:border-purple-800/50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Creations</span>
              {savedCreationsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono">
                  {savedCreationsCount}
                </span>
              )}
            </button>
          )}

          {/* Save Current Sketch Button */}
          {strokeCount > 0 && onSaveClick && (
            <button
              type="button"
              onClick={() => {
                audioService.playClick();
                onSaveClick();
              }}
              title="Save current drawing to My Creations"
              aria-label="Save Current Level"
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[#0e1424] hover:bg-cyan-950/40 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-800/50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Save Level</span>
            </button>
          )}

          {/* Undo Button */}
          <button
            type="button"
            onClick={() => {
              audioService.playClick();
              onUndo();
            }}
            disabled={!canUndo}
            title="Undo last stroke (Ctrl+Z)"
            aria-label="Undo last stroke"
            className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[#0e1424] hover:bg-slate-800 text-slate-300 disabled:opacity-35 disabled:cursor-not-allowed border border-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Undo</span>
          </button>

          {/* Redo Button */}
          <button
            type="button"
            onClick={() => {
              audioService.playClick();
              onRedo();
            }}
            disabled={!canRedo}
            title="Redo stroke (Ctrl+Y)"
            aria-label="Redo stroke"
            className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[#0e1424] hover:bg-slate-800 text-slate-300 disabled:opacity-35 disabled:cursor-not-allowed border border-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Redo</span>
          </button>

          {/* Clear Canvas Action */}
          <button
            type="button"
            onClick={() => {
              audioService.playClick();
              onClearClick();
            }}
            disabled={strokeCount === 0}
            title="Clear entire canvas"
            aria-label="Clear Canvas"
            className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[#0e1424] hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 disabled:opacity-35 disabled:cursor-not-allowed border border-slate-800 hover:border-rose-800/40 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          {/* Export Action */}
          <button
            type="button"
            onClick={() => {
              audioService.playClick();
              onExportClick();
            }}
            disabled={strokeCount === 0}
            title="Export sketch as PNG or structured JSON"
            aria-label="Export Sketch"
            className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[#0e1424] hover:bg-slate-800 text-slate-200 disabled:opacity-35 disabled:cursor-not-allowed border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Help Button */}
          <button
            type="button"
            onClick={() => {
              audioService.playClick();
              onHelpClick();
            }}
            title="Studio Guide & Shortcuts"
            aria-label="Open Studio Guide"
            className="p-2 rounded-xl text-xs font-semibold bg-[#0e1424] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Quick Play Button (Instant Local Physics) */}
          {strokeCount > 0 && onQuickPlayClick && (
            <button
              type="button"
              onClick={() => {
                audioService.playClick();
                onQuickPlayClick();
              }}
              title="Launch level immediately with local vector physics"
              className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white border border-emerald-500/40 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer active:scale-95"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-emerald-200" />
              <span>Quick Play</span>
            </button>
          )}

          {/* Multimodal Reference Intake Button (Phase 6.1) */}
          {onReferenceIntakeClick && (
            <button
              type="button"
              onClick={() => {
                audioService.playClick();
                onReferenceIntakeClick();
              }}
              title="Upload reference screenshot, image, or video frame to detect game type and generate plan"
              aria-label="Multimodal Reference Intake"
              className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-[#0e1424] hover:bg-cyan-950/40 text-cyan-300 border border-cyan-800/50 shadow-md hover:border-cyan-500/60 transition-all cursor-pointer active:scale-95"
            >
              <Boxes className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reference Intake</span>
              <span className="hidden lg:inline text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300">
                v6.1
              </span>
            </button>
          )}

          {/* Primary Analyze Sketch Button */}
          <button
            type="button"
            onClick={() => {
              audioService.playClick();
              onAnalyzeClick();
            }}
            className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 border shadow-lg transition-all focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none ${
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
export default TopBar;
