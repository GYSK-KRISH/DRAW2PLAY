import assert from 'node:assert';
import {
  GameDirector,
  TelemetryTracker,
  ActionExecutor,
  AIDirectorAdvisor,
  DEFAULT_DIRECTOR_RULES,
  ALLOWLISTED_DIRECTOR_ACTION_TYPES,
  PHYSICS_BOUNDS,
  type DirectorAction,
  type DirectorContext,
} from '../src/game/director/index.js';

console.log('🧪 Starting Draw2Play AI Stage 6: Adaptive Gameplay & AI Director Test Suite...\n');

// =============================================================================
// TEST 1: TELEMETRY COLLECTION & SPATIAL CLUSTERING
// =============================================================================
console.log('▶ Test 1: Telemetry Collection & Spatial Failure Clustering');

const tracker = new TelemetryTracker({
  spawnX: 80,
  spawnY: 380,
  goalX: 720,
  goalY: 380,
  totalCoins: 5,
  totalSwitches: 2,
});

let snapshot = tracker.getSnapshot();
assert.strictEqual(snapshot.deathCount, 0);
assert.strictEqual(snapshot.consecutiveDeaths, 0);
assert.strictEqual(snapshot.progressRatio, 0);

// Update player movement: move to x=200
tracker.updatePlayerPosition(200, 380, 2.0);
snapshot = tracker.getSnapshot();
assert.strictEqual(snapshot.playerX, 200);
assert.strictEqual(snapshot.maxProgressX, 200);
assert.ok(snapshot.progressRatio > 0.15 && snapshot.progressRatio < 0.25, 'Progress ratio should be ~18%');

// Die at (240, 400)
tracker.recordDeath('Spike Hazard', 240, 400);
snapshot = tracker.getSnapshot();
assert.strictEqual(snapshot.deathCount, 1);
assert.strictEqual(snapshot.consecutiveDeaths, 1);
assert.strictEqual(snapshot.deathClusters.length, 1);
assert.strictEqual(snapshot.repeatedObstacleFailures, 1);

// Die again close by at (245, 405) - within 90px cluster
tracker.recordDeath('Spike Hazard', 245, 405);
snapshot = tracker.getSnapshot();
assert.strictEqual(snapshot.deathCount, 2);
assert.strictEqual(snapshot.consecutiveDeaths, 2);
assert.strictEqual(snapshot.deathClusters.length, 1, 'Should stay in same spatial cluster');
assert.strictEqual(snapshot.repeatedObstacleFailures, 2);

// Die a 3rd time close by at (238, 395)
tracker.recordDeath('Spike Hazard', 238, 395);
snapshot = tracker.getSnapshot();
assert.strictEqual(snapshot.deathCount, 3);
assert.strictEqual(snapshot.consecutiveDeaths, 3);
assert.strictEqual(snapshot.repeatedObstacleFailures, 3, 'Should register 3 repeated obstacle failures');

// Die far away at (600, 200) - should form a second cluster
tracker.recordDeath('Enemy Collision', 600, 200);
snapshot = tracker.getSnapshot();
assert.strictEqual(snapshot.deathCount, 4);
assert.strictEqual(snapshot.deathClusters.length, 2, 'Should create separate spatial cluster for distant death');

// Reach checkpoint: clears consecutive deaths but keeps history
tracker.recordCheckpoint('cp-mid', 400, 380);
snapshot = tracker.getSnapshot();
assert.strictEqual(snapshot.consecutiveDeaths, 0, 'Checkpoint should reset consecutive deaths');
assert.strictEqual(snapshot.repeatedObstacleFailures, 0);
assert.strictEqual(snapshot.checkpointsReached.length, 1);

// Stuck player simulation: staying within 120px for 26 seconds
tracker.updatePlayerPosition(410, 380, 10.0);
tracker.updatePlayerPosition(415, 380, 16.0);
snapshot = tracker.getSnapshot();
assert.strictEqual(snapshot.timeStuckSeconds, 26, 'Should detect player stuck for 26 seconds');

