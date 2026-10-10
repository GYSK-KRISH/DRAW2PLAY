import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from '../../game/config.js';
import { MainScene } from '../../game/scenes/MainScene.js';
import type { CharacterConfig } from '../../types/game.js';

interface PhaserGameViewProps {
  characterConfig?: CharacterConfig;
}

export const PhaserGameView: React.FC<PhaserGameViewProps> = ({ characterConfig }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  const characterConfigRef = useRef(characterConfig);

  useEffect(() => {
    characterConfigRef.current = characterConfig;
  }, [characterConfig]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Instantiate game once container mounts
    const config = createGameConfig(containerRef.current);
    const game = new Phaser.Game(config);
    gameRef.current = game;

    // Pass character configuration once scene starts
    game.events.once('ready', () => {
      const scene = game.scene.getScene('MainScene') as MainScene;
      if (scene && characterConfigRef.current) {
        scene.updateCharacter(characterConfigRef.current);
      }
    });

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // Update scene when characterConfig changes
  useEffect(() => {
    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene('MainScene') as MainScene;
      if (scene && characterConfig) {
        scene.updateCharacter(characterConfig);
      }
    }
  }, [characterConfig]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl bg-slate-950 flex flex-col items-center">
      <div className="w-full bg-slate-900/90 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-200">Phaser 2D Arcade Engine</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Active Hero: <strong className="text-amber-400">{characterConfig?.attributes.name || 'Default Hero'}</strong></span>
          <span>Archetype: <strong className="text-indigo-400">{characterConfig?.attributes.archetype?.toUpperCase() || 'BALANCED'}</strong></span>
        </div>
      </div>
      <div ref={containerRef} className="w-full max-w-[800px] aspect-[800/480] bg-slate-950" />
    </div>
  );
};
