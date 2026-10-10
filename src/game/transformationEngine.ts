import {
  type PlayableGameScene,
  PlayableGameSceneSchema,
  type LevelTheme,
  type CoinElement,
  type HazardElement,
} from '../types/scene.js';
import type { TransformationOperation } from '../types/transformation.js';

export interface TransformationResult {
  transformedScene: PlayableGameScene;
  appliedOperations: TransformationOperation[];
  warnings: string[];
  diagnostics: {
    totalCoins: number;
    totalHazards: number;
    theme: LevelTheme;
    friction: number;
    playerSpeed: number;
    playerJump: number;
  };
}

/**
 * Applies a list of validated transformation operations to a scene deterministically.
 * Deep-clones the scene to guarantee original scene immutability.
 */
export function applyTransformations(
  originalScene: PlayableGameScene,
  operations: TransformationOperation[],
  newSource: PlayableGameScene['source'] = 'local-rules-transformed'
): TransformationResult {
  // 1. Deep clone to guarantee immutability
  const scene: PlayableGameScene = JSON.parse(JSON.stringify(originalScene));
  scene.source = newSource;

  const appliedOperations: TransformationOperation[] = [];
  const warnings: string[] = [];

  const worldWidth = scene.world.width;
  const worldHeight = scene.world.height;
  const spawnX = scene.player.spawnX;
  const spawnY = scene.player.spawnY;
  const goalX = scene.goal.x;
  const goalY = scene.goal.y;

  for (const op of operations) {
    switch (op.type) {
      case 'set_theme': {
        scene.world.theme = op.theme;

        // Apply theme-specific palette and default ambient effects
        if (op.theme === 'ice') {
          scene.world.backgroundColor = '#082f49';
          if (!scene.world.ambientEffect || scene.world.ambientEffect === 'none') {
            scene.world.ambientEffect = 'snow';
          }
          // Default ice friction to slippery 0.12 if previously normal
          if (scene.world.friction >= 0.8) {
            scene.world.friction = 0.12;
          }
        } else if (op.theme === 'lava') {
          scene.world.backgroundColor = '#1c1917';
          if (!scene.world.ambientEffect || scene.world.ambientEffect === 'none') {
            scene.world.ambientEffect = 'embers';
          }
        } else if (op.theme === 'space') {
          scene.world.backgroundColor = '#030712';
          if (!scene.world.ambientEffect || scene.world.ambientEffect === 'none') {
            scene.world.ambientEffect = 'stardust';
          }
          // Floaty lunar gravity if standard default
          if (scene.world.gravity === 750) {
            scene.world.gravity = 380;
            scene.player.jumpPower = Math.min(600, Math.round(scene.player.jumpPower * 1.15));
          }
        } else if (op.theme === 'forest') {
          scene.world.backgroundColor = '#052e16';
          if (!scene.world.ambientEffect || scene.world.ambientEffect === 'none') {
            scene.world.ambientEffect = 'leaves';
          }
        } else if (op.theme === 'cyberpunk') {
          scene.world.backgroundColor = '#09090b';
          if (!scene.world.ambientEffect || scene.world.ambientEffect === 'none') {
            scene.world.ambientEffect = 'sparks';
          }
        } else if (op.theme === 'default') {
          scene.world.backgroundColor = '#070a13';
          scene.world.ambientEffect = 'none';
          scene.world.friction = 1.0;
        }

        appliedOperations.push(op);
        break;
      }

      case 'set_difficulty': {
        scene.world.difficulty = op.difficulty;

        if (op.difficulty === 'easy') {
          // Reduce hazards by 50%
          if (scene.hazards.length > 1) {
            scene.hazards = scene.hazards.slice(0, Math.ceil(scene.hazards.length / 2));
          }
          // Boost jump power slightly to make gaps easy to cross
          scene.player.jumpPower = Math.min(650, Math.max(440, Math.round(scene.player.jumpPower * 1.15)));
          // Add 2-3 safe reward coins
          addSafeCoinsToPlatforms(scene, 3, worldWidth, worldHeight);
        } else if (op.difficulty === 'normal') {
          // Standard balanced settings
        } else if (op.difficulty === 'hard') {
          // Add 2-3 extra hazards on platform surfaces
          addSafeHazardsToPlatforms(scene, 2, worldWidth, worldHeight, spawnX, spawnY, goalX, goalY);
          // Slightly faster pace
          scene.player.speed = Math.min(320, Math.max(240, Math.round(scene.player.speed * 1.1)));
        }

        appliedOperations.push(op);
        break;
      }

      case 'adjust_physics': {
        if (op.gravity !== undefined) {
          const clampedGravity = Math.max(200, Math.min(2000, op.gravity));
          if (clampedGravity !== op.gravity) {
            warnings.push(`Gravity adjusted from ${op.gravity} to safe limit ${clampedGravity}.`);
          }
          scene.world.gravity = clampedGravity;
        }
        if (op.friction !== undefined) {
          const clampedFriction = Math.max(0.01, Math.min(1.0, op.friction));
          if (clampedFriction !== op.friction) {
            warnings.push(`Friction adjusted to safe bound [0.01, 1.0].`);
          }
          scene.world.friction = clampedFriction;
        }
        appliedOperations.push(op);
        break;
      }

      case 'add_coins': {
        const added = addSafeCoinsToPlatforms(scene, op.count, worldWidth, worldHeight);
        if (added < op.count) {
          warnings.push(`Placed ${added} coins (limited by available platform space).`);
        }
        appliedOperations.push(op);
        break;
      }

      case 'adjust_coin_density': {
        const targetCount = Math.max(1, Math.min(30, Math.round(scene.coins.length * op.multiplier)));
        if (targetCount < scene.coins.length) {
          scene.coins = scene.coins.slice(0, targetCount);
        } else if (targetCount > scene.coins.length) {
          const needed = targetCount - scene.coins.length;
          addSafeCoinsToPlatforms(scene, needed, worldWidth, worldHeight);
        }
        appliedOperations.push(op);
        break;
      }

      case 'add_hazards': {
        const added = addSafeHazardsToPlatforms(
          scene,
          op.count,
          worldWidth,
          worldHeight,
          spawnX,
          spawnY,
          goalX,
          goalY,
          op.hazardType
        );
        if (added < op.count) {
          warnings.push(`Placed ${added} hazards (avoided player spawn and goal zones).`);
        }
        appliedOperations.push(op);
        break;
      }

      case 'adjust_hazard_density': {
        if (op.multiplier === 0) {
          scene.hazards = [];
        } else {
          const targetCount = Math.max(0, Math.min(15, Math.round(scene.hazards.length * op.multiplier)));
          if (targetCount < scene.hazards.length) {
            scene.hazards = scene.hazards.slice(0, targetCount);
          } else if (targetCount > scene.hazards.length) {
            const needed = targetCount - scene.hazards.length;
            addSafeHazardsToPlatforms(scene, needed, worldWidth, worldHeight, spawnX, spawnY, goalX, goalY);
          }
        }
        appliedOperations.push(op);
        break;
      }

      case 'adjust_player_jump': {
        if (op.multiplier !== undefined) {
          scene.player.jumpPower = Math.round(
            Math.max(200, Math.min(700, scene.player.jumpPower * op.multiplier))
          );
        } else if (op.jumpPower !== undefined) {
          scene.player.jumpPower = Math.max(200, Math.min(700, op.jumpPower));
        }
        appliedOperations.push(op);
        break;
      }

      case 'adjust_player_speed': {
        if (op.multiplier !== undefined) {
          scene.player.speed = Math.round(
            Math.max(80, Math.min(500, scene.player.speed * op.multiplier))
          );
        } else if (op.speed !== undefined) {
          scene.player.speed = Math.max(80, Math.min(500, op.speed));
        }
        appliedOperations.push(op);
        break;
      }

      case 'set_environment_effects': {
        scene.world.ambientEffect = op.effect;
        appliedOperations.push(op);
        break;
      }
    }
  }

  // Validate the final output scene with Zod contract
  const validatedScene = PlayableGameSceneSchema.parse(scene);

  return {
    transformedScene: validatedScene,
    appliedOperations,
    warnings,
    diagnostics: {
      totalCoins: validatedScene.coins.length,
      totalHazards: validatedScene.hazards.length,
      theme: validatedScene.world.theme,
      friction: validatedScene.world.friction,
      playerSpeed: validatedScene.player.speed,
      playerJump: validatedScene.player.jumpPower,
    },
  };
}

