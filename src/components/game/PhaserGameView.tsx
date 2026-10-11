import React, { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import {
  RotateCcw,
  ArrowLeft,
  Trophy,
  AlertTriangle,
  Sparkles,
  Cpu,
  ShieldAlert,
  Volume2,
  VolumeX,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  Gamepad2,
  Wand2,
  Ghost,
  Globe,
  Share2,
} from 'lucide-react';
import { createGameConfig } from '../../game/config.js';
import { MainScene } from '../../game/scenes/MainScene.js';
import type { PlayableGameScene, GamePlayState } from '../../types/scene.js';
import { audioService } from '../../services/audioService.js';
import { TransformationModal } from '../studio/TransformationModal.js';
import { PromptToPatchModal } from './PromptToPatchModal.js';
import type { JsonPatchOperation, AffectedSystem } from '../../types/remix.js';
import type { ReplayData } from '../../types/replay.js';
import { getBestReplayForLevel, saveReplay } from '../../services/replayStorage.js';
import { GhostControlsBar } from './GhostControlsBar.js';
import { ReplaySaveModal } from './ReplaySaveModal.js';
import { PublishLevelModal } from '../gallery/PublishLevelModal.js';
import { CommunityGalleryModal } from '../gallery/CommunityGalleryModal.js';

interface PhaserGameViewProps {
  sceneData: PlayableGameScene;
  onBackToEditor: () => void;
  onSaveCreation?: (sceneToSave?: PlayableGameScene) => void;
  geminiConfigured?: boolean;
}

export const PhaserGameView: React.FC<PhaserGameViewProps> = ({
  sceneData,
  onBackToEditor,
  onSaveCreation,
  geminiConfigured = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  const [activeScene, setActiveScene] = useState<PlayableGameScene>(sceneData);
  const [gameState, setGameState] = useState<GamePlayState>('ready');
  const [score, setScore] = useState<number>(0);
  const [coinsCollected, setCoinsCollected] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(audioService.getIsMuted());
  const [hasSavedCreation, setHasSavedCreation] = useState<boolean>(false);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(true);
  const [isTransformModalOpen, setIsTransformModalOpen] = useState<boolean>(false);
  const [isRemixModalOpen, setIsRemixModalOpen] = useState<boolean>(false);
  const [planVersion, setPlanVersion] = useState<number>(1);
  const [previousSceneHistory, setPreviousSceneHistory] = useState<PlayableGameScene[]>([]);

  // Stage 8: Replay Recording, Ghost Playback, and Community Gallery
  const [activeGhostReplay, setActiveGhostReplay] = useState<ReplayData | null>(null);
  const [isGhostActive, setIsGhostActive] = useState<boolean>(false);
  const [lastRecordedReplay, setLastRecordedReplay] = useState<ReplayData | null>(null);
  const [isReplaySaveModalOpen, setIsReplaySaveModalOpen] = useState<boolean>(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (activeScene?.id) {
      const best = getBestReplayForLevel(activeScene.id);
      if (best) {
        queueMicrotask(() => {
          setActiveGhostReplay(best);
        });
      }
    }
  }, [activeScene?.id]);

  const handleReplayRecorded = useCallback((replay: ReplayData) => {
    setLastRecordedReplay(replay);
    if (replay.summary.completed) {
      saveReplay(replay);
      setActiveGhostReplay(replay);
      setIsReplaySaveModalOpen(true);
    }
  }, []);

  const handleGameStateChange = useCallback((
    newState: GamePlayState,
    newScore: number,
    newCoins: number
  ) => {
    setGameState(newState);
    setScore(newScore);
    setCoinsCollected(newCoins);
  }, []);

  const initGame = useCallback(() => {
    if (!containerRef.current) return;

    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }

    const config = createGameConfig(containerRef.current);
    const game = new Phaser.Game(config);
    gameRef.current = game;

    game.events.once('ready', () => {
      const scene = game.scene.getScene('MainScene') as MainScene;
      if (scene) {
        scene.scene.restart({
          sceneData: activeScene,
          onGameStateChange: handleGameStateChange,
          ghostReplay: activeGhostReplay || undefined,
          onReplayRecorded: handleReplayRecorded,
        });
        setIsGhostActive(Boolean(activeGhostReplay));
      }
    });
  }, [activeScene, activeGhostReplay, handleGameStateChange, handleReplayRecorded]);

  useEffect(() => {
    initGame();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [initGame]);

  const handleRestart = () => {
    audioService.playClick();
    setGameState('playing');
    setScore(0);
    setCoinsCollected(0);
    setHasSavedCreation(false);
    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
      if (scene) {
        scene.restartGame(activeScene);
      }
    }
  };

  const handleToggleMute = () => {
    const nextMute = audioService.toggleMute();
    setIsMuted(nextMute);
    if (!nextMute) {
      audioService.playClick();
    }
  };

  const handleSaveClick = () => {
    audioService.playClick();
    if (onSaveCreation) {
      onSaveCreation(activeScene);
      setHasSavedCreation(true);
    }
  };

  const handleApplyTransformation = (newScene: PlayableGameScene, saveToCreations?: boolean) => {
    setActiveScene(newScene);
    setGameState('playing');
    setScore(0);
    setCoinsCollected(0);
    setHasSavedCreation(false);

    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
      if (scene) {
        scene.restartGame(newScene);
      }
    }

    if (saveToCreations && onSaveCreation) {
      onSaveCreation(newScene);
      setHasSavedCreation(true);
    }
  };

  const handleApplyRemixPatch = (
    newScene: PlayableGameScene,
    _patch: JsonPatchOperation[],
    affectedSystems: AffectedSystem[],
    _canHotUpdate: boolean
  ) => {
    setPreviousSceneHistory((prev) => [...prev, activeScene]);
    setActiveScene(newScene);
    setPlanVersion((v) => v + 1);

    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
      if (scene) {
        scene.applyRemixHotPatch(newScene, affectedSystems);
      }
    }
  };

  const handleRevertRemix = () => {
    if (previousSceneHistory.length === 0) return;
    const lastScene = previousSceneHistory[previousSceneHistory.length - 1];
    setPreviousSceneHistory((prev) => prev.slice(0, -1));
    setActiveScene(lastScene);
    setPlanVersion((v) => Math.max(1, v - 1));

    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
      if (scene) {
        scene.applyRemixHotPatch(lastScene, ['presentation', 'physics', 'entities', 'structural']);
      }
    }
  };

  const handleToggleGhostRun = () => {
    if (!activeGhostReplay) return;
    audioService.playClick();
    if (isGhostActive) {
      if (gameRef.current) {
        const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
        scene?.stopGhost();
      }
      setIsGhostActive(false);
    } else {
      setIsGhostActive(true);
      if (gameRef.current) {
        const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
        scene?.scene.restart({
          sceneData: activeScene,
          onGameStateChange: handleGameStateChange,
          ghostReplay: activeGhostReplay,
          onReplayRecorded: handleReplayRecorded,
        });
      }
    }
  };

  // Virtual touch input dispatchers
  const dispatchTouchInput = (input: {
    left?: boolean;
    right?: boolean;
    up?: boolean;
    down?: boolean;
    jump?: boolean;
    action?: boolean;
  }) => {
    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
      if (scene) {
        scene.setVirtualInput(input);
      }
    }
  };

  const totalCoins = sceneData.coins.length;
  const isTopDown = activeScene.movementModel === 'topdown' || activeScene.world.gravity === 0;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-950 flex flex-col items-center select-none">
      {/* Top HUD Game Header */}
      <div className="w-full bg-[#0a0e1c] px-3 sm:px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-300">
        {/* Left: Level Title & Provenance Badge */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              audioService.playClick();
              onBackToEditor();
            }}
            title="Return to Studio Editor"
            aria-label="Return to Editor"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors flex items-center gap-1 cursor-pointer font-semibold text-xs focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Editor</span>
          </button>

          <span className="font-bold text-white text-xs sm:text-sm truncate max-w-[140px] sm:max-w-[200px]">
            {activeScene.levelName}
          </span>

          {/* Template & Movement Model Badge */}
          {activeScene.templateId && (
            <span
              title={`Template: ${activeScene.templateId} (${activeScene.movementModel || 'platformer'})`}
              className="hidden md:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/60"
            >
              {activeScene.templateId}
            </span>
          )}

          {/* AI Provenance Badge */}
          {activeScene.source === 'gemini-vision' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> <span className="hidden sm:inline">Gemini Vision AI</span>
            </span>
          )}
          {activeScene.source === 'gemini-transformed' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
              <Wand2 className="w-3 h-3" /> <span className="hidden sm:inline">Gemini Transformed</span>
            </span>
          )}
          {activeScene.source === 'local-rules-transformed' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
              <Wand2 className="w-3 h-3" /> <span className="hidden sm:inline">AI Transformed (Local)</span>
            </span>
          )}
          {activeScene.source === 'local-vector' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
              <Cpu className="w-3 h-3" /> <span className="hidden sm:inline">Local Vector Physics</span>
            </span>
          )}
          {activeScene.source === 'mock-fallback' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> <span className="hidden sm:inline">Mock Fallback</span>
            </span>
          )}
        </div>

        {/* Center: Score & Coins */}
        <div className="flex items-center gap-3 sm:gap-4 font-mono font-bold text-xs">
          <span className="text-amber-400">
            Coins: {coinsCollected}/{totalCoins}
          </span>
          <span className="text-cyan-400">
            Score: {score}
          </span>
        </div>

        {/* Right: Sound, Restart, and Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Audio Mute/Unmute Button */}
          <button
            type="button"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute game audio' : 'Mute game audio'}
            aria-label={isMuted ? 'Unmute game audio' : 'Mute game audio'}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          {/* Toggle Touch Controls Button */}
          <button
            type="button"
            onClick={() => setShowTouchControls(!showTouchControls)}
            title={showTouchControls ? 'Hide on-screen touch controls' : 'Show on-screen touch controls'}
            aria-label={showTouchControls ? 'Hide touch controls' : 'Show touch controls'}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
              showTouchControls
                ? 'bg-cyan-950/40 border-cyan-800/60 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
          </button>

          {/* AI Transform Button in Top HUD */}
          <button
            type="button"
            onClick={() => {
              audioService.playClick();
              setIsTransformModalOpen(true);
            }}
            title="Transform Level with Natural Language AI"
            aria-label="Transform Level"
            className="px-2.5 py-1 rounded-lg bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 hover:text-white border border-purple-800/60 transition-colors flex items-center gap-1 cursor-pointer font-semibold text-xs focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none"
          >
            <Wand2 className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">AI Transform</span>
          </button>

          {/* Live Prompt-to-Patch Remix Button */}
          <button
            type="button"
            onClick={() => {
              audioService.playClick();
              setIsRemixModalOpen(true);
            }}
            title="Live Prompt-to-Patch Game Remixing"
            aria-label="Remix Level Live"
            className="px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 hover:text-white border border-cyan-800/60 transition-colors flex items-center gap-1 cursor-pointer font-semibold text-xs focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Live Remix</span>
          </button>

          {/* Stage 8: Community Gallery Button */}
          <button
            type="button"
            onClick={() => {
              audioService.playClick();
              setIsGalleryModalOpen(true);
            }}
            title="Browse Community Gallery Levels"
            aria-label="Community Gallery"
            className="px-2.5 py-1 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 hover:text-white border border-indigo-800/60 transition-colors flex items-center gap-1 cursor-pointer font-semibold text-xs focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Gallery</span>
          </button>

          {/* Stage 8: Race Ghost Toggle Button */}
          {activeGhostReplay && (
            <button
              type="button"
              onClick={handleToggleGhostRun}
              title={isGhostActive ? 'Stop Ghost Playback' : 'Race Against Best Ghost'}
              aria-label="Race Ghost"
              className={`px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer font-semibold text-xs focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                isGhostActive
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30'
                  : 'bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 hover:text-white border-cyan-800/60'
              }`}
            >
              <Ghost className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="hidden sm:inline">{isGhostActive ? 'Ghost Active' : 'Race Ghost'}</span>
            </button>
          )}

          {/* Stage 8: Publish Level Button */}
          <button
            type="button"
            onClick={() => {
              audioService.playClick();
              setIsPublishModalOpen(true);
            }}
            title="Publish Level to Community Gallery"
            aria-label="Publish Level"
            className="px-2.5 py-1 rounded-lg bg-violet-950/40 hover:bg-violet-900/60 text-violet-300 hover:text-white border border-violet-800/60 transition-colors flex items-center gap-1 cursor-pointer font-semibold text-xs focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:outline-none"
          >
            <Share2 className="w-3.5 h-3.5 text-violet-400" />
            <span className="hidden sm:inline">Publish</span>
          </button>

          {/* Restart Level Button */}
          <button
            type="button"
            onClick={handleRestart}
            title="Restart Level"
            aria-label="Restart Level"
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Restart</span>
          </button>
        </div>
      </div>

      {/* Phaser Canvas Viewport Mount */}
      <div className="relative w-full flex flex-col items-center justify-center bg-slate-950 p-2 sm:p-4">
        {/* Stage 8: Floating Ghost Controls Bar */}
        {isGhostActive && activeGhostReplay && (
          <div className="absolute top-6 z-20">
            <GhostControlsBar
              ghostName={activeGhostReplay.playerName || 'Best Run'}
              bestDurationMs={activeGhostReplay.summary.durationMs}
              onPause={() => {
                if (gameRef.current) {
                  const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
                  scene?.pauseGhost();
                }
              }}
              onResume={() => {
                if (gameRef.current) {
                  const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
                  scene?.resumeGhost();
                }
              }}
              onStop={() => {
                if (gameRef.current) {
                  const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
                  scene?.stopGhost();
                }
                setIsGhostActive(false);
              }}
              onSetSpeed={(speed) => {
                if (gameRef.current) {
                  const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
                  scene?.setGhostSpeed(speed);
                }
              }}
            />
          </div>
        )}

        <div
          ref={containerRef}
          className="w-full max-w-[800px] aspect-[800/480] rounded-xl overflow-hidden shadow-2xl border border-slate-800 relative"
        />

        {/* ON-SCREEN TOUCH CONTROLS (For mobile, tablet, or mouse gamers) */}
        {showTouchControls && (
          <div className="w-full max-w-[800px] mt-2.5 flex items-center justify-between px-2 text-xs select-none">
            {/* D-Pad Movement */}
            {isTopDown ? (
              <div className="grid grid-cols-3 gap-1">
                <div />
                <button
                  type="button"
                  onPointerDown={() => dispatchTouchInput({ up: true })}
                  onPointerUp={() => dispatchTouchInput({ up: false })}
                  onPointerLeave={() => dispatchTouchInput({ up: false })}
                  aria-label="Move Up"
                  className="w-10 h-10 rounded-lg bg-slate-800/90 active:bg-cyan-600 text-slate-200 active:text-white border border-slate-700 flex items-center justify-center font-bold text-lg shadow-lg touch-none transition-colors"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div />
                <button
                  type="button"
                  onPointerDown={() => dispatchTouchInput({ left: true })}
                  onPointerUp={() => dispatchTouchInput({ left: false })}
                  onPointerLeave={() => dispatchTouchInput({ left: false })}
                  aria-label="Move Left"
                  className="w-10 h-10 rounded-lg bg-slate-800/90 active:bg-cyan-600 text-slate-200 active:text-white border border-slate-700 flex items-center justify-center font-bold text-lg shadow-lg touch-none transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onPointerDown={() => dispatchTouchInput({ down: true })}
                  onPointerUp={() => dispatchTouchInput({ down: false })}
                  onPointerLeave={() => dispatchTouchInput({ down: false })}
                  aria-label="Move Down"
                  className="w-10 h-10 rounded-lg bg-slate-800/90 active:bg-cyan-600 text-slate-200 active:text-white border border-slate-700 flex items-center justify-center font-bold text-lg shadow-lg touch-none transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onPointerDown={() => dispatchTouchInput({ right: true })}
                  onPointerUp={() => dispatchTouchInput({ right: false })}
                  onPointerLeave={() => dispatchTouchInput({ right: false })}
                  aria-label="Move Right"
                  className="w-10 h-10 rounded-lg bg-slate-800/90 active:bg-cyan-600 text-slate-200 active:text-white border border-slate-700 flex items-center justify-center font-bold text-lg shadow-lg touch-none transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onPointerDown={() => dispatchTouchInput({ left: true })}
                  onPointerUp={() => dispatchTouchInput({ left: false })}
                  onPointerLeave={() => dispatchTouchInput({ left: false })}
                  aria-label="Move Left"
                  className="w-12 h-11 rounded-xl bg-slate-800/90 active:bg-cyan-600 text-slate-200 active:text-white border border-slate-700 flex items-center justify-center font-bold text-lg shadow-lg touch-none transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onPointerDown={() => dispatchTouchInput({ right: true })}
                  onPointerUp={() => dispatchTouchInput({ right: false })}
                  onPointerLeave={() => dispatchTouchInput({ right: false })}
                  aria-label="Move Right"
                  className="w-12 h-11 rounded-xl bg-slate-800/90 active:bg-cyan-600 text-slate-200 active:text-white border border-slate-700 flex items-center justify-center font-bold text-lg shadow-lg touch-none transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Desktop Keyboard Guidance */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span>{activeScene.hudInstructions || (isTopDown ? '[WASD / Arrows] 4-Way Move' : '[A/D/◀/▶] Move • [W/Space/▲] Jump')}</span>
            </div>

            {/* Action / Jump Button */}
            {!isTopDown && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onPointerDown={() => dispatchTouchInput({ jump: true })}
                  onPointerUp={() => dispatchTouchInput({ jump: false })}
                  onPointerLeave={() => dispatchTouchInput({ jump: false })}
                  aria-label="Jump"
                  className="px-5 h-11 rounded-xl bg-purple-600/90 active:bg-purple-500 text-white border border-purple-500/50 flex items-center justify-center gap-1.5 font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-950/40 touch-none transition-colors"
                >
                  <ArrowUp className="w-4 h-4" />
                  <span>Jump</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* VICTORY OVERLAY */}
        {gameState === 'won' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200 z-30">
            <div className="p-4 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 mb-3 shadow-lg shadow-purple-950/60">
              <Trophy className="w-10 h-10 text-amber-400 animate-bounce" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-wide">
              Level Complete! 🎉
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-sm">
              You navigated your hand-drawn level, gathered {coinsCollected} coins, and touched the finish goal!
            </p>
            <div className="mt-3 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm font-mono font-bold text-cyan-300">
              Final Score: {score} points
            </div>
            <div className="flex items-center flex-wrap justify-center gap-3 mt-5">
              <button
                type="button"
                onClick={handleRestart}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-cyan-950/50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Play Again</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  audioService.playClick();
                  setIsTransformModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-purple-950/50 active:scale-95"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Transform with AI</span>
              </button>

              {onSaveCreation && (
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={hasSavedCreation}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    hasSavedCreation
                      ? 'bg-emerald-700/80 text-emerald-200 border border-emerald-600'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950/50'
                  }`}
                >
                  {hasSavedCreation ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                  <span>{hasSavedCreation ? 'Saved to Creations!' : 'Save Creation'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  audioService.playClick();
                  onBackToEditor();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Drawing</span>
              </button>
            </div>
          </div>
        )}

        {/* FAILURE OVERLAY */}
        {gameState === 'lost' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200 z-30">
            <div className="p-4 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 mb-3 shadow-lg shadow-rose-950/60">
              <AlertTriangle className="w-10 h-10 text-rose-400" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-wide">
              Hazard Collision! 💥
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-sm">
              Your hero struck a lethal obstacle. Don't worry, sketches can be re-attempted or modified anytime!
            </p>
            <div className="flex items-center gap-3 mt-5">
              <button
                type="button"
                onClick={handleRestart}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-rose-950/50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  audioService.playClick();
                  setIsTransformModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-purple-950/50 active:scale-95"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>AI Transform</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  audioService.playClick();
                  onBackToEditor();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Sketch</span>
              </button>
            </div>
          </div>
        )}

        {/* TRANSFORMATION MODAL */}
        <TransformationModal
          isOpen={isTransformModalOpen}
          currentScene={activeScene}
          geminiConfigured={geminiConfigured}
          onApplyTransformation={handleApplyTransformation}
          onClose={() => setIsTransformModalOpen(false)}
        />

        {/* STAGE 7: PROMPT-TO-PATCH REMIX MODAL */}
        <PromptToPatchModal
          isOpen={isRemixModalOpen}
          onClose={() => setIsRemixModalOpen(false)}
          activeScene={activeScene}
          onApplyPatch={handleApplyRemixPatch}
          onRevert={handleRevertRemix}
          hasUndo={previousSceneHistory.length > 0}
          currentVersion={planVersion}
        />

        {/* STAGE 8: COMMUNITY GALLERY MODAL */}
        <CommunityGalleryModal
          isOpen={isGalleryModalOpen}
          onClose={() => setIsGalleryModalOpen(false)}
          onPlayLevel={(newScene, ghost) => {
            setActiveScene(newScene);
            if (ghost) {
              setActiveGhostReplay(ghost);
              setIsGhostActive(true);
            } else {
              setActiveGhostReplay(null);
              setIsGhostActive(false);
            }
            if (gameRef.current) {
              const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
              scene?.restartGame(newScene);
            }
          }}
        />

        {/* STAGE 8: PUBLISH LEVEL MODAL */}
        <PublishLevelModal
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
          scene={activeScene}
          replay={lastRecordedReplay || activeGhostReplay || undefined}
        />

        {/* STAGE 8: REPLAY SAVE MODAL */}
        {lastRecordedReplay && (
          <ReplaySaveModal
            isOpen={isReplaySaveModalOpen}
            onClose={() => setIsReplaySaveModalOpen(false)}
            onOpenPublishModal={() => setIsPublishModalOpen(true)}
            replay={lastRecordedReplay}
          />
        )}
      </div>
    </div>
  );
};
export default PhaserGameView;
