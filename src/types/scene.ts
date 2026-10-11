import { z } from 'zod';
import { GameAssetBundleSchema } from './plan.js';
export type { GameAssetBundle } from './plan.js';

/**
 * Provenance source of the scene definition
 */
export type SceneProvenanceSource =
  | 'gemini-vision'
  | 'huggingface-vision'
  | 'local-vector'
  | 'mock-fallback'
  | 'gemini-transformed'
  | 'local-rules-transformed';

export const SceneProvenanceSourceSchema = z.enum([
  'gemini-vision',
  'huggingface-vision',
  'local-vector',
  'mock-fallback',
  'gemini-transformed',
  'local-rules-transformed',
]);

/**
 * Visual themes supported by the renderer
 */
export const LevelThemeSchema = z.enum([
  'default',
  'forest',
  'ice',
  'lava',
  'space',
  'cyberpunk',
]);

export type LevelTheme = z.infer<typeof LevelThemeSchema>;

/**
 * Difficulty presets
 */
export const LevelDifficultySchema = z.enum(['easy', 'normal', 'hard']);

export type LevelDifficulty = z.infer<typeof LevelDifficultySchema>;

/**
 * Ambient environmental particle effects
 */
export const AmbientEffectSchema = z.enum([
  'none',
  'snow',
  'embers',
  'stardust',
  'sparks',
  'leaves',
]);

export type AmbientEffect = z.infer<typeof AmbientEffectSchema>;

/**
 * World and physics configuration
 */
export const WorldConfigSchema = z.object({
  width: z.number().int().min(400).max(3840).default(800),
  height: z.number().int().min(300).max(2160).default(480),
  gravity: z.number().min(0).max(2000).default(750),
  backgroundColor: z.string().default('#070a13'),
  theme: LevelThemeSchema.default('default'),
  friction: z.number().min(0.01).max(1.0).default(1.0),
  difficulty: LevelDifficultySchema.default('normal'),
  ambientEffect: AmbientEffectSchema.default('none'),
});

export type WorldConfig = z.infer<typeof WorldConfigSchema>;

/**
 * Player configuration and spawn coordinates
 */
export const PlayerSpawnSchema = z.object({
  spawnX: z.number().min(0).max(3840).default(80),
  spawnY: z.number().min(0).max(2160).default(380),
  speed: z.number().min(80).max(500).default(220),
  jumpPower: z.number().min(0).max(700).default(400),
  size: z.number().min(16).max(96).default(36),
});

export type PlayerSpawn = z.infer<typeof PlayerSpawnSchema>;

/**
 * Solid platform element (derived from Ground strokes)
 */
export const PlatformElementSchema = z.object({
  id: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
  strokeColor: z.string().optional(),
});

export type PlatformElement = z.infer<typeof PlatformElementSchema>;

/**
 * Lethal hazard element (derived from Hazard strokes)
 */
export const HazardElementSchema = z.object({
  id: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
  hazardType: z.enum(['spike', 'lava']).default('spike'),
});

export type HazardElement = z.infer<typeof HazardElementSchema>;

/**
 * Elastic trampoline element (derived from Trampoline strokes)
 */
export const TrampolineElementSchema = z.object({
  id: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
  bounceStrength: z.number().min(300).max(1200).default(580),
});

export type TrampolineElement = z.infer<typeof TrampolineElementSchema>;

/**
 * Collectible reward element (derived from Coin strokes)
 */
export const CoinElementSchema = z.object({
  id: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  size: z.number().positive().default(24),
  value: z.number().int().positive().default(10),
});

export type CoinElement = z.infer<typeof CoinElementSchema>;

/**
 * Level victory goal element (derived from Goal strokes)
 */
export const GoalElementSchema = z.object({
  id: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().default(36),
  height: z.number().positive().default(48),
});

export type GoalElement = z.infer<typeof GoalElementSchema>;

/**
 * Dynamic Enemy element in Phaser scene
 */
export const EnemyElementSchema = z.object({
  id: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().default(32),
  height: z.number().positive().default(32),
  type: z.enum(['patrol', 'chaser', 'stationary']).default('patrol'),
  speed: z.number().min(20).max(400).default(100),
  patrolRange: z.number().min(40).max(600).default(120),
});
export type EnemyElement = z.infer<typeof EnemyElementSchema>;

/**
 * Interactive pressure switch element
 */
export const SwitchElementSchema = z.object({
  id: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().default(32),
  height: z.number().positive().default(16),
  targetId: z.string(),
  isActivated: z.boolean().default(false),
});
export type SwitchElement = z.infer<typeof SwitchElementSchema>;

/**
 * Interactive barrier/door element opened by linked switches
 */
export const DoorElementSchema = z.object({
  id: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().default(24),
  height: z.number().positive().default(80),
  isOpen: z.boolean().default(false),
});
export type DoorElement = z.infer<typeof DoorElementSchema>;

/**
 * Template objective configuration and completion contract
 */
export const ObjectiveConfigSchema = z.object({
  type: z.enum(['reach_goal', 'collect_all_coins', 'survive_time', 'activate_switches', 'timed_race']).default('reach_goal'),
  targetCount: z.number().int().min(0).optional(),
  timeLimitSeconds: z.number().min(1).max(300).optional(),
  description: z.string().optional(),
});
export type ObjectiveConfig = z.infer<typeof ObjectiveConfigSchema>;

/**
 * Supported player movement models in Phaser
 */
export const PlayerMovementModelSchema = z.enum([
  'platformer',
  'precision',
  'topdown',
  'gravity-switch',
  'drift',
]);
export type PlayerMovementModel = z.infer<typeof PlayerMovementModelSchema>;

/**
 * Scene conversion diagnostics, warnings, and AI reasoning
 */
export const SceneDiagnosticsSchema = z.object({
  warnings: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  strokeCount: z.number().int().min(0).default(0),
  aiConfidence: z.number().min(0).max(1).optional(),
});

export type SceneDiagnostics = z.infer<typeof SceneDiagnosticsSchema>;

/**
 * Validated Playable 2D Game Scene Contract
 */
export const PlayableGameSceneSchema = z.object({
  schemaVersion: z.literal('1.0'),
  id: z.string().optional(),
  name: z.string().optional(),
  source: SceneProvenanceSourceSchema,
  templateId: z.string().optional(),
  movementModel: PlayerMovementModelSchema.default('platformer'),
  levelName: z.string().min(1).default('Sketch Adventure Level'),
  levelDescription: z.string().default('A 2D physics level generated from your hand-drawn sketch.'),
  world: WorldConfigSchema,
  player: PlayerSpawnSchema,
  platforms: z.array(PlatformElementSchema).default([]),
  hazards: z.array(HazardElementSchema).default([]),
  trampolines: z.array(TrampolineElementSchema).default([]),
  coins: z.array(CoinElementSchema).default([]),
  enemies: z.array(EnemyElementSchema).default([]),
  switches: z.array(SwitchElementSchema).default([]),
  doors: z.array(DoorElementSchema).default([]),
  goal: GoalElementSchema,
  objective: ObjectiveConfigSchema.optional(),
  hudInstructions: z.string().optional(),
  assetBundle: GameAssetBundleSchema.optional(),
  assets: z.record(z.string(), z.string()).optional(),
  diagnostics: SceneDiagnosticsSchema,
});

export type PlayableGameScene = z.infer<typeof PlayableGameSceneSchema>;

/**
 * Game state in the active session
 */
export type GamePlayState = 'ready' | 'playing' | 'won' | 'lost';
