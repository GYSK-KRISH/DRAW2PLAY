import type {
  GameDesignPlan,
  GameTemplateId,
  AllowlistedMechanicId,
  AllowlistedPlayerAbility,
} from '../types/plan.js';
import type { GameCategory, TargetEngine } from '../types/reference.js';
import type { PlayerMovementModel } from '../types/scene.js';

export interface TemplateSpecification {
  id: GameTemplateId;
  name: string;
  description: string;
  targetEngine: TargetEngine;
  category: GameCategory;
  movementModel: PlayerMovementModel;
  controlsHelp: string;
  supportedEntityTypes: {
    platforms: boolean;
    walls: boolean;
    hazards: Array<'spike' | 'lava' | 'pit' | 'slime'>;
    enemies: Array<'patrol' | 'jumper' | 'stationary'>;
    collectibles: Array<'coin' | 'gem' | 'key' | 'star'>;
    interactives: Array<'trampoline' | 'door' | 'switch'>;
  };
  supportedMechanics: AllowlistedMechanicId[];
  requiredPlayerConfiguration: {
    allowedAbilities: AllowlistedPlayerAbility[];
    requiresJump: boolean;
    allowsGravity: boolean;
  };
  requiredObjectives: {
    supportedPrimaryTypes: Array<'reach_goal' | 'collect_all' | 'defeat_enemies' | 'survival'>;
    requiresGoalPosition: boolean;
  };
  allowedWorldSettings: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    minGravity: number;
    maxGravity: number;
    supportedCoordinateSystems: Array<'screen-top-left-2d' | 'cartesian-3d'>;
  };
  knownLimitations: string[];
}

export interface SuggestedAlternative {
  templateId: GameTemplateId;
  templateName: string;
  rationale: string;
  whatWouldChange: string[];
}

export interface TemplateCompatibilityReport {
  isCompatible: boolean;
  templateId: GameTemplateId;
  templateName: string;
  errors: string[];
  warnings: string[];
  suggestedAlternatives: SuggestedAlternative[];
  knownLimitations: string[];
}