/**
 * Distributes bonus coins safely along platforms with clearance
 */
function addSafeCoinsToPlatforms(
  scene: PlayableGameScene,
  count: number,
  worldWidth: number,
  worldHeight: number
): number {
  if (scene.platforms.length === 0 || count <= 0) return 0;

  let added = 0;
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    // Round-robin through platforms
    const platform = scene.platforms[i % scene.platforms.length];
    const stepFraction = ((i + 1) / (count + 1)) * 0.7 + 0.15;
    const targetX = Math.round(platform.x + platform.width * stepFraction);
    const targetY = Math.max(24, Math.round(platform.y - 28));

    // Bounds checking
    if (targetX < 16 || targetX > worldWidth - 16 || targetY < 16 || targetY > worldHeight - 16) {
      continue;
    }

    // Proximity check against existing coins
    const tooCloseToCoin = scene.coins.some(
      (c) => Math.hypot(c.x - targetX, c.y - targetY) < 24
    );
    if (tooCloseToCoin) continue;

    // Proximity check against hazards
    const tooCloseToHazard = scene.hazards.some(
      (h) => Math.hypot(h.x + h.width / 2 - targetX, h.y + h.height / 2 - targetY) < 32
    );
    if (tooCloseToHazard) continue;

    const newCoin: CoinElement = {
      id: `coin-gen-${now}-${i}`,
      x: targetX,
      y: targetY,
      size: 24,
      value: 10,
    };

    scene.coins.push(newCoin);
    added++;
  }

  return added;
}

