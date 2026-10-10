import React from 'react';
import { X, Keyboard, Zap, Sparkles, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-[#0a0e1c] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative flex flex-col gap-5 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-cyan-400" />
            <h2 id="help-modal-title" className="text-base font-bold text-white">
              Draw2Play Studio Guide
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Help"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 text-xs text-slate-300 leading-relaxed overflow-y-auto max-h-[70vh] pr-1">
          {/* Workflow */}
          <div>
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider mb-1.5 flex items-center gap-1.5 text-cyan-400">
              <Sparkles className="w-3.5 h-3.5" /> 1. How It Works
            </h3>
            <p className="text-slate-400">
              Draw a character in the center canvas. You can sketch limbs, wings, hats, or spikes. When ready, click <strong>Analyze Drawing</strong> to send the sketch to the Image AI engine, which translates your visual strokes into gameplay stats.
            </p>
          </div>

          {/* Archetypes */}
          <div>
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider mb-2 flex items-center gap-1.5 text-purple-400">
              <Zap className="w-3.5 h-3.5" /> 2. Character Archetypes
            </h3>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-[#060914] border border-slate-800">
                <strong className="text-sky-300 block">⚡ Speedster</strong>
                <span className="text-slate-400">Thin, sharp, or winged silhouettes boost sprint speed.</span>
              </div>
              <div className="p-2 rounded-lg bg-[#060914] border border-slate-800">
                <strong className="text-emerald-300 block">🛡️ Tank</strong>
                <span className="text-slate-400">Chunky, rounded, dense bodies increase mass and health.</span>
              </div>
              <div className="p-2 rounded-lg bg-[#060914] border border-slate-800">
                <strong className="text-rose-300 block">⚔️ Brawler</strong>
                <span className="text-slate-400">Spikes and aggressive angles grant balanced speed & punch.</span>
              </div>
              <div className="p-2 rounded-lg bg-[#060914] border border-slate-800">
                <strong className="text-purple-300 block">🔮 Mystic</strong>
                <span className="text-slate-400">Floating halos or stars reduce gravity for high leaps.</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div>
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider mb-1.5 flex items-center gap-1.5 text-emerald-400">
              <Keyboard className="w-3.5 h-3.5" /> 3. Game Controls
            </h3>
            <div className="space-y-1 text-slate-400 font-mono text-[11px] bg-[#060914] p-2.5 rounded-lg border border-slate-800">
              <div><strong className="text-slate-200">[A] / [D]</strong> or <strong className="text-slate-200">[←] / [→]</strong> : Move Left / Right</div>
              <div><strong className="text-slate-200">[W]</strong> or <strong className="text-slate-200">[Space]</strong> : Jump</div>
              <div><strong className="text-slate-200">Collect Bananas</strong> : +10 Score</div>
              <div><strong className="text-slate-200">Red Spikes</strong> : Respawn back to start</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
