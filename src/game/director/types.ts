import type { GameTemplateId } from '../../types/plan.js';
import type { PlayerMovementModel } from '../../types/scene.js';

/**
 * Allowlisted Director Action Types.
 * The Director must NEVER execute arbitrary code or issue unvalidated engine commands.
 */
export const ALLOWLISTED_DIRECTOR_ACTION_TYPES = [
  'SPAWN_HELPER_PLATFORM',
  'GRANT_JUMP_ASSIST',
  'SPAWN_CHECKPOINT',
  'REDUCE_ENEMY_SPEED',
  'SPAWN_BONUS_COLLECTIBLE',
  'DISPLAY_TACTICAL_HINT',
] as const;

export type DirectorActionType = (typeof ALLOWLISTED_DIRECTOR_ACTION_TYPES)[number];

/**
 * Recorded player death event with spatial grounding
 */
export interface DeathEvent {
  x: number;
  y: number;
  cause: string;
  timestamp: number;
}

/**
 * Spatial cluster of failures indicating repeated failure at the same obstacle
 */
export interface DeathCluster {
  centroidX: number;
  centroidY: number;
  count: number;
  firstDeathTime: number;
  lastDeathTime: number;
  primaryCause: string;
}

/**
 * Only tracks gameplay data strictly necessary for adaptive difficulty
 * Avoids any unnecessary personal information
 */
export interface PlayerTelemetry {
  deathCount: number;
  consecutiveDeaths: number;
  elapsedTimeSeconds: number;
  lastDeathEvent: DeathEvent | null;
  deathHistory: DeathEvent[];
  deathClusters: DeathCluster[];
  repeatedObstacleFailures: number; // consecutive failures in same 100px zone
  
  // Progress & Movement
  playerX: number;
  playerY: number;
  spawnX: number;
  spawnY: number;
  maxProgressX: number;
  progressRatio: number; // 0.0 to 1.0 (relative to goal X)
  timeStuckSeconds: number; // seconds spent in ~120px window without progress
  
  // Objectives & Items
  coinsCollected: number;
  totalCoins: number;
  switchesActivated: number;
  totalSwitches: number;
  checkpointsReached: string[];
  lastCheckpointPosition: { x: number; y: number } | null;
  
  // High-pacing metrics (speedrun detection)
  coinsPerMinute: number;
  hasDiedThisRun: boolean;
}

/**
 * Validated Director Action to be executed by the engine
 */
export interface DirectorAction {
  id: string;
  ruleId: string;
  type: DirectorActionType;
  playerExplanation: string;
  durationSeconds?: number; // 0 or undefined for permanent until level restart
  payload: {
    // For SPAWN_HELPER_PLATFORM
    platform?: {
      x: number;
      y: number;
      width: number;
      height: number;
      tint?: number;
    };
    // For GRANT_JUMP_ASSIST
    jumpBoostRatio?: number; // e.g., 1.12 (+12%)
    // For REDUCE_ENEMY_SPEED
    speedReductionRatio?: number; // e.g., 0.75 (-25%)
    // For SPAWN_CHECKPOINT
    checkpoint?: {
      x: number;
      y: number;
      id: string;
    };
    // For SPAWN_BONUS_COLLECTIBLE
    bonusCollectible?: {
      x: number;
      y: number;
      value: number;
    };
    // For DISPLAY_TACTICAL_HINT
    hintText?: string;
  };
  createdAt: number;
}

/**
 * Director Context passed during rule evaluation
 */
export interface DirectorContext {
  templateId?: GameTemplateId;
  movementModel?: PlayerMovementModel;
  worldWidth: number;
  worldHeight: number;
  gravity: number;
  baselinePlayerSpeed: number;
  baselineJumpPower: number;
  goalX: number;
  goalY: number;
  activeActions: ActiveDirectorModifier[];
  actionExecutionCounts: Record<string, number>;
  lastActionTimes: Record<string, number>;
}

/**
 * Active temporary director modifier tracking expiration and reversal
 */
export interface ActiveDirectorModifier {
  actionId: string;
  ruleId: string;
  type: DirectorActionType;
  appliedAtTimestamp: number;
  expiresAtTimestamp: number;
  reversalData?: {
    originalValue?: number;
    targetEntityId?: string;
    spawnedGameObjects?: any[];
  };
}

/**
 * Deterministic Director Rule contract
 */
export interface DirectorRule {
  id: string;
  name: string;
  description: string;
  supportedTemplates: Array<GameTemplateId | 'all'>;
  cooldownSeconds: number;
  maxActivationsPerLevel: number;
  evaluate: (telemetry: PlayerTelemetry, context: DirectorContext) => DirectorAction | null;
}

/**
 * Event log record for testing, observability, and debugging
 */
export interface DirectorAuditLogEvent {
  timestamp: number;
  type: 'telemetry_sample' | 'rule_triggered' | 'action_executed' | 'action_expired' | 'action_reverted' | 'director_shutdown';
  ruleId?: string;
  actionId?: string;
  actionType?: DirectorActionType;
  explanation?: string;
  details?: Record<string, any>;
}

/**
 * Director Configuration Options
 */
export interface DirectorConfig {
  enabled?: boolean;
  evaluationIntervalMs?: number; // default 500ms
  difficultyPreference?: 'dynamic' | 'assist_only' | 'challenge_only' | 'off';
  maxActiveHelperPlatforms?: number;
  enablePlayerNotifications?: boolean;
}
