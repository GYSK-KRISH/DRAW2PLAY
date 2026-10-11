import type {
  DirectorRule,
  PlayerTelemetry,
  DirectorContext,
  DirectorAction,
} from './types.js';

/**
 * Standard allowlisted Director Rules library.
 * Deterministic, predictable, and strictly respecting template boundaries.
 */
export const DEFAULT_DIRECTOR_RULES: DirectorRule[] = [
  // ---------------------------------------------------------------------------
  // 1. REPEATED FAILURE AT OBSTACLE
  // ---------------------------------------------------------------------------
  {
    id: 'repeated-hazard-failure',
    name: 'Repeated Hazard Safety Net',
    description: 'Spawns a temporary helper stepping-stone platform when player dies repeatedly at the same obstacle.',
    supportedTemplates: ['all'],
    cooldownSeconds: 10,
    maxActivationsPerLevel: 3,
    evaluate: (telemetry: PlayerTelemetry, context: DirectorContext): DirectorAction | null => {
      // Trigger when 3+ failures occur in a spatial cluster, or 3+ consecutive deaths
      if (telemetry.repeatedObstacleFailures >= 3 || telemetry.consecutiveDeaths >= 3) {
        const lastDeath = telemetry.lastDeathEvent;
        const targetX = lastDeath ? Math.max(context.baselinePlayerSpeed * 0.5, lastDeath.x - 20) : telemetry.playerX;
        const targetY = lastDeath ? Math.min(context.worldHeight - 48, lastDeath.y + 16) : telemetry.playerY;

        return {
          id: `action-helper-plat-${Date.now()}`,
          ruleId: 'repeated-hazard-failure',
          type: 'SPAWN_HELPER_PLATFORM',
          playerExplanation: 'Director Assist: A safety platform has appeared across the hazard.',
          payload: {
            platform: {
              x: Math.round(targetX),
              y: Math.round(targetY),
              width: 72,
              height: 18,
              tint: 0x06b6d4, // glowing cyan indicator
            },
          },
          durationSeconds: 0, // remains until level restart
          createdAt: Date.now(),
        };
      }
      return null;
    },
  },

  // ---------------------------------------------------------------------------
  // 2. STUCK PLAYER OBSTACLE BRIDGE
  // ---------------------------------------------------------------------------
  {
    id: 'stuck-player-bridge',
    name: 'Stuck Player Bridge',
    description: 'Introduces a stepping platform when player is stuck for over 25 seconds without progress.',
    supportedTemplates: ['all'],
    cooldownSeconds: 15,
    maxActivationsPerLevel: 2,
    evaluate: (telemetry: PlayerTelemetry, context: DirectorContext): DirectorAction | null => {
      if (telemetry.timeStuckSeconds >= 25 && telemetry.progressRatio < 0.85) {
        // Place helper stepping stone 60px ahead of player toward goal
        const dir = context.goalX >= telemetry.playerX ? 1 : -1;
        const targetX = telemetry.playerX + dir * 64;
        const targetY = Math.min(context.worldHeight - 50, telemetry.playerY + 24);

        return {
          id: `action-stuck-bridge-${Date.now()}`,
          ruleId: 'stuck-player-bridge',
          type: 'SPAWN_HELPER_PLATFORM',
          playerExplanation: 'Director Assist: A pathway platform has materialized ahead.',
          payload: {
            platform: {
              x: Math.round(targetX),
              y: Math.round(targetY),
              width: 64,
              height: 16,
              tint: 0xa855f7, // soft purple indicator
            },
          },
          durationSeconds: 0,
          createdAt: Date.now(),
        };
      }
      return null;
    },
  },

  // ---------------------------------------------------------------------------
  // 3. FAST MASTERY / SPEEDRUN BONUS CHALLENGE
  // ---------------------------------------------------------------------------
  {
    id: 'speedrun-mastery-challenge',
    name: 'Speedrun Mastery Bonus',
    description: 'Rewards skilled pacing with an optional bonus collectible without penalizing the main objective.',
    supportedTemplates: ['all'],
    cooldownSeconds: 30,
    maxActivationsPerLevel: 1,
    evaluate: (telemetry: PlayerTelemetry, context: DirectorContext): DirectorAction | null => {
      // Master criteria: collected >= 50% coins or covered >= 60% distance in under 16s with 0 deaths
      const minCoins = Math.max(1, Math.floor(telemetry.totalCoins * 0.4));
      const hasQuickPace = telemetry.coinsCollected >= minCoins || telemetry.progressRatio >= 0.6;

      if (!telemetry.hasDiedThisRun && hasQuickPace && telemetry.elapsedTimeSeconds > 2 && telemetry.elapsedTimeSeconds < 16) {
        // Spawn bonus collectible halfway between player and goal
        const bonusX = Math.round((telemetry.playerX + context.goalX) / 2);
        const bonusY = Math.max(48, Math.round(telemetry.playerY - 40));

        return {
          id: `action-mastery-gem-${Date.now()}`,
          ruleId: 'speedrun-mastery-challenge',
          type: 'SPAWN_BONUS_COLLECTIBLE',
          playerExplanation: 'Challenge Mode: Exceptional pace! Bonus golden gem unlocked (+50 pts).',
          payload: {
            bonusCollectible: {
              x: bonusX,
              y: bonusY,
              value: 50,
            },
          },
          createdAt: Date.now(),
        };
      }
      return null;
    },
  },

  // ---------------------------------------------------------------------------
  // 4. RELENTLESS ENEMY PATROL SLOWDOWN
  // ---------------------------------------------------------------------------
  {
    id: 'enemy-patrol-slowdown',
    name: 'Enemy Patrol Disorientation',
    description: 'Slows down hostile patrol enemies by 25% when player experiences repeated enemy collisions.',
    supportedTemplates: ['all'],
    cooldownSeconds: 12,
    maxActivationsPerLevel: 2,
    evaluate: (telemetry: PlayerTelemetry): DirectorAction | null => {
      const enemyDeaths = telemetry.deathHistory.filter((d) => d.cause.toLowerCase().includes('enemy')).length;
      if (enemyDeaths >= 2 && telemetry.consecutiveDeaths >= 2) {
        return {
          id: `action-enemy-slow-${Date.now()}`,
          ruleId: 'enemy-patrol-slowdown',
          type: 'REDUCE_ENEMY_SPEED',
          playerExplanation: 'Director Assist: Patrol enemies temporarily disoriented (-25% speed).',
          payload: {
            speedReductionRatio: 0.75, // 25% slower
          },
          durationSeconds: 12, // temporary 12 seconds
          createdAt: Date.now(),
        };
      }
      return null;
    },
  },

  // ---------------------------------------------------------------------------
  // 5. MIDPOINT CHECKPOINT ASSIST
  // ---------------------------------------------------------------------------
  {
    id: 'midpoint-checkpoint-assist',
    name: 'Midpoint Rescue Checkpoint',
    description: 'Establishes a respawn point at furthest reached safe ground if player dies far into the level.',
    supportedTemplates: ['all'],
    cooldownSeconds: 20,
    maxActivationsPerLevel: 1,
    evaluate: (telemetry: PlayerTelemetry, context: DirectorContext): DirectorAction | null => {
      const distanceCovered = telemetry.maxProgressX - telemetry.spawnX;
      const totalDistance = context.goalX - telemetry.spawnX;
      const isPastMidpoint = totalDistance > 0 && distanceCovered / totalDistance >= 0.45;

      if (isPastMidpoint && telemetry.consecutiveDeaths >= 2 && telemetry.checkpointsReached.length === 0) {
        return {
          id: `action-checkpoint-${Date.now()}`,
          ruleId: 'midpoint-checkpoint-assist',
          type: 'SPAWN_CHECKPOINT',
          playerExplanation: 'Director Assist: Midpoint respawn beacon activated.',
          payload: {
            checkpoint: {
              x: Math.round(telemetry.maxProgressX - 40),
              y: Math.round(telemetry.playerY),
              id: `cp-director-${Date.now()}`,
            },
          },
          createdAt: Date.now(),
        };
      }
      return null;
    },
  },

  // ---------------------------------------------------------------------------
  // 6. JUMP POWER MICRO-BOOST
  // ---------------------------------------------------------------------------
  {
    id: 'jump-micro-boost',
    name: 'Jump Micro-Assist',
    description: 'Provides a conservative +12% jump power boost when player fails repeatedly in precision platforming.',
    supportedTemplates: ['physics-platformer', 'precision-platformer', 'collect-and-escape'],
    cooldownSeconds: 15,
    maxActivationsPerLevel: 2,
    evaluate: (telemetry: PlayerTelemetry, context: DirectorContext): DirectorAction | null => {
      // Only for platformer gravity templates
      if (context.gravity > 0 && telemetry.consecutiveDeaths >= 3) {
        return {
          id: `action-jump-boost-${Date.now()}`,
          ruleId: 'jump-micro-boost',
          type: 'GRANT_JUMP_ASSIST',
          playerExplanation: 'Director Assist: Kinetic jump thrusters boosted (+12%).',
          payload: {
            jumpBoostRatio: 1.12,
          },
          durationSeconds: 15, // lasts 15 seconds then cleanly reverts
          createdAt: Date.now(),
        };
      }
      return null;
    },
  },
];
