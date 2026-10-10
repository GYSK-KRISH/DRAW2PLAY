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
  Activity,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  type CanvasTool,
  type SceneElementType,
  type SceneSummary,
  ELEMENT_DEFINITIONS,
} from '../../types/sketch.js';

interface BottomStatusBarProps {
  currentTool: CanvasTool;
  selectedElement: SceneElementType;
  canvasDimensions: { width: number; height: number };
  drawingStatus: 'idle' | 'drawing';
  summary: SceneSummary;
}

export const BottomStatusBar: React.FC<BottomStatusBarProps> = ({
  currentTool,
  selectedElement,
  canvasDimensions,
  drawingStatus,
  summary,
}) => {
  const elementDef = ELEMENT_DEFINITIONS[selectedElement];

  const getToolIcon = () => {
    switch (currentTool) {
      case 'select':
        return <MousePointer className="w-3.5 h-3.5 text-slate-300" />;
      case 'eraser':
        return <Eraser className="w-3.5 h-3.5 text-purple-400" />;
      case 'brush':
      default:
        return <PenTool className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  const getElementIcon = () => {
    switch (selectedElement) {
      case 'ground':
        return <Mountain className="w-3.5 h-3.5" />;
      case 'hazard':
        return <Flame className="w-3.5 h-3.5" />;
      case 'trampoline':
        return <Zap className="w-3.5 h-3.5" />;
      case 'coin':
        return <Coins className="w-3.5 h-3.5" />;
      case 'goal':
        return <Flag className="w-3.5 h-3.5" />;
    }
  };

  return (
    <footer
      aria-label="Studio Status Bar"
      className="w-full bg-[#070a13]/90 backdrop-blur-md border-t border-slate-800/80 px-4 py-2 text-xs text-slate-400"
    >
      <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Active Tool and Selected Element */}
        <div className="flex items-center flex-wrap gap-3">
          {/* Active Tool */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e1424] border border-slate-800">
            {getToolIcon()}
            <span className="text-[11px] font-medium text-slate-300 capitalize">
              Tool: <strong>{currentTool}</strong>
            </span>
          </div>

          {/* Selected Element */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e1424] border border-slate-800">
            <span style={{ color: elementDef.color }}>
              {getElementIcon()}
            </span>
            <span className="text-[11px] font-medium text-slate-300">
              Element:{' '}
              <strong style={{ color: elementDef.color }}>{elementDef.label}</strong>
            </span>
            <span
              className="w-2 h-2 rounded-full ml-0.5"
              style={{ backgroundColor: elementDef.color }}
            />
          </div>

          {/* Drawing Status */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300">
              {drawingStatus === 'drawing' ? (
                <span className="text-cyan-400 font-semibold animate-pulse">
                  Drawing stroke...
                </span>
              ) : summary.totalStrokes > 0 ? (
                <span>
                  Ready (<strong className="text-slate-200">{summary.totalStrokes}</strong> strokes recorded)
                </span>
              ) : (
                <span className="text-slate-500">Empty canvas</span>
              )}
            </span>
          </div>
        </div>

        {/* Right: Dimensions, DPI, and Readiness */}
        <div className="flex items-center flex-wrap gap-3 text-[11px] font-mono text-slate-400">
          <div>
            Canvas: <span className="text-slate-200">{canvasDimensions.width} × {canvasDimensions.height}</span>
          </div>

          <div className="hidden sm:inline">
            Points: <span className="text-cyan-300">{summary.totalPoints}</span>
          </div>

          {/* Level Integrity */}
          <div className="flex items-center gap-1">
            {summary.hasGround && summary.hasGoal ? (
              <span className="flex items-center gap-1 text-emerald-400 font-sans font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Playable Level Draft
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400 font-sans">
                <AlertTriangle className="w-3.5 h-3.5" />
                {!summary.hasGround ? 'Missing Ground' : 'Missing Goal'}
              </span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
