import { z } from 'zod';
import {
  LevelThemeSchema,
  LevelDifficultySchema,
  AmbientEffectSchema,
  PlayableGameSceneSchema,
} from './scene.js';

/**
 * Operation to update the visual theme
 */
export const SetThemeOpSchema = z.object({
  type: z.literal('set_theme'),
  theme: LevelThemeSchema,
});
export type SetThemeOp = z.infer<typeof SetThemeOpSchema>;

/**
 * Operation to update difficulty settings
 */
export const SetDifficultyOpSchema = z.object({
  type: z.literal('set_difficulty'),
  difficulty: LevelDifficultySchema,
});
export type SetDifficultyOp = z.infer<typeof SetDifficultyOpSchema>;

/**
 * Operation to adjust global physics parameters
 */
export const AdjustPhysicsOpSchema = z.object({
  type: z.literal('adjust_physics'),
  gravity: z.number().min(200).max(2000).optional(),
  friction: z.number().min(0.01).max(1.0).optional(),
  bounce: z.number().min(0).max(1.0).optional(),
});
export type AdjustPhysicsOp = z.infer<typeof AdjustPhysicsOpSchema>;

/**
 * Operation to add bonus coins
 */
export const AddCoinsOpSchema = z.object({
  type: z.literal('add_coins'),
  count: z.number().int().min(1).max(20),
});
export type AddCoinsOp = z.infer<typeof AddCoinsOpSchema>;

/**
 * Operation to adjust existing coin density
 */
export const AdjustCoinDensityOpSchema = z.object({
  type: z.literal('adjust_coin_density'),
  multiplier: z.number().min(0.2).max(3.0),
});
export type AdjustCoinDensityOp = z.infer<typeof AdjustCoinDensityOpSchema>;

/**
 * Operation to add lethal hazards
 */
export const AddHazardsOpSchema = z.object({
  type: z.literal('add_hazards'),
  count: z.number().int().min(1).max(15),
  hazardType: z.enum(['spike', 'lava']).default('spike'),
});
export type AddHazardsOp = z.infer<typeof AddHazardsOpSchema>;

/**
 * Operation to scale hazard density
 */
export const AdjustHazardDensityOpSchema = z.object({
  type: z.literal('adjust_hazard_density'),
  multiplier: z.number().min(0.0).max(3.0),
});
export type AdjustHazardDensityOp = z.infer<typeof AdjustHazardDensityOpSchema>;

/**
 * Operation to adjust player jump velocity
 */
export const AdjustPlayerJumpOpSchema = z.object({
  type: z.literal('adjust_player_jump'),
  jumpPower: z.number().min(200).max(700).optional(),
  multiplier: z.number().min(0.5).max(2.0).optional(),
});
export type AdjustPlayerJumpOp = z.infer<typeof AdjustPlayerJumpOpSchema>;

/**
 * Operation to adjust player horizontal speed
 */
export const AdjustPlayerSpeedOpSchema = z.object({
  type: z.literal('adjust_player_speed'),
  speed: z.number().min(80).max(500).optional(),
  multiplier: z.number().min(0.5).max(2.0).optional(),
});
export type AdjustPlayerSpeedOp = z.infer<typeof AdjustPlayerSpeedOpSchema>;

/**
 * Operation to set environmental particle effects
 */
export const SetEnvironmentEffectsOpSchema = z.object({
  type: z.literal('set_environment_effects'),
  effect: AmbientEffectSchema,
});
export type SetEnvironmentEffectsOp = z.infer<typeof SetEnvironmentEffectsOpSchema>;

/**
 * Discriminated union of all supported transformation operations
 */
export const TransformationOperationSchema = z.discriminatedUnion('type', [
  SetThemeOpSchema,
  SetDifficultyOpSchema,
  AdjustPhysicsOpSchema,
  AddCoinsOpSchema,
  AdjustCoinDensityOpSchema,
  AddHazardsOpSchema,
  AdjustHazardDensityOpSchema,
  AdjustPlayerJumpOpSchema,
  AdjustPlayerSpeedOpSchema,
  SetEnvironmentEffectsOpSchema,
]);
export type TransformationOperation = z.infer<typeof TransformationOperationSchema>;

/**
 * Natural language level transformation request
 */
export const TransformLevelRequestSchema = z.object({
  scene: PlayableGameSceneSchema,
  instruction: z.string().min(1).max(500),
  preferences: z.object({
    preferredTheme: LevelThemeSchema.optional(),
    preferredDifficulty: LevelDifficultySchema.optional(),
  }).optional(),
});
export type TransformLevelRequest = z.infer<typeof TransformLevelRequestSchema>;

/**
 * Natural language level transformation response
 */
export const TransformLevelResponseSchema = z.object({
  success: z.boolean(),
  source: z.enum(['gemini', 'local-rules', 'mock-fallback']),
  operations: z.array(TransformationOperationSchema),
  explanation: z.string(),
  warnings: z.array(z.string()).default([]),
  transformedScene: PlayableGameSceneSchema,
  diagnostics: z.object({
    totalCoins: z.number().int().optional(),
    totalHazards: z.number().int().optional(),
    theme: LevelThemeSchema.optional(),
    difficulty: LevelDifficultySchema.optional(),
    friction: z.number().optional(),
    playerSpeed: z.number().optional(),
    playerJump: z.number().optional(),
  }).optional(),
  notice: z.string().optional(),
  error: z.string().optional(),
});
export type TransformLevelResponse = z.infer<typeof TransformLevelResponseSchema>;
