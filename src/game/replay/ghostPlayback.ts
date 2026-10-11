import type {
  ReplayData,
  ReplayInput,
} from '../../types/replay.js';

export interface GhostInterpolatedState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingRight?: boolean;
  inputs: ReplayInput;
  currentTimeMs: number;
  durationMs: number;
  progressRatio: number;
  isFinished: boolean;
}

export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

/**
 * Stage 8: GhostPlaybackController
 * Manages timeline synchronization, speed scaling, and Hermite/linear position
 * interpolation between recorded sync frames for visual ghost replay.
 */
export class GhostPlaybackController {
  private replay: ReplayData;
  private currentTimeMs = 0;
  private isPlaying = false;
  private isPaused = false;
  private speed: PlaybackSpeed = 1;
  private durationMs = 0;

  constructor(replay: ReplayData) {
    this.replay = replay;
    this.durationMs = replay.summary.durationMs || (replay.frames.length > 0 ? replay.frames[replay.frames.length - 1].timestampMs : 0);
  }

  public start(): void {
    this.currentTimeMs = 0;
    this.isPlaying = true;
    this.isPaused = false;
  }

  public pause(): void {
    if (this.isPlaying) {
      this.isPaused = true;
    }
  }

  public resume(): void {
    if (this.isPlaying) {
      this.isPaused = false;
    }
  }

  public stop(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentTimeMs = 0;
  }

  public setSpeed(newSpeed: PlaybackSpeed): void {
    this.speed = newSpeed;
  }

  public getSpeed(): PlaybackSpeed {
    return this.speed;
  }

  public isActive(): boolean {
    return this.isPlaying && !this.isPaused;
  }

  public isFinished(): boolean {
    return this.currentTimeMs >= this.durationMs;
  }

  public getCurrentTimeMs(): number {
    return this.currentTimeMs;
  }

  public getDurationMs(): number {
    return this.durationMs;
  }

  public getReplayData(): ReplayData {
    return this.replay;
  }

  /**
   * Advances the playback timer by deltaMs * speed
   */
  public update(deltaMs: number): GhostInterpolatedState {
    if (this.isPlaying && !this.isPaused && deltaMs > 0) {
      this.currentTimeMs += deltaMs * this.speed;
      if (this.currentTimeMs > this.durationMs) {
        this.currentTimeMs = this.durationMs;
        this.isPlaying = false;
      }
    }
    return this.sampleState(this.currentTimeMs);
  }

  /**
   * Pure position & input interpolation at arbitrary timestamp
   */
  public sampleState(targetTimeMs: number): GhostInterpolatedState {
    const frames = this.replay.frames;
    const duration = Math.max(1, this.durationMs);
    const clampedTime = Math.max(0, Math.min(targetTimeMs, duration));
    const progress = clampedTime / duration;

    const defaultInputs: ReplayInput = { left: false, right: false, up: false, down: false, jump: false, action: false };

    if (!frames || frames.length === 0) {
      return {
        x: this.replay.initialState.x,
        y: this.replay.initialState.y,
        vx: 0,
        vy: 0,
        inputs: defaultInputs,
        currentTimeMs: clampedTime,
        durationMs: this.durationMs,
        progressRatio: progress,
        isFinished: clampedTime >= duration,
      };
    }

    if (frames.length === 1 || clampedTime <= frames[0].timestampMs) {
      const f = frames[0];
      return {
        x: f.position.x,
        y: f.position.y,
        vx: f.position.vx,
        vy: f.position.vy,
        facingRight: f.position.facingRight,
        inputs: f.inputs,
        currentTimeMs: clampedTime,
        durationMs: this.durationMs,
        progressRatio: progress,
        isFinished: false,
      };
    }

    const lastIdx = frames.length - 1;
    if (clampedTime >= frames[lastIdx].timestampMs) {
      const f = frames[lastIdx];
      return {
        x: f.position.x,
        y: f.position.y,
        vx: f.position.vx,
        vy: f.position.vy,
        facingRight: f.position.facingRight,
        inputs: f.inputs,
        currentTimeMs: clampedTime,
        durationMs: this.durationMs,
        progressRatio: 1.0,
        isFinished: true,
      };
    }

    // Binary search for surrounding frames f0 and f1
    let low = 0;
    let high = lastIdx;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (frames[mid].timestampMs <= clampedTime) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx0 = Math.max(0, high);
    const idx1 = Math.min(lastIdx, idx0 + 1);
    const f0 = frames[idx0];
    const f1 = frames[idx1];

    const timeSpan = f1.timestampMs - f0.timestampMs;
    const alpha = timeSpan > 0 ? (clampedTime - f0.timestampMs) / timeSpan : 0;

    // Linear lerp for positions
    const interpX = f0.position.x + (f1.position.x - f0.position.x) * alpha;
    const interpY = f0.position.y + (f1.position.y - f0.position.y) * alpha;
    const interpVx = f0.position.vx + (f1.position.vx - f0.position.vx) * alpha;
    const interpVy = f0.position.vy + (f1.position.vy - f0.position.vy) * alpha;
    const facingRight = alpha >= 0.5 ? f1.position.facingRight : f0.position.facingRight;

    return {
      x: Math.round(interpX * 10) / 10,
      y: Math.round(interpY * 10) / 10,
      vx: Math.round(interpVx),
      vy: Math.round(interpVy),
      facingRight,
      inputs: alpha >= 0.5 ? f1.inputs : f0.inputs,
      currentTimeMs: clampedTime,
      durationMs: this.durationMs,
      progressRatio: progress,
      isFinished: clampedTime >= duration,
    };
  }
}

