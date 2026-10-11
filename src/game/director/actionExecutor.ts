import {
  ALLOWLISTED_DIRECTOR_ACTION_TYPES,
  type DirectorAction,
  type ActiveDirectorModifier,
  type DirectorContext,
} from './types.js';
import { TEMPLATE_REGISTRY } from '../../templates/templateRegistry.js';

export interface ActionValidationResult {
  valid: boolean;
  reason?: string;
  sanitizedAction?: DirectorAction;
}

export interface ExecutionResult {
  success: boolean;
  actionId: string;
  error?: string;
  modifier?: ActiveDirectorModifier;
}

/**
 * Bounds & Physics Safety Constants
 */
export const PHYSICS_BOUNDS = {
  MIN_PLAYER_SPEED: 100,
  MAX_PLAYER_SPEED: 380,
  MIN_JUMP_POWER: 200,
  MAX_JUMP_POWER: 600,
  MIN_JUMP_BOOST_RATIO: 1.05,
  MAX_JUMP_BOOST_RATIO: 1.25,
  MIN_ENEMY_SPEED_REDUCTION: 0.5,
  MAX_ENEMY_SPEED_REDUCTION: 0.9,
  MIN_PLATFORM_WIDTH: 32,
  MAX_PLATFORM_WIDTH: 200,
  MIN_PLATFORM_HEIGHT: 8,
  MAX_PLATFORM_HEIGHT: 48,
  MIN_BONUS_VALUE: 10,
  MAX_BONUS_VALUE: 100,
};

/**
 * ActionExecutor is responsible for:
 * 1. Validating proposed actions against template constraints and physics bounds.
 * 2. Safely executing allowlisted mutations on the Phaser scene at safe lifecycle points.
 * 3. Tracking active temporary modifiers and restoring initial values upon expiry.
 * 4. Reverting all changes and freeing game objects on level shutdown/restart.
 */
export class ActionExecutor {
  private activeModifiers: ActiveDirectorModifier[] = [];

  /**
   * Validates a proposed action against allowlist, template rules, and physics bounds
   */
  public validateAction(action: DirectorAction, context: DirectorContext): ActionValidationResult {
    // 1. Allowlist enforcement
    if (!ALLOWLISTED_DIRECTOR_ACTION_TYPES.includes(action.type)) {
      return {
        valid: false,
        reason: `Action type '${action.type}' is not in the allowlisted director action registry.`,
      };
    }

    // 2. Template & Physics compatibility check
    if (action.type === 'GRANT_JUMP_ASSIST') {
      if (context.gravity === 0 || context.movementModel === 'topdown') {
        return {
          valid: false,
          reason: `Jump assist requires positive vertical gravity and platformer movement.`,
        };
      }
      if (context.templateId) {
        const templateSpec = TEMPLATE_REGISTRY[context.templateId];
        if (templateSpec && !templateSpec.requiredPlayerConfiguration.requiresJump) {
          return {
            valid: false,
            reason: `Template '${context.templateId}' does not support jump mechanics.`,
          };
        }
      }
    }

    // 3. Payload & physics bounds validation and clamping
    const clonedAction: DirectorAction = JSON.parse(JSON.stringify(action));

    switch (clonedAction.type) {
      case 'SPAWN_HELPER_PLATFORM': {
        const plat = clonedAction.payload.platform;
        if (!plat) {
          return { valid: false, reason: 'Payload missing platform configuration.' };
        }
        // Clamp dimensions and positions
        plat.width = Math.min(PHYSICS_BOUNDS.MAX_PLATFORM_WIDTH, Math.max(PHYSICS_BOUNDS.MIN_PLATFORM_WIDTH, plat.width));
        plat.height = Math.min(PHYSICS_BOUNDS.MAX_PLATFORM_HEIGHT, Math.max(PHYSICS_BOUNDS.MIN_PLATFORM_HEIGHT, plat.height));
        plat.x = Math.min(context.worldWidth - plat.width / 2, Math.max(plat.width / 2, plat.x));
        plat.y = Math.min(context.worldHeight - plat.height / 2, Math.max(plat.height / 2, plat.y));
        break;
      }

      case 'GRANT_JUMP_ASSIST': {
        const ratio = clonedAction.payload.jumpBoostRatio ?? 1.12;
        const clampedRatio = Math.min(PHYSICS_BOUNDS.MAX_JUMP_BOOST_RATIO, Math.max(PHYSICS_BOUNDS.MIN_JUMP_BOOST_RATIO, ratio));
        clonedAction.payload.jumpBoostRatio = clampedRatio;

        const prospectiveJump = context.baselineJumpPower * clampedRatio;
        if (prospectiveJump < PHYSICS_BOUNDS.MIN_JUMP_POWER || prospectiveJump > PHYSICS_BOUNDS.MAX_JUMP_POWER) {
          return {
            valid: false,
            reason: `Prospective jump power (${prospectiveJump}) exceeds safe physics bounds [${PHYSICS_BOUNDS.MIN_JUMP_POWER}, ${PHYSICS_BOUNDS.MAX_JUMP_POWER}].`,
          };
        }
        break;
      }

      case 'REDUCE_ENEMY_SPEED': {
        const reduction = clonedAction.payload.speedReductionRatio ?? 0.75;
        const clampedReduction = Math.min(
          PHYSICS_BOUNDS.MAX_ENEMY_SPEED_REDUCTION,
          Math.max(PHYSICS_BOUNDS.MIN_ENEMY_SPEED_REDUCTION, reduction)
        );
        clonedAction.payload.speedReductionRatio = clampedReduction;
        break;
      }

      case 'SPAWN_CHECKPOINT': {
        const cp = clonedAction.payload.checkpoint;
        if (!cp) {
          return { valid: false, reason: 'Payload missing checkpoint definition.' };
        }
        cp.x = Math.min(context.worldWidth - 30, Math.max(30, cp.x));
        cp.y = Math.min(context.worldHeight - 30, Math.max(30, cp.y));
        break;
      }

      case 'SPAWN_BONUS_COLLECTIBLE': {
        const bonus = clonedAction.payload.bonusCollectible;
        if (!bonus) {
          return { valid: false, reason: 'Payload missing bonus collectible data.' };
        }
        bonus.value = Math.min(PHYSICS_BOUNDS.MAX_BONUS_VALUE, Math.max(PHYSICS_BOUNDS.MIN_BONUS_VALUE, bonus.value));
        bonus.x = Math.min(context.worldWidth - 20, Math.max(20, bonus.x));
        bonus.y = Math.min(context.worldHeight - 20, Math.max(20, bonus.y));
        break;
      }

      case 'DISPLAY_TACTICAL_HINT': {
        if (!clonedAction.payload.hintText && !clonedAction.playerExplanation) {
          return { valid: false, reason: 'Tactical hint requires text payload.' };
        }
        break;
      }
    }

    return {
      valid: true,
      sanitizedAction: clonedAction,
    };
  }

