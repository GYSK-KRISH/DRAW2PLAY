import React, { useState } from 'react';
import {
  Layers,
  Mountain,
  Flame,
  Zap,
  Coins,
  Flag,
  Info,
  CheckCircle2,
  Clock,
  Bot,
  Box,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  type SceneSummary,
  type ExtractedSceneElement,
  ELEMENT_DEFINITIONS,
} from '../../types/sketch.js';

interface ScenePanelProps {
  summary: SceneSummary;
  canvasDimensions: { width: number; height: number };
  extractedElements?: ExtractedSceneElement[];
  geminiConfigured?: boolean;
}

export const ScenePanel: React.FC<ScenePanelProps> = ({
  summary,
  canvasDimensions,
  extractedElements = [],
  geminiConfigured = false,
}) => {
  const [showGeometryDetails, setShowGeometryDetails] = useState(false);

  return (
    <aside
      aria-label="Scene Summary and AI Status"
      className="w-full lg:w-80 shrink-0 bg-[#0a0e1c]/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col gap-4"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
            Scene Statistics
          </h2>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
          Deterministic Preprocessing
        </span>
      </div>

      {/* 1. Element Type Counts (Ground, Hazard, Trampoline, Coin, Goal) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Element Breakdown
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            Total: {summary.totalStrokes} strokes
          </span>
        </div>

        <div className="space-y-1.5">
          {/* Ground */}
          <div className="p-2 rounded-xl bg-[#060914] border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${ELEMENT_DEFINITIONS.ground.color}25`, color: ELEMENT_DEFINITIONS.ground.color }}
              >
                <Mountain className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">Ground</span>
                <span className="text-[10px] text-slate-500">Solid platform</span>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-800">
              {summary.elementCounts.ground}
            </span>
          </div>

          {/* Hazard */}
          <div className="p-2 rounded-xl bg-[#060914] border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${ELEMENT_DEFINITIONS.hazard.color}25`, color: ELEMENT_DEFINITIONS.hazard.color }}
              >
                <Flame className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">Hazard</span>
                <span className="text-[10px] text-slate-500">Spike traps</span>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-rose-400 border border-slate-800">
              {summary.elementCounts.hazard}
            </span>
          </div>

          {/* Trampoline */}
          <div className="p-2 rounded-xl bg-[#060914] border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${ELEMENT_DEFINITIONS.trampoline.color}25`, color: ELEMENT_DEFINITIONS.trampoline.color }}
              >
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">Trampoline</span>
                <span className="text-[10px] text-slate-500">Bounce pad</span>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-cyan-400 border border-slate-800">
              {summary.elementCounts.trampoline}
            </span>
          </div>

          {/* Coin */}
          <div className="p-2 rounded-xl bg-[#060914] border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${ELEMENT_DEFINITIONS.coin.color}25`, color: ELEMENT_DEFINITIONS.coin.color }}
              >
                <Coins className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">Coin</span>
                <span className="text-[10px] text-slate-500">Collectible</span>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800">
              {summary.elementCounts.coin}
            </span>
          </div>

          {/* Goal */}
          <div className="p-2 rounded-xl bg-[#060914] border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${ELEMENT_DEFINITIONS.goal.color}25`, color: ELEMENT_DEFINITIONS.goal.color }}
              >
                <Flag className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">Goal</span>
                <span className="text-[10px] text-slate-500">Destination</span>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-purple-400 border border-slate-800">
              {summary.elementCounts.goal}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Vector Geometry Preprocessing (Local Geometric Calculations) */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Extracted Geometry
            </span>
          </div>
          {extractedElements.length > 0 && (
            <button
              type="button"
              onClick={() => setShowGeometryDetails(!showGeometryDetails)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              <span>{showGeometryDetails ? 'Collapse' : 'Inspect'}</span>
              {showGeometryDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        <div className="p-3 rounded-xl bg-[#060914] border border-slate-800/80 space-y-1.5 text-[11px]">
          <div className="flex justify-between text-slate-400">
            <span>Extracted Vectors:</span>
            <span className="font-mono text-cyan-300 font-bold">
              {extractedElements.length} elements
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Viewport Dimensions:</span>
            <span className="font-mono text-slate-200">
              {canvasDimensions.width} × {canvasDimensions.height} px
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Sampled Points:</span>
            <span className="font-mono text-slate-200">
              {summary.totalPoints} points
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Vector Payload Size:</span>
            <span className="font-mono text-slate-200">
              ~{(summary.estimatedMemoryBytes / 1024).toFixed(1)} KB
            </span>
          </div>
          <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/60">
            <span>Level Readiness:</span>
            <span className="flex items-center gap-1 font-semibold text-emerald-400">
              {summary.hasGround && summary.hasGoal ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </>
              ) : (
                <span className="text-amber-400">Needs Ground & Goal</span>
              )}
            </span>
          </div>

          {/* Expandable Geometry Inspector */}
          {showGeometryDetails && extractedElements.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {extractedElements.map((el, idx) => (
                <div
                  key={el.strokeId}
                  className="p-1.5 rounded bg-slate-900/60 border border-slate-800 text-[10px] font-mono flex flex-col gap-0.5"
                >
                  <div className="flex justify-between text-slate-300 font-semibold">
                    <span className="uppercase text-cyan-400">
                      #{idx + 1} {el.elementType}
                    </span>
                    <span>{el.pointCount} pts</span>
                  </div>
                  <div className="text-slate-400 text-[9px]">
                    Bounds: [{el.bounds.x.toFixed(2)}, {el.bounds.y.toFixed(2)}] ({el.bounds.width.toFixed(2)}×{el.bounds.height.toFixed(2)})
                  </div>
                  <div className="text-slate-500 text-[9px]">
                    Centroid: ({el.centroid.x.toFixed(2)}, {el.centroid.y.toFixed(2)}) | Len: {el.length.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. FUTURE IMAGE-AI INTEGRATION (Explicitly Distinct from Local Geometry) */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-purple-400 shrink-0" />
              <h3 className="text-xs font-bold text-purple-200">
                Image-AI Pipeline Status
              </h3>
            </div>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                geminiConfigured
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
            >
              {geminiConfigured ? 'Gemini 3.8 Flash' : 'Offline Mock-Heuristic'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-amber-300/90 font-mono">
            <Clock className="w-3 h-3 shrink-0" />
            <span>Awaiting Phase 3 Vision Hand-off</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            In Phase 3, this canvas connects with Gemini Vision to interpret freehand doodles into physics assets. Preprocessing extracts geometry locally and deterministically.
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-1 border-t border-purple-500/20">
            <Info className="w-3 h-3 shrink-0" />
            <span>Local geometry extraction is never misrepresented as AI output.</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