export const TEMPLATE_REGISTRY: Record<GameTemplateId, TemplateSpecification> = {
  // ---------------------------------------------------------------------------
  // 1. PHYSICS PLATFORMER
  // ---------------------------------------------------------------------------
  'physics-platformer': {
    id: 'physics-platformer',
    name: 'Physics Platformer',
    description: 'Momentum platformer with gravity, variable jump heights, hazards, trampoline springs, and goal exit.',
    targetEngine: 'phaser-2d',
    category: '2d-platformer',
    movementModel: 'platformer',
    controlsHelp: 'Arrow Keys / WASD: Move & Run | Space / Up: Jump | Down: Fast-fall',
    supportedEntityTypes: {
      platforms: true,
      walls: true,
      hazards: ['spike', 'lava', 'pit', 'slime'],
      enemies: ['patrol', 'jumper', 'stationary'],
      collectibles: ['coin', 'gem', 'key', 'star'],
      interactives: ['trampoline', 'door', 'switch'],
    },
    supportedMechanics: [
      'jump_and_run',
      'hazard_evasion',
      'coin_collection',
      'checkpoint_respawn',
      'trampoline_bounce',
      'patrol_enemy_avoidance',
      'door_key_unlock',
      'switch_toggle',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'jump', 'double_jump', 'dash', 'wall_slide'],
      requiresJump: true,
      allowsGravity: true,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['reach_goal', 'collect_all', 'defeat_enemies', 'survival'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 480,
      maxWidth: 8000,
      minHeight: 320,
      maxHeight: 4000,
      minGravity: 200,
      maxGravity: 1800,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Requires positive gravity (>= 200) for vertical jump arcs.',
      'Does not support 4-way top-down directional steering.',
    ],
  },

  // ---------------------------------------------------------------------------
  // 2. PRECISION PLATFORMER
  // ---------------------------------------------------------------------------
  'precision-platformer': {
    id: 'precision-platformer',
    name: 'Precision Platformer',
    description: 'High-gravity, instant-response precision gauntlet with micro-platforms, tight needle corridors, and zero margin for error.',
    targetEngine: 'phaser-2d',
    category: '2d-platformer',
    movementModel: 'precision',
    controlsHelp: 'Arrow Keys / WASD: Instant Move | Space: Precision Jump',
    supportedEntityTypes: {
      platforms: true,
      walls: true,
      hazards: ['spike', 'lava'],
      enemies: ['stationary'],
      collectibles: ['gem', 'star'],
      interactives: ['trampoline'],
    },
    supportedMechanics: [
      'jump_and_run',
      'hazard_evasion',
      'precision_jumping',
      'checkpoint_respawn',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'jump', 'dash'],
      requiresJump: true,
      allowsGravity: true,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['reach_goal'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 480,
      maxWidth: 8000,
      minHeight: 320,
      maxHeight: 4000,
      minGravity: 600,
      maxGravity: 2000,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Strict instant-acceleration physics model removes momentum drift.',
      'Requires jump ability and positive gravity >= 600.',
    ],
  },

  // ---------------------------------------------------------------------------
  // 3. PHYSICS PUZZLE
  // ---------------------------------------------------------------------------
  'physics-puzzle': {
    id: 'physics-puzzle',
    name: 'Physics Puzzle',
    description: 'Chamber puzzle with ground pressure switches, motorized door barriers, and mechanical obstacles.',
    targetEngine: 'phaser-2d',
    category: 'puzzle',
    movementModel: 'platformer',
    controlsHelp: 'Arrow Keys / WASD: Move & Jump | Step on Switches to Open Doors',
    supportedEntityTypes: {
      platforms: true,
      walls: true,
      hazards: ['spike', 'lava', 'slime'],
      enemies: ['stationary'],
      collectibles: ['coin', 'gem', 'key'],
      interactives: ['door', 'switch', 'trampoline'],
    },
    supportedMechanics: [
      'door_key_unlock',
      'switch_toggle',
      'coin_collection',
      'hazard_evasion',
      'jump_and_run',
      'checkpoint_respawn',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'jump'],
      requiresJump: false,
      allowsGravity: true,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['reach_goal', 'collect_all'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 400,
      maxWidth: 5000,
      minHeight: 300,
      maxHeight: 3000,
      minGravity: 0,
      maxGravity: 1500,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Requires interactive switches and doors for optimal puzzle progression.',
    ],
  },

  // ---------------------------------------------------------------------------
  // 4. TOP-DOWN EXPLORATION
  // ---------------------------------------------------------------------------
  'top-down-exploration': {
    id: 'top-down-exploration',
    name: 'Top-Down Exploration',
    description: 'Multi-room labyrinth exploration with 4-way/8-way directional velocity, zero gravity, and landmark destinations.',
    targetEngine: 'phaser-2d',
    category: 'top-down-2d',
    movementModel: 'topdown',
    controlsHelp: 'Arrow Keys / WASD: 4-Way Directional Movement',
    supportedEntityTypes: {
      platforms: false,
      walls: true,
      hazards: ['spike', 'lava', 'slime'],
      enemies: ['patrol', 'stationary'],
      collectibles: ['coin', 'gem', 'key', 'star'],
      interactives: ['door', 'switch'],
    },
    supportedMechanics: [
      'topdown_4way_movement',
      'hazard_evasion',
      'coin_collection',
      'door_key_unlock',
      'switch_toggle',
      'patrol_enemy_avoidance',
      'checkpoint_respawn',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'dash'],
      requiresJump: false,
      allowsGravity: false,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['reach_goal', 'collect_all', 'survival'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 480,
      maxWidth: 8000,
      minHeight: 320,
      maxHeight: 8000,
      minGravity: 0,
      maxGravity: 0,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Gravity must be exactly 0 (no vertical jumping).',
      'Platforms are replaced by solid corridor walls.',
    ],
  },

  // ---------------------------------------------------------------------------
  // 5. TOP-DOWN ARENA SURVIVAL
  // ---------------------------------------------------------------------------
  'top-down-arena-survival': {
    id: 'top-down-arena-survival',
    name: 'Top-Down Arena Survival',
    description: 'Enclosed combat arena with pursuing chasers; survive for the target duration without taking fatal damage.',
    targetEngine: 'phaser-2d',
    category: 'top-down-2d',
    movementModel: 'topdown',
    controlsHelp: 'Arrow Keys / WASD: Dodge and evade chasers | Survive the clock!',
    supportedEntityTypes: {
      platforms: false,
      walls: true,
      hazards: ['spike', 'lava'],
      enemies: ['patrol', 'stationary'],
      collectibles: ['coin', 'gem', 'star'],
      interactives: [],
    },
    supportedMechanics: [
      'topdown_4way_movement',
      'patrol_enemy_avoidance',
      'arena_survival',
      'hazard_evasion',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'dash'],
      requiresJump: false,
      allowsGravity: false,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['survival', 'defeat_enemies'],
      requiresGoalPosition: false,
    },
    allowedWorldSettings: {
      minWidth: 480,
      maxWidth: 4000,
      minHeight: 320,
      maxHeight: 4000,
      minGravity: 0,
      maxGravity: 0,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Zero gravity arena; win condition is survival countdown or clearing waves.',
    ],
  },

  // ---------------------------------------------------------------------------
  // 6. COLLECT-AND-ESCAPE ADVENTURE
  // ---------------------------------------------------------------------------
  'collect-and-escape': {
    id: 'collect-and-escape',
    name: 'Collect-and-Escape Adventure',
    description: 'Collect all required keys or relics to unseal the locked exit portal before escaping.',
    targetEngine: 'phaser-2d',
    category: '2d-platformer',
    movementModel: 'platformer',
    controlsHelp: 'Arrow Keys / WASD: Move & Jump | Collect all keys to unseal the exit!',
    supportedEntityTypes: {
      platforms: true,
      walls: true,
      hazards: ['spike', 'lava', 'slime'],
      enemies: ['patrol', 'stationary'],
      collectibles: ['key', 'coin', 'gem'],
      interactives: ['door', 'switch', 'trampoline'],
    },
    supportedMechanics: [
      'jump_and_run',
      'coin_collection',
      'door_key_unlock',
      'hazard_evasion',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'jump', 'double_jump'],
      requiresJump: true,
      allowsGravity: true,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['collect_all'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 480,
      maxWidth: 8000,
      minHeight: 320,
      maxHeight: 4000,
      minGravity: 200,
      maxGravity: 1800,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Goal portal remains sealed and unenterable until all key collectibles are collected.',
    ],
  },

  // ---------------------------------------------------------------------------
  // 7. MAZE EXPLORATION
  // ---------------------------------------------------------------------------
  'maze-exploration': {
    id: 'maze-exploration',
    name: 'Maze Exploration',
    description: 'Navigate procedurally connected labyrinth walls and dead-ends with zero gravity to locate the exit.',
    targetEngine: 'phaser-2d',
    category: 'top-down-2d',
    movementModel: 'topdown',
    controlsHelp: 'Arrow Keys / WASD: Navigate maze corridors to find the exit',
    supportedEntityTypes: {
      platforms: false,
      walls: true,
      hazards: ['spike'],
      enemies: ['patrol', 'stationary'],
      collectibles: ['coin', 'gem'],
      interactives: ['door', 'switch'],
    },
    supportedMechanics: [
      'topdown_4way_movement',
      'coin_collection',
      'hazard_evasion',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'dash'],
      requiresJump: false,
      allowsGravity: false,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['reach_goal'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 480,
      maxWidth: 8000,
      minHeight: 320,
      maxHeight: 8000,
      minGravity: 0,
      maxGravity: 0,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Requires connected maze corridors and zero gravity.',
    ],
  },

  // ---------------------------------------------------------------------------
  // 8. GRAVITY-SWITCH PUZZLE
  // ---------------------------------------------------------------------------
  'gravity-switch-puzzle': {
    id: 'gravity-switch-puzzle',
    name: 'Gravity-Switch Puzzle',
    description: 'Invertible gravity mechanic: press Action / Space to walk on ceilings and bypass fatal floor chasms.',
    targetEngine: 'phaser-2d',
    category: 'puzzle',
    movementModel: 'gravity-switch',
    controlsHelp: 'Arrow Keys / A/D: Move | Space / Action: Invert Gravity (Floor <-> Ceiling)',
    supportedEntityTypes: {
      platforms: true,
      walls: true,
      hazards: ['spike', 'lava'],
      enemies: ['stationary'],
      collectibles: ['coin', 'star', 'gem'],
      interactives: ['trampoline'],
    },
    supportedMechanics: [
      'jump_and_run',
      'gravity_inversion',
      'hazard_evasion',
      'coin_collection',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'jump', 'flip_gravity'],
      requiresJump: false,
      allowsGravity: true,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['reach_goal', 'collect_all'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 480,
      maxWidth: 6000,
      minHeight: 320,
      maxHeight: 3000,
      minGravity: 300,
      maxGravity: 1500,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Requires ceiling platforms and overhead collision geometry for walking upside down.',
    ],
  },

  // ---------------------------------------------------------------------------
  // 9. MOMENTUM AND DRIFTING CHALLENGE
  // ---------------------------------------------------------------------------
  'momentum-drifting': {
    id: 'momentum-drifting',
    name: 'Momentum & Drifting Challenge',
    description: 'Low-friction inertia challenge: steer and drift around tight slalom gates to reach the finish line.',
    targetEngine: 'phaser-2d',
    category: 'racing',
    movementModel: 'drift',
    controlsHelp: 'Arrow Keys: Steer & Drift | High Inertia Slalom Track',
    supportedEntityTypes: {
      platforms: false,
      walls: true,
      hazards: ['spike', 'lava'],
      enemies: ['stationary'],
      collectibles: ['star', 'coin'],
      interactives: [],
    },
    supportedMechanics: [
      'topdown_4way_movement',
      'momentum_drift',
      'coin_collection',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'steer_drift'],
      requiresJump: false,
      allowsGravity: false,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['reach_goal'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 480,
      maxWidth: 8000,
      minHeight: 320,
      maxHeight: 8000,
      minGravity: 0,
      maxGravity: 0,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Operates with low friction (<= 0.2) and zero gravity for smooth inertia drifting.',
    ],
  },

  // ---------------------------------------------------------------------------
  // 10. TIMED OBSTACLE COURSE
  // ---------------------------------------------------------------------------
  'timed-obstacle-course': {
    id: 'timed-obstacle-course',
    name: 'Timed Obstacle Course',
    description: 'Sprint against a strict countdown timer across hurdle tiers before time runs out.',
    targetEngine: 'phaser-2d',
    category: '2d-platformer',
    movementModel: 'platformer',
    controlsHelp: 'Arrow Keys / WASD: Sprint & Jump | Race against the countdown timer!',
    supportedEntityTypes: {
      platforms: true,
      walls: true,
      hazards: ['spike', 'lava'],
      enemies: ['patrol', 'stationary'],
      collectibles: ['star', 'coin'],
      interactives: ['trampoline'],
    },
    supportedMechanics: [
      'jump_and_run',
      'timed_countdown',
      'hazard_evasion',
      'coin_collection',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'jump', 'dash'],
      requiresJump: true,
      allowsGravity: true,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['reach_goal'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 480,
      maxWidth: 8000,
      minHeight: 320,
      maxHeight: 4000,
      minGravity: 300,
      maxGravity: 1800,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Must contain a valid time limit in primary objective contract.',
    ],
  },

  // ---------------------------------------------------------------------------
  // 11. COIN COLLECTION CHALLENGE
  // ---------------------------------------------------------------------------
  'coin-collection-challenge': {
    id: 'coin-collection-challenge',
    name: 'Coin Collection Challenge',
    description: 'High verticality agility platformer requiring every single gold coin to be collected.',
    targetEngine: 'phaser-2d',
    category: '2d-platformer',
    movementModel: 'platformer',
    controlsHelp: 'Arrow Keys / WASD: Move & Jump | Collect all coins to trigger victory!',
    supportedEntityTypes: {
      platforms: true,
      walls: true,
      hazards: ['spike', 'slime'],
      enemies: ['patrol'],
      collectibles: ['coin', 'gem'],
      interactives: ['trampoline'],
    },
    supportedMechanics: [
      'jump_and_run',
      'coin_collection',
      'hazard_evasion',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'jump', 'double_jump'],
      requiresJump: true,
      allowsGravity: true,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['collect_all'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 480,
      maxWidth: 8000,
      minHeight: 320,
      maxHeight: 4000,
      minGravity: 200,
      maxGravity: 1800,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Requires at least 3 collectible coins on platform ledges.',
    ],
  },

  // ---------------------------------------------------------------------------
  // 12. EXPLORATION-AND-PUZZLE HYBRID
  // ---------------------------------------------------------------------------
  'exploration-puzzle-hybrid': {
    id: 'exploration-puzzle-hybrid',
    name: 'Exploration & Puzzle Hybrid',
    description: 'Explore interconnected maze corridors, solve pressure switch puzzles to open security gates, and claim the relic.',
    targetEngine: 'phaser-2d',
    category: 'puzzle',
    movementModel: 'topdown',
    controlsHelp: 'Arrow Keys / WASD: 4-Way Move | Locate hidden switches to unlock vault barriers',
    supportedEntityTypes: {
      platforms: false,
      walls: true,
      hazards: ['spike', 'slime'],
      enemies: ['patrol', 'stationary'],
      collectibles: ['gem', 'key', 'coin'],
      interactives: ['door', 'switch'],
    },
    supportedMechanics: [
      'topdown_4way_movement',
      'switch_toggle',
      'door_key_unlock',
      'coin_collection',
      'hazard_evasion',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'dash'],
      requiresJump: false,
      allowsGravity: false,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['reach_goal', 'collect_all'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 480,
      maxWidth: 8000,
      minHeight: 320,
      maxHeight: 8000,
      minGravity: 0,
      maxGravity: 0,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Zero gravity exploration combined with switch-door barrier logic.',
    ],
  },

  // ---------------------------------------------------------------------------
  // LEGACY ALIASES (100% Backward Compatibility)
  // ---------------------------------------------------------------------------
  'phaser-2d-platformer': {
    id: 'phaser-2d-platformer',
    name: 'Phaser 2D Platformer',
    description: 'Side-scrolling 2D platformer with gravity, jumping, moving hazards, and reach-the-goal progression.',
    targetEngine: 'phaser-2d',
    category: '2d-platformer',
    movementModel: 'platformer',
    controlsHelp: 'Arrow Keys / WASD: Move & Jump',
    supportedEntityTypes: {
      platforms: true,
      walls: true,
      hazards: ['spike', 'lava', 'pit', 'slime'],
      enemies: ['patrol', 'jumper', 'stationary'],
      collectibles: ['coin', 'gem', 'key', 'star'],
      interactives: ['trampoline', 'door', 'switch'],
    },
    supportedMechanics: [
      'jump_and_run',
      'hazard_evasion',
      'coin_collection',
      'checkpoint_respawn',
      'trampoline_bounce',
      'patrol_enemy_avoidance',
      'door_key_unlock',
      'switch_toggle',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'jump', 'double_jump', 'dash', 'wall_slide'],
      requiresJump: true,
      allowsGravity: true,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['reach_goal', 'collect_all', 'defeat_enemies', 'survival'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 480,
      maxWidth: 8000,
      minHeight: 320,
      maxHeight: 4000,
      minGravity: 200,
      maxGravity: 1800,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Does not support 4-way top-down directional movement.',
      'Requires positive gravity (>= 200) for platform jumping physics.',
    ],
  },

  'phaser-2d-topdown': {
    id: 'phaser-2d-topdown',
    name: 'Phaser 2D Top-Down Maze',
    description: 'Top-down 4-directional navigation with zero gravity, corridor walls, keys, and enemy patrols.',
    targetEngine: 'phaser-2d',
    category: 'top-down-2d',
    movementModel: 'topdown',
    controlsHelp: 'Arrow Keys / WASD: 4-Way Directional Movement',
    supportedEntityTypes: {
      platforms: false,
      walls: true,
      hazards: ['spike', 'lava', 'slime'],
      enemies: ['patrol', 'stationary'],
      collectibles: ['coin', 'gem', 'key', 'star'],
      interactives: ['door', 'switch'],
    },
    supportedMechanics: [
      'topdown_4way_movement',
      'hazard_evasion',
      'coin_collection',
      'door_key_unlock',
      'switch_toggle',
      'patrol_enemy_avoidance',
      'checkpoint_respawn',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'dash'],
      requiresJump: false,
      allowsGravity: false,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['reach_goal', 'collect_all', 'survival'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 480,
      maxWidth: 6000,
      minHeight: 320,
      maxHeight: 6000,
      minGravity: 0,
      maxGravity: 0,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Gravity must be 0 (no vertical jumping physics).',
      'Jump mechanics and trampolines are not supported in top-down mode.',
      'Terrain uses walls instead of floating platform ledges.',
    ],
  },

  'phaser-2d-puzzle': {
    id: 'phaser-2d-puzzle',
    name: 'Phaser 2D Puzzle Room',
    description: 'Enclosed room with interactive switches, doors, keys, and logical completion conditions.',
    targetEngine: 'phaser-2d',
    category: 'puzzle',
    movementModel: 'platformer',
    controlsHelp: 'Arrow Keys / WASD: Move & Jump | Activate Switches',
    supportedEntityTypes: {
      platforms: true,
      walls: true,
      hazards: ['spike', 'lava', 'slime'],
      enemies: ['stationary'],
      collectibles: ['coin', 'gem', 'key'],
      interactives: ['door', 'switch', 'trampoline'],
    },
    supportedMechanics: [
      'door_key_unlock',
      'switch_toggle',
      'coin_collection',
      'hazard_evasion',
      'jump_and_run',
      'checkpoint_respawn',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'jump'],
      requiresJump: false,
      allowsGravity: true,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['reach_goal', 'collect_all'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 400,
      maxWidth: 4000,
      minHeight: 300,
      maxHeight: 3000,
      minGravity: 0,
      maxGravity: 1500,
      supportedCoordinateSystems: ['screen-top-left-2d'],
    },
    knownLimitations: [
      'Optimized for single-screen or compact multi-chamber rooms.',
      'Requires interactive entities (doors, keys, or switches) for optimal experience.',
    ],
  },

  'voxel-3d-deferred': {
    id: 'voxel-3d-deferred',
    name: 'Deferred 3D Voxel Engine',
    description: '3D voxel coordinate space plan. Runtime generation is deferred to future 3D engine.',
    targetEngine: 'future-3d-engine',
    category: 'voxel',
    movementModel: 'platformer',
    controlsHelp: '3D Voxel Mesh (Export Only in Phase 6.2)',
    supportedEntityTypes: {
      platforms: true,
      walls: true,
      hazards: ['lava', 'pit'],
      enemies: ['patrol', 'stationary'],
      collectibles: ['gem', 'star', 'coin'],
      interactives: ['switch', 'door'],
    },
    supportedMechanics: [
      'jump_and_run',
      'hazard_evasion',
      'coin_collection',
      'checkpoint_respawn',
    ],
    requiredPlayerConfiguration: {
      allowedAbilities: ['walk', 'run', 'jump'],
      requiresJump: true,
      allowsGravity: true,
    },
    requiredObjectives: {
      supportedPrimaryTypes: ['reach_goal', 'collect_all'],
      requiresGoalPosition: true,
    },
    allowedWorldSettings: {
      minWidth: 320,
      maxWidth: 10000,
      minHeight: 240,
      maxHeight: 10000,
      minGravity: 0,
      maxGravity: 2000,
      supportedCoordinateSystems: ['cartesian-3d', 'screen-top-left-2d'],
    },
    knownLimitations: [
      'Voxel 3D runtime is deferred; plans are preserved in 3D format for future export.',
      'Phaser canvas cannot execute native 3D voxel meshes directly without 2D projection.',
    ],
  },
};

