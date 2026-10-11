import React, { useState } from 'react';
import {
  Trophy,
  X,
  Ghost,
  Share2,
  Download,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import type { ReplayData } from '../../types/replay.js';
import { saveReplay } from '../../services/replayStorage.js';

interface ReplaySaveModalProps {
  replay: ReplayData;
  isOpen: boolean;
  onClose: () => void;
  onOpenPublishModal: () => void;
}

export const ReplaySaveModal: React.FC<ReplaySaveModalProps> = ({
  replay,
  isOpen,
  onClose,
  onOpenPublishModal,
}) => {
  const [savedLocally, setSavedLocally] = useState(false);

  if (!isOpen) return null;

  const durationSec = (replay.summary.durationMs / 1000).toFixed(2);

  const handleSaveGhost = () => {
    const success = saveReplay(replay);
    if (success) {
      setSavedLocally(true);
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(replay, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay-${replay.levelId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl text-slate-100 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Run Completed!</h3>
            <p className="text-xs text-slate-400">Save your run replay or race against your ghost.</p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-5 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-center p-2 rounded-lg bg-slate-900/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Time</div>
            <div className="text-sm font-mono font-bold text-cyan-300 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" />
              {durationSec}s
            </div>
          </div>
          <div className="text-center p-2 rounded-lg bg-slate-900/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Score</div>
            <div className="text-sm font-mono font-bold text-amber-300">
              {replay.summary.finalScore}
            </div>
          </div>
          <div className="text-center p-2 rounded-lg bg-slate-900/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Coins</div>
            <div className="text-sm font-mono font-bold text-emerald-300">
              {replay.summary.coinsCollected}
            </div>
          </div>
        </div>

        {/* Playback Mode Note */}
        <div className="mb-5 p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-500/20 text-[11px] text-cyan-200/90 flex items-start gap-2">
          <Ghost className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-cyan-300">Position-Interpolated Ghost: </span>
            <span>Recorded {replay.frames.length} sync frames. Accurate visual playback for competitive time trials.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleSaveGhost}
            disabled={savedLocally}
            className={`w-full py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
              savedLocally
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 cursor-default'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30'
            }`}
          >
            {savedLocally ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Saved to Local Best Runs!
              </>
            ) : (
              <>
                <Ghost className="w-4 h-4" />
                Save as Personal Ghost
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPublishModal();
            }}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-sm bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 transition-all"
          >
            <Share2 className="w-4 h-4" />
            Publish Level & Ghost to Community
          </button>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="flex-1 py-2 px-3 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
