import type {
  DirectorConfig,
  DirectorRule,
  DirectorAuditLogEvent,
  DirectorContext,
  DirectorAction,
  ActiveDirectorModifier,
  PlayerTelemetry,
} from './types.js';
import { TelemetryTracker } from './telemetryTracker.js';
import { DEFAULT_DIRECTOR_RULES } from './directorRules.js';
import { ActionExecutor } from './actionExecutor.js';
import type { GameTemplateId } from '../../types/plan.js';
import type { PlayerMovementModel } from '../../types/scene.js';

export interface GameDirectorInitOptions {
  sceneRef?: any;
  config?: DirectorConfig;
  rules?: DirectorRule[];
  notifyPlayer?: (msg: string) => void;
  templateId?: GameTemplateId;
  movementModel?: PlayerMovementModel;
  worldWidth?: number;
  worldHeight?: number;
  gravity?: number;
  baselinePlayerSpeed?: number;
  baselineJumpPower?: number;
  spawnX?: number;
  spawnY?: number;
  goalX?: number;
  goalY?: number;
  totalCoins?: number;
  totalSwitches?: number;
}

/**
 * GameDirector coordinates:
 * - Managed telemetry collection (no private data, purely spatial and mechanical).
 * - Deterministic, template-constrained rule evaluation within the engine update loop (no unmanaged setInterval).
 * - Allowlisted action validation and safe execution.
 * - Non-intrusive player notifications.
 * - Modifier expiry, reversal, and complete shutdown cleanup.
 */
export class GameDirector {
  private config: Required<DirectorConfig>;
  private tracker: TelemetryTracker;
  private executor: ActionExecutor;
  private rules: DirectorRule[];
  private sceneRef?: any;
  private notifyPlayer?: (msg: string) => void;

  private auditLog: DirectorAuditLogEvent[] = [];
  private actionExecutionCounts: Record<string, number> = {};
  private lastActionTimes: Record<string, number> = {};

  // Lifecycle timers (managed via update(time, deltaMs))
  private accumulatedDeltaMs = 0;
  private isRunning = true;

  // Context metadata
  private templateId?: GameTemplateId;
  private movementModel?: PlayerMovementModel;
  private worldWidth: number;
  private worldHeight: number;
  private gravity: number;
  private baselinePlayerSpeed: number;
  private baselineJumpPower: number;
  private goalX: number;
  private goalY: number;

  constructor(options: GameDirectorInitOptions) {
    this.sceneRef = options.sceneRef;
    this.notifyPlayer = options.notifyPlayer;

    this.config = {
      enabled: options.config?.enabled ?? true,
      evaluationIntervalMs: options.config?.evaluationIntervalMs ?? 500,
      difficultyPreference: options.config?.difficultyPreference ?? 'dynamic',
      maxActiveHelperPlatforms: options.config?.maxActiveHelperPlatforms ?? 4,
      enablePlayerNotifications: options.config?.enablePlayerNotifications ?? true,
    };

    this.rules = options.rules ?? [...DEFAULT_DIRECTOR_RULES];
    this.executor = new ActionExecutor();

    this.templateId = options.templateId;
    this.movementModel = options.movementModel;
    this.worldWidth = options.worldWidth ?? 800;
    this.worldHeight = options.worldHeight ?? 480;
    this.gravity = options.gravity ?? 750;
    this.baselinePlayerSpeed = options.baselinePlayerSpeed ?? 220;
    this.baselineJumpPower = options.baselineJumpPower ?? 400;
    this.goalX = options.goalX ?? 720;
    this.goalY = options.goalY ?? 400;

    this.tracker = new TelemetryTracker({
      spawnX: options.spawnX ?? 80,
      spawnY: options.spawnY ?? 380,
      goalX: this.goalX,
      goalY: this.goalY,
      totalCoins: options.totalCoins ?? 0,
      totalSwitches: options.totalSwitches ?? 0,
    });
  }

  /**
   * Main game loop update hook. Called from Phaser Scene update(time, delta).
   * Strictly avoids uncontrolled setInterval.
   */
  public update(_time: number, deltaMs: number): void {
    if (!this.isRunning || !this.config.enabled) return;

    const deltaSeconds = deltaMs / 1000;

    // 1. Update player position from scene if available
    if (this.sceneRef?.player) {
      const px = this.sceneRef.player.x;
      const py = this.sceneRef.player.y;
      this.tracker.updatePlayerPosition(px, py, deltaSeconds);
    }

    // 2. Tick modifier executor for expiring temporary effects
    const expired = this.executor.update(this.sceneRef);
    for (const exp of expired) {
      this.recordAudit({
        timestamp: Date.now(),
        type: 'action_expired',
        actionId: exp.actionId,
        ruleId: exp.ruleId,
        actionType: exp.type,
      });
      this.recordAudit({
        timestamp: Date.now(),
        type: 'action_reverted',
        actionId: exp.actionId,
        ruleId: exp.ruleId,
        actionType: exp.type,
      });
    }

    // 3. Accumulate delta for deterministic evaluation interval
    this.accumulatedDeltaMs += deltaMs;
    if (this.accumulatedDeltaMs >= this.config.evaluationIntervalMs) {
      this.accumulatedDeltaMs = 0;
      this.evaluateDirectorRules();
    }
  }

