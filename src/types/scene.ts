import { z } from 'zod';

/**
 * Provenance source of the scene definition
 */
export type SceneProvenanceSource = 'gemini-vision' | 'local-vector' | 'mock-fallback';

export const SceneProvenanceSourceSchema = z.enum([
  'gemini-vision',
  'local-vector',
  'mock-fallback',
]);

/**
 * World and physics configuration
 */
export const WorldConfigSchema = z.object({
  width: z.number().int().min(400).max(3840).default(800),
  height: z.number().int().min(300).max(2160).default(480),
  gravity: z.number().min(200).max(2000).default(750),
  backgroundColor: z.string().default('#070a13'),
});

export type WorldConfig = z.infer<typeof WorldConfigSchema>;

/**
 * Player configuration and spawn coordinates
 */
export const PlayerSpawnSchema = z.object({
  spawnX: z.number().min(0).max(3840).default(80),
  spawnY: z.number().min(0).max(2160).default(380),
  speed: z.number().min(80).max(500).default(220),
  jumpPower: z.number().min(200).max(700).default(400),
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
  source: SceneProvenanceSourceSchema,
  levelName: z.string().min(1).default('Sketch Adventure Level'),
  levelDescription: z.string().default('A 2D physics level generated from your hand-drawn sketch.'),
  world: WorldConfigSchema,
  player: PlayerSpawnSchema,
  platforms: z.array(PlatformElementSchema).default([]),
  hazards: z.array(HazardElementSchema).default([]),
  trampolines: z.array(TrampolineElementSchema).default([]),
  coins: z.array(CoinElementSchema).default([]),
  goal: GoalElementSchema,
  diagnostics: SceneDiagnosticsSchema,
});

export type PlayableGameScene = z.infer<typeof PlayableGameSceneSchema>;

/**
 * Game state in the active session
 */
export type GamePlayState = 'ready' | 'playing' | 'won' | 'lost';
