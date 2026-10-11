import type {
  PlayerTelemetry,
  DeathEvent,
  DeathCluster,
} from './types.js';

export interface TelemetryTrackerInitData {
  spawnX: number;
  spawnY: number;
  goalX: number;
  goalY: number;
  totalCoins: number;
  totalSwitches: number;
}

const SPATIAL_CLUSTER_RADIUS = 90; // Pixels distance to consider deaths in the same obstacle cluster
const STUCK_ZONE_RADIUS = 120; // Pixels range to evaluate if player is stuck

export class TelemetryTracker {
  private telemetry: PlayerTelemetry;
  private goalX: number;
  private lastStuckAnchorX = 0;
  private lastStuckAnchorY = 0;
  private currentStuckDuration = 0;

  constructor(initData: TelemetryTrackerInitData) {
    this.goalX = initData.goalX || 800;
    this.lastStuckAnchorX = initData.spawnX;
    this.lastStuckAnchorY = initData.spawnY;

    this.telemetry = {
      deathCount: 0,
      consecutiveDeaths: 0,
      elapsedTimeSeconds: 0,
      lastDeathEvent: null,
      deathHistory: [],
      deathClusters: [],
      repeatedObstacleFailures: 0,
      playerX: initData.spawnX,
      playerY: initData.spawnY,
      spawnX: initData.spawnX,
      spawnY: initData.spawnY,
      maxProgressX: initData.spawnX,
      progressRatio: 0,
      timeStuckSeconds: 0,
      coinsCollected: 0,
      totalCoins: initData.totalCoins,
      switchesActivated: 0,
      totalSwitches: initData.totalSwitches,
      checkpointsReached: [],
      lastCheckpointPosition: null,
      coinsPerMinute: 0,
      hasDiedThisRun: false,
    };
  }

  /**
   * Updates player position and computes continuous progress and stuck state
   */
  public updatePlayerPosition(x: number, y: number, deltaSeconds: number): void {
    this.telemetry.playerX = x;
    this.telemetry.playerY = y;
    this.telemetry.elapsedTimeSeconds += deltaSeconds;

    // Track furthest progress along target axis toward goal
    if (x > this.telemetry.maxProgressX) {
      this.telemetry.maxProgressX = x;
    }

    // Compute progress ratio (0.0 to 1.0)
    const distanceTotal = Math.max(1, Math.abs(this.goalX - this.telemetry.spawnX));
    const distanceCovered = Math.max(0, x - this.telemetry.spawnX);
    this.telemetry.progressRatio = Math.min(1.0, Math.max(0, distanceCovered / distanceTotal));

    // Stuck detection: measure time spent within stuck zone radius without crossing max progress
    const distFromAnchor = Math.hypot(x - this.lastStuckAnchorX, y - this.lastStuckAnchorY);
    if (distFromAnchor > STUCK_ZONE_RADIUS) {
      // Made meaningful spatial movement
      this.lastStuckAnchorX = x;
      this.lastStuckAnchorY = y;
      this.currentStuckDuration = 0;
      this.telemetry.timeStuckSeconds = 0;
    } else {
      this.currentStuckDuration += deltaSeconds;
      this.telemetry.timeStuckSeconds = Math.round(this.currentStuckDuration);
    }

    // Update pacing metrics
    if (this.telemetry.elapsedTimeSeconds > 0) {
      this.telemetry.coinsPerMinute = (this.telemetry.coinsCollected / this.telemetry.elapsedTimeSeconds) * 60;
    }
  }

  /**
   * Records a player death event and updates spatial failure clustering
   */
  public recordDeath(cause: string, x: number, y: number, timestamp = Date.now()): DeathEvent {
    const deathEvent: DeathEvent = {
      x,
      y,
      cause,
      timestamp,
    };

    this.telemetry.deathCount++;
    this.telemetry.consecutiveDeaths++;
    this.telemetry.lastDeathEvent = deathEvent;
    this.telemetry.deathHistory.push(deathEvent);
    this.telemetry.hasDiedThisRun = true;

    // Update spatial cluster
    this.updateDeathClusters(deathEvent);

    return deathEvent;
  }

  /**
   * Records collectible pickup
   */
  public recordCoinCollected(): void {
    this.telemetry.coinsCollected++;
    // Collecting items resets consecutive obstacle failures slightly
    this.currentStuckDuration = 0;
    this.telemetry.timeStuckSeconds = 0;
  }

  /**
   * Records switch activation
   */
  public recordSwitchActivated(): void {
    this.telemetry.switchesActivated++;
    this.currentStuckDuration = 0;
    this.telemetry.timeStuckSeconds = 0;
  }

  /**
   * Records checkpoint reached (clears consecutive death counter)
   */
  public recordCheckpoint(id: string, x: number, y: number): void {
    if (!this.telemetry.checkpointsReached.includes(id)) {
      this.telemetry.checkpointsReached.push(id);
    }
    this.telemetry.lastCheckpointPosition = { x, y };
    this.telemetry.consecutiveDeaths = 0;
    this.telemetry.repeatedObstacleFailures = 0;
    this.lastStuckAnchorX = x;
    this.lastStuckAnchorY = y;
    this.currentStuckDuration = 0;
    this.telemetry.timeStuckSeconds = 0;
  }

  /**
   * Spatially groups deaths into obstacle clusters
   */
  private updateDeathClusters(event: DeathEvent): void {
    let matchedCluster: DeathCluster | null = null;

    for (const cluster of this.telemetry.deathClusters) {
      const distance = Math.hypot(cluster.centroidX - event.x, cluster.centroidY - event.y);
      if (distance <= SPATIAL_CLUSTER_RADIUS) {
        matchedCluster = cluster;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.count++;
      matchedCluster.lastDeathTime = event.timestamp;
      // Moving average of centroid
      matchedCluster.centroidX = (matchedCluster.centroidX * (matchedCluster.count - 1) + event.x) / matchedCluster.count;
      matchedCluster.centroidY = (matchedCluster.centroidY * (matchedCluster.count - 1) + event.y) / matchedCluster.count;
      this.telemetry.repeatedObstacleFailures = matchedCluster.count;
    } else {
      const newCluster: DeathCluster = {
        centroidX: event.x,
        centroidY: event.y,
        count: 1,
        firstDeathTime: event.timestamp,
        lastDeathTime: event.timestamp,
        primaryCause: event.cause,
      };
      this.telemetry.deathClusters.push(newCluster);
      this.telemetry.repeatedObstacleFailures = 1;
    }
  }

  /**
   * Returns a snapshot of current telemetry data
   */
  public getSnapshot(): Readonly<PlayerTelemetry> {
    return { ...this.telemetry };
  }

  /**
   * Resets session counters on fresh restart
   */
  public resetSession(keepCumulative = false): void {
    if (!keepCumulative) {
      this.telemetry.deathCount = 0;
      this.telemetry.deathHistory = [];
      this.telemetry.deathClusters = [];
    }
    this.telemetry.consecutiveDeaths = 0;
    this.telemetry.repeatedObstacleFailures = 0;
    this.telemetry.timeStuckSeconds = 0;
    this.telemetry.elapsedTimeSeconds = 0;
    this.telemetry.coinsCollected = 0;
    this.telemetry.switchesActivated = 0;
    this.telemetry.checkpointsReached = [];
    this.telemetry.hasDiedThisRun = false;
    this.telemetry.progressRatio = 0;
    this.telemetry.maxProgressX = this.telemetry.spawnX;
    this.currentStuckDuration = 0;
  }
}
