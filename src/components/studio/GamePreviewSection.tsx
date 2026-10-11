import React, { useState } from 'react';
import { Gamepad2, ChevronDown, ChevronUp, RotateCcw, CheckCircle2 } from 'lucide-react';
import { PhaserGameView } from '../game/PhaserGameView.js';
import type { CharacterConfig } from '../../types/game.js';
import type { PlayableGameScene } from '../../types/scene.js';

interface GamePreviewSectionProps {
  characterConfig?: CharacterConfig | null;
  sceneData?: PlayableGameScene | null;
  onDrawNewClick?: () => void;
  onBackToEditor?: () => void;
}

export const GamePreviewSection: React.FC<GamePreviewSectionProps> = ({
  characterConfig,
  sceneData,
  onDrawNewClick,
  onBackToEditor,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const activeScene: PlayableGameScene = sceneData || {
    schemaVersion: '1.0',
    source: 'local-vector',
    levelName: characterConfig?.attributes.name ? `${characterConfig.attributes.name}'s Trial` : 'Default Level',
    levelDescription: 'Interactive 2D physics stage',
    world: {
      width: 800,
      height: 480,
      gravity: characterConfig?.attributes.gravity || 750,
      backgroundColor: '#070a13',
      theme: 'default',
      friction: 1.0,
      difficulty: 'normal',
      ambientEffect: 'none',
    },
    player: {
      spawnX: 80,
      spawnY: 360,
      speed: characterConfig?.attributes.speed || 220,
      jumpPower: characterConfig?.attributes.jumpPower || 400,
      size: 36,
    },
    movementModel: 'platformer',
    platforms: [
      { id: 'plat-floor', x: 0, y: 440, width: 800, height: 40, strokeColor: '#10b981' },
    ],
    hazards: [],
    trampolines: [],
    coins: [],
    enemies: [],
    switches: [],
    doors: [],
    goal: { id: 'goal-def', x: 720, y: 370, width: 36, height: 48 },
    diagnostics: { warnings: [], assumptions: [], strokeCount: 1 },
  };

  const hasContent = Boolean(sceneData || characterConfig);

  return (
    <section
      aria-label="2D Game Engine Preview"
      className="w-full bg-[#0a0e1c]/80 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden transition-all duration-300"
    >
      {/* Collapsible Header */}
      <div className="w-full bg-[#060914] px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <Gamepad2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                2D Arcade Game Preview
              </h2>
              {hasContent ? (
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  Active ({activeScene.levelName})
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  Standby
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 hidden sm:block">
              Interactive physics simulation running at 60 FPS
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-2">
          {onDrawNewClick && (
            <button
              type="button"
              onClick={onDrawNewClick}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline">Draw New Hero</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse game preview' : 'Expand game preview'}
            aria-expanded={isExpanded}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content Area */}
      {isExpanded && (
        <div className="p-4 flex flex-col items-center">
          {hasContent ? (
            <div className="w-full flex flex-col items-center gap-3">
              {/* Active Phaser Game Engine Component */}
              <PhaserGameView
                sceneData={activeScene}
                onBackToEditor={onBackToEditor || onDrawNewClick || (() => {})}
              />

              {/* Status and Controls Strip */}
              <div className="w-full flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#060914] border border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Level active: <strong className="text-amber-400">{activeScene.levelName}</strong> ({activeScene.source})
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                  <span>[A] / [D] or [←] / [→] Move</span>
                  <span>•</span>
                  <span>[W] or [Space] Jump</span>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="w-full py-12 flex flex-col items-center justify-center text-center bg-[#060914]/60 rounded-xl border border-slate-800/60 p-6">
              <Gamepad2 className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">Physics Engine Standing By</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Analyze a sketch or click Quick Play to test your custom drawn level.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
export default GamePreviewSection;