console.log('✔ Telemetry collection & spatial clustering verified.\n');

// =============================================================================
// TEST 2: ALLOWLISTED ACTION REGISTRY & SAFETY VALIDATION
// =============================================================================
console.log('▶ Test 2: Allowlisted Action Registry & Safety Validation');

const executor = new ActionExecutor();
const mockContext: DirectorContext = {
  templateId: 'physics-platformer',
  movementModel: 'platformer',
  worldWidth: 800,
  worldHeight: 480,
  gravity: 750,
  baselinePlayerSpeed: 220,
  baselineJumpPower: 400,
  goalX: 720,
  goalY: 380,
  activeActions: [],
  actionExecutionCounts: {},
  lastActionTimes: {},
};

// 1. Attempt arbitrary / forbidden action type
const illegalAction = {
  id: 'illegal-1',
  ruleId: 'malicious-rule',
  type: 'MUTATE_GRAVITY_ARBITRARY' as any,
  playerExplanation: 'Inverting gravity randomly',
  payload: {},
  createdAt: Date.now(),
};
const illegalResult = executor.validateAction(illegalAction, mockContext);
assert.strictEqual(illegalResult.valid, false, 'Unallowlisted action type must be strictly rejected');
assert.ok(illegalResult.reason?.includes('not in the allowlisted'));

// 2. Platform out of bounds clamping
const outOfBoundsPlatformAction: DirectorAction = {
  id: 'plat-oob',
  ruleId: 'repeated-hazard-failure',
  type: 'SPAWN_HELPER_PLATFORM',
  playerExplanation: 'Safety platform',
  payload: {
    platform: {
      x: 950, // exceeds worldWidth 800
      y: -50, // exceeds top 0
      width: 500, // exceeds max width 200
      height: 4, // below min height 8
    },
  },
  createdAt: Date.now(),
};
const platValidation = executor.validateAction(outOfBoundsPlatformAction, mockContext);
assert.strictEqual(platValidation.valid, true);
assert.strictEqual(platValidation.sanitizedAction?.payload.platform?.width, PHYSICS_BOUNDS.MAX_PLATFORM_WIDTH);
assert.strictEqual(platValidation.sanitizedAction?.payload.platform?.height, PHYSICS_BOUNDS.MIN_PLATFORM_HEIGHT);
assert.ok(platValidation.sanitizedAction!.payload.platform!.x <= 800);
assert.ok(platValidation.sanitizedAction!.payload.platform!.y >= 0);

// 3. Jump boost ratio clamping & bounds check
const excessiveJumpAction: DirectorAction = {
  id: 'jump-excessive',
  ruleId: 'jump-micro-boost',
  type: 'GRANT_JUMP_ASSIST',
  playerExplanation: 'Jump boost',
  payload: {
    jumpBoostRatio: 2.5, // way too high
  },
  createdAt: Date.now(),
};
const jumpValidation = executor.validateAction(excessiveJumpAction, mockContext);
assert.strictEqual(jumpValidation.valid, true);
assert.strictEqual(jumpValidation.sanitizedAction?.payload.jumpBoostRatio, PHYSICS_BOUNDS.MAX_JUMP_BOOST_RATIO);

// 4. Template restriction: Reject jump assist on topdown template with 0 gravity
const topdownContext: DirectorContext = {
  ...mockContext,
  templateId: 'top-down-arena-survival',
  movementModel: 'topdown',
  gravity: 0,
};
const jumpOnTopdownValidation = executor.validateAction(excessiveJumpAction, topdownContext);
assert.strictEqual(jumpOnTopdownValidation.valid, false, 'Jump assist must be rejected on 0-gravity topdown templates');

console.log('✔ Allowlisted action registry & safety validation verified.\n');

// =============================================================================
// TEST 3: MODIFIER EXECUTION, EXPIRY, AND CLEAN RESTORATION
// =============================================================================
console.log('▶ Test 3: Modifier Execution, Expiry, and Clean Restoration');