/**
 * Adds lethal hazards onto platform surfaces away from spawn & goal
 */
function addSafeHazardsToPlatforms(
  scene: PlayableGameScene,
  count: number,
  worldWidth: number,
  worldHeight: number,
  spawnX: number,
  spawnY: number,
  goalX: number,
  goalY: number,
  hazardType: 'spike' | 'lava' = 'spike'
): number {
  if (scene.platforms.length === 0 || count <= 0) return 0;

  let added = 0;
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    // Choose platform
    const platform = scene.platforms[(i + 1) % scene.platforms.length];
    if (platform.width < 50) continue; // Don't place on tiny platforms

    const stepFraction = 0.5 + ((i % 2 === 0 ? 1 : -1) * 0.2);
    const targetX = Math.round(platform.x + platform.width * stepFraction - 12);
    const targetY = Math.round(platform.y - 24);

    // Bounds check
    if (targetX < 16 || targetX > worldWidth - 32 || targetY < 16 || targetY > worldHeight - 32) {
      continue;
    }

    // Safe distance from player spawn (> 120px)
    if (Math.hypot(targetX - spawnX, targetY - spawnY) < 120) {
      continue;
    }

    // Safe distance from goal (> 90px)
    if (Math.hypot(targetX - goalX, targetY - goalY) < 90) {
      continue;
    }

    // Avoid overlapping existing hazards
    const tooCloseToHazard = scene.hazards.some(
      (h) => Math.hypot(h.x - targetX, h.y - targetY) < 36
    );
    if (tooCloseToHazard) continue;

    const newHazard: HazardElement = {
      id: `hazard-gen-${now}-${i}`,
      x: targetX,
      y: targetY,
      width: 24,
      height: 24,
      hazardType,
    };

    scene.hazards.push(newHazard);
    added++;
  }

  return added;
}