/**
 * Phaser Scene Ghost Visual Container Handler
 * Manages the visual sprite, ethereal alpha pulse, and floating time label.
 * Strictly non-colliding (no physics body).
 */
export interface SceneGhostVisual {
  sprite: any;
  label: any;
  controller: GhostPlaybackController;
  destroy: () => void;
  update: (deltaMs: number) => void;
}

export function createSceneGhostVisual(
  scene: any,
  replay: ReplayData
): SceneGhostVisual | null {
  try {
    const controller = new GhostPlaybackController(replay);
    controller.start();

    const initialState = controller.sampleState(0);
    const textureKey = scene.textures?.exists('custom-asset-player')
      ? 'custom-asset-player'
      : scene.textures?.exists('player-sprite')
      ? 'player-sprite'
      : 'particle-sparkle';

    // Spawn purely decorative visual sprite (NO Arcade physics body!)
    const sprite = scene.add.sprite(initialState.x, initialState.y, textureKey);
    sprite.setDisplaySize(32, 32);
    sprite.setAlpha(0.55);
    sprite.setTint(0x38bdf8); // Sky cyan ethereal ghost tint
    sprite.setDepth(90);

    // Floating name/timer badge above ghost
    const playerName = replay.playerName || 'Ghost';
    const label = scene.add.text(initialState.x, initialState.y - 24, `[GHOST: ${playerName}]`, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#38bdf8',
      backgroundColor: '#020617',
      padding: { x: 4, y: 2 },
    });
    label.setOrigin(0.5);
    label.setAlpha(0.8);
    label.setDepth(91);

    // Ethereal subtle pulse tween
    const pulseTween = scene.tweens?.add({
      targets: sprite,
      alpha: 0.35,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const update = (deltaMs: number) => {
      const state = controller.update(deltaMs);
      sprite.setPosition(state.x, state.y);
      label.setPosition(state.x, state.y - 24);

      const sec = (state.currentTimeMs / 1000).toFixed(1);
      label.setText(`[GHOST: ${playerName} ${sec}s]`);

      if (state.facingRight !== undefined) {
        sprite.setFlipX(!state.facingRight);
      }

      if (state.isFinished) {
        sprite.setAlpha(0.2);
        label.setAlpha(0.3);
      }
    };

    const destroy = () => {
      pulseTween?.destroy();
      sprite?.destroy();
      label?.destroy();
      controller.stop();
    };

    return {
      sprite,
      label,
      controller,
      destroy,
      update,
    };
  } catch (err) {
    console.warn('[GhostPlayback] Failed to create visual ghost in scene:', err);
    return null;
  }
}