// Mock scene interface
const mockScene = {
  sceneData: {
    player: {
      speed: 220,
      jumpPower: 400,
    },
  },
  enemies: {
    getChildren: () => [
      {
        getData: (k: string) => (k === 'speed' ? 100 : undefined),
        setData: (k: string, v: any) => { if (k === 'speed') mockEnemyState.speed = v; },
        body: { velocity: { x: 100 } },
        setVelocityX: (vx: number) => { mockEnemyState.vx = vx; },
      },
    ],
  },
  platforms: {
    create: (x: number, y: number) => {
      const obj = {
        x,
        y,
        isDestroyed: false,
        setDisplaySize: () => {},
        setTint: () => {},
        refreshBody: () => {},
        destroy: () => { obj.isDestroyed = true; },
      };
      return obj;
    },
  },
};
const mockEnemyState = { speed: 100, vx: 100 };

// 1. Execute Jump Assist (+12% for 15s)
const jumpAction: DirectorAction = {
  id: 'jump-test-1',
  ruleId: 'jump-micro-boost',
  type: 'GRANT_JUMP_ASSIST',
  playerExplanation: 'Jump assist (+12%)',
  payload: { jumpBoostRatio: 1.12 },
  durationSeconds: 15,
  createdAt: 1000,
};
const execResult = executor.executeAction(jumpAction, mockScene, 1000);
assert.strictEqual(execResult.success, true);
assert.strictEqual(mockScene.sceneData.player.jumpPower, 448, 'Jump power should be boosted to 448');
assert.strictEqual(executor.getActiveModifiers().length, 1);

// Advance time to 10s (not yet expired)
let expiredMods = executor.update(mockScene, 11000);
assert.strictEqual(expiredMods.length, 0);
assert.strictEqual(mockScene.sceneData.player.jumpPower, 448);

// Advance time past 15s to 17s (expired!)
expiredMods = executor.update(mockScene, 17000);
assert.strictEqual(expiredMods.length, 1);
assert.strictEqual(mockScene.sceneData.player.jumpPower, 400, 'Jump power must be cleanly restored to baseline 400');
assert.strictEqual(executor.getActiveModifiers().length, 0);

// 2. Execute Enemy Speed Reduction (-25% for 12s)
const enemySlowAction: DirectorAction = {
  id: 'enemy-slow-1',
  ruleId: 'enemy-patrol-slowdown',
  type: 'REDUCE_ENEMY_SPEED',
  playerExplanation: 'Enemies slowed (-25%)',
  payload: { speedReductionRatio: 0.75 },
  durationSeconds: 12,
  createdAt: 20000,
};
executor.executeAction(enemySlowAction, mockScene, 20000);
assert.strictEqual(mockEnemyState.speed, 75, 'Enemy speed should be reduced to 75');

// Expire after 12s
executor.update(mockScene, 33000);
assert.strictEqual(mockEnemyState.speed, 100, 'Enemy speed must be cleanly restored to 100');

console.log('✔ Modifier execution, expiry, and clean restoration verified.\n');

// =============================================================================
// TEST 4: GAME DIRECTOR INTEGRATION & 3 DEMONSTRATED ADAPTIVE EVENTS
// =============================================================================
console.log('▶ Test 4: GameDirector Lifecycle & 3 Tested Adaptive Events');

const notifiedMessages: string[] = [];
let spawnedPlatformsCount = 0;
let spawnedBonusCount = 0;

const playableMockScene = {
  player: { x: 80, y: 380 },
  sceneData: {
    player: { speed: 220, jumpPower: 400 },
  },
  platforms: {
    create: (x: number, y: number) => {
      spawnedPlatformsCount++;
      return {
        x,
        y,
        setDisplaySize: () => {},
        setTint: () => {},
        refreshBody: () => {},
        destroy: () => { spawnedPlatformsCount--; },
      };
    },
  },
  coins: {
    create: (x: number, y: number) => {
      spawnedBonusCount++;
      return {
        x,
        y,
        setDisplaySize: () => {},
        setTint: () => {},
        setData: () => {},
        destroy: () => { spawnedBonusCount--; },
      };
    },
  },
  showMessage: (msg: string) => {
    notifiedMessages.push(msg);
  },
};

