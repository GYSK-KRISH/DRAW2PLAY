import { z } from 'zod';
import {
  GameCategorySchema,
  TargetEngineSchema,
  AnalysisProvenanceSchema,
  PlanStatusSchema,
} from './reference.js';

/**
 * Allowlisted mechanic identifiers supported by the Draw2Play runtime engines.
 * Any mechanic outside this list is marked as rejected/unsupported.
 */
export const ALLOWLISTED_MECHANIC_IDS = [
  'jump_and_run',
  'hazard_evasion',
  'coin_collection',
  'checkpoint_respawn',
  'trampoline_bounce',
  'patrol_enemy_avoidance',
  'door_key_unlock',
  'switch_toggle',
  'topdown_4way_movement',
  'gravity_inversion',
  'arena_survival',
  'timed_countdown',
  'momentum_drift',
  'precision_jumping',
] as const;

export const AllowlistedMechanicIdSchema = z.enum(ALLOWLISTED_MECHANIC_IDS);
export type AllowlistedMechanicId = z.infer<typeof AllowlistedMechanicIdSchema>;

/**
 * Supported player movement abilities.
 */
export const ALLOWLISTED_PLAYER_ABILITIES = [
  'walk',
  'run',
  'jump',
  'double_jump',
  'dash',
  'wall_slide',
  'flip_gravity',
  'steer_drift',
] as const;

export const AllowlistedPlayerAbilitySchema = z.enum(ALLOWLISTED_PLAYER_ABILITIES);
export type AllowlistedPlayerAbility = z.infer<typeof AllowlistedPlayerAbilitySchema>;

/**
 * Template IDs with strict runtime contracts.
 */
export const GAME_TEMPLATE_IDS = [
  'physics-platformer',
  'precision-platformer',
  'physics-puzzle',
  'top-down-exploration',
  'top-down-arena-survival',
  'collect-and-escape',
  'maze-exploration',
  'gravity-switch-puzzle',
  'momentum-drifting',
  'timed-obstacle-course',
  'coin-collection-challenge',
  'exploration-puzzle-hybrid',
  // Backward compatibility aliases
  'phaser-2d-platformer',
  'phaser-2d-topdown',
  'phaser-2d-puzzle',
  'voxel-3d-deferred',
] as const;

export const GameTemplateIdSchema = z.enum(GAME_TEMPLATE_IDS);
export type GameTemplateId = z.infer<typeof GameTemplateIdSchema>;

/**
 * Platform geometry element
 */
export const PlatformGeometrySchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
  strokeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  friction: z.number().min(0).max(2).optional(),
});
export type PlatformGeometry = z.infer<typeof PlatformGeometrySchema>;

/**
 * Solid wall geometry element
 */
export const WallGeometrySchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
  strokeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type WallGeometry = z.infer<typeof WallGeometrySchema>;

/**
 * Hazard geometry element
 */
export const HazardGeometrySchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
  hazardType: z.enum(['spike', 'lava', 'pit', 'slime']).default('spike'),
});
export type HazardGeometry = z.infer<typeof HazardGeometrySchema>;

/**
 * Enemy entity definition
 */
export const EnemyDefinitionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(60).default('Enemy'),
  type: z.enum(['patrol', 'jumper', 'stationary']).default('patrol'),
  x: z.number().finite(),
  y: z.number().finite(),
  speed: z.number().finite().optional(),
  patrolDistance: z.number().positive().finite().default(120),
  damage: z.number().positive().finite().default(1),
});
export type EnemyDefinition = z.infer<typeof EnemyDefinitionSchema>;

/**
 * Collectible entity definition
 */
export const CollectibleDefinitionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(60).default('Collectible'),
  type: z.enum(['coin', 'gem', 'key', 'star']).default('coin'),
  x: z.number().finite(),
  y: z.number().finite(),
  value: z.number().int().positive().default(10),
});
export type CollectibleDefinition = z.infer<typeof CollectibleDefinitionSchema>;

/**
 * Interactive entity definition (trampoline, door, switch)
 */
export const InteractiveDefinitionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(60).default('Interactive').optional(),
  type: z.enum(['trampoline', 'door', 'switch']),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().optional(),
  height: z.number().finite().optional(),
  targetRef: z.string().max(64).optional(),
  behavior: z.record(z.string(), z.any()).optional(),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type InteractiveDefinition = z.infer<typeof InteractiveDefinitionSchema>;

