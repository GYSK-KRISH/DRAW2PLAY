import { z } from 'zod';
import { GameTemplateIdSchema } from './plan.js';

/**
 * Stage 8: Allowlisted Game Inputs for Replay Recording
 * Strictly rejects arbitrary keyboard logging outside gameplay controls.
 */
export const ReplayInputSchema = z.object({
  left: z.boolean().default(false),
  right: z.boolean().default(false),
  up: z.boolean().default(false),
  down: z.boolean().default(false),
  jump: z.boolean().default(false),
  action: z.boolean().default(false),
});
export type ReplayInput = z.infer<typeof ReplayInputSchema>;

/**
 * Kinematic state at position checkpoint
 */
export const ReplayPositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  vx: z.number().finite().default(0),
  vy: z.number().finite().default(0),
  facingRight: z.boolean().optional(),
});
export type ReplayPosition = z.infer<typeof ReplayPositionSchema>;

/**
 * Tick-indexed replay frame containing inputs and position sync marker
 */
export const ReplayFrameSchema = z.object({
  tick: z.number().int().nonnegative(),
  timestampMs: z.number().nonnegative(),
  inputs: ReplayInputSchema,
  position: ReplayPositionSchema,
});
export type ReplayFrame = z.infer<typeof ReplayFrameSchema>;

/**
 * Key discrete milestone events occurring during the run
 */
export const ReplayEventSchema = z.object({
  timestampMs: z.number().nonnegative(),
  type: z.enum([
    'level_start',
    'coin_collected',
    'switch_toggled',
    'checkpoint_reached',
    'hazard_death',
    'goal_reached',
  ]),
  entityId: z.string().max(64).optional(),
  details: z.record(z.string(), z.any()).optional(),
});
export type ReplayEvent = z.infer<typeof ReplayEventSchema>;

/**
 * Final performance summary
 */
export const ReplaySummarySchema = z.object({
  durationMs: z.number().nonnegative(),
  finalScore: z.number().int().nonnegative(),
  coinsCollected: z.number().int().nonnegative(),
  deaths: z.number().int().nonnegative().default(0),
  completed: z.boolean(),
  endReason: z.enum(['goal_reached', 'time_out', 'died', 'abandoned']),
});
export type ReplaySummary = z.infer<typeof ReplaySummarySchema>;

/**
 * Complete Versioned Replay Document (Schema 1.0)
 * Uses position-interpolated-ghost playback mode to truthfully acknowledge
 * variable framerate Arcade physics without claiming false lockstep determinism.
 */
export const ReplayDataSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  replayId: z.string().min(1).max(100),
  levelId: z.string().min(1).max(100),
  levelVersion: z.number().int().positive().default(1),
  gamePlanSchemaVersion: z.string().default('2.0'),
  templateId: GameTemplateIdSchema,
  engineVersion: z.string().default('phaser-4.2.1'),
  seed: z.number().default(42),
  playbackMode: z.literal('position-interpolated-ghost').default('position-interpolated-ghost'),
  initialState: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    vx: z.number().finite().default(0),
    vy: z.number().finite().default(0),
  }),
  frames: z.array(ReplayFrameSchema).max(36000),
  events: z.array(ReplayEventSchema).max(1000).default([]),
  summary: ReplaySummarySchema,
  recordedAt: z.string(),
  playerName: z.string().max(50).default('Player'),
});
export type ReplayData = z.infer<typeof ReplayDataSchema>;

/**
 * Compatibility validation helper
 */
export interface ReplayCompatibilityResult {
  compatible: boolean;
  warnings: string[];
  reasons: string[];
}

export function checkReplayCompatibility(
  replay: ReplayData,
  currentLevelId: string,
  currentLevelVersion: number,
  currentTemplateId?: string
): ReplayCompatibilityResult {
  const warnings: string[] = [];
  const reasons: string[] = [];

  if (replay.levelId !== currentLevelId) {
    reasons.push(`Level ID mismatch: Replay was recorded on '${replay.levelId}', active level is '${currentLevelId}'.`);
  }

  if (replay.levelVersion !== currentLevelVersion) {
    warnings.push(
      `Level version mismatch: Replay was recorded on v${replay.levelVersion}, active level is v${currentLevelVersion}. Geometry or entity locations may have changed.`
    );
  }

  if (currentTemplateId && replay.templateId !== currentTemplateId) {
    reasons.push(
      `Template mismatch: Replay requires '${replay.templateId}' template, but current level is '${currentTemplateId}'.`
    );
  }

  return {
    compatible: reasons.length === 0,
    warnings,
    reasons,
  };
}
