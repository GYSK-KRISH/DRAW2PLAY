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
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Server,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import {
  type SceneSummary,
  type ExtractedSceneElement,
  ELEMENT_DEFINITIONS,
} from '../../types/sketch.js';
import type { AiPipelineStatus } from '../../types/aiStatus.js';

interface ScenePanelProps {
  summary: SceneSummary;
  canvasDimensions: { width: number; height: number };
  extractedElements?: ExtractedSceneElement[];
  geminiConfigured?: boolean;
  aiStatus?: AiPipelineStatus;
  onRefreshHealth?: () => void;
}

export const ScenePanel: React.FC<ScenePanelProps> = ({
  summary,
  canvasDimensions,
  extractedElements = [],
  geminiConfigured = false,
  aiStatus,
  onRefreshHealth,
}) => {
  const [showGeometryDetails, setShowGeometryDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefreshHealth && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefreshHealth();
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  const readiness = summary.readinessStatus || (summary.hasGround && summary.hasGoal ? 'ready' : 'missing-both');

  return (
    <aside
      aria-label="Scene Summary and AI Status"
      className="w-full lg:w-80 shrink-0 bg-[#080a12]/95 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col gap-4 text-slate-100"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
            Scene Statistics
          </h2>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800">
          Deterministic 2D
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
          <div className="p-2 rounded-xl bg-[#0d1122] border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${ELEMENT_DEFINITIONS.ground.color}25`, color: ELEMENT_DEFINITIONS.ground.color }}
              >
                <Mountain className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">Ground</span>
                <span className="text-[10px] text-slate-400">Solid platform</span>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-800">
              {summary.elementCounts.ground}
            </span>
          </div>

          {/* Hazard */}
          <div className="p-2 rounded-xl bg-[#0d1122] border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${ELEMENT_DEFINITIONS.hazard.color}25`, color: ELEMENT_DEFINITIONS.hazard.color }}
              >
                <Flame className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">Hazard</span>
                <span className="text-[10px] text-slate-400">Spike traps</span>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-rose-400 border border-slate-800">
              {summary.elementCounts.hazard}
            </span>
          </div>

          {/* Trampoline */}
          <div className="p-2 rounded-xl bg-[#0d1122] border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${ELEMENT_DEFINITIONS.trampoline.color}25`, color: ELEMENT_DEFINITIONS.trampoline.color }}
              >
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">Trampoline</span>
                <span className="text-[10px] text-slate-400">High jump spring</span>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800">
              {summary.elementCounts.trampoline}
            </span>
          </div>

          {/* Coin */}
          <div className="p-2 rounded-xl bg-[#0d1122] border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${ELEMENT_DEFINITIONS.coin.color}25`, color: ELEMENT_DEFINITIONS.coin.color }}
              >
                <Coins className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">Coin</span>
                <span className="text-[10px] text-slate-400">Score reward</span>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-yellow-400 border border-slate-800">
              {summary.elementCounts.coin}
            </span>
          </div>

          {/* Goal */}
          <div className="p-2 rounded-xl bg-[#0d1122] border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${ELEMENT_DEFINITIONS.goal.color}25`, color: ELEMENT_DEFINITIONS.goal.color }}
              >
                <Flag className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">Goal</span>
                <span className="text-[10px] text-slate-400">Finish line</span>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-purple-400 border border-slate-800">
              {summary.elementCounts.goal}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Extracted Geometry & Actionable Level Readiness */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Extracted Geometry
            </span>
          </div>
          {extractedElements.length > 0 && (
            <button
              type="button"
              onClick={() => setShowGeometryDetails(!showGeometryDetails)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-400 focus-visible:outline-none"
            >
              <span>{showGeometryDetails ? 'Collapse' : 'Inspect'}</span>
              {showGeometryDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        <div className="p-3 rounded-xl bg-[#0d1122] border border-slate-800/80 space-y-2 text-[11px]">
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

          {/* Granular Actionable Readiness Diagnostics */}
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Level Readiness:</span>
              {readiness === 'ready' && (
                <span className="flex items-center gap-1 font-bold text-emerald-400 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ready to Play</span>
                </span>
              )}
              {readiness === 'missing-ground' && (
                <span className="flex items-center gap-1 font-bold text-amber-400 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Missing Ground</span>
                </span>
              )}
              {readiness === 'missing-goal' && (
                <span className="flex items-center gap-1 font-bold text-amber-400 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Missing Goal</span>
                </span>
              )}
              {readiness === 'missing-both' && (
                <span className="flex items-center gap-1 font-bold text-amber-400 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Needs Ground & Goal</span>
                </span>
              )}
              {readiness === 'empty' && (
                <span className="flex items-center gap-1 font-semibold text-slate-400 text-[11px]">
                  <Info className="w-3.5 h-3.5" />
                  <span>Empty Canvas</span>
                </span>
              )}
            </div>

            {/* Actionable Guidance Tip */}
            {summary.actionableGuidance && (
              <p className="text-[10px] text-slate-400 leading-snug bg-slate-950/70 p-2 rounded-lg border border-slate-800/60">
                {summary.actionableGuidance}
              </p>
            )}
          </div>

          {/* Expandable Geometry Inspector */}
          {showGeometryDetails && extractedElements.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {extractedElements.map((el, idx) => (
                <div
                  key={el.strokeId}
                  className="p-1.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] font-mono flex flex-col gap-0.5"
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

      {/* 3. TRUTHFUL AI PIPELINE STATUS PANEL (Section G) */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="p-3.5 rounded-xl bg-[#0d1122] border border-slate-800 flex flex-col gap-2.5">
          {/* Header with Server & Refresh Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-purple-400 shrink-0" />
              <h3 className="text-xs font-bold text-white">
                AI Pipeline Status
              </h3>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Probe backend API and AI provider status"
              aria-label="Refresh AI status"
              className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors cursor-pointer disabled:opacity-50 focus-visible:ring-1 focus-visible:ring-cyan-400 focus-visible:outline-none"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>

          {/* Backend Connectivity Status */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1">
              <Server className="w-3 h-3 text-slate-500" />
              <span>Backend Server:</span>
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full ${aiStatus?.connectivity === 'offline' ? 'bg-rose-500' : aiStatus?.connectivity === 'checking' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className={aiStatus?.connectivity === 'offline' ? 'text-rose-400 font-semibold' : aiStatus?.connectivity === 'checking' ? 'text-amber-400' : 'text-emerald-400 font-semibold'}>
                {aiStatus?.connectivity === 'offline' ? 'Offline (port 3001)' : aiStatus?.connectivity === 'checking' ? 'Probing...' : 'Online (port 3001)'}
              </span>
            </span>
          </div>

          {/* Provider Configuration */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Provider Config:</span>
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                geminiConfigured
                  ? 'bg-purple-950/70 text-purple-300 border-purple-700/60'
                  : 'bg-amber-950/70 text-amber-300 border-amber-700/60'
              }`}
            >
              {geminiConfigured ? 'Gemini 3.8 Flash' : 'Deterministic Mock'}
            </span>
          </div>

          {/* Current Analysis Stage */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Analysis Stage:</span>
            <span className="font-mono text-[10px] uppercase font-bold text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
              {aiStatus?.activeStage || 'idle'}
            </span>
          </div>

          {/* Latest Provenance */}
          {aiStatus?.latestProvenance && aiStatus.latestProvenance !== 'none' && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Result Provenance:</span>
              <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                aiStatus.latestProvenance === 'gemini-vision'
                  ? 'bg-purple-900/40 text-purple-300 border-purple-700/60'
                  : 'bg-amber-900/40 text-amber-300 border-amber-700/60'
              }`}>
                {aiStatus.latestProvenance}
              </span>
            </div>
          )}

          {/* Last Error Category / Retry Availability */}
          {aiStatus?.lastErrorCategory && aiStatus.lastErrorCategory !== 'none' && (
            <div className="p-2 rounded-lg bg-rose-950/50 border border-rose-800/60 text-[10px] text-rose-300 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span>Last Error: {aiStatus.lastErrorCategory}</span>
                {aiStatus.retryAvailable && (
                  <span className="text-cyan-300 font-mono text-[9px] bg-slate-900 px-1.5 py-0.5 rounded">Retry Available</span>
                )}
              </div>
              {aiStatus.lastErrorMessage && (
                <p className="text-rose-400 text-[10px] leading-tight truncate">{aiStatus.lastErrorMessage}</p>
              )}
            </div>
          )}

          {/* Fallback & Provenance Truth Disclosure */}
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/60 space-y-1 text-[10px] text-slate-400">
            <div className="flex items-center gap-1 text-slate-300 font-semibold">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              <span>Truthful Provenance Model</span>
            </div>
            <p className="leading-relaxed text-slate-400 text-[10px]">
              {aiStatus?.fallbackReason
                ? aiStatus.fallbackReason
                : geminiConfigured
                ? 'Reference analysis uses Google Gemini Vision with strict schema contract validation.'
                : 'Heuristic mode active. Fallback outputs are truthfully flagged as mock-heuristic and never masquerade as Gemini Vision.'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
