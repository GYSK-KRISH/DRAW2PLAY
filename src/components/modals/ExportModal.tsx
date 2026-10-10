import React, { useState } from 'react';
import { Download, FileJson, Image as ImageIcon, X, Check, ShieldCheck } from 'lucide-react';
import type { SketchDocument } from '../../types/sketch.js';
import { exportValidatedSketchDocument } from '../../utils/sketchSerializer.js';

interface ExportModalProps {
  isOpen: boolean;
  document: SketchDocument;
  onGetPngDataUrl: (backgroundColor?: string) => string;
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
  const [backgroundType, setBackgroundType] = useState<'white' | 'transparent'>('white');

  if (!isOpen) return null;

  const handleDownloadPng = () => {
    try {
      const bgColor = backgroundType === 'transparent' ? 'transparent' : '#ffffff';
      const dataUrl = onGetPngDataUrl(bgColor);
      const link = window.document.createElement('a');
      link.download = `draw2play-level-${backgroundType}-${Date.now()}.png`;
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
      const { json, isValid } = exportValidatedSketchDocument(document);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.download = `draw2play-scene-${isValid ? 'v1' : 'raw'}-${Date.now()}.json`;
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
      <div className="bg-[#0a0e1c] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative flex flex-col gap-5 text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Download className="w-4 h-4" />
            <h2 id="export-dialog-title">Export Level & Vector Scene</h2>
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
          Export your level as a high-resolution image with configurable background or as a validated vector scene JSON containing normalized coordinates and preprocessed geometry.
        </p>

        {/* Background Selection for Image Export */}
        <div className="p-3 rounded-xl bg-[#060914] border border-slate-800 text-xs flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Image Background Option:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setBackgroundType('white')}
              className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition-colors cursor-pointer ${
                backgroundType === 'white'
                  ? 'bg-cyan-500/10 border-cyan-500/50 text-white'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span className="font-bold text-xs flex items-center justify-between">
                <span>Solid White</span>
                {backgroundType === 'white' && <Check className="w-3 h-3 text-cyan-400" />}
              </span>
              <span className="text-[10px] text-slate-400">Optimal for AI vision models</span>
            </button>

            <button
              type="button"
              onClick={() => setBackgroundType('transparent')}
              className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition-colors cursor-pointer ${
                backgroundType === 'transparent'
                  ? 'bg-cyan-500/10 border-cyan-500/50 text-white'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span className="font-bold text-xs flex items-center justify-between">
                <span>Transparent</span>
                {backgroundType === 'transparent' && <Check className="w-3 h-3 text-cyan-400" />}
              </span>
              <span className="text-[10px] text-slate-400">For sprite & game assets</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option A: PNG Image Export */}
          <div className="p-4 rounded-xl bg-[#060914] border border-slate-800 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-white mb-1">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <span>PNG Image</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Rendered with {backgroundType} background at native canvas resolution.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadPng}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {downloadedPng ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              <span>{downloadedPng ? 'Downloaded!' : `Save PNG (${backgroundType})`}</span>
            </button>
          </div>

          {/* Option B: JSON Structured Scene */}
          <div className="p-4 rounded-xl bg-[#060914] border border-slate-800 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-white mb-1">
                <FileJson className="w-4 h-4 text-purple-400" />
                <span>Vector Scene JSON</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Normalized coordinates [0, 1] with extracted bounding boxes and Zod validation.
              </p>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
                <span>Zod Validated (v1.0)</span>
              </div>
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
