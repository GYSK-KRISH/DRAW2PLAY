import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  FileCode,
  Image as ImageIcon,
  Clock,
  X,
  Info,
} from 'lucide-react';
import type { SketchDocument, SceneSummary } from '../../types/sketch.js';

interface AnalyzePreparationModalProps {
  isOpen: boolean;
  blobSize: number;
  document: SketchDocument;
  summary: SceneSummary;
  onClose: () => void;
}

export const AnalyzePreparationModal: React.FC<AnalyzePreparationModalProps> = ({
  isOpen,
  blobSize,
  document,
  summary,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prep-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-[#0a0e1c] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative flex flex-col gap-5 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h2 id="prep-dialog-title" className="text-white">
              Sketch Prepared for Image-AI Pipeline
            </h2>
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

        {/* Preparation Status Badges */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-[#060914] border border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                Image Blob
              </span>
              <span className="text-xs font-mono font-bold text-white">
                {(blobSize / 1024).toFixed(1)} KB (image/png)
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#060914] border border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                Vector Scene Data
              </span>
              <span className="text-xs font-mono font-bold text-white">
                {document.strokes.length} strokes ({summary.totalPoints} pts)
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown of Prepared Strokes */}
        <div className="p-3.5 rounded-xl bg-[#060914] border border-slate-800 text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Structured Elements In Prepared Payload:
          </span>
          <div className="flex flex-wrap gap-2 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
              Ground: {summary.elementCounts.ground}
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/60 text-rose-300">
              Hazard: {summary.elementCounts.hazard}
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300">
              Trampoline: {summary.elementCounts.trampoline}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300">
              Coin: {summary.elementCounts.coin}
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/60 text-purple-300">
              Goal: {summary.elementCounts.goal}
            </span>
          </div>
        </div>

        {/* Explicit Boundary Notice */}
        <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200/90 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold text-purple-300">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Phase 2 Boundary: Ready for Phase 3 Integration</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            The visible sketch canvas has been converted into a high-contrast binary image Blob and normalized JSON vector model. In <strong>Phase 3</strong>, this payload will connect directly to the Gemini Multimodal Vision API to infer level physics.
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1 border-t border-purple-500/20">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>No external AI API was called; all preparation was validated deterministically.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow-lg shadow-cyan-950/40 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Understood</span>
          </button>
        </div>
      </div>
    </div>
  );
};
