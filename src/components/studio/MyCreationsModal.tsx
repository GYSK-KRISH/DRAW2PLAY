import React from 'react';
import { X, FolderLock, Sparkles, Layers, CloudUpload } from 'lucide-react';

interface MyCreationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MyCreationsModal: React.FC<MyCreationsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="creations-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-[#0a0e1c] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative flex flex-col gap-5 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FolderLock className="w-5 h-5 text-amber-400" />
            <h2 id="creations-modal-title" className="text-base font-bold text-white">
              My Creations Gallery
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Placeholder Content with explicit future indicator */}
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4 shadow-inner">
            <Layers className="w-7 h-7" />
          </div>

          <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 mb-2">
            Scheduled For Phase 3
          </div>

          <h3 className="text-sm font-bold text-white">
            Cloud Character Roster & Gallery
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            Local sketch auto-saving, multi-hero party selection, and level sharing are currently under development.
          </p>

          <div className="w-full mt-6 space-y-2 text-left">
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#060914] border border-slate-800 text-xs text-slate-400">
              <CloudUpload className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Session export & PNG character sheet download</span>
            </div>
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#060914] border border-slate-800 text-xs text-slate-400">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Multi-character roster management</span>
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