  /**
   * Executes a validated action on the target scene safely
   */
  public executeAction(action: DirectorAction, scene: any, now = Date.now()): ExecutionResult {
    try {
      const spawnedObjects: any[] = [];
      let originalValue: number | undefined;

      switch (action.type) {
        case 'SPAWN_HELPER_PLATFORM': {
          const plat = action.payload.platform;
          if (plat && scene) {
            if (scene.platforms && typeof scene.platforms.create === 'function') {
              // Static Arcade platform
              const sprite = scene.platforms.create(plat.x, plat.y, 'door-texture');
              if (sprite) {
                sprite.setDisplaySize(plat.width, plat.height);
                if (plat.tint && typeof sprite.setTint === 'function') {
                  sprite.setTint(plat.tint);
                }
                if (typeof sprite.refreshBody === 'function') {
                  sprite.refreshBody();
                }
                spawnedObjects.push(sprite);
              }
            } else if (scene.spawnDirectorPlatform && typeof scene.spawnDirectorPlatform === 'function') {
              const obj = scene.spawnDirectorPlatform(plat);
              if (obj) spawnedObjects.push(obj);
            }
          }
          break;
        }

        case 'GRANT_JUMP_ASSIST': {
          const ratio = action.payload.jumpBoostRatio ?? 1.12;
          if (scene && scene.sceneData && scene.sceneData.player) {
            const currentJump = scene.sceneData.player.jumpPower ?? 400;
            originalValue = currentJump;
            scene.sceneData.player.jumpPower = Math.round(currentJump * ratio);
          }
          break;
        }

        case 'REDUCE_ENEMY_SPEED': {
          const reduction = action.payload.speedReductionRatio ?? 0.75;
          if (scene && scene.enemies && typeof scene.enemies.getChildren === 'function') {
            const enemies = scene.enemies.getChildren();
            for (const enemy of enemies) {
              const currentSpeed = enemy.getData ? enemy.getData('speed') : 100;
              if (originalValue === undefined) {
                originalValue = currentSpeed;
              }
              const newSpeed = Math.round(currentSpeed * reduction);
              if (enemy.setData) {
                enemy.setData('speed', newSpeed);
              }
              if (enemy.setVelocityX && enemy.body && enemy.body.velocity.x !== 0) {
                const dir = enemy.body.velocity.x > 0 ? 1 : -1;
                enemy.setVelocityX(newSpeed * dir);
              }
            }
          }
          break;
        }

        case 'SPAWN_CHECKPOINT': {
          const cp = action.payload.checkpoint;
          if (cp && scene) {
            if (scene.spawnDirectorCheckpoint && typeof scene.spawnDirectorCheckpoint === 'function') {
              const obj = scene.spawnDirectorCheckpoint(cp);
              if (obj) spawnedObjects.push(obj);
            }
          }
          break;
        }

        case 'SPAWN_BONUS_COLLECTIBLE': {
          const bonus = action.payload.bonusCollectible;
          if (bonus && scene) {
            if (scene.coins && typeof scene.coins.create === 'function') {
              const bonusCoin = scene.coins.create(bonus.x, bonus.y, 'coin-sprite');
              if (bonusCoin) {
                bonusCoin.setDisplaySize(28, 28);
                if (typeof bonusCoin.setTint === 'function') {
                  bonusCoin.setTint(0xf59e0b); // golden amber glow
                }
                if (typeof bonusCoin.setData === 'function') {
                  bonusCoin.setData('value', bonus.value);
                  bonusCoin.setData('isBonus', true);
                }
                if (scene.tweens && typeof scene.tweens.add === 'function') {
                  scene.tweens.add({
                    targets: bonusCoin,
                    y: bonus.y - 8,
                    duration: 600,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                  });
                }
                spawnedObjects.push(bonusCoin);
              }
            } else if (scene.spawnBonusCollectible && typeof scene.spawnBonusCollectible === 'function') {
              const obj = scene.spawnBonusCollectible(bonus);
              if (obj) spawnedObjects.push(obj);
            }
          }
          break;
        }

        case 'DISPLAY_TACTICAL_HINT': {
          const hint = action.payload.hintText || action.playerExplanation;
          if (scene && typeof scene.showMessage === 'function') {
            scene.showMessage(`Tactical Hint: ${hint}`);
          }
          break;
        }
      }

      // Track active modifier if duration is temporary
      let modifier: ActiveDirectorModifier | undefined;
      const durationSeconds = action.durationSeconds ?? 0;

      modifier = {
        actionId: action.id,
        ruleId: action.ruleId,
        type: action.type,
        appliedAtTimestamp: now,
        expiresAtTimestamp: durationSeconds > 0 ? now + durationSeconds * 1000 : Infinity,
        reversalData: {
          originalValue,
          spawnedGameObjects: spawnedObjects,
        },
      };

      this.activeModifiers.push(modifier);

      return {
        success: true,
        actionId: action.id,
        modifier,
      };
    } catch (err: any) {
      return {
        success: false,
        actionId: action.id,
        error: err.message || 'Execution failed',
      };
    }
  }