/**
 * Checks a proposed GameDesignPlan against a target template specification.
 * Never silently mutates or switches templates — returns explicit errors, warnings,
 * and actionable alternatives with explanations of what would change.
 */
export function checkTemplateCompatibility(
  plan: GameDesignPlan,
  targetTemplateId?: GameTemplateId
): TemplateCompatibilityReport {
  const templateId = targetTemplateId || plan.templateId;
  const spec = TEMPLATE_REGISTRY[templateId];

  if (!spec) {
    return {
      isCompatible: false,
      templateId,
      templateName: 'Unknown Template',
      errors: [`Template "${templateId}" is not registered in the system.`],
      warnings: [],
      suggestedAlternatives: [
        {
          templateId: 'physics-platformer',
          templateName: TEMPLATE_REGISTRY['physics-platformer'].name,
          rationale: 'Default reliable 2D platformer template supported by the active Phaser runtime.',
          whatWouldChange: ['Switches to standard 2D side-scrolling platformer mechanics.'],
        },
      ],
      knownLimitations: [],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestedAlternatives: SuggestedAlternative[] = [];

  // 1. Gravity checks
  if (spec.allowedWorldSettings.minGravity === 0 && spec.allowedWorldSettings.maxGravity === 0) {
    if (plan.world.gravity > 0) {
      errors.push(
        `Template "${spec.name}" requires zero gravity for top-down perspective, but plan specifies gravity=${plan.world.gravity}.`
      );
    }
  } else {
    if (plan.world.gravity < spec.allowedWorldSettings.minGravity) {
      errors.push(
        `Template "${spec.name}" requires minimum gravity of ${spec.allowedWorldSettings.minGravity}, but plan specifies gravity=${plan.world.gravity}.`
      );
    } else if (plan.world.gravity > spec.allowedWorldSettings.maxGravity) {
      errors.push(
        `Template "${spec.name}" exceeds maximum gravity of ${spec.allowedWorldSettings.maxGravity}, but plan specifies gravity=${plan.world.gravity}.`
      );
    }
  }

  // 2. World dimensions checks
  if (plan.world.width < spec.allowedWorldSettings.minWidth || plan.world.width > spec.allowedWorldSettings.maxWidth) {
    errors.push(
      `Plan world width (${plan.world.width}) is outside template allowed range [${spec.allowedWorldSettings.minWidth}, ${spec.allowedWorldSettings.maxWidth}].`
    );
  }
  if (plan.world.height < spec.allowedWorldSettings.minHeight || plan.world.height > spec.allowedWorldSettings.maxHeight) {
    errors.push(
      `Plan world height (${plan.world.height}) is outside template allowed range [${spec.allowedWorldSettings.minHeight}, ${spec.allowedWorldSettings.maxHeight}].`
    );
  }

  // 3. Supported coordinate systems
  if (!spec.allowedWorldSettings.supportedCoordinateSystems.includes(plan.world.coordinateSystem)) {
    errors.push(
      `Coordinate system "${plan.world.coordinateSystem}" is unsupported by template "${spec.name}".`
    );
  }

  // 4. Mechanics checks
  for (const mech of plan.mechanics.allowedMechanics) {
    if (!spec.supportedMechanics.includes(mech)) {
      errors.push(
        `Mechanic "${mech}" is not supported by template "${spec.name}". Supported: [${spec.supportedMechanics.join(', ')}].`
      );
    }
  }

  // 5. Player abilities checks
  for (const ability of plan.player.supportedAbilities) {
    if (!spec.requiredPlayerConfiguration.allowedAbilities.includes(ability)) {
      errors.push(
        `Player ability "${ability}" is unsupported by template "${spec.name}". Allowed: [${spec.requiredPlayerConfiguration.allowedAbilities.join(', ')}].`
      );
    }
  }

  if (spec.requiredPlayerConfiguration.requiresJump && !plan.player.supportedAbilities.includes('jump')) {
    errors.push(
      `Template "${spec.name}" requires the "jump" player ability, but plan does not include it.`
    );
  }

  // 6. Entity types checks
  if (!spec.supportedEntityTypes.platforms && plan.terrain.platforms.length > 1) {
    errors.push(
      `Template "${spec.name}" does not support floating platform geometry. Convert to boundary walls or switch template.`
    );
  }

  // 7. Objectives checks
  if (
    plan.objectives.primary.type &&
    !spec.requiredObjectives.supportedPrimaryTypes.includes(plan.objectives.primary.type as any)
  ) {
    errors.push(
      `Objective type "${plan.objectives.primary.type}" is unsupported by template "${spec.name}". Allowed: [${spec.requiredObjectives.supportedPrimaryTypes.join(', ')}].`
    );
  }

  // 8. Generate intelligent alternatives if incompatible
  if (errors.length > 0) {
    if (plan.world.gravity > 0) {
      const altPlatformerId: GameTemplateId =
        templateId.startsWith('phaser-2d-') ? 'phaser-2d-platformer' : 'physics-platformer';
      if (templateId !== altPlatformerId && !suggestedAlternatives.some((a) => a.templateId === altPlatformerId)) {
        suggestedAlternatives.push({
          templateId: altPlatformerId,
          templateName: TEMPLATE_REGISTRY[altPlatformerId].name,
          rationale: 'Your plan defines positive gravity and jump mechanics, matching 2D platformer.',
          whatWouldChange: [
            'Enables platform jump physics with gravity.',
            'Adds jump ability and platform ledges.',
          ],
        });
      }
    } else if (plan.world.gravity === 0 || plan.category === 'top-down-2d') {
      const altTopdownId: GameTemplateId =
        templateId.startsWith('phaser-2d-') ? 'phaser-2d-topdown' : 'top-down-exploration';
      if (templateId !== altTopdownId && !suggestedAlternatives.some((a) => a.templateId === altTopdownId)) {
        suggestedAlternatives.push({
          templateId: altTopdownId,
          templateName: TEMPLATE_REGISTRY[altTopdownId].name,
          rationale: 'Your plan defines zero gravity and directional movement, matching top-down exploration.',
          whatWouldChange: [
            'Converts floating platforms into navigable boundary walls.',
            'Enables 4-way movement instead of vertical jumping.',
          ],
        });
      }
    }

    if (plan.entities.interactives.some((i) => i.type === 'switch' || i.type === 'door')) {
      const altPuzzleId: GameTemplateId =
        templateId.startsWith('phaser-2d-') ? 'phaser-2d-puzzle' : 'physics-puzzle';
      if (templateId !== altPuzzleId && !suggestedAlternatives.some((a) => a.templateId === altPuzzleId)) {
        suggestedAlternatives.push({
          templateId: altPuzzleId,
          templateName: TEMPLATE_REGISTRY[altPuzzleId].name,
          rationale: 'Your plan contains interactive switches and doors, ideal for a physics puzzle room.',
          whatWouldChange: [
            'Configures interactive switches to open linked barrier doors.',
            'Sets puzzle progression objectives.',
          ],
        });
      }
    }
  }

  return {
    isCompatible: errors.length === 0,
    templateId,
    templateName: spec.name,
    errors,
    warnings,
    suggestedAlternatives,
    knownLimitations: spec.knownLimitations,
  };
}

/**
 * Returns all currently playable templates (targetEngine: 'phaser-2d').
 * Segregates deferred engines like 'voxel-3d-deferred'.
 */
export function getSupportedTemplates(): TemplateSpecification[] {
  return Object.values(TEMPLATE_REGISTRY).filter((t) => t.targetEngine === 'phaser-2d');
}
