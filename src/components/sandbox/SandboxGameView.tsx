import React, { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import {
  ArrowLeft,
  Save,
  FolderOpen,
  Volume2,
  VolumeX,
  Hammer,
  Pickaxe,
  Box,
  Compass,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
} from 'lucide-react';
import { createSandboxGameConfig } from '../../game/config.js';
import { SandboxScene } from '../../game/scenes/SandboxScene.js';
import type {
  SandboxInventory,
  SandboxWorldData,
  PlaceableBlockType,
  CraftSubmission,
  CraftableItemId,
  CraftRecognitionProvenance,
} from '../../types/sandbox.js';
import {
  HOTBAR_BLOCK_ORDER,
  TILE_DEFINITIONS,
  SANDBOX_ITEM_CATALOGUE,
} from '../../types/sandbox.js';
import {
  createDefaultInventory,
  getSelectedBlockType,
  awardCraftedItem,
  setHotbarSlot,
} from '../../game/sandbox/sandboxInventory.js';
import { craftRecipe } from '../../game/sandbox/sandboxRecipes.js';
import { generateDefaultSandboxWorld } from '../../game/sandbox/sandboxWorld.js';
import { saveSandbox, loadSandbox, hasSandboxSave } from '../../services/sandboxStorage.js';
import { audioService } from '../../services/audioService.js';
import { DrawToCraftModal } from './DrawToCraftModal.js';
import { CraftingModal } from './CraftingModal.js';

interface SandboxGameViewProps {
  onBackToStudio: () => void;
}

export const SandboxGameView: React.FC<SandboxGameViewProps> = ({ onBackToStudio }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<SandboxScene | null>(null);

  const [inventory, setInventory] = useState<SandboxInventory>(createDefaultInventory());
  const [playerPosition, setPlayerPosition] = useState<{ x: number; y: number; col: number; row: number }>({
    x: 0,
    y: 0,
    col: 0,
    row: 0,
  });
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(audioService.getIsMuted());
  const [touchMode, setTouchMode] = useState<'mine' | 'place'>('mine');
  const [isCraftModalOpen, setIsCraftModalOpen] = useState<boolean>(false);
  const [isCraftingModalOpen, setIsCraftingModalOpen] = useState<boolean>(false);
  const [hasSavedWorld, setHasSavedWorld] = useState<boolean>(hasSandboxSave());
  const [awardedSubmissionIds, setAwardedSubmissionIds] = useState<Set<string>>(() => new Set());

  // Show temporary action feedback toast
  const triggerFeedback = useCallback((msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage((prev) => (prev === msg ? null : prev));
    }, 2500);
  }, []);

  // Initialize Phaser Sandbox Game
  const initGame = useCallback((initialWorld?: SandboxWorldData, initialInv?: SandboxInventory) => {
    if (!containerRef.current) return;

    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }

    const config = createSandboxGameConfig(containerRef.current);
    const game = new Phaser.Game(config);
    gameRef.current = game;

    game.events.once('ready', () => {
      const scene = game.scene.getScene('SandboxScene') as SandboxScene;
      if (scene) {
        sceneRef.current = scene;
        scene.scene.restart({
          worldData: initialWorld || generateDefaultSandboxWorld(),
          initialInventory: initialInv || createDefaultInventory(),
          onInventoryChange: (newInv: SandboxInventory) => {
            setInventory({ ...newInv });
          },
          onActionFeedback: (msg: string) => {
            triggerFeedback(msg);
          },
          onPlayerPositionChange: (coords: { x: number; y: number; col: number; row: number }) => {
            setPlayerPosition(coords);
          },
        });
      }
    });
  }, [triggerFeedback]);

  useEffect(() => {
    initGame();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      }
    };
  }, [initGame]);

  // Audio Toggle
  const handleToggleMute = () => {
    const next = audioService.toggleMute();
    setIsMuted(next);
    if (!next) audioService.playClick();
  };

  // Select hotbar slot
  const handleSelectSlot = (slotIdx: number) => {
    audioService.playClick();
    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene('SandboxScene') as SandboxScene;
      if (scene) {
        scene.selectHotbarSlot(slotIdx);
      }
    }
  };

  // Toggle touch interaction mode (mine vs place)
  const handleToggleTouchMode = (mode: 'mine' | 'place') => {
    audioService.playClick();
    setTouchMode(mode);
    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene('SandboxScene') as SandboxScene;
      if (scene) {
        scene.setTouchInteractionMode(mode);
      }
    }
  };

  // Virtual directional touch controls
  const handleTouchDirection = (key: 'left' | 'right' | 'jump', active: boolean) => {
    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene('SandboxScene') as SandboxScene;
      if (scene) {
        scene.setVirtualInput({ [key]: active });
      }
    }
  };

  // Save Sandbox World
  const handleSaveWorld = () => {
    audioService.playClick();
    if (!gameRef.current) return;
    const scene = gameRef.current.scene.getScene('SandboxScene') as SandboxScene;
    if (!scene) return;

    try {
      saveSandbox({
        id: `sandbox-save-${Date.now()}`,
        name: 'My Draw-to-Craft World',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        world: scene.worldData,
        player: {
          x: playerPosition.x,
          y: playerPosition.y,
          inventory,
        },
        schemaVersion: '2.0',
      });
      setHasSavedWorld(true);
      triggerFeedback('Sandbox World saved to browser storage!');
    } catch (err) {
      console.error('Failed to save sandbox:', err);
      triggerFeedback('Failed to save sandbox.');
    }
  };

  // Load Saved World
  const handleLoadWorld = () => {
    audioService.playClick();
    const saved = loadSandbox();
    if (!saved) {
      triggerFeedback('No saved sandbox found.');
      return;
    }

    initGame(saved.world, saved.player.inventory);
    setInventory(saved.player.inventory);
    triggerFeedback('Loaded saved sandbox world!');
  };

  // Craft submission and award handlers (Phase 7.2)
  const handleAwardItem = useCallback(
    (
      submissionId: string,
      itemId: CraftableItemId,
      provenance: CraftRecognitionProvenance
    ) => {
      if (awardedSubmissionIds.has(submissionId)) {
        triggerFeedback('Craft submission has already been awarded!');
        return;
      }

      const awardResult = awardCraftedItem(inventory, itemId);
      if (!awardResult.success || !awardResult.item) {
        triggerFeedback(awardResult.reason || 'Failed to craft item.');
        audioService.playHazard();
        return;
      }

      setAwardedSubmissionIds((prev) => new Set(prev).add(submissionId));
      setInventory({ ...awardResult.inventory });

      if (sceneRef.current) {
        sceneRef.current.setInventory(awardResult.inventory);
      }

      triggerFeedback(`✨ Crafted 1x ${awardResult.item.displayName}! (${provenance})`);
    },
    [awardedSubmissionIds, inventory, triggerFeedback]
  );

  // Recipe Crafting Handler (Phase 8)
  const handleCraftRecipe = useCallback(
    (recipeId: string, batches = 1) => {
      const craftResult = craftRecipe(inventory, recipeId, batches);
      if (!craftResult.success || !craftResult.recipe) {
        triggerFeedback(craftResult.reason || 'Failed to craft recipe.');
        audioService.playHazard();
        return;
      }

      setInventory({ ...craftResult.inventory });
      if (sceneRef.current) {
        sceneRef.current.setInventory(craftResult.inventory);
      }

      const outDef = SANDBOX_ITEM_CATALOGUE[craftResult.recipe.output.itemId];
      triggerFeedback(
        `🔨 Crafted ${craftResult.craftedCount}x ${outDef?.displayName || craftResult.recipe.name}!`
      );
    },
    [inventory, triggerFeedback]
  );

  // Quick equip a placeable block into a specific hotbar slot
  const handleEquipToHotbar = (slotIdx: number, itemType: PlaceableBlockType) => {
    audioService.playClick();
    const updated = setHotbarSlot(inventory, slotIdx, itemType);
    setInventory(updated);
    if (sceneRef.current) {
      sceneRef.current.setInventory(updated);
    }
    triggerFeedback(`Equipped ${TILE_DEFINITIONS[itemType].displayName} to hotbar slot ${slotIdx + 1}`);
  };

  // Keyboard shortcut 'C' toggles crafting modal when not in another modal or text input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === 'c' || e.key === 'C') && !isCraftModalOpen) {
        setIsCraftingModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCraftModalOpen]);

  const handleCraftSubmission = (_submission: CraftSubmission) => {
    // Blueprint registered in crafting queue
  };

  const selectedBlock = getSelectedBlockType(inventory);

  return (
    <div className="flex-1 max-w-[1700px] w-full mx-auto px-2 sm:px-6 py-3 flex flex-col gap-3 selection:bg-cyan-500 selection:text-black">
      {/* 1. TOP CONTROL BAR */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2.5 rounded-2xl bg-[#0b1329]/90 border border-cyan-900/40 backdrop-blur-md shadow-lg shadow-cyan-950/20">
        {/* Left: Back to Studio & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              audioService.playClick();
              onBackToStudio();
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Studio
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              <Box className="w-4 h-4 text-cyan-400" />
              Draw-to-Craft Sandbox
            </span>
            <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/50 font-mono">
              Phase 8: Crafting
            </span>
          </div>
        </div>

        {/* Center: Coordinates info */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/60 px-3 py-1 rounded-lg border border-slate-800">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>Pos:</span>
          <span className="text-cyan-300">
            col {playerPosition.col}, row {playerPosition.row}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">
            ({playerPosition.x}, {playerPosition.y}px)
          </span>
        </div>

        {/* Right: Actions (Draw to Craft, Save, Load, Sound) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              audioService.playClick();
              setIsCraftingModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition-all cursor-pointer"
            title="Open Crafting Workshop (Press C)"
          >
            <Hammer className="w-3.5 h-3.5 text-amber-300" />
            Crafting
            <span className="hidden sm:inline-block text-[9px] px-1 py-0.5 rounded bg-black/40 text-amber-200 border border-amber-500/30 font-mono">
              C
            </span>
          </button>

          <button
            onClick={() => {
              audioService.playClick();
              setIsCraftModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-950/40 transition-all cursor-pointer"
            title="Open Draw to Craft sketch modal"
          >
            <Pickaxe className="w-3.5 h-3.5 text-cyan-200" />
            Draw to Craft
          </button>

          <button
            onClick={handleSaveWorld}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors"
            title="Save World to browser storage"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>

          <button
            onClick={handleLoadWorld}
            disabled={!hasSavedWorld}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Load World from browser storage"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Load</span>
          </button>

          <button
            onClick={handleToggleMute}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. GAME CANVAS VIEWPORT */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-cyan-900/40 bg-[#070b19] shadow-2xl flex items-center justify-center min-h-[460px] sm:min-h-[500px]">
        {/* Container mounted to Phaser Game */}
        <div ref={containerRef} className="w-full h-full flex items-center justify-center" />

        {/* Floating Feedback Toast Notification */}
        {feedbackMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-slate-900/90 border border-cyan-500/50 text-white text-xs font-semibold shadow-xl shadow-cyan-950/60 animate-in fade-in duration-150 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Controls Overlay Guide */}
        <div className="absolute top-4 right-4 z-10 hidden lg:flex flex-col gap-1 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 backdrop-blur-sm text-[11px] text-slate-300 font-mono shadow-md">
          <span className="text-cyan-400 font-bold mb-0.5">Controls:</span>
          <span>A / D or ◄ / ► : Move</span>
          <span>W / Space / ▲ : Jump</span>
          <span>Left-Click : Mine block</span>
          <span>Right-Click : Place block</span>
          <span>1, 2, 3, 4 : Select Hotbar</span>
          <span>C : Crafting Workshop</span>
        </div>

        {/* 3. FLOATING HOTBAR (Bottom Center) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          {/* Mobile Touch Mode Toggle (Mine vs Place) */}
          <div className="flex sm:hidden items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 backdrop-blur-sm">
            <button
              onClick={() => handleToggleTouchMode('mine')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                touchMode === 'mine'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Pickaxe className="w-3.5 h-3.5" />
              Mine
            </button>
            <button
              onClick={() => handleToggleTouchMode('place')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                touchMode === 'place'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              Place
            </button>
          </div>

          {/* Hotbar Slots */}
          <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-2xl bg-slate-950/85 border border-cyan-800/40 backdrop-blur-md shadow-2xl shadow-cyan-950/60">
            {(inventory.hotbar && inventory.hotbar.length === 4 ? inventory.hotbar : HOTBAR_BLOCK_ORDER).map(
              (blockType: PlaceableBlockType, idx: number) => {
                const def = TILE_DEFINITIONS[blockType];
                const catDef = SANDBOX_ITEM_CATALOGUE[blockType];
                const count = inventory.items[blockType] ?? 0;
                const isSelected = inventory.selectedSlot === idx;

                return (
                  <button
                    key={`${blockType}-${idx}`}
                    onClick={() => handleSelectSlot(idx)}
                    className={`relative flex flex-col items-center justify-between w-14 sm:w-16 h-14 sm:h-16 p-1.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/60 shadow-lg shadow-cyan-500/20 scale-105 ring-2 ring-cyan-400/30'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-850'
                    }`}
                    title={`${def?.displayName || blockType} (Hotkey ${idx + 1})`}
                  >
                    {/* Slot Number Tag */}
                    <span className="absolute top-1 left-1.5 text-[9px] font-mono text-slate-400 font-bold">
                      {idx + 1}
                    </span>

                    {/* Block Visual Preview Color Swatch / Icon */}
                    <div
                      className="w-6 h-6 rounded-md shadow-sm border border-black/30 mt-1 flex items-center justify-center text-xs"
                      style={{ backgroundColor: def?.colorHex || '#555' }}
                    >
                      {catDef?.icon}
                    </div>

                    {/* Block Count Badge */}
                    <span
                      className={`text-xs font-mono font-bold ${
                        count > 0 ? 'text-white' : 'text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          {/* Quick-equip inventory placeables (if player owns placeables not in hotbar) */}
          {Object.entries(inventory.items).some(
            ([id, count]) =>
              (count ?? 0) > 0 &&
              SANDBOX_ITEM_CATALOGUE[id as PlaceableBlockType]?.isPlaceable &&
              !(inventory.hotbar || HOTBAR_BLOCK_ORDER).includes(id as PlaceableBlockType)
          ) && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/75 border border-slate-800 backdrop-blur-sm">
              <span className="text-[10px] text-slate-400 font-mono">Equip to slot {inventory.selectedSlot + 1}:</span>
              {Object.entries(inventory.items)
                .filter(
                  ([id, count]) =>
                    (count ?? 0) > 0 &&
                    SANDBOX_ITEM_CATALOGUE[id as PlaceableBlockType]?.isPlaceable &&
                    !(inventory.hotbar || HOTBAR_BLOCK_ORDER).includes(id as PlaceableBlockType)
                )
                .map(([id, count]) => {
                  const placeableId = id as PlaceableBlockType;
                  const itemDef = SANDBOX_ITEM_CATALOGUE[placeableId];
                  return (
                    <button
                      key={id}
                      onClick={() => handleEquipToHotbar(inventory.selectedSlot, placeableId)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-200 transition-colors"
                      title={`Assign ${itemDef?.displayName} to slot ${inventory.selectedSlot + 1}`}
                    >
                      <span>{itemDef?.icon}</span>
                      <span className="font-semibold">{itemDef?.displayName}</span>
                      <span className="text-cyan-400 font-mono font-bold">({count})</span>
                    </button>
                  );
                })}
            </div>
          )}

          <span className="hidden sm:inline-block text-[10px] font-mono text-slate-400 drop-shadow">
            Selected: <strong className="text-cyan-300">{TILE_DEFINITIONS[selectedBlock]?.displayName || selectedBlock}</strong>
            {inventory.items[selectedBlock] === 0 ? (
              <span className="text-amber-400 ml-1.5 font-sans">(Empty! Mine blocks or craft more)</span>
            ) : (
              ' (Right-Click to Place)'
            )}
          </span>
        </div>

        {/* Mobile On-Screen Virtual Controls */}
        <div className="absolute bottom-4 left-4 z-20 flex sm:hidden items-center gap-2">
          <button
            onTouchStart={() => handleTouchDirection('left', true)}
            onTouchEnd={() => handleTouchDirection('left', false)}
            onMouseDown={() => handleTouchDirection('left', true)}
            onMouseUp={() => handleTouchDirection('left', false)}
            className="w-11 h-11 rounded-xl bg-slate-900/80 border border-slate-700 text-white flex items-center justify-center active:bg-cyan-600 transition-colors"
            title="Move Left"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onTouchStart={() => handleTouchDirection('right', true)}
            onTouchEnd={() => handleTouchDirection('right', false)}
            onMouseDown={() => handleTouchDirection('right', true)}
            onMouseUp={() => handleTouchDirection('right', false)}
            className="w-11 h-11 rounded-xl bg-slate-900/80 border border-slate-700 text-white flex items-center justify-center active:bg-cyan-600 transition-colors"
            title="Move Right"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        <div className="absolute bottom-4 right-4 z-20 flex sm:hidden items-center">
          <button
            onTouchStart={() => handleTouchDirection('jump', true)}
            onTouchEnd={() => handleTouchDirection('jump', false)}
            onMouseDown={() => handleTouchDirection('jump', true)}
            onMouseUp={() => handleTouchDirection('jump', false)}
            className="w-12 h-12 rounded-2xl bg-cyan-600/90 border border-cyan-400 text-white flex items-center justify-center active:bg-cyan-500 shadow-lg shadow-cyan-950/50"
            title="Jump"
          >
            <ArrowUp className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 4. DRAW-TO-CRAFT MODAL */}
      <DrawToCraftModal
        isOpen={isCraftModalOpen}
        onClose={() => setIsCraftModalOpen(false)}
        onSubmitCraft={handleCraftSubmission}
        onAwardItem={handleAwardItem}
      />

      {/* 5. CRAFTING RECIPES WORKSHOP MODAL (Phase 8) */}
      <CraftingModal
        isOpen={isCraftingModalOpen}
        onClose={() => setIsCraftingModalOpen(false)}
        inventory={inventory}
        onCraftRecipe={handleCraftRecipe}
      />
    </div>
  );
};
