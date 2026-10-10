import React, { useState } from 'react';
import { Download, FileJson, Image as ImageIcon, X, Check } from 'lucide-react';
import type { SketchDocument } from '../../types/sketch.js';
import { exportSketchToJson } from '../../utils/sketchSerializer.js';

interface ExportModalProps {
  isOpen: boolean;
  document: SketchDocument;
  onGetPngDataUrl: () => string;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  document,
  onGetPngDataUrl,
  onClose,
}) => {
  const [downloadedPng, setDownloadedPng] = useState(false);
  const [downloadedJson, setDownloadedJson] = useState(false);

  if (!isOpen) return null;

  const handleDownloadPng = () => {
    try {
      const dataUrl = onGetPngDataUrl();
      const link = window.document.createElement('a');
      link.download = `draw2play-level-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      setDownloadedPng(true);
      setTimeout(() => setDownloadedPng(false), 2000);
    } catch (err) {
      console.error('Failed to export PNG:', err);
    }
  };

  const handleDownloadJson = () => {
    try {
      const jsonContent = exportSketchToJson(document);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.download = `draw2play-scene-${Date.now()}.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      setDownloadedJson(true);
      setTimeout(() => setDownloadedJson(false), 2000);
    } catch (err) {
      console.error('Failed to export JSON:', err);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-[#0a0e1c] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative flex flex-col gap-5 text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Download className="w-4 h-4" />
            <h2 id="export-dialog-title">Export Level Data</h2>
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
          Export your hand-drawn level as a visual high-contrast image or as a structured vector scene definition with normalized coordinates.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option A: PNG Image Export */}
          <div className="p-4 rounded-xl bg-[#060914] border border-slate-800 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-white mb-1">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <span>PNG Image</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Solid white background rendered for computer vision models.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadPng}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {downloadedPng ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              <span>{downloadedPng ? 'Downloaded!' : 'Save PNG'}</span>
            </button>
          </div>

          {/* Option B: JSON Structured Scene */}
          <div className="p-4 rounded-xl bg-[#060914] border border-slate-800 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-white mb-1">
                <FileJson className="w-4 h-4 text-purple-400" />
                <span>JSON Scene</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Normalized vector coordinates [0, 1] with semantic element labels.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {downloadedJson ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              <span>{downloadedJson ? 'Downloaded!' : 'Save JSON'}</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
