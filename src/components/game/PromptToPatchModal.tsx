import React, { useState } from 'react';
import {
  Wand2,
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  RefreshCw,
} from 'lucide-react';
import type { PlayableGameScene } from '../../types/scene.js';
import type {
  RemixLevelResponse,
  JsonPatchOperation,
  AffectedSystem,
} from '../../types/remix.js';

interface PromptToPatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeScene: PlayableGameScene;
  onApplyPatch: (
    newScene: PlayableGameScene,
    patch: JsonPatchOperation[],
    affectedSystems: AffectedSystem[],
    canHotUpdate: boolean
  ) => void;
  onRevert?: () => void;
  hasUndo?: boolean;
  currentVersion?: number;
}

const PRESET_PROMPTS = [
  { label: '🌋 Lava & Darker Theme', prompt: 'Make the environment darker and add orange lava with falling embers.' },
  { label: '🪙 More Collectibles', prompt: 'Increase the number of collectibles across the level.' },
  { label: '🦘 Easier Jumps', prompt: 'Make the level easier: boost player jump power and reduce enemy speed.' },
  { label: '🚩 Add Checkpoint', prompt: 'Add a checkpoint before the final jump.' },
  { label: '🧊 Icy Glacial Low-Friction', prompt: 'Transform the level to an icy glacial theme with low friction and snow.' },
  { label: '⚡ Fast Sprint Pace', prompt: 'Increase player running speed and add ambient sparks.' },
];

export const PromptToPatchModal: React.FC<PromptToPatchModalProps> = ({
  isOpen,
  onClose,
  activeScene,
  onApplyPatch,
  onRevert,
  hasUndo = false,
  currentVersion = 1,
}) => {
  const [instruction, setInstruction] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<RemixLevelResponse | null>(null);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGeneratePatch = async (promptToUse?: string) => {
    const text = (promptToUse || instruction).trim();
    if (!text) {
      setError('Please provide a remix instruction.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setPreviewResult(null);
    setAppliedNotice(null);

    try {
      const response = await fetch('/api/remix-level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneData: activeScene,
          currentVersion,
          instruction: text,
          templateId: activeScene.templateId,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to compute remix patch.');
      }

      setPreviewResult(data);
    } catch (err: any) {
      setError(err.message || 'Error communicating with remix engine.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (!previewResult || !previewResult.appliedScene) return;

    onApplyPatch(
      previewResult.appliedScene,
      previewResult.patch,
      previewResult.affectedSystems,
      previewResult.canHotUpdate
    );

    setAppliedNotice(
      previewResult.canHotUpdate
        ? 'Remix applied live! Phaser physics and presentation updated.'
        : 'Remix applied! Scene restaged with player progress preserved.'
    );

    setTimeout(() => {
      onClose();
      setPreviewResult(null);
      setAppliedNotice(null);
    }, 1200);
  };

  const handleDiscard = () => {
    setPreviewResult(null);
    setError(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="remix-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-2xl bg-[#090d1a] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/50 flex flex-col max-h-[90vh] overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#060914]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="remix-modal-title" className="text-sm font-bold text-white flex items-center gap-2">
                Live Prompt-to-Patch Game Remixing
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  v{currentVersion}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Modify gameplay & visuals via natural language without full-page reload
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Preset Prompts */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">
              Quick Remix Suggestions:
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_PROMPTS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInstruction(preset.prompt);
                    handleGeneratePatch(preset.prompt);
                  }}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-800/80 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/40 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Input Box */}
          <div>
            <label htmlFor="remix-instruction-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Natural Language Instruction:
            </label>
            <div className="relative">
              <textarea
                id="remix-instruction-input"
                rows={3}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g. 'Make the environment darker and add orange lava' or 'Increase collectibles and make jumps floatier'..."
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 resize-none"
              />
            </div>
          </div>

          {/* Action Buttons: Generate */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {hasUndo && onRevert && (
                <button
                  type="button"
                  onClick={onRevert}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  Revert to Previous
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleGeneratePatch()}
                disabled={isGenerating || !instruction.trim()}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md shadow-cyan-900/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Computing Patch...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate Patch
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Applied Success Notice */}
          {appliedNotice && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{appliedNotice}</span>
            </div>
          )}

          {/* Patch Preview Card */}
          {previewResult && !appliedNotice && (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Proposed Remix Patch
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      RFC 6902 ({previewResult.patch.length} ops)
                    </span>
                  </div>
                  <p className="text-xs text-cyan-200 font-medium">{previewResult.summary}</p>
                </div>

                {previewResult.canHotUpdate ? (
                  <span className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    Phaser Hot Update
                  </span>
                ) : (
                  <span className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                    <RotateCcw className="w-3 h-3 text-amber-400" />
                    Stateful Restage
                  </span>
                )}
              </div>

              {/* Affected Systems Badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400">Affected Systems:</span>
                {previewResult.affectedSystems.map((sys, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                  >
                    {sys}
                  </span>
                ))}
              </div>

              {/* Patch Operations List */}
              <div className="bg-black/60 rounded-lg p-2.5 font-mono text-[11px] max-h-32 overflow-y-auto space-y-1 text-slate-300 border border-slate-800">
                {previewResult.patch.map((op, idx) => (
                  <div key={idx} className="flex items-baseline gap-2">
                    <span
                      className={`uppercase font-bold text-[9px] px-1 rounded ${
                        op.op === 'replace'
                          ? 'bg-blue-500/30 text-blue-300'
                          : op.op === 'add'
                          ? 'bg-emerald-500/30 text-emerald-300'
                          : 'bg-red-500/30 text-red-300'
                      }`}
                    >
                      {op.op}
                    </span>
                    <span className="text-cyan-400">{op.path}</span>
                    {op.value !== undefined && (
                      <span className="text-slate-400 truncate">
                        = {typeof op.value === 'object' ? JSON.stringify(op.value) : String(op.value)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Preview Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Apply Patch to Game
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