/**
 * Level objective contract
 */
export const ObjectiveContractSchema = z.object({
  primary: z.object({
    type: z.enum(['reach_goal', 'collect_all', 'defeat_enemies', 'survival']).default('reach_goal'),
    targetRef: z.string().max(64).optional(),
    requiredCount: z.number().int().positive().optional(),
    targetCount: z.number().int().positive().optional(),
    timeLimit: z.number().positive().optional(),
  }),
  secondary: z.array(
    z.object({
      type: z.enum(['collect_all', 'defeat_enemies', 'activate_switch', 'reach_checkpoint']),
      targetCount: z.number().int().positive().optional(),
      targetRef: z.string().max(64).optional(),
      timeLimit: z.number().positive().optional(),
    })
  ).max(5).optional(),
  winConditions: z.array(z.string().max(120)).min(1).max(5),
  loseConditions: z.array(z.string().max(120)).min(1).max(5),
  checkpoints: z.array(
    z.object({
      id: z.string().min(1).max(64),
      x: z.number().finite(),
      y: z.number().finite(),
    })
  ).max(10).default([]),
  goal: z.object({
    id: z.string().min(1).max(64),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive().finite().default(36),
    height: z.number().positive().finite().default(48),
  }),
});
export type ObjectiveContract = z.infer<typeof ObjectiveContractSchema>;

/**
 * Stage 5: Visual Asset Specifications & Bundle Schema
 */
export const AssetRoleSchema = z.enum([
  'player',
  'enemy',
  'collectible',
  'hazard',
  'goal',
  'background',
  'platform',
]);
export type AssetRole = z.infer<typeof AssetRoleSchema>;

export const AssetProvenanceSchema = z.enum([
  'gemini-imagen',
  'procedural-fallback',
  'reused-project',
  'user-upload',
]);
export type AssetProvenance = z.infer<typeof AssetProvenanceSchema>;

export const AssetStatusSchema = z.enum([
  'pending',
  'generating',
  'ready',
  'failed',
  'fallback',
]);
export type AssetStatus = z.infer<typeof AssetStatusSchema>;

export const GeneratedAssetSchema = z.object({
  id: z.string().min(1).max(64),
  role: AssetRoleSchema,
  entityId: z.string().max(64).optional(),
  name: z.string().min(1).max(80),
  visualDescription: z.string().max(400),
  artStyle: z.string().max(80).default('pixel-art'),
  targetDimensions: z.object({
    width: z.number().int().positive().max(2048),
    height: z.number().int().positive().max(2048),
  }),
  aspectRatio: z.string().default('1:1'),
  requiresTransparency: z.boolean().default(true),
  animationMetadata: z
    .object({
      isAnimated: z.boolean().default(false),
      frameCount: z.number().int().min(1).max(16).default(1),
      frameWidth: z.number().int().positive().optional(),
      frameHeight: z.number().int().positive().optional(),
      fps: z.number().int().min(1).max(30).default(8),
    })
    .optional(),
  sourceReferenceId: z.string().optional(),
  status: AssetStatusSchema.default('pending'),
  provenance: AssetProvenanceSchema.default('procedural-fallback'),
  isFallback: z.boolean().default(false),
  dataUrl: z.string().optional(),
  mimeType: z.string().optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  promptUsed: z.string().optional(),
  generatedAt: z.string().optional(),
});
export type GeneratedAsset = z.infer<typeof GeneratedAssetSchema>;

export const GameAssetBundleSchema = z.object({
  bundleId: z.string().min(1),
  planId: z.string().optional(),
  artStyle: z.string().default('pixel-art'),
  palette: z.array(z.string()).default([]),
  assets: z.array(GeneratedAssetSchema).default([]),
  createdAt: z.string(),
  generatedAt: z.string().optional(),
  provenance: z.enum(['gemini-imagen', 'procedural-fallback', 'reused-project', 'user-upload', 'mixed']).optional(),
  overallStatus: z.enum(['idle', 'generating', 'ready', 'partial', 'failed']).default('idle'),
});
export type GameAssetBundle = z.infer<typeof GameAssetBundleSchema>;

/**
 * Versioned Game Design Plan (Schema 2.0)
 * Serves as the validated intermediate representation before runtime generation.
 */
