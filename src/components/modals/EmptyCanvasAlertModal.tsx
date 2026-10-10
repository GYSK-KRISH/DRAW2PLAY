import React from 'react';
import { AlertCircle, X, Mountain } from 'lucide-react';

interface EmptyCanvasAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPreset: (preset: 'hills' | 'canyon') => void;
}

export const EmptyCanvasAlertModal: React.FC<EmptyCanvasAlertModalProps> = ({
  isOpen,
  onClose,
  onLoadPreset,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="empty-alert-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-[#0a0e1c] border border-rose-500/30 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative flex flex-col gap-4 text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <AlertCircle className="w-4 h-4" />
            <h2 id="empty-alert-title">Canvas Is Empty</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Cannot analyze an empty canvas. Please draw at least one level element (such as Ground, Hazards, or Coins) or load a sample blueprint first.
        </p>

        <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              onLoadPreset('hills');
              onClose();
            }}
            className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>Load "Rolling Hills" Blueprint</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-1.5 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            Back to Drawing
          </button>
        </div>
      </div>
    </div>
  );
};
