import React from 'react';
import {
  PenTool,
  Eraser,
  MousePointer,
  Mountain,
  Flame,
  Zap,
  Coins,
  Flag,
} from 'lucide-react';
import {
  type CanvasTool,
  type SceneElementType,
  ELEMENT_DEFINITIONS,
} from '../../types/sketch.js';

interface SketchToolbarProps {
  currentTool: CanvasTool;
  onSelectTool: (tool: CanvasTool) => void;
  selectedElement: SceneElementType;
  onSelectElement: (type: SceneElementType) => void;
  brushSize: number;
  onSelectBrushSize: (size: number) => void;
}

const BRUSH_SIZES = [
  { label: 'Fine', size: 4, desc: '4px - Precision accents' },
  { label: 'Normal', size: 8, desc: '8px - Default contour' },
  { label: 'Thick', size: 14, desc: '14px - Heavy surface' },
  { label: 'Heavy', size: 22, desc: '22px - Wide terrain blocks' },
];

export const SketchToolbar: React.FC<SketchToolbarProps> = ({
  currentTool,
  onSelectTool,
  selectedElement,
  onSelectElement,
  brushSize,
  onSelectBrushSize,
}) => {
  return (
    <aside
      aria-label="Studio Drawing Tools"
      className="w-full lg:w-64 shrink-0 bg-[#0a0e1c]/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col gap-5"
    >
      {/* 1. Tool Selection */}
      <div>
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block mb-2">
          Canvas Tools
        </span>
        <div className="grid grid-cols-3 gap-1.5 bg-[#060914] p-1.5 rounded-xl border border-slate-800/80">
          {/* Select Tool */}
          <button
            type="button"
            onClick={() => onSelectTool('select')}
            title="Select & Pan Tool"
            aria-pressed={currentTool === 'select'}
            className={`py-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
              currentTool === 'select'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <MousePointer className="w-4 h-4" />
            <span className="text-[10px]">Select</span>
          </button>

          {/* Brush Tool */}
          <button
            type="button"
            onClick={() => onSelectTool('brush')}
            title="Freehand Brush Tool"
            aria-pressed={currentTool === 'brush'}
            className={`py-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
              currentTool === 'brush'
                ? 'bg-gradient-to-b from-cyan-500/20 to-blue-600/30 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span className="text-[10px]">Brush</span>
          </button>

          {/* Eraser Tool */}
          <button
            type="button"
            onClick={() => onSelectTool('eraser')}
            title="Eraser Tool"
            aria-pressed={currentTool === 'eraser'}
            className={`py-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none ${
              currentTool === 'eraser'
                ? 'bg-gradient-to-b from-purple-500/20 to-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Eraser className="w-4 h-4" />
            <span className="text-[10px]">Eraser</span>
          </button>
        </div>
      </div>

      {/* 2. Brush Size Control */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Stroke Width
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

      {/* 3. Semantic Element Palette */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Element Palette
          </span>
          <span className="text-[10px] text-slate-500">Semantic Types</span>
        </div>

        <div className="flex flex-col gap-1.5">
          {/* Ground */}
          <button
            type="button"
            onClick={() => {
              onSelectElement('ground');
              if (currentTool === 'eraser' || currentTool === 'select') onSelectTool('brush');
            }}
            aria-pressed={selectedElement === 'ground' && currentTool === 'brush'}
            className={`w-full p-2.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
              selectedElement === 'ground' && currentTool === 'brush'
                ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/30'
                : 'bg-[#060914] border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/30'
            }`}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ backgroundColor: `${ELEMENT_DEFINITIONS.ground.color}25`, color: ELEMENT_DEFINITIONS.ground.color }}
            >
              <Mountain className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  {ELEMENT_DEFINITIONS.ground.label}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: ELEMENT_DEFINITIONS.ground.color }}
                />
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                {ELEMENT_DEFINITIONS.ground.description}
              </span>
            </div>
          </button>

          {/* Hazard */}
          <button
            type="button"
            onClick={() => {
              onSelectElement('hazard');
              if (currentTool === 'eraser' || currentTool === 'select') onSelectTool('brush');
            }}
            aria-pressed={selectedElement === 'hazard' && currentTool === 'brush'}
            className={`w-full p-2.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none ${
              selectedElement === 'hazard' && currentTool === 'brush'
                ? 'bg-rose-950/40 border-rose-500/60 shadow-md ring-1 ring-rose-500/30'
                : 'bg-[#060914] border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/30'
            }`}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ backgroundColor: `${ELEMENT_DEFINITIONS.hazard.color}25`, color: ELEMENT_DEFINITIONS.hazard.color }}
            >
              <Flame className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  {ELEMENT_DEFINITIONS.hazard.label}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: ELEMENT_DEFINITIONS.hazard.color }}
                />
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                {ELEMENT_DEFINITIONS.hazard.description}
              </span>
            </div>
          </button>

          {/* Trampoline */}
          <button
            type="button"
            onClick={() => {
              onSelectElement('trampoline');
              if (currentTool === 'eraser' || currentTool === 'select') onSelectTool('brush');
            }}
            aria-pressed={selectedElement === 'trampoline' && currentTool === 'brush'}
            className={`w-full p-2.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
              selectedElement === 'trampoline' && currentTool === 'brush'
                ? 'bg-cyan-950/40 border-cyan-500/60 shadow-md ring-1 ring-cyan-500/30'
                : 'bg-[#060914] border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/30'
            }`}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ backgroundColor: `${ELEMENT_DEFINITIONS.trampoline.color}25`, color: ELEMENT_DEFINITIONS.trampoline.color }}
            >
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  {ELEMENT_DEFINITIONS.trampoline.label}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: ELEMENT_DEFINITIONS.trampoline.color }}
                />
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                {ELEMENT_DEFINITIONS.trampoline.description}
              </span>
            </div>
          </button>

          {/* Coin */}
          <button
            type="button"
            onClick={() => {
              onSelectElement('coin');
              if (currentTool === 'eraser' || currentTool === 'select') onSelectTool('brush');
            }}
            aria-pressed={selectedElement === 'coin' && currentTool === 'brush'}
            className={`w-full p-2.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none ${
              selectedElement === 'coin' && currentTool === 'brush'
                ? 'bg-amber-950/40 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                : 'bg-[#060914] border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/30'
            }`}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ backgroundColor: `${ELEMENT_DEFINITIONS.coin.color}25`, color: ELEMENT_DEFINITIONS.coin.color }}
            >
              <Coins className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  {ELEMENT_DEFINITIONS.coin.label}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: ELEMENT_DEFINITIONS.coin.color }}
                />
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                {ELEMENT_DEFINITIONS.coin.description}
              </span>
            </div>
          </button>

          {/* Goal */}
          <button
            type="button"
            onClick={() => {
              onSelectElement('goal');
              if (currentTool === 'eraser' || currentTool === 'select') onSelectTool('brush');
            }}
            aria-pressed={selectedElement === 'goal' && currentTool === 'brush'}
            className={`w-full p-2.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none ${
              selectedElement === 'goal' && currentTool === 'brush'
                ? 'bg-purple-950/40 border-purple-500/60 shadow-md ring-1 ring-purple-500/30'
                : 'bg-[#060914] border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/30'
            }`}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ backgroundColor: `${ELEMENT_DEFINITIONS.goal.color}25`, color: ELEMENT_DEFINITIONS.goal.color }}
            >
              <Flag className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  {ELEMENT_DEFINITIONS.goal.label}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: ELEMENT_DEFINITIONS.goal.color }}
                />
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                {ELEMENT_DEFINITIONS.goal.description}
              </span>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
};
