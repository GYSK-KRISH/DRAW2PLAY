import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  Shield,
  Heart,
  Play,
  SlidersHorizontal,
  Bot,
  AlertCircle,
  HelpCircle,
  Cpu,
} from 'lucide-react';
import type { CharacterConfig, CharacterAttributes } from '../../types/game.js';

interface AnalysisPanelProps {
  characterConfig: CharacterConfig | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  analysisSource: 'gemini' | 'mock-heuristic' | null;
  onAttributeChange: (key: keyof CharacterAttributes, value: number) => void;
  onPlayClick: () => void;
  onClearError: () => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  characterConfig,
  isAnalyzing,
  analysisError,
  analysisSource,
  onAttributeChange,
  onPlayClick,
  onClearError,
}) => {
  const [showTuning, setShowTuning] = useState(false);

  return (
    <aside
      aria-label="AI Character Properties"
      className="w-full lg:w-80 shrink-0 bg-[#0a0e1c]/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col gap-4"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-400" />
          <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
            Image AI Synthesis
          </h2>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/25">
          gemini-3.8-flash
        </span>
      </div>

      {/* STATE 1: LOADING STATE */}
      {isAnalyzing && (
        <div className="my-auto py-8 flex flex-col items-center text-center animate-pulse">
          <div className="relative mb-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-purple-950/50">
              <Sparkles className="w-8 h-8 animate-spin" />
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-cyan-400/20 blur-lg -z-10 animate-ping" />
          </div>

          <h3 className="text-sm font-bold text-white">Synthesizing Character...</h3>
          <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
            Analyzing stroke contours, shape density, and gameplay physics attributes.
          </p>

          <div className="w-full bg-[#060914] rounded-full h-1.5 mt-5 overflow-hidden border border-slate-800">
            <div className="bg-gradient-to-r from-purple-500 to-cyan-400 h-1.5 rounded-full w-2/3 animate-pulse" />
          </div>
        </div>
      )}

      {/* STATE 2: ERROR STATE */}
      {!isAnalyzing && analysisError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Analysis Failed</span>
          </div>
          <p className="text-[11px] text-rose-300/90 leading-relaxed">
            {analysisError}
          </p>
          <button
            type="button"
            onClick={onClearError}
            className="self-end mt-1 px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-700/50 text-[10px] font-semibold text-rose-200 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* STATE 3: EMPTY STATE (No character analyzed yet) */}
      {!isAnalyzing && !analysisError && !characterConfig && (
        <div className="my-auto py-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#060914] border border-slate-800 flex items-center justify-center text-slate-500 mb-3.5 shadow-inner">
            <Cpu className="w-7 h-7 text-slate-500" />
          </div>
          <h3 className="text-sm font-bold text-slate-300">
            Awaiting Character Drawing
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 px-3 leading-relaxed">
            Draw your character on the canvas and trigger <strong className="text-purple-300">Analyze Drawing</strong>. The vision pipeline will interpret your strokes into archetype & stats.
          </p>

          {/* Archetype Quick Reference */}
          <div className="w-full mt-5 pt-4 border-t border-slate-800/80 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Archetype Detection Guide
              </span>
              <HelpCircle className="w-3 h-3 text-slate-600" />
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#060914] border border-slate-800/60">
                <span className="text-sky-300 font-semibold flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> Speedster
                </span>
                <span className="text-slate-500 text-[10px]">Sharp, narrow silhouette</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#060914] border border-slate-800/60">
                <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                  <Shield className="w-3 h-3" /> Tank
                </span>
                <span className="text-slate-500 text-[10px]">Bulky, dense mass</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#060914] border border-slate-800/60">
                <span className="text-purple-300 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Mystic
                </span>
                <span className="text-slate-500 text-[10px]">Light, floaty contours</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 4: ACTIVE CHARACTER DETAILS */}
      {!isAnalyzing && characterConfig && (
        <div className="flex flex-col gap-4">
          {/* Character Card Hero Preview */}
          <div className="p-3.5 rounded-xl bg-[#060914] border border-slate-800 flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
              <img
                src={characterConfig.drawingDataUrl}
                alt={characterConfig.attributes.name}
                className="w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(56,189,248,0.3)]"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-sm text-white truncate">
                  {characterConfig.attributes.name}
                </h3>
              </div>
              <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {characterConfig.attributes.archetype}
              </span>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                Source: {analysisSource === 'gemini' ? 'Gemini 3.8 Flash' : 'Heuristic Engine'}
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-[11px] text-slate-300 italic bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
            "{characterConfig.attributes.visualDescription}"
          </p>

          {/* Physics Metrics */}
          <div className="space-y-3">
            {/* Speed */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1 text-sky-400">
                  <Zap className="w-3 h-3" /> Speed
                </span>
                <span className="font-mono text-slate-300 text-[11px]">
                  {characterConfig.attributes.speed} px/s
                </span>
              </div>
              <div className="w-full bg-[#060914] rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div
                  className="bg-sky-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(characterConfig.attributes.speed / 400) * 100}%` }}
                />
              </div>
            </div>

            {/* Jump Power */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1 text-amber-400">
                  <Shield className="w-3 h-3" /> Jump Impulse
                </span>
                <span className="font-mono text-slate-300 text-[11px]">
                  {characterConfig.attributes.jumpPower} imp
                </span>
              </div>
              <div className="w-full bg-[#060914] rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(characterConfig.attributes.jumpPower / 600) * 100}%` }}
                />
              </div>
            </div>

            {/* Vitality */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1 text-rose-400">
                  <Heart className="w-3 h-3" /> Vitality
                </span>
                <span className="font-mono text-slate-300 text-[11px]">
                  {characterConfig.attributes.health} HP
                </span>
              </div>
              <div className="w-full bg-[#060914] rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div
                  className="bg-rose-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(characterConfig.attributes.health / 200) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Identified Visual Features */}
          {characterConfig.attributes.detectedFeatures.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Visual Traits Detected:
              </span>
              <div className="flex flex-wrap gap-1">
                {characterConfig.attributes.detectedFeatures.map((feat, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-slate-800/80 text-[10px] text-slate-300 border border-slate-700/60"
                  >
                    ✓ {feat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tuning Toggle & Sliders */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowTuning(!showTuning)}
              className="w-full py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center justify-between bg-[#060914] border border-slate-800 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <span>Fine-tune Physics Traits</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-400">
                {showTuning ? 'Hide' : 'Expand'}
              </span>
            </button>

            {showTuning && (
              <div className="mt-3 space-y-3 bg-[#060914] p-3 rounded-xl border border-slate-800">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Speed (px/s)</span>
                    <span className="font-mono text-cyan-300">{characterConfig.attributes.speed}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="400"
                    value={characterConfig.attributes.speed}
                    onChange={(e) => onAttributeChange('speed', Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Jump Power</span>
                    <span className="font-mono text-amber-300">{characterConfig.attributes.jumpPower}</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="600"
                    value={characterConfig.attributes.jumpPower}
                    onChange={(e) => onAttributeChange('jumpPower', Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Gravity Force</span>
                    <span className="font-mono text-purple-300">{characterConfig.attributes.gravity}</span>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="1200"
                    value={characterConfig.attributes.gravity}
                    onChange={(e) => onAttributeChange('gravity', Number(e.target.value))}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Play Primary Action Button */}
          <button
            type="button"
            onClick={onPlayClick}
            className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play With This Hero</span>
          </button>
        </div>
      )}
    </aside>
  );
};
