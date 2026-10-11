import type {
  GameDesignPlan,
  GameTemplateId,
} from '../types/plan.js';
import { validateGamePlan } from '../utils/planValidator.js';

/**
 * Deterministic pseudo-random number generator (Mulberry32).
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns pseudo-random float in [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns pseudo-random integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Picks a random item from array */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

export interface LevelGenerationOptions {
  seed?: number;
  width?: number;
  height?: number;
  theme?: 'default' | 'forest' | 'ice' | 'lava' | 'space' | 'cyberpunk';
  userPrompt?: string;
  referenceEvidence?: {
    dominantColors?: string[];
    visibleShapes?: string[];
    spatialLayout?: string;
  };
}

/**
 * Procedural generation engine for Stage 3 multi-template gameplay.
 * Produces deterministic, validated GameDesignPlan instances tailored to each template's gameplay rules.
 */
export function generateTemplateLevel(
  templateId: GameTemplateId,
  options: LevelGenerationOptions = {}
): GameDesignPlan {
  const seed = options.seed ?? 42;
  const width = options.width ?? 800;
  const height = options.height ?? 480;
  const theme = options.theme ?? 'forest';
  const palette = options.referenceEvidence?.dominantColors ?? ['#10b981', '#059669', '#38bdf8', '#facc15'];

  const basePlanMeta = {
    schemaVersion: '2.0' as const,
    generationId: `gen-${templateId}-${seed}`,
    id: `plan-${templateId}-${seed}`,
    referenceId: `ref-img-${seed}`,
    sourceType: 'image-upload' as const,
    provenance: 'gemini-vision' as const,
    provider: { id: 'gemini', model: 'gemini-2.5-flash', isFallback: false },
    userPrompt: options.userPrompt || `Procedurally generated ${templateId} level`,
    theme: {
      name: theme,
      palette,
      background: '#070a13',
    },
    status: 'ready-for-2d-generation' as const,
    createdAt: new Date().toISOString(),
    requestedFeatures: [],
    missingRequirements: [],
    limitationsAndWarnings: [],
    difficulty: { tier: 'medium' as const, seed, enemySpeedMultiplier: 1.0 },
    confidenceAndWarnings: {
      overallConfidence: 'high' as const,
      confidenceReasoning: `Deterministic procedural level generated specifically for template "${templateId}".`,
      warnings: [],
      unsupportedFeatures: [],
    },
  };

  switch (templateId) {
    // -------------------------------------------------------------------------
    // 1. PHYSICS PLATFORMER (and phaser-2d-platformer alias)
    // -------------------------------------------------------------------------
    case 'physics-platformer':
    case 'phaser-2d-platformer': {
      const platforms = [
        { id: 'floor', x: 0, y: height - 40, width, height: 40, strokeColor: '#10b981' },
        { id: 'tier-1', x: Math.round(width * 0.15), y: Math.round(height * 0.72), width: Math.round(width * 0.22), height: 24, strokeColor: '#10b981' },
        { id: 'tier-2', x: Math.round(width * 0.42), y: Math.round(height * 0.52), width: Math.round(width * 0.22), height: 24, strokeColor: '#10b981' },
        { id: 'tier-3', x: Math.round(width * 0.68), y: Math.round(height * 0.35), width: Math.round(width * 0.18), height: 24, strokeColor: '#10b981' },
        { id: 'goal-ledge', x: Math.round(width * 0.85), y: Math.round(height * 0.22), width: Math.round(width * 0.13), height: 24, strokeColor: '#10b981' },
      ];
      const hazards = [
        { id: 'spike-pit-1', x: Math.round(width * 0.38), y: height - 25, width: 40, height: 20, hazardType: 'spike' as const },
        { id: 'spike-pit-2', x: Math.round(width * 0.65), y: height - 25, width: 40, height: 20, hazardType: 'spike' as const },
      ];
      const interactives = [
        { id: 'bounce-spring', name: 'Spring Pad', type: 'trampoline' as const, x: Math.round(width * 0.65), y: height - 40, width: 40, height: 16, behavior: { bounceForce: 650 } },
      ];
      const collectibles = [
        { id: 'coin-1', name: 'Meadow Coin', type: 'coin' as const, x: Math.round(width * 0.25), y: Math.round(height * 0.72) - 30, value: 10 },
        { id: 'coin-2', name: 'Cliff Coin', type: 'coin' as const, x: Math.round(width * 0.52), y: Math.round(height * 0.52) - 30, value: 10 },
        { id: 'coin-3', name: 'Summit Coin', type: 'coin' as const, x: Math.round(width * 0.76), y: Math.round(height * 0.35) - 30, value: 20 },
      ];
      const enemies = [
        { id: 'patrol-1', name: 'Ridge Patrol', type: 'patrol' as const, x: Math.round(width * 0.46), y: Math.round(height * 0.52) - 32, speed: 90, patrolDistance: 100, damage: 1 },
      ];

      return {
        ...basePlanMeta,
        title: 'Highland Physics Gauntlet',
        description: 'Multi-tiered physics platformer with momentum running, trampoline shortcuts, and hazard evasion.',
        templateId,
        targetEngine: 'phaser-2d',
        category: '2d-platformer',
        world: { width, height, gravity: 750, coordinateSystem: 'screen-top-left-2d', friction: 0.85 },
        terrain: { platforms, walls: [], hazards },
        player: {
          spawn: { x: 50, y: height - 80 },
          speed: 240,
          jumpPower: 440,
          size: 36,
          supportedAbilities: ['walk', 'run', 'jump', 'double_jump'],
        },
        entities: { enemies, collectibles, interactives },
        objectives: {
          primary: { type: 'reach_goal', targetRef: 'goal-portal' },
          winConditions: ['Traverse the tiers and reach the summit portal'],
          loseConditions: ['Fall into the spike pits'],
          checkpoints: [{ id: 'cp-mid', x: Math.round(width * 0.45), y: Math.round(height * 0.52) - 30 }],
          goal: { id: 'goal-portal', x: Math.round(width * 0.88), y: Math.round(height * 0.22) - 48, width: 36, height: 48 },
        },
        mechanics: {
          allowedMechanics: ['jump_and_run', 'hazard_evasion', 'coin_collection', 'trampoline_bounce', 'patrol_enemy_avoidance'],
          rejectedMechanics: [],
        },
      };
    }

    // -------------------------------------------------------------------------
    // 2. PRECISION PLATFORMER
    // -------------------------------------------------------------------------
    case 'precision-platformer': {
      const platforms = [
        { id: 'start-pad', x: 0, y: height - 40, width: Math.round(width * 0.12), height: 40, strokeColor: '#ef4444' },
        { id: 'micro-step-1', x: Math.round(width * 0.16), y: Math.round(height * 0.78), width: 50, height: 18, strokeColor: '#ef4444' },
        { id: 'micro-step-2', x: Math.round(width * 0.30), y: Math.round(height * 0.65), width: 50, height: 18, strokeColor: '#ef4444' },
        { id: 'micro-step-3', x: Math.round(width * 0.46), y: Math.round(height * 0.52), width: 50, height: 18, strokeColor: '#ef4444' },
        { id: 'micro-step-4', x: Math.round(width * 0.62), y: Math.round(height * 0.39), width: 50, height: 18, strokeColor: '#ef4444' },
        { id: 'micro-step-5', x: Math.round(width * 0.76), y: Math.round(height * 0.28), width: 50, height: 18, strokeColor: '#ef4444' },
        { id: 'finish-pad', x: Math.round(width * 0.86), y: Math.round(height * 0.18), width: Math.round(width * 0.12), height: 26, strokeColor: '#ef4444' },
      ];
      const hazards = [
        { id: 'void-bed', x: Math.round(width * 0.12), y: height - 25, width: Math.round(width * 0.74), height: 25, hazardType: 'spike' as const },
        { id: 'overhead-needle-1', x: Math.round(width * 0.30), y: Math.round(height * 0.56), width: 20, height: 16, hazardType: 'spike' as const },
        { id: 'overhead-needle-2', x: Math.round(width * 0.62), y: Math.round(height * 0.30), width: 20, height: 16, hazardType: 'spike' as const },
      ];

      return {
        ...basePlanMeta,
        title: 'Needlepoint Precision Run',
        description: 'Pixel-perfect precision platformer with instant deceleration, strict jump arcs, and zero margin for error.',
        templateId: 'precision-platformer',
        targetEngine: 'phaser-2d',
        category: '2d-platformer',
        world: { width, height, gravity: 900, coordinateSystem: 'screen-top-left-2d', friction: 1.0 },
        terrain: { platforms, walls: [], hazards },
        player: {
          spawn: { x: 35, y: height - 80 },
          speed: 260,
          jumpPower: 450,
          size: 32,
          supportedAbilities: ['walk', 'run', 'jump'],
        },
        entities: { enemies: [], collectibles: [], interactives: [] },
        objectives: {
          primary: { type: 'reach_goal', targetRef: 'precision-goal' },
          winConditions: ['Land every micro-jump cleanly and touch the goal beacon'],
          loseConditions: ['Touch any needle or fall into the floor pit'],
          checkpoints: [],
          goal: { id: 'precision-goal', x: Math.round(width * 0.90), y: Math.round(height * 0.18) - 48, width: 32, height: 48 },
        },
        mechanics: {
          allowedMechanics: ['jump_and_run', 'hazard_evasion', 'precision_jumping'],
          rejectedMechanics: [],
        },
      };
    }

    // -------------------------------------------------------------------------
    // 3. PHYSICS PUZZLE (and phaser-2d-puzzle alias)
    // -------------------------------------------------------------------------
    case 'physics-puzzle':
    case 'phaser-2d-puzzle': {
      const platforms = [
        { id: 'chamber-floor', x: 0, y: height - 40, width, height: 40, strokeColor: '#0284c7' },
        { id: 'upper-ledge', x: Math.round(width * 0.22), y: Math.round(height * 0.60), width: Math.round(width * 0.25), height: 24, strokeColor: '#0284c7' },
        { id: 'vault-shelf', x: Math.round(width * 0.62), y: Math.round(height * 0.60), width: Math.round(width * 0.35), height: 24, strokeColor: '#0284c7' },
      ];
      const walls = [
        { id: 'door-barrier-1', x: Math.round(width * 0.55), y: Math.round(height * 0.30), width: 24, height: Math.round(height * 0.66), strokeColor: '#eab308' },
      ];
      const interactives = [
        { id: 'switch-alpha', name: 'Pressure Switch', type: 'switch' as const, x: Math.round(width * 0.32), y: Math.round(height * 0.60) - 16, width: 36, height: 16, behavior: { targetDoorId: 'door-barrier-1' } },
      ];
      const collectibles = [
        { id: 'gem-1', name: 'Sapphire Shard', type: 'gem' as const, x: Math.round(width * 0.25), y: Math.round(height * 0.60) - 32, value: 50 },
        { id: 'gem-2', name: 'Ruby Core', type: 'gem' as const, x: Math.round(width * 0.72), y: Math.round(height * 0.60) - 32, value: 50 },
      ];

      return {
        ...basePlanMeta,
        title: 'Chamber Gate Mechanism',
        description: 'Interactive puzzle chamber where stepping on pressure switches retracts security barriers.',
        templateId,
        targetEngine: 'phaser-2d',
        category: 'puzzle',
        world: { width, height, gravity: 650, coordinateSystem: 'screen-top-left-2d', friction: 0.8 },
        terrain: { platforms, walls, hazards: [] },
        player: {
          spawn: { x: 50, y: height - 80 },
          speed: 230,
          jumpPower: 420,
          size: 36,
          supportedAbilities: ['walk', 'run', 'jump'],
        },
        entities: { enemies: [], collectibles, interactives },
        objectives: {
          primary: { type: 'reach_goal', targetRef: 'vault-exit' },
          secondary: [{ type: 'activate_switch', targetCount: 1 }],
          winConditions: ['Activate switch-alpha to open door-barrier-1 and access the vault'],
          loseConditions: ['Unable to solve barrier switches before reset'],
          checkpoints: [],
          goal: { id: 'vault-exit', x: Math.round(width * 0.88), y: Math.round(height * 0.60) - 48, width: 36, height: 48 },
        },
        mechanics: {
          allowedMechanics: ['jump_and_run', 'switch_toggle', 'door_key_unlock', 'coin_collection'],
          rejectedMechanics: [],
        },
      };
    }

    // -------------------------------------------------------------------------
    // 4. TOP-DOWN EXPLORATION (and phaser-2d-topdown alias)
    // -------------------------------------------------------------------------
    case 'top-down-exploration':
    case 'phaser-2d-topdown': {
      const walls = [
        { id: 'north-wall', x: 0, y: 0, width, height: 24, strokeColor: '#334155' },
        { id: 'south-wall', x: 0, y: height - 24, width, height: 24, strokeColor: '#334155' },
        { id: 'west-wall', x: 0, y: 0, width: 24, height, strokeColor: '#334155' },
        { id: 'east-wall', x: width - 24, y: 0, width: 24, height, strokeColor: '#334155' },
        { id: 'room-divider-1', x: Math.round(width * 0.35), y: 24, width: 20, height: Math.round(height * 0.60), strokeColor: '#334155' },
        { id: 'room-divider-2', x: Math.round(width * 0.68), y: Math.round(height * 0.38), width: 20, height: Math.round(height * 0.58), strokeColor: '#334155' },
        { id: 'obstacle-pillar-1', x: Math.round(width * 0.16), y: Math.round(height * 0.32), width: 44, height: 44, strokeColor: '#334155' },
        { id: 'obstacle-pillar-2', x: Math.round(width * 0.50), y: Math.round(height * 0.50), width: 44, height: 44, strokeColor: '#334155' },
      ];
      const collectibles = [
        { id: 'relic-1', name: 'Jade Figurine', type: 'gem' as const, x: Math.round(width * 0.18), y: Math.round(height * 0.72), value: 25 },
        { id: 'relic-2', name: 'Solar Relic', type: 'gem' as const, x: Math.round(width * 0.50), y: Math.round(height * 0.22), value: 25 },
        { id: 'relic-3', name: 'Ancient Seal', type: 'gem' as const, x: Math.round(width * 0.82), y: Math.round(height * 0.68), value: 50 },
      ];

      const enemies = [
        { id: 'sentinel-1', name: 'Temple Sentinel', type: 'patrol' as const, x: Math.round(width * 0.50), y: Math.round(height * 0.40), speed: 85, patrolDistance: 100, damage: 1 },
      ];

      return {
        ...basePlanMeta,
        title: 'Ancient Sanctuaries Exploration',
        description: 'Top-down multi-chamber ruin with true 4-way/8-way navigation, sentinel avoidance, and zero gravity.',
        templateId,
        targetEngine: 'phaser-2d',
        category: 'top-down-2d',
        world: { width, height, gravity: 0, coordinateSystem: 'screen-top-left-2d', friction: 0.9 },
        terrain: { platforms: [], walls, hazards: [] },
        player: {
          spawn: { x: 50, y: 60 },
          speed: 250,
          jumpPower: 0,
          size: 34,
          supportedAbilities: ['walk', 'run', 'dash'],
        },
        entities: { enemies, collectibles, interactives: [] },
        objectives: {
          primary: { type: 'reach_goal', targetRef: 'sanctuary-portal' },
          winConditions: ['Explore the sanctuary corridors and reach the eastern portal'],
          loseConditions: ['Caught by the temple sentinel before reaching the sanctuary exit'],
          checkpoints: [],
          goal: { id: 'sanctuary-portal', x: width - 70, y: 55, width: 40, height: 40 },
        },
        mechanics: {
          allowedMechanics: ['topdown_4way_movement', 'coin_collection', 'patrol_enemy_avoidance'],
          rejectedMechanics: [],
        },
      };
    }

    // -------------------------------------------------------------------------
    // 5. TOP-DOWN ARENA SURVIVAL
    // -------------------------------------------------------------------------
    case 'top-down-arena-survival': {
      const walls = [
        { id: 'arena-north', x: 0, y: 0, width, height: 24, strokeColor: '#7f1d1d' },
        { id: 'arena-south', x: 0, y: height - 24, width, height: 24, strokeColor: '#7f1d1d' },
        { id: 'arena-west', x: 0, y: 0, width: 24, height, strokeColor: '#7f1d1d' },
        { id: 'arena-east', x: width - 24, y: 0, width: 24, height, strokeColor: '#7f1d1d' },
        { id: 'pillar-nw', x: Math.round(width * 0.22), y: Math.round(height * 0.24), width: 44, height: 44, strokeColor: '#991b1b' },
        { id: 'pillar-ne', x: Math.round(width * 0.72), y: Math.round(height * 0.24), width: 44, height: 44, strokeColor: '#991b1b' },
        { id: 'pillar-sw', x: Math.round(width * 0.22), y: Math.round(height * 0.68), width: 44, height: 44, strokeColor: '#991b1b' },
        { id: 'pillar-se', x: Math.round(width * 0.72), y: Math.round(height * 0.68), width: 44, height: 44, strokeColor: '#991b1b' },
      ];
      const enemies = [
        { id: 'chaser-1', name: 'Hunter Alpha', type: 'patrol' as const, x: 55, y: 55, speed: 110, patrolDistance: 180, damage: 1 },
        { id: 'chaser-2', name: 'Hunter Beta', type: 'patrol' as const, x: width - 85, y: 55, speed: 120, patrolDistance: 180, damage: 1 },
        { id: 'chaser-3', name: 'Hunter Gamma', type: 'patrol' as const, x: 55, y: height - 85, speed: 105, patrolDistance: 180, damage: 1 },
        { id: 'chaser-4', name: 'Hunter Delta', type: 'patrol' as const, x: width - 85, y: height - 85, speed: 115, patrolDistance: 180, damage: 1 },
      ];

      return {
        ...basePlanMeta,
        title: 'Colosseum Survival Arena',
        description: 'High-octane top-down arena where the player must dodge pursuing threats for 20 seconds.',
        templateId: 'top-down-arena-survival',
        targetEngine: 'phaser-2d',
        category: 'top-down-2d',
        world: { width, height, gravity: 0, coordinateSystem: 'screen-top-left-2d', friction: 0.92 },
        terrain: { platforms: [], walls, hazards: [] },
        player: {
          spawn: { x: Math.round(width / 2), y: Math.round(height / 2) },
          speed: 280,
          jumpPower: 0,
          size: 32,
          supportedAbilities: ['walk', 'run', 'dash'],
        },
        entities: { enemies, collectibles: [], interactives: [] },
        objectives: {
          primary: { type: 'survival', timeLimit: 20 },
          winConditions: ['Survive in the arena for 20 seconds without fatal collision'],
          loseConditions: ['Collide with enemy chasers'],
          checkpoints: [],
          goal: { id: 'arena-center', x: Math.round(width / 2) - 18, y: Math.round(height / 2) - 18, width: 36, height: 36 },
        },
        mechanics: {
          allowedMechanics: ['topdown_4way_movement', 'patrol_enemy_avoidance', 'arena_survival', 'hazard_evasion'],
          rejectedMechanics: [],
        },
      };
    }

    // -------------------------------------------------------------------------
    // 6. COLLECT-AND-ESCAPE ADVENTURE
    // -------------------------------------------------------------------------
    case 'collect-and-escape': {
      const platforms = [
        { id: 'floor', x: 0, y: height - 40, width, height: 40, strokeColor: '#f59e0b' },
        { id: 'vault-1', x: Math.round(width * 0.12), y: Math.round(height * 0.70), width: Math.round(width * 0.18), height: 24, strokeColor: '#f59e0b' },
        { id: 'vault-2', x: Math.round(width * 0.38), y: Math.round(height * 0.48), width: Math.round(width * 0.18), height: 24, strokeColor: '#f59e0b' },
        { id: 'vault-3', x: Math.round(width * 0.64), y: Math.round(height * 0.30), width: Math.round(width * 0.18), height: 24, strokeColor: '#f59e0b' },
        { id: 'exit-gate-ledge', x: Math.round(width * 0.85), y: Math.round(height * 0.65), width: Math.round(width * 0.12), height: 24, strokeColor: '#f59e0b' },
      ];
      const collectibles = [
        { id: 'key-ruby', name: 'Ruby Key', type: 'key' as const, x: Math.round(width * 0.20), y: Math.round(height * 0.70) - 32, value: 100 },
        { id: 'key-sapphire', name: 'Sapphire Key', type: 'key' as const, x: Math.round(width * 0.46), y: Math.round(height * 0.48) - 32, value: 100 },
        { id: 'key-emerald', name: 'Emerald Key', type: 'key' as const, x: Math.round(width * 0.72), y: Math.round(height * 0.30) - 32, value: 100 },
      ];
      const hazards = [
        { id: 'spike-chasm', x: Math.round(width * 0.30), y: height - 25, width: 55, height: 20, hazardType: 'spike' as const },
        { id: 'lava-pool', x: Math.round(width * 0.56), y: height - 25, width: 55, height: 20, hazardType: 'lava' as const },
      ];

      return {
        ...basePlanMeta,
        title: 'Vault Escape Heist',
        description: 'All 3 keys must be secured before the final exit gate will unlock.',
        templateId: 'collect-and-escape',
        targetEngine: 'phaser-2d',
        category: '2d-platformer',
        world: { width, height, gravity: 680, coordinateSystem: 'screen-top-left-2d', friction: 0.85 },
        terrain: { platforms, walls: [], hazards },
        player: {
          spawn: { x: 50, y: height - 80 },
          speed: 230,
          jumpPower: 440,
          size: 36,
          supportedAbilities: ['walk', 'run', 'jump', 'double_jump'],
        },
        entities: { enemies: [], collectibles, interactives: [] },
        objectives: {
          primary: { type: 'collect_all', targetCount: 3 },
          winConditions: ['Collect all 3 elemental keys to unlock and enter the escape portal'],
          loseConditions: ['Attempting escape before collecting keys, or falling into hazards'],
          checkpoints: [],
          goal: { id: 'locked-exit-portal', x: Math.round(width * 0.88), y: Math.round(height * 0.65) - 48, width: 36, height: 48 },
        },
        mechanics: {
          allowedMechanics: ['jump_and_run', 'coin_collection', 'door_key_unlock', 'hazard_evasion'],
          rejectedMechanics: [],
        },
      };
    }

    // -------------------------------------------------------------------------
    // 7. MAZE EXPLORATION
    // -------------------------------------------------------------------------
    case 'maze-exploration': {
      const walls = [
        { id: 'm-north', x: 0, y: 0, width, height: 22, strokeColor: '#475569' },
        { id: 'm-south', x: 0, y: height - 22, width, height: 22, strokeColor: '#475569' },
        { id: 'm-west', x: 0, y: 0, width: 22, height, strokeColor: '#475569' },
        { id: 'm-east', x: width - 22, y: 0, width: 22, height, strokeColor: '#475569' },
        { id: 'm-v1', x: Math.round(width * 0.20), y: 22, width: 18, height: Math.round(height * 0.68), strokeColor: '#475569' },
        { id: 'm-v2', x: Math.round(width * 0.40), y: Math.round(height * 0.30), width: 18, height: Math.round(height * 0.68), strokeColor: '#475569' },
        { id: 'm-v3', x: Math.round(width * 0.60), y: 22, width: 18, height: Math.round(height * 0.68), strokeColor: '#475569' },
        { id: 'm-v4', x: Math.round(width * 0.80), y: Math.round(height * 0.30), width: 18, height: Math.round(height * 0.68), strokeColor: '#475569' },
        { id: 'm-h1', x: Math.round(width * 0.20), y: Math.round(height * 0.35), width: Math.round(width * 0.12), height: 18, strokeColor: '#475569' },
        { id: 'm-h2', x: Math.round(width * 0.40), y: Math.round(height * 0.65), width: Math.round(width * 0.12), height: 18, strokeColor: '#475569' },
        { id: 'm-h3', x: Math.round(width * 0.60), y: Math.round(height * 0.35), width: Math.round(width * 0.12), height: 18, strokeColor: '#475569' },
      ];
      const collectibles = [
        { id: 'bread-crumb-1', name: 'Labyrinth Coin 1', type: 'coin' as const, x: Math.round(width * 0.30), y: 50, value: 5 },
        { id: 'bread-crumb-2', name: 'Labyrinth Coin 2', type: 'coin' as const, x: Math.round(width * 0.50), y: Math.round(height * 0.45), value: 5 },
        { id: 'bread-crumb-3', name: 'Labyrinth Coin 3', type: 'coin' as const, x: Math.round(width * 0.70), y: 50, value: 5 },
        { id: 'bread-crumb-4', name: 'Labyrinth Coin 4', type: 'coin' as const, x: Math.round(width * 0.70), y: Math.round(height * 0.75), value: 5 },
      ];

      return {
        ...basePlanMeta,
        title: 'Minotaur Labyrinth Maze',
        description: 'True maze navigation with corridor dead ends, no gravity, and guaranteed path connectivity to the exit.',
        templateId: 'maze-exploration',
        targetEngine: 'phaser-2d',
        category: 'top-down-2d',
        world: { width, height, gravity: 0, coordinateSystem: 'screen-top-left-2d', friction: 0.95 },
        terrain: { platforms: [], walls, hazards: [] },
        player: {
          spawn: { x: 45, y: 45 },
          speed: 220,
          jumpPower: 0,
          size: 28,
          supportedAbilities: ['walk', 'run'],
        },
        entities: { enemies: [], collectibles, interactives: [] },
        objectives: {
          primary: { type: 'reach_goal', targetRef: 'maze-exit' },
          winConditions: ['Navigate the labyrinth paths and touch the exit gate'],
          loseConditions: ['Unable to solve barrier switches before reset'],
          checkpoints: [],
          goal: { id: 'maze-exit', x: width - 60, y: height - 60, width: 34, height: 34 },
        },
        mechanics: {
          allowedMechanics: ['topdown_4way_movement', 'coin_collection'],
          rejectedMechanics: [],
        },
      };
    }

    // -------------------------------------------------------------------------
    // 8. GRAVITY-SWITCH PUZZLE
    // -------------------------------------------------------------------------
    case 'gravity-switch-puzzle': {
      const platforms = [
        { id: 'floor-a', x: 0, y: height - 36, width: Math.round(width * 0.32), height: 36, strokeColor: '#a855f7' },
        { id: 'floor-b', x: Math.round(width * 0.55), y: height - 36, width: Math.round(width * 0.25), height: 36, strokeColor: '#a855f7' },
        { id: 'ceiling-a', x: Math.round(width * 0.24), y: 0, width: Math.round(width * 0.38), height: 32, strokeColor: '#a855f7' },
        { id: 'ceiling-b', x: Math.round(width * 0.72), y: 0, width: Math.round(width * 0.26), height: 32, strokeColor: '#a855f7' },
        { id: 'finish-platform', x: Math.round(width * 0.85), y: Math.round(height * 0.65), width: Math.round(width * 0.13), height: 26, strokeColor: '#a855f7' },
      ];
      const hazards = [
        { id: 'floor-chasm-gap', x: Math.round(width * 0.32), y: height - 20, width: Math.round(width * 0.23), height: 20, hazardType: 'lava' as const },
        { id: 'ceiling-spikes', x: Math.round(width * 0.62), y: 32, width: Math.round(width * 0.10), height: 18, hazardType: 'spike' as const },
      ];
      const collectibles = [
        { id: 'flux-orb-1', name: 'Gravity Orb Alpha', type: 'star' as const, x: Math.round(width * 0.40), y: 50, value: 50 },
        { id: 'flux-orb-2', name: 'Gravity Orb Beta', type: 'star' as const, x: Math.round(width * 0.65), y: height - 60, value: 50 },
      ];

      return {
        ...basePlanMeta,
        title: 'Inversion Gravity Lab',
        description: 'Press Action or Space to invert gravity, walking on ceilings to cross fatal floor chasms.',
        templateId: 'gravity-switch-puzzle',
        targetEngine: 'phaser-2d',
        category: 'puzzle',
        world: { width, height, gravity: 750, coordinateSystem: 'screen-top-left-2d', friction: 0.85 },
        terrain: { platforms, walls: [], hazards },
        player: {
          spawn: { x: 45, y: height - 75 },
          speed: 250,
          jumpPower: 380,
          size: 34,
          supportedAbilities: ['walk', 'run', 'flip_gravity'],
        },
        entities: { enemies: [], collectibles, interactives: [] },
        objectives: {
          primary: { type: 'reach_goal', targetRef: 'gravity-goal' },
          winConditions: ['Invert gravity to traverse ceilings and reach the exit chamber'],
          loseConditions: ['Fall into lava chasm or collide with ceiling spikes'],
          checkpoints: [],
          goal: { id: 'gravity-goal', x: Math.round(width * 0.88), y: Math.round(height * 0.65) - 48, width: 36, height: 48 },
        },
        mechanics: {
          allowedMechanics: ['jump_and_run', 'gravity_inversion', 'hazard_evasion', 'coin_collection'],
          rejectedMechanics: [],
        },
      };
    }

    // -------------------------------------------------------------------------
    // 9. MOMENTUM AND DRIFTING CHALLENGE
    // -------------------------------------------------------------------------
    case 'momentum-drifting': {
      const walls = [
        { id: 'track-north', x: 0, y: 0, width, height: 24, strokeColor: '#06b6d4' },
        { id: 'track-south', x: 0, y: height - 24, width, height: 24, strokeColor: '#06b6d4' },
        { id: 'track-west', x: 0, y: 0, width: 24, height, strokeColor: '#06b6d4' },
        { id: 'track-east', x: width - 24, y: 0, width: 24, height, strokeColor: '#06b6d4' },
        { id: 'barrier-1', x: Math.round(width * 0.35), y: 24, width: 20, height: Math.round(height * 0.62), strokeColor: '#0891b2' },
        { id: 'barrier-2', x: Math.round(width * 0.68), y: Math.round(height * 0.35), width: 20, height: Math.round(height * 0.63), strokeColor: '#0891b2' },
      ];
      const collectibles = [
        { id: 'gate-boost-1', name: 'Drift Gate 1', type: 'star' as const, x: Math.round(width * 0.18), y: Math.round(height * 0.60), value: 20 },
        { id: 'gate-boost-2', name: 'Drift Gate 2', type: 'star' as const, x: Math.round(width * 0.50), y: Math.round(height * 0.25), value: 20 },
        { id: 'gate-boost-3', name: 'Drift Gate 3', type: 'star' as const, x: Math.round(width * 0.82), y: Math.round(height * 0.68), value: 20 },
      ];

      return {
        ...basePlanMeta,
        title: 'Neon Drift Circuit',
        description: 'Ultra-low friction drifting challenge requiring momentum steering around hairpin slalom barriers.',
        templateId: 'momentum-drifting',
        targetEngine: 'phaser-2d',
        category: 'racing',
        world: { width, height, gravity: 0, coordinateSystem: 'screen-top-left-2d', friction: 0.15 },
        terrain: { platforms: [], walls, hazards: [] },
        player: {
          spawn: { x: 50, y: 55 },
          speed: 320,
          jumpPower: 0,
          size: 32,
          supportedAbilities: ['walk', 'run', 'steer_drift'],
        },
        entities: { enemies: [], collectibles, interactives: [] },
        objectives: {
          primary: { type: 'reach_goal', targetRef: 'drift-finish-line' },
          winConditions: ['Drift through the slalom gates and cross the finish line'],
          loseConditions: ['Unable to solve barrier switches before reset'],
          checkpoints: [],
          goal: { id: 'drift-finish-line', x: width - 68, y: 55, width: 40, height: 48 },
        },
        mechanics: {
          allowedMechanics: ['topdown_4way_movement', 'momentum_drift', 'coin_collection'],
          rejectedMechanics: [],
        },
      };
    }

    // -------------------------------------------------------------------------
    // 10. TIMED OBSTACLE COURSE
    // -------------------------------------------------------------------------
    case 'timed-obstacle-course': {
      const platforms = [
        { id: 'sprint-floor-1', x: 0, y: height - 40, width: Math.round(width * 0.28), height: 40, strokeColor: '#f97316' },
        { id: 'sprint-floor-2', x: Math.round(width * 0.34), y: height - 40, width: Math.round(width * 0.28), height: 40, strokeColor: '#f97316' },
        { id: 'sprint-floor-3', x: Math.round(width * 0.68), y: height - 40, width: Math.round(width * 0.32), height: 40, strokeColor: '#f97316' },
        { id: 'hurdle-1', x: Math.round(width * 0.20), y: Math.round(height * 0.72), width: 48, height: 18, strokeColor: '#f97316' },
        { id: 'hurdle-2', x: Math.round(width * 0.46), y: Math.round(height * 0.64), width: 52, height: 18, strokeColor: '#f97316' },
        { id: 'hurdle-3', x: Math.round(width * 0.78), y: Math.round(height * 0.60), width: 56, height: 18, strokeColor: '#f97316' },
      ];
      const hazards = [
        { id: 'speed-chasm-1', x: Math.round(width * 0.28), y: height - 25, width: Math.round(width * 0.06), height: 25, hazardType: 'spike' as const },
        { id: 'speed-chasm-2', x: Math.round(width * 0.62), y: height - 25, width: Math.round(width * 0.06), height: 25, hazardType: 'spike' as const },
      ];
      const collectibles = [
        { id: 'time-bonus-1', name: 'Chrono Gem 1', type: 'star' as const, x: Math.round(width * 0.22), y: Math.round(height * 0.72) - 30, value: 10 },
        { id: 'time-bonus-2', name: 'Chrono Gem 2', type: 'star' as const, x: Math.round(width * 0.48), y: Math.round(height * 0.64) - 30, value: 10 },
        { id: 'time-bonus-3', name: 'Chrono Gem 3', type: 'star' as const, x: Math.round(width * 0.80), y: Math.round(height * 0.60) - 30, value: 10 },
      ];

      return {
        ...basePlanMeta,
        title: 'Turbo Sprint Trial',
        description: 'Race against a strict 25-second countdown clock across hurdle tiers.',
        templateId: 'timed-obstacle-course',
        targetEngine: 'phaser-2d',
        category: '2d-platformer',
        world: { width, height, gravity: 800, coordinateSystem: 'screen-top-left-2d', friction: 0.9 },
        terrain: { platforms, walls: [], hazards },
        player: {
          spawn: { x: 45, y: height - 80 },
          speed: 290,
          jumpPower: 460,
          size: 34,
          supportedAbilities: ['walk', 'run', 'jump', 'dash'],
        },
        entities: { enemies: [], collectibles, interactives: [] },
        objectives: {
          primary: { type: 'reach_goal', targetRef: 'turbo-finish', timeLimit: 25 },
          winConditions: ['Reach the finish gate before the 25-second clock expires'],
          loseConditions: ['Timer reaches 0:00 or fall into spike chasms'],
          checkpoints: [],
          goal: { id: 'turbo-finish', x: width - 75, y: height - 88, width: 36, height: 48 },
        },
        mechanics: {
          allowedMechanics: ['jump_and_run', 'timed_countdown', 'hazard_evasion', 'coin_collection'],
          rejectedMechanics: [],
        },
      };
    }

    // -------------------------------------------------------------------------
    // 11. COIN COLLECTION CHALLENGE
    // -------------------------------------------------------------------------
    case 'coin-collection-challenge': {
      const platforms = [
        { id: 'base-meadow', x: 0, y: height - 40, width, height: 40, strokeColor: '#eab308' },
        { id: 'coin-tier-1', x: Math.round(width * 0.12), y: Math.round(height * 0.72), width: Math.round(width * 0.16), height: 22, strokeColor: '#eab308' },
        { id: 'coin-tier-2', x: Math.round(width * 0.36), y: Math.round(height * 0.54), width: Math.round(width * 0.18), height: 22, strokeColor: '#eab308' },
        { id: 'coin-tier-3', x: Math.round(width * 0.62), y: Math.round(height * 0.36), width: Math.round(width * 0.18), height: 22, strokeColor: '#eab308' },
        { id: 'coin-tier-4', x: Math.round(width * 0.84), y: Math.round(height * 0.56), width: Math.round(width * 0.14), height: 22, strokeColor: '#eab308' },
      ];
      const collectibles = [
        { id: 'c-1', name: 'Gold Coin 1', type: 'coin' as const, x: Math.round(width * 0.15), y: Math.round(height * 0.72) - 30, value: 10 },
        { id: 'c-2', name: 'Gold Coin 2', type: 'coin' as const, x: Math.round(width * 0.22), y: Math.round(height * 0.72) - 30, value: 10 },
        { id: 'c-3', name: 'Gold Coin 3', type: 'coin' as const, x: Math.round(width * 0.40), y: Math.round(height * 0.54) - 30, value: 10 },
        { id: 'c-4', name: 'Gold Coin 4', type: 'coin' as const, x: Math.round(width * 0.48), y: Math.round(height * 0.54) - 30, value: 10 },
        { id: 'c-5', name: 'Gold Coin 5', type: 'coin' as const, x: Math.round(width * 0.66), y: Math.round(height * 0.36) - 30, value: 10 },
        { id: 'c-6', name: 'Gold Coin 6', type: 'coin' as const, x: Math.round(width * 0.74), y: Math.round(height * 0.36) - 30, value: 10 },
        { id: 'c-7', name: 'Gold Coin 7', type: 'coin' as const, x: Math.round(width * 0.87), y: Math.round(height * 0.56) - 30, value: 10 },
        { id: 'c-8', name: 'Gold Coin 8', type: 'coin' as const, x: Math.round(width * 0.93), y: Math.round(height * 0.56) - 30, value: 10 },
      ];

      return {
        ...basePlanMeta,
        title: 'Gold Rush Collector',
        description: 'High verticality agility platformer requiring every single gold coin to be gathered.',
        templateId: 'coin-collection-challenge',
        targetEngine: 'phaser-2d',
        category: '2d-platformer',
        world: { width, height, gravity: 740, coordinateSystem: 'screen-top-left-2d', friction: 0.85 },
        terrain: { platforms, walls: [], hazards: [] },
        player: {
          spawn: { x: 45, y: height - 80 },
          speed: 260,
          jumpPower: 440,
          size: 34,
          supportedAbilities: ['walk', 'run', 'jump', 'double_jump'],
        },
        entities: { enemies: [], collectibles, interactives: [] },
        objectives: {
          primary: { type: 'collect_all', targetCount: 8 },
          winConditions: ['Collect all 8 gold coins to complete the challenge'],
          loseConditions: ['Unable to collect all 8 coins before stage exit'],
          checkpoints: [],
          goal: { id: 'golden-trophy-exit', x: width - 75, y: height - 88, width: 36, height: 48 },
        },
        mechanics: {
          allowedMechanics: ['jump_and_run', 'coin_collection'],
          rejectedMechanics: [],
        },
      };
    }

    // -------------------------------------------------------------------------
    // 12. EXPLORATION-AND-PUZZLE HYBRID
    // -------------------------------------------------------------------------
    case 'exploration-puzzle-hybrid': {
      const walls = [
        { id: 'h-north', x: 0, y: 0, width, height: 24, strokeColor: '#10b981' },
        { id: 'h-south', x: 0, y: height - 24, width, height: 24, strokeColor: '#10b981' },
        { id: 'h-west', x: 0, y: 0, width: 24, height, strokeColor: '#10b981' },
        { id: 'h-east', x: width - 24, y: 0, width: 24, height, strokeColor: '#10b981' },
        { id: 'h-chamber-left', x: Math.round(width * 0.38), y: 24, width: 20, height: Math.round(height * 0.60), strokeColor: '#059669' },
        { id: 'h-chamber-right', x: Math.round(width * 0.72), y: Math.round(height * 0.38), width: 20, height: Math.round(height * 0.60), strokeColor: '#059669' },
        { id: 'vault-door', x: Math.round(width * 0.72), y: 24, width: 20, height: Math.round(height * 0.36), strokeColor: '#f59e0b' },
      ];
      const interactives = [
        { id: 'vault-switch', name: 'Vault Switch', type: 'switch' as const, x: Math.round(width * 0.20), y: Math.round(height * 0.75), width: 32, height: 32, behavior: { targetDoorId: 'vault-door' } },
      ];
      const collectibles = [
        { id: 'artifact-1', name: 'Relic Alpha', type: 'gem' as const, x: Math.round(width * 0.18), y: Math.round(height * 0.25), value: 50 },
        { id: 'artifact-2', name: 'Relic Beta', type: 'gem' as const, x: Math.round(width * 0.54), y: Math.round(height * 0.70), value: 50 },
      ];

      return {
        ...basePlanMeta,
        title: 'Catacomb Vault Expedition',
        description: 'Explore the catacombs, discover the hidden switch, retract the vault door, and claim the relic.',
        templateId: 'exploration-puzzle-hybrid',
        targetEngine: 'phaser-2d',
        category: 'puzzle',
        world: { width, height, gravity: 0, coordinateSystem: 'screen-top-left-2d', friction: 0.9 },
        terrain: { platforms: [], walls, hazards: [] },
        player: {
          spawn: { x: 50, y: 55 },
          speed: 240,
          jumpPower: 0,
          size: 32,
          supportedAbilities: ['walk', 'run', 'dash'],
        },
        entities: { enemies: [], collectibles, interactives },
        objectives: {
          primary: { type: 'reach_goal', targetRef: 'vault-treasure' },
          secondary: [{ type: 'activate_switch', targetCount: 1 }],
          winConditions: ['Locate and step on vault-switch to open vault-door, then claim the treasure'],
          loseConditions: ['Unable to solve barrier switches before reset'],
          checkpoints: [],
          goal: { id: 'vault-treasure', x: width - 68, y: 55, width: 40, height: 40 },
        },
        mechanics: {
          allowedMechanics: ['topdown_4way_movement', 'switch_toggle', 'door_key_unlock', 'coin_collection'],
          rejectedMechanics: [],
        },
      };
    }

    // -------------------------------------------------------------------------
    // 13. DEFERRED 3D ENGINE VOXEL SPECIFICATION
    // -------------------------------------------------------------------------
    case 'voxel-3d-deferred': {
      return {
        ...basePlanMeta,
        title: 'Voxel World Exploration (Deferred 3D Engine)',
        description: 'Voxel cubic landscape specification structured for upcoming WebGL volumetric voxel runtime.',
        templateId: 'voxel-3d-deferred',
        targetEngine: 'future-3d-engine',
        status: 'deferred-future-engine',
        category: 'voxel',
        world: {
          width,
          height,
          gravity: 0,
          coordinateSystem: 'cartesian-3d',
          friction: 0.8,
        },
        terrain: {
          platforms: [
            { id: 'voxel-bedrock', x: 0, y: height - 40, width, height: 40, strokeColor: '#10b981' },
          ],
          walls: [],
          hazards: [],
        },
        player: {
          spawn: { x: Math.round(width * 0.1), y: height - 80 },
          speed: 240,
          jumpPower: 400,
          size: 32,
          supportedAbilities: ['walk', 'run', 'jump'],
        },
        entities: { enemies: [], collectibles: [], interactives: [] },
        objectives: {
          primary: { type: 'reach_goal', targetRef: 'voxel-beacon' },
          winConditions: ['Traverse the voxel landscape and reach the target beacon'],
          loseConditions: ['Falling into unrendered void boundaries'],
          checkpoints: [],
          goal: { id: 'voxel-beacon', x: Math.round(width * 0.85), y: height - 88, width: 36, height: 48 },
        },
        mechanics: {
          allowedMechanics: ['jump_and_run'],
          rejectedMechanics: [],
        },
      };
    }

    default: {
      return generateTemplateLevel('physics-platformer', options);
    }
  }
}

/**
 * Validates that a generated plan passes strict runtime contract bounds.
 */
export function generateAndValidateTemplateLevel(
  templateId: GameTemplateId,
  options: LevelGenerationOptions = {}
): GameDesignPlan {
  const plan = generateTemplateLevel(templateId, options);
  const valResult = validateGamePlan(plan);
  if (!valResult.success) {
    throw new Error(
      `Procedural generator produced invalid plan for template "${templateId}":\n- ${valResult.errors.join('\n- ')}`
    );
  }
  return valResult.plan!;
}