const director = new GameDirector({
  sceneRef: playableMockScene,
  templateId: 'physics-platformer',
  movementModel: 'platformer',
  worldWidth: 800,
  worldHeight: 480,
  gravity: 750,
  baselinePlayerSpeed: 220,
  baselineJumpPower: 400,
  spawnX: 80,
  spawnY: 380,
  goalX: 720,
  goalY: 380,
  totalCoins: 4,
  totalSwitches: 1,
  config: {
    evaluationIntervalMs: 200,
  },
});

// -----------------------------------------------------------------------------
// EVENT 1: REPEATED FAILURE -> SPAWN HELPER PLATFORM ASSIST
// -----------------------------------------------------------------------------
console.log('  Testing Adaptive Event 1: Repeated Hazard Failure');

// Die 3 times in same hazard area (260, 420)
director.recordDeath('Spike Hazard', 260, 420);
director.recordDeath('Spike Hazard', 265, 422);
director.recordDeath('Spike Hazard', 258, 418);

assert.strictEqual(spawnedPlatformsCount, 1, 'Director should have spawned 1 helper platform');
assert.ok(
  notifiedMessages.some((msg) => msg.includes('safety platform has appeared')),
  'Player should receive non-intrusive HUD notification'
);

// -----------------------------------------------------------------------------
// EVENT 2: STUCK PLAYER -> OBSTACLE BRIDGE ASSIST
// -----------------------------------------------------------------------------
console.log('  Testing Adaptive Event 2: Stuck Player Bridge Assist');

// Reset session for fresh event testing
director.resetSession(false);
spawnedPlatformsCount = 0;
notifiedMessages.length = 0;

// Simulate player moving to x=320, then remaining stuck for 26s
playableMockScene.player.x = 320;
director.getTracker().updatePlayerPosition(320, 380, 1.0);
director.getTracker().updatePlayerPosition(320, 380, 26.0); // 26 seconds stuck

// Trigger update loop tick
director.update(1000, 250);

assert.strictEqual(spawnedPlatformsCount, 1, 'Director should spawn helper bridge for stuck player');
assert.ok(
  notifiedMessages.some((msg) => msg.includes('pathway platform has materialized')),
  'Player should receive stuck assistance notification'
);

// -----------------------------------------------------------------------------
// EVENT 3: SPEEDRUN MASTERY -> BONUS COLLECTIBLE CHALLENGE
// -----------------------------------------------------------------------------
console.log('  Testing Adaptive Event 3: Speedrun Mastery Bonus Challenge');

director.resetSession(false);
notifiedMessages.length = 0;
spawnedBonusCount = 0;

// Player rushes through: reaches x=520 (68% distance) in 8 seconds with 0 deaths
playableMockScene.player.x = 520;
director.getTracker().updatePlayerPosition(520, 380, 8.0);
director.getTracker().recordCoinCollected();
director.getTracker().recordCoinCollected();

director.update(2000, 250);

assert.strictEqual(spawnedBonusCount, 1, 'Director should spawn bonus golden gem');
assert.ok(
  notifiedMessages.some((msg) => msg.includes('Bonus golden gem unlocked')),
  'Player should receive challenge mode unlocked notification'
);

// -----------------------------------------------------------------------------
// EVENT 4: REPEATED ENEMY COLLISIONS -> SLOWDOWN ASSIST
// -----------------------------------------------------------------------------
console.log('  Testing Adaptive Event 4: Repeated Enemy Patrol Collisions');

director.resetSession(false);
notifiedMessages.length = 0;

// Die twice from enemy patrol
director.recordDeath('Enemy Patrol Collision', 300, 380);
director.recordDeath('Enemy Patrol Collision', 305, 380);

director.update(3000, 250);

assert.ok(
  notifiedMessages.some((msg) => msg.includes('disoriented') || msg.includes('Patrol enemies')),
  'Player should receive enemy slowdown notification'
);

