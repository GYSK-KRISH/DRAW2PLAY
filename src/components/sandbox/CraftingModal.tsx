import React, { useState, useEffect } from 'react';
import {
  X,
  Hammer,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Layers,
  Sparkles,
  Package,
} from 'lucide-react';
import { audioService } from '../../services/audioService.js';
import type { SandboxInventory, CraftingRecipe } from '../../types/sandbox.js';
import {
  CRAFTING_RECIPES,
  canCraftRecipe,
  calculateMaxCraftable,
} from '../../game/sandbox/sandboxRecipes.js';
import { SANDBOX_ITEM_CATALOGUE } from '../../types/sandbox.js';

interface CraftingModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: SandboxInventory;
  onCraftRecipe: (recipeId: string, batches?: number) => void;
}

type RecipeCategoryFilter = 'all' | 'basic' | 'building' | 'utility';

export const CraftingModal: React.FC<CraftingModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onCraftRecipe,
}) => {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(CRAFTING_RECIPES[0]?.id || '');
  const [categoryFilter, setCategoryFilter] = useState<RecipeCategoryFilter>('all');
  const [craftBatches, setCraftBatches] = useState<number>(1);
  const [lastCraftedFeedback, setLastCraftedFeedback] = useState<string | null>(null);

  // Keyboard shortcut: Escape or 'C' closes the modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        audioService.playClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredRecipes = CRAFTING_RECIPES.filter((r) => {
    if (categoryFilter === 'all') return true;
    return r.category === categoryFilter;
  });

  const selectedRecipe = CRAFTING_RECIPES.find((r) => r.id === selectedRecipeId) || CRAFTING_RECIPES[0];
  const maxCraftable = selectedRecipe ? calculateMaxCraftable(inventory, selectedRecipe.id) : 0;
  const craftCheck = selectedRecipe ? canCraftRecipe(inventory, selectedRecipe.id) : { canCraft: false, missingIngredients: [] };

  const handleCraft = (batches = 1) => {
    if (!selectedRecipe) return;
    audioService.playCraft();
    onCraftRecipe(selectedRecipe.id, batches);
    const outItem = SANDBOX_ITEM_CATALOGUE[selectedRecipe.output.itemId];
    const totalOut = selectedRecipe.output.count * batches;
    setLastCraftedFeedback(`Crafted ${totalOut}x ${outItem?.displayName ?? selectedRecipe.name}!`);
    setTimeout(() => setLastCraftedFeedback(null), 2500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="crafting-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl bg-[#0b1329] border border-cyan-800/40 rounded-3xl shadow-2xl shadow-cyan-950/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-900/30 bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
              <Hammer className="w-5 h-5" />
            </div>
            <div>
              <h2 id="crafting-modal-title" className="text-base sm:text-lg font-bold text-white tracking-wide">
                Artisan Crafting Station
              </h2>
              <p className="text-xs text-slate-400">
                Combine raw materials into refined building blocks, tools, and utilities
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              audioService.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close crafting modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FEEDBACK TOAST BANNER */}
        {lastCraftedFeedback && (
          <div className="px-6 py-2 bg-emerald-950/80 border-b border-emerald-800/40 flex items-center gap-2 text-xs font-semibold text-emerald-300 animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{lastCraftedFeedback}</span>
          </div>
        )}

        {/* MAIN BODY: 2 COLUMN SPLIT */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
          {/* LEFT COLUMN: RECIPE LIST & FILTERS (5 cols) */}
          <div className="md:col-span-5 p-4 sm:p-5 flex flex-col gap-3 overflow-hidden bg-slate-950/40">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['all', 'basic', 'building', 'utility'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    audioService.playClick();
                    setCategoryFilter(cat);
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-950/60'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {cat === 'all' ? 'All Recipes' : cat}
                </button>
              ))}
            </div>

            {/* Recipes Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredRecipes.map((recipe: CraftingRecipe) => {
                const isSelected = selectedRecipe?.id === recipe.id;
                const canCraft = calculateMaxCraftable(inventory, recipe.id) > 0;
                const outDef = SANDBOX_ITEM_CATALOGUE[recipe.output.itemId];

                return (
                  <button
                    key={recipe.id}
                    onClick={() => {
                      audioService.playClick();
                      setSelectedRecipeId(recipe.id);
                      setCraftBatches(1);
                    }}
                    className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-500 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-500/40'
                        : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-xl shrink-0 shadow-inner">
                        {outDef?.icon || '📦'}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-1.5">
                          <span>{recipe.name}</span>
                          <span className="text-xs text-cyan-400 font-mono">x{recipe.output.count}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 capitalize">{recipe.category}</span>
                      </div>
                    </div>

                    <div>
                      {canCraft ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
                          Ready
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/60 border border-slate-700/60 text-slate-500">
                          Need Mats
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: RECIPE DETAILS & CRAFT ACTION (7 cols) */}
          <div className="md:col-span-7 p-5 sm:p-6 flex flex-col justify-between overflow-y-auto bg-[#070d1e]/50">
            {selectedRecipe ? (
              <div className="space-y-6">
                {/* Recipe Output Banner */}
                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-3xl shrink-0 shadow-lg shadow-cyan-950/40">
                    {SANDBOX_ITEM_CATALOGUE[selectedRecipe.output.itemId]?.icon || '📦'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>{selectedRecipe.name}</span>
                      <span className="text-cyan-400 font-mono text-sm">
                        x{selectedRecipe.output.count * craftBatches}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">{selectedRecipe.description}</p>
                  </div>
                </div>

                {/* Required Ingredients Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-slate-400">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      Required Materials
                    </span>
                    <span>
                      Owned in Inventory
                    </span>
                  </div>

                  <div className="space-y-2">
                    {selectedRecipe.inputs.map((input) => {
                      const itemDef = SANDBOX_ITEM_CATALOGUE[input.itemId];
                      const totalNeeded = input.count * craftBatches;
                      const owned = inventory.items[input.itemId] ?? 0;
                      const hasEnough = owned >= totalNeeded;

                      return (
                        <div
                          key={input.itemId}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                            hasEnough
                              ? 'bg-slate-900/40 border-slate-800'
                              : 'bg-rose-950/20 border-rose-900/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">{itemDef?.icon || '🧱'}</span>
                            <div>
                              <div className="text-sm font-semibold text-white">
                                {itemDef?.displayName || input.itemId}
                              </div>
                              <span className="text-[11px] text-slate-400">
                                Need {totalNeeded} ({input.count} per craft)
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-sm font-mono font-bold ${
                                hasEnough ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {owned} / {totalNeeded}
                            </span>
                            <div className="text-[10px] text-slate-500">
                              {hasEnough ? 'Available' : 'Missing'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Status Callout if materials missing */}
                {!craftCheck.canCraft && craftCheck.reason && (
                  <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/50 flex items-center gap-2 text-xs text-rose-300">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{craftCheck.reason}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                <Package className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
                <p>Select a recipe from the left to view blueprints.</p>
              </div>
            )}

            {/* CRAFT ACTION BUTTONS */}
            {selectedRecipe && (
              <div className="pt-6 border-t border-slate-800/80 space-y-3 mt-6">
                <div className="flex items-center justify-between gap-3">
                  {/* Quantity selector */}
                  <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => {
                        audioService.playClick();
                        setCraftBatches((b) => Math.max(1, b - 1));
                      }}
                      disabled={craftBatches <= 1}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      -
                    </button>
                    <span className="px-2 text-xs font-mono font-bold text-white">
                      {craftBatches}x
                    </span>
                    <button
                      onClick={() => {
                        audioService.playClick();
                        setCraftBatches((b) => Math.min(maxCraftable || 1, b + 1));
                      }}
                      disabled={craftBatches >= (maxCraftable || 1)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      +
                    </button>
                  </div>

                  {maxCraftable > 1 && (
                    <button
                      onClick={() => {
                        audioService.playClick();
                        setCraftBatches(maxCraftable);
                      }}
                      className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      Craft Max ({maxCraftable})
                    </button>
                  )}
                </div>

                <button
                  onClick={() => handleCraft(craftBatches)}
                  disabled={!craftCheck.canCraft || maxCraftable < craftBatches}
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
                    craftCheck.canCraft && maxCraftable >= craftBatches
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-950/60 hover:scale-[1.01]'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50 shadow-none'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    Craft {selectedRecipe.output.count * craftBatches}x{' '}
                    {SANDBOX_ITEM_CATALOGUE[selectedRecipe.output.itemId]?.displayName || selectedRecipe.name}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
