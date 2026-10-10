import React from 'react';
import {
  PenTool,
  Eraser,
  Grid,
  Undo2,
  Redo2,
  Trash2,
  PaintBucket,
} from 'lucide-react';

export type ToolMode = 'brush' | 'eraser';

interface DrawingToolbarProps {
  currentTool: ToolMode;
  onSelectTool: (tool: ToolMode) => void;
  currentColor: string;
  onSelectColor: (color: string) => void;
  brushSize: number;
  onSelectBrushSize: (size: number) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

const PALETTE = [
  { name: 'Carbon Ink', hex: '#0f172a' },
  { name: 'Neon Cyan', hex: '#06b6d4' },
  { name: 'Electric Gold', hex: '#eab308' },
  { name: 'Magma Red', hex: '#ef4444' },
  { name: 'Acid Green', hex: '#22c55e' },
  { name: 'Royal Purple', hex: '#a855f7' },
  { name: 'Hot Pink', hex: '#ec4899' },
  { name: 'Titanium White', hex: '#ffffff' },
];

const BRUSH_SIZES = [
  { label: 'S', size: 4, desc: 'Fine Detail' },
  { label: 'M', size: 8, desc: 'Normal Contour' },
  { label: 'L', size: 14, desc: 'Bold Silhouette' },
  { label: 'XL', size: 22, desc: 'Heavy Block' },
];

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  currentTool,
  onSelectTool,
  currentColor,
  onSelectColor,
  brushSize,
  onSelectBrushSize,
  showGrid,
  onToggleGrid,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
}) => {
  return (
    <aside
      aria-label="Drawing Tools"
      className="w-full lg:w-56 shrink-0 bg-[#0a0e1c]/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col gap-5"
    >
      {/* 1. Tool Mode Selection */}
      <div>
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block mb-2">
          Drawing Tools
        </span>
        <div className="grid grid-cols-3 gap-1.5 bg-[#060914] p-1.5 rounded-xl border border-slate-800/80">
          {/* Pen / Brush */}
          <button
            type="button"
            onClick={() => onSelectTool('brush')}
            title="Brush Tool"
            aria-pressed={currentTool === 'brush'}
            className={`py-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
              currentTool === 'brush'
                ? 'bg-gradient-to-b from-cyan-500/20 to-blue-600/30 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span className="text-[10px]">Brush</span>
          </button>

          {/* Eraser */}
          <button
            type="button"
            onClick={() => onSelectTool('eraser')}
            title="Eraser Tool"
            aria-pressed={currentTool === 'eraser'}
            className={`py-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none ${
              currentTool === 'eraser'
                ? 'bg-gradient-to-b from-purple-500/20 to-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Eraser className="w-4 h-4" />
            <span className="text-[10px]">Eraser</span>
          </button>

          {/* Fill Tool (Clearly marked as Phase 2 to prevent dead button confusion) */}
          <div className="relative group flex flex-col items-center justify-center">
            <button
              type="button"
              disabled
              title="Smart Bucket Fill (Coming in Phase 2)"
              aria-disabled="true"
              className="w-full py-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 text-slate-600 opacity-40 cursor-not-allowed border border-transparent"
            >
              <PaintBucket className="w-4 h-4" />
              <span className="text-[10px]">Fill</span>
            </button>
            <span className="absolute -top-7 hidden group-hover:block bg-slate-900 text-amber-300 text-[10px] px-2 py-0.5 rounded border border-slate-700 whitespace-nowrap shadow-lg z-50">
              Phase 2
            </span>
          </div>
        </div>
      </div>

      {/* 2. Brush Size Selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Stroke Size
          </span>
          <span className="text-xs font-mono text-cyan-400">{brushSize}px</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 bg-[#060914] p-1.5 rounded-xl border border-slate-800/80">
          {BRUSH_SIZES.map((b) => (
            <button
              key={b.size}
              type="button"
              onClick={() => onSelectBrushSize(b.size)}
              title={b.desc}
              aria-pressed={brushSize === b.size}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                brushSize === b.size
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Color Swatches */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Color Palette
          </span>
          <div
            className="w-4 h-4 rounded-full border border-white/40 shadow-sm"
            style={{ backgroundColor: currentColor }}
            title={`Active: ${currentColor}`}
          />
        </div>
        <div className="grid grid-cols-4 gap-2 bg-[#060914] p-2.5 rounded-xl border border-slate-800/80">
          {PALETTE.map((c) => {
            const isSelected = currentColor === c.hex && currentTool === 'brush';
            return (
              <button
                key={c.hex}
                type="button"
                onClick={() => {
                  onSelectColor(c.hex);
                  if (currentTool === 'eraser') onSelectTool('brush');
                }}
                title={c.name}
                aria-label={c.name}
                className={`w-8 h-8 rounded-lg transition-transform cursor-pointer relative flex items-center justify-center border focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                  isSelected
                    ? 'scale-110 border-white shadow-md ring-2 ring-cyan-400'
                    : 'border-slate-800/80 hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
              >
                {isSelected && (
                  <span className={`w-2 h-2 rounded-full ${c.hex === '#ffffff' ? 'bg-black' : 'bg-white'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Canvas Utility Actions */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          Canvas Actions
        </span>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo stroke"
            aria-label="Undo"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 bg-[#060914] hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo stroke"
            aria-label="Redo"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 bg-[#060914] hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span>Redo</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onToggleGrid}
            title="Toggle Canvas Grid"
            aria-pressed={showGrid}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
              showGrid
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                : 'bg-[#060914] text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grid {showGrid ? 'On' : 'Off'}</span>
          </button>

          <button
            type="button"
            onClick={onClear}
            title="Clear canvas"
            aria-label="Clear Canvas"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 bg-[#060914] hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