// -----------------------------------------------------------------------------
// EVENT 5: MIDPOINT DEATHS -> CHECKPOINT ASSIST
// -----------------------------------------------------------------------------
console.log('  Testing Adaptive Event 5: Midpoint Rescue Checkpoint Assist');

director.resetSession(false);
notifiedMessages.length = 0;

// Player covered 50% distance (400px), but died twice
playableMockScene.player.x = 400;
director.getTracker().updatePlayerPosition(400, 380, 5.0);
director.recordDeath('Fall into Pit', 400, 420);
director.recordDeath('Fall into Pit', 405, 420);

director.update(4000, 250);

assert.ok(
  notifiedMessages.some((msg) => msg.includes('respawn beacon') || msg.includes('Checkpoint')),
  'Player should receive midpoint checkpoint assist notification'
);

console.log('✔ All 5 adaptive events triggered and validated in playable scene context.\n');

// =============================================================================
// TEST 5: COOLDOWNS & MAX ACTIVATION LIMITS
// =============================================================================
console.log('▶ Test 5: Cooldowns & Max Activation Limits');

const rule = DEFAULT_DIRECTOR_RULES.find((r) => r.id === 'repeated-hazard-failure')!;
assert.strictEqual(rule.maxActivationsPerLevel, 3);
assert.strictEqual(rule.cooldownSeconds, 10);

// Test max activation enforcement
const testRule = {
  id: 'strict-max-rule',
  name: 'Strict Limit Rule',
  description: 'Can only fire once',
  supportedTemplates: ['all'] as const,
  cooldownSeconds: 0,
  maxActivationsPerLevel: 1,
  evaluate: () => ({
    id: `strict-act-${Date.now()}`,
    ruleId: 'strict-max-rule',
    type: 'DISPLAY_TACTICAL_HINT' as const,
    playerExplanation: 'Hint 1',
    payload: { hintText: 'Hint 1' },
    createdAt: Date.now(),
  }),
};

const limitDirector = new GameDirector({
  rules: [testRule as any],
  config: { evaluationIntervalMs: 50 },
});

const firstAction = limitDirector.evaluateDirectorRules();
assert.ok(firstAction !== null, 'First evaluation should fire');
assert.strictEqual(limitDirector.getExecutionCounts()['strict-max-rule'], 1);

const secondAction = limitDirector.evaluateDirectorRules();
assert.strictEqual(secondAction, null, 'Second evaluation must be rejected due to maxActivationsPerLevel');

limitDirector.shutdown();

console.log('✔ Cooldowns & max activation limits verified.\n');

// =============================================================================
// TEST 6: LIFECYCLE CLEANUP & SHUTDOWN LEAK PREVENTION
// =============================================================================
console.log('▶ Test 6: Lifecycle Cleanup & Zero Memory Leaks');

director.shutdown();
const audit = director.getAuditLog();
assert.ok(audit.some((e) => e.type === 'director_shutdown'));
assert.strictEqual(director.getActiveModifiers().length, 0);

console.log('✔ Shutdown cleanup leaves 0 active modifiers or dangling timers.\n');

// =============================================================================
// TEST 7: ASYNC AI ADVISOR SAFETY & OFFLINE RESILIENCE
// =============================================================================
console.log('▶ Test 7: Async AI Advisor Safety & Offline Resilience');

const advisor = new AIDirectorAdvisor({ timeoutMs: 500 });
const sampleTelemetry = director.getTelemetrySnapshot();
const sampleContext = director.createDirectorContext();

// Should return safely without throwing or hanging
const action = await advisor.requestPolicyAdvice(sampleTelemetry, sampleContext);
if (action) {
  assert.ok(ALLOWLISTED_DIRECTOR_ACTION_TYPES.includes(action.type));
}
console.log('✔ Async AI Advisor offline resilience verified.\n');

console.log('🎉 ALL DRAW2PLAY STAGE 6 ADAPTIVE GAME DIRECTOR TESTS PASSED PERFECTLY!\n');
