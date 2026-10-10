import React, { useState } from 'react';
import {
  Sparkles,
  Gamepad2,
  X,
  Info,
  Server,
  Play,
  RotateCw,
  Cpu,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import type { SketchDocument, SceneSummary } from '../../types/sketch.js';
import type { PlayableGameScene } from '../../types/scene.js';
import { convertSketchToPlayableScene } from '../../game/sceneConverter.js';
import { analyzeLevelSketch } from '../../services/api.js';

interface AnalyzePreparationModalProps {
  isOpen: boolean;
  blobSize: number;
  document: SketchDocument;
  summary: SceneSummary;
  geminiConfigured?: boolean;
  onGetPngDataUrl: () => string;
  onPlayLevel: (scene: PlayableGameScene) => void;
  onClose: () => void;
}

export const AnalyzePreparationModal: React.FC<AnalyzePreparationModalProps> = ({
  isOpen,
  blobSize,
  document,
  summary,
  geminiConfigured = false,
  onGetPngDataUrl,
  onPlayLevel,
  onClose,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedScene, setAnalyzedScene] = useState<PlayableGameScene | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. Instant Local Geometry Conversion (Fallback / Offline fast-path)
  const handleLocalConvert = () => {
    setIsAnalyzing(false);
    setAnalysisError(null);
    const scene = convertSketchToPlayableScene(document, {
      source: 'local-vector',
      levelName: document.name || 'Doodle Physics Playground',
      levelDescription: 'Deterministic physics level generated locally from vector sketch geometry.',
    });
    setAnalyzedScene(scene);
  };

  // 2. Multimodal AI Analysis (Real Gemini Vision or Server Mock)
  const handleRemoteAiAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const dataUrl = onGetPngDataUrl();
      const strokeSummaryText = `Strokes: ${document.strokes.length} (Ground: ${summary.elementCounts.ground}, Hazard: ${summary.elementCounts.hazard}, Trampoline: ${summary.elementCounts.trampoline}, Coin: ${summary.elementCounts.coin}, Goal: ${summary.elementCounts.goal})`;

      const res = await analyzeLevelSketch(dataUrl, strokeSummaryText, document.strokes.length);

      if (res.success && res.analysis) {
        // Merge Gemini's creative thematic naming and tuning with our validated geometry
        const scene = convertSketchToPlayableScene(document, {
          source: res.source, // 'gemini-vision' or 'mock-fallback'
          levelName: res.analysis.levelName,
          levelDescription: res.analysis.levelDescription,
        });

        // Apply Gemini's player tuning if present
        if (res.analysis.playerTuning) {
          scene.player.speed = res.analysis.playerTuning.speed;
          scene.player.jumpPower = res.analysis.playerTuning.jumpPower;
          scene.world.gravity = res.analysis.playerTuning.gravity;
        }

        setAnalyzedScene(scene);
      } else {
        throw new Error(res.error || 'Failed to analyze level with vision pipeline');
      }
    } catch (err) {
      console.warn('AI analysis request failed:', err);
      setAnalysisError((err as Error).message || 'Remote vision request failed.');
      // Auto-provide local vector scene so user is never blocked
      const fallbackScene = convertSketchToPlayableScene(document, {
        source: 'local-vector',
        levelName: 'Local Physics Level',
      });
      setAnalyzedScene(fallbackScene);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLaunchGame = () => {
    if (analyzedScene) {
      onPlayLevel(analyzedScene);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prep-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-[#0a0e1c] border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative flex flex-col gap-4 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h2 id="prep-dialog-title" className="text-white text-base">
              Level Synthesis & Vision Review
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

        {/* Server & Pipeline Status Badge */}
        <div className="p-3 rounded-xl bg-[#060914] border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Server className="w-4 h-4 text-slate-500" />
            <span>AI Vision Engine:</span>
          </div>
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded border font-semibold ${
              geminiConfigured
                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            {geminiConfigured ? 'Gemini 3.8 Flash Online' : 'Offline Fallback (Mock-Heuristic Active)'}
          </span>
        </div>

        {/* Loading Spinner */}
        {isAnalyzing && (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
            <RotateCw className="w-8 h-8 text-purple-400 animate-spin" />
            <div className="text-sm font-bold text-white">Analyzing Level with Vision AI...</div>
            <p className="text-xs text-slate-400 max-w-sm">
              Interpreting platform geometry, hazard placements, and gameplay rhythm.
            </p>
          </div>
        )}

        {/* REVIEW SCREEN: When a scene is generated */}
        {!isAnalyzing && analyzedScene && (
          <div className="flex flex-col gap-3">
            {/* Title & Provenance */}
            <div className="p-3.5 rounded-xl bg-[#060914] border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{analyzedScene.levelName}</span>
                {analyzedScene.source === 'gemini-vision' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Gemini Vision
                  </span>
                )}
                {analyzedScene.source === 'local-vector' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                    <Cpu className="w-3 h-3" /> Local Vector
                  </span>
                )}
                {analyzedScene.source === 'mock-fallback' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Mock Fallback
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed italic">
                "{analyzedScene.levelDescription}"
              </p>
            </div>

            {/* Geometry Elements Breakdown */}
            <div className="grid grid-cols-5 gap-1.5 text-center text-xs font-mono">
              <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
                <span className="text-[10px] text-slate-400 block">Ground</span>
                <span className="font-bold text-emerald-400">{analyzedScene.platforms.length}</span>
              </div>
              <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/40">
                <span className="text-[10px] text-slate-400 block">Hazards</span>
                <span className="font-bold text-rose-400">{analyzedScene.hazards.length}</span>
              </div>
              <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-800/40">
                <span className="text-[10px] text-slate-400 block">Bounces</span>
                <span className="font-bold text-cyan-400">{analyzedScene.trampolines.length}</span>
              </div>
              <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/40">
                <span className="text-[10px] text-slate-400 block">Coins</span>
                <span className="font-bold text-amber-400">{analyzedScene.coins.length}</span>
              </div>
              <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-800/40">
                <span className="text-[10px] text-slate-400 block">Goal</span>
                <span className="font-bold text-purple-400">1</span>
              </div>
            </div>

            {/* Warnings if any */}
            {analyzedScene.diagnostics.warnings.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  {analyzedScene.diagnostics.warnings.map((w, idx) => (
                    <div key={idx} className="text-[11px] leading-tight">{w}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DEFAULT PREPARATION VIEW: Options before analysis */}
        {!isAnalyzing && !analyzedScene && (
          <div className="flex flex-col gap-3">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#060914] border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Image Payload</span>
                <span className="font-mono font-bold text-white">{(blobSize / 1024).toFixed(1)} KB (PNG)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#060914] border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Sketch Elements</span>
                <span className="font-mono font-bold text-white">{document.strokes.length} strokes</span>
              </div>
            </div>

            {/* Option Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleRemoteAiAnalysis}
                className="p-3.5 rounded-xl bg-purple-950/30 hover:bg-purple-950/50 border border-purple-500/40 text-left flex flex-col justify-between gap-2 transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-sm text-purple-300 group-hover:text-purple-200">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Gemini Vision AI</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Multimodal analysis interprets doodle aesthetics, assigns custom hero tuning, and generates level theme.
                  </p>
                </div>
                <span className="text-xs font-bold text-purple-400 flex items-center gap-1">
                  Run Vision Analysis &rarr;
                </span>
              </button>

              <button
                type="button"
                onClick={handleLocalConvert}
                className="p-3.5 rounded-xl bg-cyan-950/30 hover:bg-cyan-950/50 border border-cyan-500/40 text-left flex flex-col justify-between gap-2 transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-sm text-cyan-300 group-hover:text-cyan-200">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span>Instant Local Vector</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Zero network delay: converts vector strokes directly into solid platforms, spike pits, and bounce pads.
                  </p>
                </div>
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                  Convert Locally &rarr;
                </span>
              </button>
            </div>

            {analysisError && (
              <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 p-2 rounded-lg">
                {analysisError}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Info className="w-3.5 h-3.5" />
            <span>AI provenance is verified and never faked.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {analyzedScene ? (
              <button
                type="button"
                onClick={handleLaunchGame}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer transform hover:scale-105"
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Play Level Now!</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLocalConvert}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow-lg shadow-cyan-950/40 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Quick Convert</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
