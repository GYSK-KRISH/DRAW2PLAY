import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Sparkles, Maximize2, Shield, Zap, Wand2 } from 'lucide-react';
import type { ToolMode } from './DrawingToolbar.js';

export interface CanvasViewportHandle {
  getCanvasDataUrl: () => string;
  hasStrokes: () => boolean;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  loadPreset: (type: 'speedster' | 'golem' | 'mystic') => void;
}

interface CanvasViewportProps {
  currentTool: ToolMode;
  currentColor: string;
  brushSize: number;
  showGrid: boolean;
  isAnalyzing: boolean;
  onAnalyze: (dataUrl: string) => void;
  onStrokesChange?: (hasStrokes: boolean) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

export const CanvasViewport = forwardRef<CanvasViewportHandle, CanvasViewportProps>(({
  currentTool,
  currentColor,
  brushSize,
  showGrid,
  isAnalyzing,
  onAnalyze,
  onStrokesChange,
  onHistoryChange,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const [strokeCount, setStrokeCount] = useState(0);

  const saveCanvasState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => {
      const updated = [...prev.slice(-20), state];
      return updated;
    });
    setRedoStack([]);
  }, []);

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveCanvasState();
  }, [saveCanvasState]);

  // Notify parent of history change
  useEffect(() => {
    if (onHistoryChange) {
      onHistoryChange(history.length > 1, redoStack.length > 0);
    }
  }, [history.length, redoStack.length, onHistoryChange]);

  // Notify parent of strokes change
  useEffect(() => {
    if (onStrokesChange) {
      onStrokesChange(strokeCount > 0);
    }
  }, [strokeCount, onStrokesChange]);

  const handleUndo = useCallback(() => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const current = history[history.length - 1];
    const target = history[history.length - 2];
    if (current && target) {
      setRedoStack((prev) => [...prev, current]);
      setHistory((prev) => prev.slice(0, -1));
      ctx.putImageData(target, 0, 0);
      setStrokeCount((prev) => Math.max(0, prev - 1));
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nextState = redoStack[redoStack.length - 1];
    if (nextState) {
      setRedoStack((prev) => prev.slice(0, -1));
      setHistory((prev) => [...prev, nextState]);
      ctx.putImageData(nextState, 0, 0);
      setStrokeCount((prev) => prev + 1);
    }
  }, [redoStack]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveCanvasState();
    setStrokeCount(0);
  }, [saveCanvasState]);

  const handleLoadPreset = useCallback((type: 'speedster' | 'golem' | 'mystic') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (type === 'speedster') {
      // Speedster: Aerodynamic, lightning cyan wings & runner body
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Head
      ctx.beginPath();
      ctx.arc(200, 140, 42, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.stroke();

      // Wing ears
      ctx.beginPath();
      ctx.moveTo(200, 100);
      ctx.lineTo(265, 55);
      ctx.lineTo(225, 115);
      ctx.fillStyle = '#eab308';
      ctx.fill();
      ctx.stroke();

      // Torso
      ctx.strokeStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(200, 182);
      ctx.lineTo(190, 280);
      ctx.stroke();

      // Limbs in sprint
      ctx.beginPath();
      ctx.moveTo(190, 280);
      ctx.lineTo(130, 335);
      ctx.moveTo(190, 280);
      ctx.lineTo(270, 335);
      ctx.stroke();

      // Eye
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(220, 135, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'golem') {
      // Golem: Heavy green mass, wide body, armor plates
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#065f46';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.roundRect(110, 120, 180, 170, [25]);
      ctx.fill();
      ctx.stroke();

      // Shoulder plates
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(95, 150, 30, 0, Math.PI * 2);
      ctx.arc(305, 150, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Eyes
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(160, 180, 12, 0, Math.PI * 2);
      ctx.arc(240, 180, 12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Mystic: Floaty ethereal star-like sprite
      ctx.fillStyle = '#a855f7';
      ctx.strokeStyle = '#6b21a8';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(200, 180, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Floating halo
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(200, 95, 45, 16, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Glowing orbs
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(180, 175, 8, 0, Math.PI * 2);
      ctx.arc(220, 175, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    saveCanvasState();
    setStrokeCount(5);
  }, [saveCanvasState]);

  // Expose imperative API to parent via ref
  useImperativeHandle(ref, () => ({
    getCanvasDataUrl: () => {
      const canvas = canvasRef.current;
      return canvas ? canvas.toDataURL('image/png') : '';
    },
    hasStrokes: () => strokeCount > 0,
    undo: handleUndo,
    redo: handleRedo,
    clear: handleClear,
    canUndo: () => history.length > 1,
    canRedo: () => redoStack.length > 0,
    loadPreset: handleLoadPreset,
  }), [handleUndo, handleRedo, handleClear, handleLoadPreset, history.length, redoStack.length, strokeCount]);

  // Mouse / Touch Event Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveCanvasState();
      setStrokeCount((prev) => prev + 1);
    }
  };

  const triggerAnalyze = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onAnalyze(canvas.toDataURL('image/png'));
  };

  return (
    <section
      aria-label="Drawing Workspace"
      className="flex-1 bg-[#0a0e1c]/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col items-center justify-between min-h-[580px]"
    >
      {/* Viewport Top Header Info */}
      <div className="w-full flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="font-semibold text-slate-200">Canvas Surface</span>
          <span className="text-[11px] text-slate-500 font-mono">400×400 px</span>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono">
            {currentTool === 'eraser' ? 'Mode: Eraser' : `Color: ${currentColor}`}
          </span>
          <span className="hidden sm:inline px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono">
            Strokes: {strokeCount}
          </span>
        </div>
      </div>

      {/* Quick Character Presets Bar */}
      <div className="w-full flex items-center justify-between gap-2 mb-3 bg-[#060914] p-2 rounded-xl border border-slate-800/80">
        <span className="text-[11px] font-semibold text-slate-400 pl-1">
          Quick Inspo:
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleLoadPreset('speedster')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Zap className="w-3 h-3" />
            <span>Speedster</span>
          </button>
          <button
            type="button"
            onClick={() => handleLoadPreset('golem')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Shield className="w-3 h-3" />
            <span>Golem</span>
          </button>
          <button
            type="button"
            onClick={() => handleLoadPreset('mystic')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-purple-300 border border-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Wand2 className="w-3 h-3" />
            <span>Mystic</span>
          </button>
        </div>
      </div>

      {/* The Central Drawing Canvas Frame */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700/80 shadow-2xl bg-white my-auto">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          tabIndex={0}
          aria-label="Character drawing area. Click and drag to draw your hero."
          className={`touch-none block ${
            currentTool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'
          } focus-visible:ring-4 focus-visible:ring-cyan-400 focus-visible:outline-none`}
        />

        {/* Toggleable Grid Overlay */}
        {showGrid && (
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
              backgroundSize: '25px 25px',
            }}
          />
        )}

        {/* Center Guide Lines */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-15">
          <div className="w-full h-[1px] bg-slate-400" />
          <div className="h-full w-[1px] bg-slate-400 absolute" />
        </div>
      </div>

      {/* Viewport Bottom Action Strip */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 mt-3 border-t border-slate-800/80">
        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Draw inside the 400×400 canvas boundary</span>
        </div>

        <button
          type="button"
          onClick={triggerAnalyze}
          disabled={strokeCount === 0 || isAnalyzing}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-lg focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none ${
            strokeCount === 0 || isAnalyzing
              ? 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed opacity-60'
              : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white border-purple-500/30 shadow-purple-900/30 cursor-pointer active:scale-95'
          }`}
        >
          {isAnalyzing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Analyzing Sketch...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
              <span>Analyze Character</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
});

CanvasViewport.displayName = 'CanvasViewport';
