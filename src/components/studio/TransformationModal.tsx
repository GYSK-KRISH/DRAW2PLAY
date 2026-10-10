import React, { useState } from 'react';
import {
  Wand2,
  X,
  Sparkles,
  Play,
  BookmarkPlus,
  RotateCcw,
  AlertTriangle,
  Flame,
  Snowflake,
  Rocket,
  Trees,
  Zap,
  Coins,
  ArrowRight,
  Sliders,
  Check,
} from 'lucide-react';
import type { PlayableGameScene } from '../../types/scene.js';
import type { TransformLevelResponse } from '../../types/transformation.js';
import { transformLevelWithAi } from '../../services/api.js';
import { audioService } from '../../services/audioService.js';

interface TransformationModalProps {
  isOpen: boolean;
  currentScene: PlayableGameScene;
  geminiConfigured?: boolean;
  onApplyTransformation: (transformedScene: PlayableGameScene, saveToCreations?: boolean) => void;
  onClose: () => void;
}

const EXAMPLE_PROMPTS = [
  { label: 'Icy & Slippery', prompt: 'Make this level icy and slippery with falling snow', icon: Snowflake },
  { label: 'Lava Cavern', prompt: 'Turn this into a volcanic lava cavern with extra hazards', icon: Flame },
  { label: 'Moon Gravity', prompt: 'Create a cosmic space world with low gravity and 5 extra coins', icon: Rocket },
  { label: 'Peaceful Forest', prompt: 'Make a relaxing forest level for beginners (Easy)', icon: Trees },
  { label: 'Cyberpunk Run', prompt: 'Turn this into a high-speed neon cyberpunk city with cyber sparks', icon: Zap },
  { label: 'Coin Bounty', prompt: 'Add 8 additional bonus coins across platforms for treasure hunting', icon: Coins },
  { label: 'Super Jump', prompt: 'Boost player jump power for high platforming challenge', icon: Sliders },
];

export const TransformationModal: React.FC<TransformationModalProps> = ({
  isOpen,
  currentScene,
  geminiConfigured = false,
  onApplyTransformation,
  onClose,
}) => {
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<TransformLevelResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTransform = async () => {
    if (!prompt.trim()) return;

    audioService.playClick();
    setIsLoading(true);
    setError(null);

    try {
      const response = await transformLevelWithAi(currentScene, prompt.trim());
      setResult(response);
    } catch (err) {
      console.error('Level transformation failed:', err);
      setError((err as Error).message || 'Failed to transform level.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyAndPlay = () => {
    if (!result) return;
    audioService.playClick();
    onApplyTransformation(result.transformedScene, false);
    onClose();
  };

  const handleApplyAndSave = () => {
    if (!result) return;
    audioService.playClick();
    onApplyTransformation(result.transformedScene, true);
    onClose();
  };

  const handleReset = () => {
    audioService.playClick();
    setResult(null);
    setError(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transform-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div className="bg-[#0a0e1c] border border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative flex flex-col gap-4 text-slate-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="transform-dialog-title" className="text-white font-bold text-sm sm:text-base">
                Natural Language Level Transformation
              </h2>
              <p className="text-[11px] text-slate-400">
                Describe desired changes in plain English to transform theme, physics, coins, and difficulty.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input & Prompt Chips (Visible when not yet previewing result) */}
        {!result && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nl-transform-input" className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Your Transformation Prompt:</span>
                <span className="text-[11px] font-normal text-slate-400 font-mono">
                  Engine: {geminiConfigured ? 'Gemini 3.8 Flash' : 'Local Rules Fallback'}
                </span>
              </label>
              <textarea
                id="nl-transform-input"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTransform();
                  }
                }}
                placeholder="e.g. 'Make this level icy and slippery with falling snow', 'Add 5 coins and make hazards harder'..."
                className="w-full bg-[#060914] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all resize-none"
              />
            </div>

            {/* Quick Suggestion Chips */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Example Prompts:</span>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_PROMPTS.map((chip, idx) => {
                  const ChipIcon = chip.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        audioService.playClick();
                        setPrompt(chip.prompt);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-slate-700 text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
                    >
                      <ChipIcon className="w-3 h-3 text-cyan-400" />
                      <span>{chip.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Transform Action Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleTransform}
                disabled={isLoading || !prompt.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-900/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                {isLoading ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing Transformations...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Transform Level</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Results Preview (Shown once transformed) */}
        {result && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            {/* Provenance and Explanation */}
            <div className="p-3.5 rounded-xl bg-[#060914] border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>AI Transformation Result</span>
                </span>
                {/* Provenance Badge */}
                {result.source === 'gemini' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Gemini 3.8 Flash AI
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Deterministic Local Rules
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200 font-medium leading-relaxed">
                {result.explanation}
              </p>
            </div>

            {/* Warnings card if any */}
            {result.warnings.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  {result.warnings.map((w, idx) => (
                    <span key={idx}>{w}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Before vs. After Comparison Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {/* Theme */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Theme</span>
                <div className="flex items-center gap-1 font-bold">
                  <span className="text-slate-400 capitalize">{currentScene.world.theme}</span>
                  <ArrowRight className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="text-cyan-300 capitalize">{result.transformedScene.world.theme}</span>
                </div>
              </div>

              {/* Difficulty */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Difficulty</span>
                <div className="flex items-center gap-1 font-bold">
                  <span className="text-slate-400 capitalize">{currentScene.world.difficulty}</span>
                  <ArrowRight className="w-3 h-3 text-purple-400 shrink-0" />
                  <span className="text-purple-300 capitalize">{result.transformedScene.world.difficulty}</span>
                </div>
              </div>

              {/* Friction / Ice */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Friction</span>
                <div className="flex items-center gap-1 font-bold">
                  <span className="text-slate-400">
                    {currentScene.world.friction < 0.8 ? 'Slippery' : 'Grip'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className={result.transformedScene.world.friction < 0.8 ? 'text-cyan-300' : 'text-slate-200'}>
                    {result.transformedScene.world.friction < 0.8
                      ? `Ice (${result.transformedScene.world.friction})`
                      : 'Normal (1.0)'}
                  </span>
                </div>
              </div>

              {/* Coins */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Coins</span>
                <div className="flex items-center gap-1 font-bold">
                  <span className="text-slate-400">{currentScene.coins.length}</span>
                  <ArrowRight className="w-3 h-3 text-yellow-400 shrink-0" />
                  <span className="text-yellow-300">
                    {result.transformedScene.coins.length}
                    {result.transformedScene.coins.length > currentScene.coins.length && (
                      <span className="text-[10px] text-green-400 ml-1">
                        (+{result.transformedScene.coins.length - currentScene.coins.length})
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons: Play, Save to Creations, Revert */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Another Prompt</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyAndSave}
                  className="px-4 py-2 rounded-xl bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 border border-purple-700/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all hover:text-white"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-purple-300" />
                  <span>Apply & Save to Creations</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyAndPlay}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Transformed Level</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
