import type {
  ReplayData,
  ReplayFrame,
  ReplayEvent,
  ReplayInput,
  ReplayPosition,
} from '../../types/replay.js';
import type { GameTemplateId } from '../../types/plan.js';

export interface RecorderStartOptions {
  levelId: string;
  levelVersion?: number;
  gamePlanSchemaVersion?: string;
  templateId?: GameTemplateId;
  seed?: number;
  initialX: number;
  initialY: number;
  playerName?: string;
}

/**
 * Stage 8: ReplayRecorder
 * Manages the recording lifecycle of a playthrough with strict safety bounds.
 * Samples inputs and position synchronization markers at controlled intervals.
 */
export class ReplayRecorder {
  private active = false;
  private levelId = '';
  private levelVersion = 1;
  private gamePlanSchemaVersion = '2.0';
  private templateId: GameTemplateId = 'physics-platformer';
  private seed = 42;
  private playerName = 'Player';
  private initialX = 0;
  private initialY = 0;

  private startTime = 0;
  private currentTick = 0;
  private frames: ReplayFrame[] = [];
  private events: ReplayEvent[] = [];

  // Safety bounds
  public static readonly MAX_DURATION_MS = 600000; // 10 minutes
  public static readonly MAX_FRAMES = 36000;       // 60 fps * 600 sec
  public static readonly SAMPLE_INTERVAL_MS = 33;  // ~30 Hz sampling to keep size compact (<1.5MB)
  private lastSampleTime = 0;

  public start(opts: RecorderStartOptions): void {
    this.active = true;
    this.levelId = opts.levelId;
    this.levelVersion = opts.levelVersion ?? 1;
    this.gamePlanSchemaVersion = opts.gamePlanSchemaVersion ?? '2.0';
    this.templateId = opts.templateId ?? 'physics-platformer';
    this.seed = opts.seed ?? 42;
    this.initialX = opts.initialX;
    this.initialY = opts.initialY;
    this.playerName = opts.playerName ?? 'Player';

    this.startTime = Date.now();
    this.lastSampleTime = 0;
    this.currentTick = 0;
    this.frames = [];
    this.events = [];

    // Initial frame
    this.frames.push({
      tick: 0,
      timestampMs: 0,
      inputs: { left: false, right: false, up: false, down: false, jump: false, action: false },
      position: { x: this.initialX, y: this.initialY, vx: 0, vy: 0 },
    });

    this.recordEvent('level_start', undefined, { templateId: this.templateId });
  }

  public recordTick(
    timestampMs: number,
    inputs: ReplayInput,
    position: ReplayPosition,
    forceCheck: boolean = false
  ): boolean {
    if (!this.active) return false;

    // Check bounds
    if (timestampMs > ReplayRecorder.MAX_DURATION_MS || this.frames.length >= ReplayRecorder.MAX_FRAMES) {
      return false;
    }

    // Rate-limit sampling unless forced or inputs changed
    const timeDelta = timestampMs - this.lastSampleTime;
    const lastFrame = this.frames[this.frames.length - 1];
    const inputsChanged =
      !lastFrame ||
      lastFrame.inputs.left !== inputs.left ||
      lastFrame.inputs.right !== inputs.right ||
      lastFrame.inputs.up !== inputs.up ||
      lastFrame.inputs.down !== inputs.down ||
      lastFrame.inputs.jump !== inputs.jump ||
      lastFrame.inputs.action !== inputs.action;

    if (!forceCheck && !inputsChanged && timeDelta < ReplayRecorder.SAMPLE_INTERVAL_MS) {
      return true;
    }

    this.currentTick++;
    this.lastSampleTime = timestampMs;

    this.frames.push({
      tick: this.currentTick,
      timestampMs: Math.round(timestampMs),
      inputs: { ...inputs },
      position: {
        x: Math.round(position.x * 10) / 10,
        y: Math.round(position.y * 10) / 10,
        vx: Math.round(position.vx),
        vy: Math.round(position.vy),
        facingRight: position.facingRight,
      },
    });

    return true;
  }

  public recordEvent(
    type: ReplayEvent['type'],
    entityId?: string,
    details?: Record<string, any>,
    timestampMs?: number
  ): void {
    if (!this.active && type !== 'level_start') return;
    const t = timestampMs ?? (this.frames.length > 0 ? this.frames[this.frames.length - 1].timestampMs : 0);

    this.events.push({
      timestampMs: Math.max(0, Math.round(t)),
      type,
      entityId,
      details,
    });
  }

  public finalize(
    completed: boolean,
    finalScore: number,
    coinsCollected: number,
    deaths: number,
    endReason: 'goal_reached' | 'time_out' | 'died' | 'abandoned',
    finalTimestampMs?: number
  ): ReplayData {
    const durationMs =
      finalTimestampMs !== undefined
        ? finalTimestampMs
        : this.frames.length > 0
        ? this.frames[this.frames.length - 1].timestampMs
        : Date.now() - this.startTime;

    if (completed) {
      this.recordEvent('goal_reached', undefined, { finalScore }, durationMs);
    } else if (endReason === 'died') {
      this.recordEvent('hazard_death', undefined, {}, durationMs);
    }

    this.active = false;

    const replayData: ReplayData = {
      schemaVersion: '1.0',
      replayId: `replay-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      levelId: this.levelId,
      levelVersion: this.levelVersion,
      gamePlanSchemaVersion: this.gamePlanSchemaVersion,
      templateId: this.templateId,
      engineVersion: 'phaser-4.2.1',
      seed: this.seed,
      playbackMode: 'position-interpolated-ghost',
      initialState: {
        x: this.initialX,
        y: this.initialY,
        vx: 0,
        vy: 0,
      },
      frames: this.frames,
      events: this.events,
      summary: {
        durationMs: Math.round(durationMs),
        finalScore,
        coinsCollected,
        deaths,
        completed,
        endReason,
      },
      recordedAt: new Date().toISOString(),
      playerName: this.playerName,
    };

    return replayData;
  }

  public isRecording(): boolean {
    return this.active;
  }

  public getFrameCount(): number {
    return this.frames.length;
  }

  public reset(): void {
    this.active = false;
    this.frames = [];
    this.events = [];
  }
}