  /**
   * Ticks active modifiers and reverts expired ones cleanly
   */
  public update(scene: any, now = Date.now()): ActiveDirectorModifier[] {
    const expiredModifiers: ActiveDirectorModifier[] = [];
    const remainingModifiers: ActiveDirectorModifier[] = [];

    for (const mod of this.activeModifiers) {
      if (mod.expiresAtTimestamp !== Infinity && now >= mod.expiresAtTimestamp) {
        expiredModifiers.push(mod);
        this.revertModifier(mod, scene);
      } else {
        remainingModifiers.push(mod);
      }
    }

    this.activeModifiers = remainingModifiers;
    return expiredModifiers;
  }

  /**
   * Reverts a specific modifier back to baseline
   */
  public revertModifier(mod: ActiveDirectorModifier, scene: any): void {
    try {
      switch (mod.type) {
        case 'GRANT_JUMP_ASSIST': {
          if (mod.reversalData?.originalValue !== undefined && scene?.sceneData?.player) {
            scene.sceneData.player.jumpPower = mod.reversalData.originalValue;
          }
          break;
        }

        case 'REDUCE_ENEMY_SPEED': {
          if (mod.reversalData?.originalValue !== undefined && scene?.enemies?.getChildren) {
            for (const enemy of scene.enemies.getChildren()) {
              if (enemy.setData) {
                enemy.setData('speed', mod.reversalData.originalValue);
              }
              if (enemy.setVelocityX && enemy.body && enemy.body.velocity.x !== 0) {
                const dir = enemy.body.velocity.x > 0 ? 1 : -1;
                enemy.setVelocityX(mod.reversalData.originalValue * dir);
              }
            }
          }
          break;
        }

        case 'SPAWN_HELPER_PLATFORM':
        case 'SPAWN_BONUS_COLLECTIBLE': {
          if (mod.reversalData?.spawnedGameObjects) {
            for (const obj of mod.reversalData.spawnedGameObjects) {
              if (obj && typeof obj.destroy === 'function') {
                obj.destroy();
              }
            }
          }
          break;
        }
      }
    } catch (err) {
      console.warn(`[ActionExecutor] Error reverting modifier ${mod.actionId}:`, err);
    }
  }

  /**
   * Reverts all active modifiers and clears spawned game objects (e.g. on shutdown/restart)
   */
  public shutdown(scene: any): void {
    for (const mod of this.activeModifiers) {
      this.revertModifier(mod, scene);
    }
    this.activeModifiers = [];
  }

  /**
   * Returns current active modifiers
   */
  public getActiveModifiers(): ReadonlyArray<ActiveDirectorModifier> {
    return this.activeModifiers;
  }
}
