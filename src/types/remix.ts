import { z } from 'zod';
import { GameDesignPlanSchema, type GameDesignPlan } from './plan.js';
import { PlayableGameSceneSchema, type PlayableGameScene } from './scene.js';

/**
 * Supported RFC 6902 JSON Patch operations for remixing
 */
export const JsonPatchOpSchema = z.enum(['add', 'replace', 'remove']);
export type JsonPatchOp = z.infer<typeof JsonPatchOpSchema>;

export const JsonPatchOperationSchema = z.object({
  op: JsonPatchOpSchema,
  path: z.string().min(1).max(256),
  value: z.any().optional(),
  from: z.string().optional(),
});
export type JsonPatchOperation = z.infer<typeof JsonPatchOperationSchema>;

/**
 * Runtime systems affected by a proposed remix patch
 */
export const AffectedSystemSchema = z.enum([
  'presentation', // Cosmetic: colors, theme, particles, background
  'physics',      // Gravity, friction, player speed, jump power
  'entities',     // Collectibles, hazards, enemies, trampolines, checkpoints
  'structural',   // Platforms, walls, level dimensions, spawn, goal
]);
export type AffectedSystem = z.infer<typeof AffectedSystemSchema>;

/**
 * Allowlisted path patterns permitted in remix patches.
 * Any path not matching this allowlist is strictly rejected.
 */
export const ALLOWLISTED_REMIX_PATH_PATTERNS = [
  // Visual Theme & Presentation
  /^\/theme(\/(name|background|palette(\/(\d+|-))?))?$/,
  /^\/world\/theme$/,
  /^\/world\/backgroundColor$/,
  /^\/world\/ambientEffect$/,

  // Physics & World
  /^\/world\/gravity$/,
  /^\/world\/friction$/,
  /^\/difficulty(\/(tier|enemySpeedMultiplier|seed))?$/,
  /^\/world\/difficulty$/,

  // Player Attributes
  /^\/player\/speed$/,
  /^\/player\/jumpPower$/,
  /^\/player\/size$/,

  // Terrain / Hazards / Platforms
  /^\/terrain\/hazards(\/(\d+|-)(\/(x|y|width|height|hazardType|id))?)?$/,
  /^\/terrain\/platforms(\/(\d+|-)(\/(x|y|width|height|id|strokeColor))?)?$/,
  /^\/hazards(\/(\d+|-)(\/(x|y|width|height|hazardType|id))?)?$/,
  /^\/platforms(\/(\d+|-)(\/(x|y|width|height|id|strokeColor))?)?$/,

  // Dynamic Entities
  /^\/entities\/collectibles(\/(\d+|-)(\/(x|y|value|size|id))?)?$/,
  /^\/entities\/enemies(\/(\d+|-)(\/(x|y|speed|type|patrolRange|id))?)?$/,
  /^\/coins(\/(\d+|-)(\/(x|y|value|size|id))?)?$/,
  /^\/enemies(\/(\d+|-)(\/(x|y|speed|type|patrolRange|id))?)?$/,

  // Objectives & Checkpoints
  /^\/objectives\/checkpoints(\/(\d+|-)(\/(id|x|y))?)?$/,
  /^\/objectives\/primary\/timeLimit$/,
  /^\/objectives\/primary\/targetCount$/,
  /^\/hudInstructions$/,
];

/**
 * Protected paths explicitly forbidden (defense-in-depth)
 */
export const FORBIDDEN_PATH_KEYWORDS = [
  '__proto__',
  'constructor',
  'prototype',
  'schemaVersion',
  'generationId',
  'referenceId',
  'provenance',
  'provider',
  'sourceType',
];

/**
 * Request payload for POST /api/remix-level
 */
export const RemixLevelRequestSchema = z.object({
  plan: GameDesignPlanSchema.optional(),
  sceneData: PlayableGameSceneSchema.optional(),
  currentVersion: z.number().int().nonnegative().default(1),
  instruction: z.string().min(2).max(400),
  templateId: z.string().optional(),
  clientState: z
    .object({
      playerX: z.number().optional(),
      playerY: z.number().optional(),
      coinsCollected: z.number().int().optional(),
      score: z.number().int().optional(),
      lastCheckpointId: z.string().optional(),
    })
    .optional(),
});
export type RemixLevelRequest = z.infer<typeof RemixLevelRequestSchema>;

/**
 * Successful response from POST /api/remix-level
 */
export interface RemixLevelResponse {
  success: boolean;
  patch: JsonPatchOperation[];
  appliedPlan?: GameDesignPlan;
  appliedScene?: PlayableGameScene;
  newVersion: number;
  summary: string;
  affectedSystems: AffectedSystem[];
  canHotUpdate: boolean;
  warnings: string[];
  executionTimeMs: number;
}
