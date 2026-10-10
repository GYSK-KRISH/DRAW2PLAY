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
} from 'lucide-react';
import { createGameConfig } from '../../game/config.js';
import { MainScene } from '../../game/scenes/MainScene.js';
import type { PlayableGameScene, GamePlayState } from '../../types/scene.js';

interface PhaserGameViewProps {
  sceneData: PlayableGameScene;
  onBackToEditor: () => void;
}

export const PhaserGameView: React.FC<PhaserGameViewProps> = ({
  sceneData,
  onBackToEditor,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  const [gameState, setGameState] = useState<GamePlayState>('ready');
  const [score, setScore] = useState<number>(0);
  const [coinsCollected, setCoinsCollected] = useState<number>(0);

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
          sceneData,
          onGameStateChange: handleGameStateChange,
        });
      }
    });
  }, [sceneData, handleGameStateChange]);

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
    setGameState('playing');
    setScore(0);
    setCoinsCollected(0);
    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
      if (scene) {
        scene.restartGame(sceneData);
      }
    }
  };

  const totalCoins = sceneData.coins.length;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-950 flex flex-col items-center">
      {/* Top HUD Game Header */}
      <div className="w-full bg-[#0a0e1c] px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        {/* Left: Level Title & Provenance Badge */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToEditor}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors flex items-center gap-1 cursor-pointer font-semibold text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Editor</span>
          </button>

          <span className="font-bold text-white text-sm">{sceneData.levelName}</span>

          {/* AI Provenance Badge */}
          {sceneData.source === 'gemini-vision' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Gemini Vision AI
            </span>
          )}
          {sceneData.source === 'local-vector' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
              <Cpu className="w-3 h-3" /> Local Vector Physics
            </span>
          )}
          {sceneData.source === 'mock-fallback' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Mock Fallback
            </span>
          )}
        </div>

        {/* Center: Score & Coins */}
        <div className="flex items-center gap-4 font-mono font-bold text-xs">
          <span className="text-amber-400">
            Coins: {coinsCollected} / {totalCoins}
          </span>
          <span className="text-cyan-400">
            Score: {score} pts
          </span>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[11px] text-slate-500">
            [A/D/Arrows] Move | [W/Space/Up] Jump
          </span>
          <button
            type="button"
            onClick={handleRestart}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restart</span>
          </button>
        </div>
      </div>

      {/* Phaser Canvas Viewport Mount */}
      <div className="relative w-full flex justify-center bg-slate-950 p-2 sm:p-4">
        <div
          ref={containerRef}
          className="w-full max-w-[800px] aspect-[800/480] rounded-xl overflow-hidden shadow-2xl border border-slate-800"
        />

        {/* VICTORY OVERLAY */}
        {gameState === 'won' && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
            <div className="p-4 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 mb-3 shadow-lg shadow-purple-950/60">
              <Trophy className="w-10 h-10 text-amber-400 animate-bounce" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-wide">
              Level Complete! 🎉
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-sm">
              You navigated the hand-drawn level, collected {coinsCollected} coins, and reached the victory goal flag!
            </p>
            <div className="mt-3 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm font-mono font-bold text-cyan-300">
              Final Score: {score} points
            </div>
            <div className="flex items-center gap-3 mt-5">
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
                onClick={onBackToEditor}
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
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
            <div className="p-4 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 mb-3 shadow-lg shadow-rose-950/60">
              <AlertTriangle className="w-10 h-10 text-rose-400" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-wide">
              Hazard Collision! 💥
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-sm">
              Your hero hit a hazard obstacle. Don't worry, sketches can be edited or re-attempted anytime!
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
                onClick={onBackToEditor}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Sketch</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
