import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Paintbrush,
  Eraser,
  RotateCcw,
  Sparkles,
  Hammer,
  Eye,
  Info,
} from 'lucide-react';
import { audioService } from '../../services/audioService.js';
import type { CraftSubmission } from '../../types/sandbox.js';

interface DrawToCraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCraft: (submission: CraftSubmission) => void;
}

export const DrawToCraftModal: React.FC<DrawToCraftModalProps> = ({
  isOpen,
  onClose,
  onSubmitCraft,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState<number>(6);
  const [strokeCount, setStrokeCount] = useState<number>(0);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Submitted preview state
  const [submittedPreview, setSubmittedPreview] = useState<string | null>(null);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save initial state to history
    const initial = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([initial]);
    setHistoryIndex(0);
    setStrokeCount(0);
    setSubmittedPreview(null);
  }, []);

  // Initialize canvas when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        clearCanvas();
      }, 50);
    }
  }, [isOpen, clearCanvas]);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setStrokeCount((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    audioService.playClick();
    const targetIndex = historyIndex - 1;
    ctx.putImageData(history[targetIndex], 0, 0);
    setHistoryIndex(targetIndex);
    setStrokeCount((prev) => Math.max(0, prev - 1));
  };

  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = tool === 'brush' ? '#38bdf8' : '#0f172a';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveToHistory();
  };

  // Submit sketch to prepare for Phase 7.2 recognition
  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    audioService.playCraft();
    const dataUrl = canvas.toDataURL('image/png');
    setSubmittedPreview(dataUrl);

    const submission: CraftSubmission = {
      id: `craft-sub-${Date.now()}`,
      strokesCount: strokeCount,
      submittedAt: new Date().toISOString(),
      thumbnailDataUrl: dataUrl,
      status: 'submitted-pending-recognition',
    };

    onSubmitCraft(submission);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b1329] border border-cyan-800/40 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl shadow-cyan-950/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-900/30 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Hammer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                Draw to Craft
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/50 font-mono">
                  Sandbox Prototype
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sketch any tool, sword, or item to prepare for AI craft recognition
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              audioService.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          {/* Drawing Canvas Area */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Paintbrush className="w-3.5 h-3.5 text-cyan-400" />
                Crafting Canvas ({strokeCount} strokes)
              </span>

              {/* Canvas Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    audioService.playClick();
                    setTool('brush');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                    tool === 'brush'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Draw Brush"
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  Brush
                </button>
                <button
                  onClick={() => {
                    audioService.playClick();
                    setTool('eraser');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                    tool === 'eraser'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Eraser"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Eraser
                </button>
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Undo Stroke"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    audioService.playClick();
                    clearCanvas();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs transition-colors"
                  title="Clear Canvas"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Brush Size Slider */}
            <div className="flex items-center gap-3 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400">
              <span>Size:</span>
              <input
                type="range"
                min="2"
                max="18"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                className="w-28 accent-cyan-500 cursor-pointer"
              />
              <span className="font-mono text-cyan-400">{brushSize}px</span>
            </div>

            {/* Canvas Viewport */}
            <div className="relative rounded-xl border border-cyan-900/40 overflow-hidden bg-[#0f172a] shadow-inner flex justify-center">
              <canvas
                ref={canvasRef}
                width={500}
                height={260}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="cursor-crosshair touch-none w-full max-w-[500px] h-[260px]"
              />
            </div>
          </div>

          {/* Submission Preview & Phase 7.2 Notice */}
          {submittedPreview ? (
            <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/50 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  Drawing Submitted Successfully!
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40 font-mono">
                  Ready for Phase 7.2
                </span>
              </div>
              <div className="flex items-center gap-3">
                <img
                  src={submittedPreview}
                  alt="Submitted sketch"
                  className="w-20 h-14 object-contain rounded-lg border border-cyan-800/50 bg-[#0f172a]"
                />
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your sketch blueprint has been registered in the sandbox crafting queue. In{' '}
                  <strong className="text-cyan-400">Phase 7.2</strong>, local sketch recognition models
                  will analyze your drawing and forge craftable weapons, picks, and torches directly into your hotbar!
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 text-xs text-slate-400">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-slate-200">How it works:</strong> Draw an item outline (like a pickaxe, axe, sword, or torch). Submitting preserves your vector blueprint without fake predictions until local model recognition is connected in Phase 7.2.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-cyan-900/30 bg-slate-900/50">
          <button
            onClick={() => {
              audioService.playClick();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={strokeCount === 0}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Sparkles className="w-4 h-4" />
            {submittedPreview ? 'Update Drawing' : 'Submit Drawing'}
          </button>
        </div>
      </div>
    </div>
  );
};