  /**
   * Evaluates all registered rules against current telemetry and context
   */
  public evaluateDirectorRules(): DirectorAction | null {
    if (!this.config.enabled || !this.isRunning) return null;

    const telemetry = this.tracker.getSnapshot();
    const now = Date.now();
    const context = this.createDirectorContext();

    for (const rule of this.rules) {
      // 1. Template compatibility check
      if (!rule.supportedTemplates.includes('all')) {
        if (this.templateId && !rule.supportedTemplates.includes(this.templateId)) {
          continue;
        }
      }

      // 2. Cooldown check
      const lastExecution = this.lastActionTimes[rule.id] || 0;
      if (now - lastExecution < rule.cooldownSeconds * 1000) {
        continue;
      }

      // 3. Max activation limit per level
      const execCount = this.actionExecutionCounts[rule.id] || 0;
      if (execCount >= rule.maxActivationsPerLevel) {
        continue;
      }

      // 4. Rule evaluation
      const proposedAction = rule.evaluate(telemetry, context);
      if (!proposedAction) continue;

      // 5. Validation against allowlist, physics bounds, and template constraints
      const validation = this.executor.validateAction(proposedAction, context);
      if (!validation.valid || !validation.sanitizedAction) {
        this.recordAudit({
          timestamp: now,
          type: 'rule_triggered',
          ruleId: rule.id,
          explanation: `Action rejected: ${validation.reason}`,
        });
        continue;
      }

      const validatedAction = validation.sanitizedAction;

      // 6. Safe execution
      const result = this.executor.executeAction(validatedAction, this.sceneRef, now);
      if (result.success) {
        this.actionExecutionCounts[rule.id] = (this.actionExecutionCounts[rule.id] || 0) + 1;
        this.lastActionTimes[rule.id] = now;

        this.recordAudit({
          timestamp: now,
          type: 'action_executed',
          ruleId: rule.id,
          actionId: validatedAction.id,
          actionType: validatedAction.type,
          explanation: validatedAction.playerExplanation,
        });

        // 7. Non-intrusive player notification
        if (this.config.enablePlayerNotifications && validatedAction.playerExplanation) {
          if (this.notifyPlayer) {
            this.notifyPlayer(validatedAction.playerExplanation);
          } else if (this.sceneRef && typeof this.sceneRef.showMessage === 'function') {
            this.sceneRef.showMessage(validatedAction.playerExplanation);
          }
        }

        // Apply only one action per evaluation tick to prevent jarring difficulty swings
        return validatedAction;
      }
    }

    return null;
  }

  /**
   * Event hook: player death
   */
  public recordDeath(cause: string, x: number, y: number): void {
    this.tracker.recordDeath(cause, x, y);
    // Proactively evaluate after death
    this.evaluateDirectorRules();
  }

  /**
   * Event hook: coin collected
   */
  public recordCoinCollected(): void {
    this.tracker.recordCoinCollected();
  }

  /**
   * Event hook: switch activated
   */
  public recordSwitchActivated(): void {
    this.tracker.recordSwitchActivated();
  }

  /**
   * Event hook: checkpoint reached
   */
  public recordCheckpoint(id: string, x: number, y: number): void {
    this.tracker.recordCheckpoint(id, x, y);
  }

  /**
   * Event hook: level completed (victory)
   */
  public onVictory(): void {
    this.isRunning = false;
    this.executor.shutdown(this.sceneRef);
  }

  /**
   * Resets session counters (e.g. on level restart)
   */
  public resetSession(keepCumulative = true): void {
    this.tracker.resetSession(keepCumulative);
    this.executor.shutdown(this.sceneRef);
    this.actionExecutionCounts = {};
    this.lastActionTimes = {};
    this.accumulatedDeltaMs = 0;
    this.isRunning = true;
  }

  /**
   * Complete shutdown cleanup: reverts modifiers, frees game objects, stops loop.
   * Guaranteed zero orphaned timers or memory leaks.
   */
  public shutdown(): void {
    this.isRunning = false;
    this.executor.shutdown(this.sceneRef);
    this.recordAudit({
      timestamp: Date.now(),
      type: 'director_shutdown',
    });
  }

  /**
   * Builds director context snapshot for rules
   */
  public createDirectorContext(): DirectorContext {
    return {
      templateId: this.templateId,
      movementModel: this.movementModel,
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
      gravity: this.gravity,
      baselinePlayerSpeed: this.baselinePlayerSpeed,
      baselineJumpPower: this.baselineJumpPower,
      goalX: this.goalX,
      goalY: this.goalY,
      activeActions: [...this.executor.getActiveModifiers()],
      actionExecutionCounts: { ...this.actionExecutionCounts },
      lastActionTimes: { ...this.lastActionTimes },
    };
  }

  /**
   * Records an audit event for testing and telemetry
   */
  private recordAudit(event: DirectorAuditLogEvent): void {
    this.auditLog.push(event);
    if (this.auditLog.length > 200) {
      this.auditLog.shift();
    }
  }

  // ---------------------------------------------------------------------------
  // Inspection Getters (for unit testing & observability)
  // ---------------------------------------------------------------------------
  public getTelemetrySnapshot(): Readonly<PlayerTelemetry> {
    return this.tracker.getSnapshot();
  }

  public getAuditLog(): ReadonlyArray<DirectorAuditLogEvent> {
    return this.auditLog;
  }

  public getActiveModifiers(): ReadonlyArray<ActiveDirectorModifier> {
    return this.executor.getActiveModifiers();
  }

  public getExecutionCounts(): Record<string, number> {
    return { ...this.actionExecutionCounts };
  }

  public getTracker(): TelemetryTracker {
    return this.tracker;
  }

  public getExecutor(): ActionExecutor {
    return this.executor;
  }
}
