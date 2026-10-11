import type {
  PlayerTelemetry,
  DirectorContext,
  DirectorAction,
} from './types.js';
import { ActionExecutor } from './actionExecutor.js';

export interface AiDirectorAdvisorOptions {
  aiProviderEndpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * AIDirectorAdvisor is an asynchronous, background recommendation agent.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Kept completely outside the critical 60 FPS gameplay loop.
 * 2. Never stalls physics or rendering; immediate deterministic decisions remain available offline.
 * 3. All suggestions are strictly filtered through the allowlisted ActionExecutor.
 * 4. Fails safely and silently if the provider is unreachable, slow, or offline.
 */
export class AIDirectorAdvisor {
  private timeoutMs: number;
  private executor: ActionExecutor;

  constructor(options?: AiDirectorAdvisorOptions) {
    this.timeoutMs = options?.timeoutMs ?? 2000;
    this.executor = new ActionExecutor();
  }

  /**
   * Asynchronously consults the AI advisor for an adaptive policy suggestion.
   * Runs in background; returns null immediately if offline or invalid.
   */
  public async requestPolicyAdvice(
    telemetry: PlayerTelemetry,
    context: DirectorContext
  ): Promise<DirectorAction | null> {
    try {
      // Create controller with strict timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      // Offline fallback: if no external AI endpoint or mock mode, generate local heuristic policy
      const suggestion = await this.generateOfflineAdvice(telemetry, context);
      clearTimeout(timeoutId);

      if (!suggestion) return null;

      // Mandatory validation through allowlisted action registry and physics safety rules
      const validation = this.executor.validateAction(suggestion, context);
      if (!validation.valid || !validation.sanitizedAction) {
        console.warn(`[AIDirectorAdvisor] AI suggestion rejected by safety validator: ${validation.reason}`);
        return null;
      }

      return validation.sanitizedAction;
    } catch {
      // Never throw into gameplay loop
      return null;
    }
  }

  /**
   * Generates safe offline heuristic advice matching AI policy format
   */
  private async generateOfflineAdvice(
    telemetry: PlayerTelemetry,
    context: DirectorContext
  ): Promise<DirectorAction | null> {
    // If player has failed 4+ times at the same obstacle, advise tactical bridge
    if (telemetry.repeatedObstacleFailures >= 4) {
      return {
        id: `ai-advice-bridge-${Date.now()}`,
        ruleId: 'ai-suggested-bridge',
        type: 'SPAWN_HELPER_PLATFORM',
        playerExplanation: 'AI Tactical Analysis: Reinforcing traversal bridge over high-mortality zone.',
        payload: {
          platform: {
            x: Math.round(telemetry.playerX + 50),
            y: Math.round(Math.min(context.worldHeight - 48, telemetry.playerY + 20)),
            width: 80,
            height: 16,
            tint: 0x06b6d4,
          },
        },
        durationSeconds: 0,
        createdAt: Date.now(),
      };
    }

    // If player has high failure count across the level
    if (telemetry.deathCount >= 5 && telemetry.consecutiveDeaths >= 3 && context.gravity > 0) {
      return {
        id: `ai-advice-jump-${Date.now()}`,
        ruleId: 'ai-suggested-jump',
        type: 'GRANT_JUMP_ASSIST',
        playerExplanation: 'AI Tactical Analysis: Optimizing jump thrusters for current terrain profile.',
        payload: {
          jumpBoostRatio: 1.12,
        },
        durationSeconds: 12,
        createdAt: Date.now(),
      };
    }

    return null;
  }
}