export const GameDesignPlanSchema = z.object({
  schemaVersion: z.literal('2.0'),
  generationId: z.string().min(1).max(64),
  id: z.string().min(1).max(64),
  referenceId: z.string().min(1).max(64),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  sourceType: z.enum(['image-upload', 'video-frame', 'canvas-sketch', 'manual-editor']).default('image-upload'),
  provenance: AnalysisProvenanceSchema,
  provider: z.object({
    id: z.string().min(1).max(32),
    model: z.string().min(1).max(64),
    isFallback: z.boolean(),
  }),
  templateId: GameTemplateIdSchema,
  targetEngine: TargetEngineSchema,
  category: GameCategorySchema,
  userPrompt: z.string().min(1).max(500),

  // Visual & Thematic Settings
  theme: z.object({
    name: z.enum(['default', 'forest', 'ice', 'lava', 'space', 'cyberpunk']).default('default'),
    palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(1).max(8),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#070a13'),
  }),

  // World and Physics Dimensions
  world: z.object({
    width: z.number().int().min(320).max(10000),
    height: z.number().int().min(240).max(10000),
    gravity: z.number().min(0).max(2000).default(750),
    coordinateSystem: z.enum(['screen-top-left-2d', 'cartesian-3d']).default('screen-top-left-2d'),
    friction: z.number().min(0.01).max(1.0).default(0.8),
  }),

  // Geometry
  terrain: z.object({
    platforms: z.array(PlatformGeometrySchema).max(150).default([]),
    walls: z.array(WallGeometrySchema).max(100).default([]),
    hazards: z.array(HazardGeometrySchema).max(50).default([]),
  }),

  // Player Specification
  player: z.object({
    spawn: z.object({
      x: z.number().finite(),
      y: z.number().finite(),
    }),
    speed: z.number().int().min(80).max(500).default(240),
    jumpPower: z.number().int().min(0).max(700).default(440),
    size: z.number().int().min(16).max(96).default(36),
    supportedAbilities: z.array(AllowlistedPlayerAbilitySchema).min(1).max(6).default(['walk', 'run', 'jump']),
  }),

  // Dynamic Entities
  entities: z.object({
    enemies: z.array(EnemyDefinitionSchema).max(50).default([]),
    collectibles: z.array(CollectibleDefinitionSchema).max(50).default([]),
    interactives: z.array(InteractiveDefinitionSchema).max(30).default([]),
  }),

  // Objectives and Progression
  objectives: ObjectiveContractSchema,

  // Difficulty & Seed
  difficulty: z.object({
    tier: z.enum(['easy', 'medium', 'hard']).default('medium'),
    seed: z.number().int().default(42),
    enemySpeedMultiplier: z.number().min(0.5).max(3.0).default(1.0),
  }),

  // Mechanics Governance
  mechanics: z.object({
    allowedMechanics: z.array(AllowlistedMechanicIdSchema).min(1).max(10),
    rejectedMechanics: z.array(z.string().max(80)).max(10).default([]),
  }),

  // Observability & Warning Governance
  confidenceAndWarnings: z.object({
    overallConfidence: z.enum(['high', 'medium', 'low']).default('medium'),
    confidenceReasoning: z.string().max(300).default('Calibrated qualitative assessment from visual cues and prompt match.'),
    warnings: z.array(z.string().max(300)).max(15).default([]),
    unsupportedFeatures: z.array(z.string().max(200)).max(10).default([]),
  }),

  // Stage 5: Visual Asset Bundle
  assets: GameAssetBundleSchema.optional(),

  status: PlanStatusSchema.default('ready-for-2d-generation'),
  createdAt: z.string(),

  // Backwards Compatibility fields for legacy consumers
  requestedFeatures: z.array(z.string().max(100)).max(15).default([]),
  missingRequirements: z.array(z.string().max(200)).max(15).default([]),
  limitationsAndWarnings: z.array(z.string().max(300)).max(15).default([]),
  suggested2DConfig: z
    .object({
      theme: z.enum(['default', 'forest', 'ice', 'lava', 'space', 'cyberpunk']),
      playerSpeed: z.number().int().min(80).max(500),
      playerJump: z.number().int().min(0).max(700),
      gravity: z.number().int().min(0).max(2000),
      platformCount: z.number().int().min(1).max(50),
      hazardTypes: z.array(z.string()).max(10),
      collectibleTypes: z.array(z.string()).max(10),
    })
    .optional(),
});

export type GameDesignPlan = z.infer<typeof GameDesignPlanSchema>;
