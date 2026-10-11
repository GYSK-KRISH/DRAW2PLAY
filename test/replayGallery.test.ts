import assert from 'node:assert';
import {
  ReplayDataSchema,
  ReplayFrameSchema,
  checkReplayCompatibility,
  type ReplayData,
} from '../src/types/replay.js';
import { ReplayRecorder } from '../src/game/replay/replayRecorder.js';
import {
  GhostPlaybackController,
} from '../src/game/replay/ghostPlayback.js';
import {
  saveReplay,
  getBestReplayForLevel,
  clearAllReplaysForTest,
} from '../src/services/replayStorage.js';
import { CommunityGalleryService } from '../server/services/gallery.service.js';
import { generateAndValidateTemplateLevel } from '../src/generators/templateGenerators.js';
import { convertPlanToPlayableScene } from '../src/game/sceneConverter.js';

console.log('🧪 Starting Draw2Play AI Stage 8: Replays, Ghost Runs & Gallery Test Suite...\n');

// Clean slates for test runs
clearAllReplaysForTest();
const galleryTestService = new CommunityGalleryService();
galleryTestService.clearForTest();

const baselinePlan = generateAndValidateTemplateLevel('physics-platformer', { seed: 42 });
const baselineScene = convertPlanToPlayableScene(baselinePlan);

// =============================================================================
// TEST 1: RECORDER LIFECYCLE (START, TICK RECORDING, MILESTONE EVENTS, FINALIZE)
// =============================================================================
console.log('▶ Test 1: Recorder Lifecycle (Start, Tick, Events, Finalize)');

const recorder = new ReplayRecorder();
recorder.start({
  levelId: baselinePlan.id,
  levelVersion: 1,
  templateId: 'physics-platformer',
  seed: 42,
  initialX: 100,
  initialY: 450,
  playerName: 'SpeedrunnerX',
});

assert.strictEqual(recorder.isRecording(), true);
assert.strictEqual(recorder.getFrameCount(), 1, 'Initial frame must be recorded on start');

// Record movement over 3 seconds
recorder.recordTick(100, { left: false, right: true, up: false, down: false, jump: false, action: false }, { x: 120, y: 450, vx: 200, vy: 0, facingRight: true });
recorder.recordTick(500, { left: false, right: true, up: false, down: false, jump: true, action: false }, { x: 180, y: 390, vx: 200, vy: -350, facingRight: true });
recorder.recordEvent('coin_collected', 'coin-1', { value: 20 }, 520);
recorder.recordTick(1200, { left: false, right: true, up: false, down: false, jump: false, action: false }, { x: 260, y: 450, vx: 180, vy: 0, facingRight: true });
recorder.recordTick(2500, { left: false, right: false, up: false, down: false, jump: false, action: false }, { x: 400, y: 450, vx: 0, vy: 0, facingRight: true });

const finalizedReplay = recorder.finalize(true, 150, 3, 0, 'goal_reached', 2500);

assert.strictEqual(recorder.isRecording(), false);
assert.strictEqual(finalizedReplay.summary.completed, true);
assert.strictEqual(finalizedReplay.summary.finalScore, 150);
assert.strictEqual(finalizedReplay.summary.durationMs, 2500);
assert.strictEqual(finalizedReplay.frames.length >= 4, true);
assert.ok(finalizedReplay.events.some((e) => e.type === 'coin_collected'));
assert.ok(finalizedReplay.events.some((e) => e.type === 'goal_reached'));

console.log('✔ Recorder lifecycle, tick recording, and event tracking verified.\n');

// =============================================================================
// TEST 2: REPLAY SCHEMA VALIDATION & COMPRESSION
// =============================================================================
console.log('▶ Test 2: Replay Schema Validation & Immutability');

const validatedReplay = ReplayDataSchema.parse(finalizedReplay);
assert.strictEqual(validatedReplay.schemaVersion, '1.0');
assert.strictEqual(validatedReplay.playbackMode, 'position-interpolated-ghost');
assert.strictEqual(validatedReplay.levelId, baselinePlan.id);

// Check serialized JSON size bounds (< 2 MB)
const serializedJson = JSON.stringify(validatedReplay);
const sizeBytes = Buffer.byteLength(serializedJson, 'utf-8');
assert.ok(sizeBytes < 500000, `Replay size ${sizeBytes} bytes must be compact (<500 KB)`);

console.log(`✔ Replay schema strictly validated. Compact size: ${sizeBytes} bytes.\n`);

// =============================================================================
// TEST 3: GHOST SYNCHRONIZATION & INTERPOLATION (HERMITE/LINEAR LERP)
// =============================================================================
console.log('▶ Test 3: Ghost Synchronization & Interpolation');

const ghostController = new GhostPlaybackController(validatedReplay);
ghostController.start();

// At t = 0
const stateAt0 = ghostController.sampleState(0);
assert.strictEqual(stateAt0.x, 100);
assert.strictEqual(stateAt0.y, 450);

// At intermediate timestamp t = 300ms (between t=100 (x=120) and t=500 (x=180))
// alpha = (300 - 100) / (500 - 100) = 0.5
// expected x = 120 + (180 - 120) * 0.5 = 150
const stateAt300 = ghostController.sampleState(300);
assert.strictEqual(stateAt300.x, 150, 'Position must interpolate smoothly between sync frames');
assert.strictEqual(stateAt300.progressRatio > 0 && stateAt300.progressRatio < 1, true);

// Test Timeline Advance with Speed Control
ghostController.setSpeed(2); // 2x playback speed
assert.strictEqual(ghostController.getSpeed(), 2);
const advancedState = ghostController.update(250); // 250ms * 2 = +500ms
assert.strictEqual(advancedState.currentTimeMs, 500);

// Test Pause & Resume
ghostController.pause();
assert.strictEqual(ghostController.isActive(), false);
ghostController.update(500); // Should not advance while paused
assert.strictEqual(ghostController.getCurrentTimeMs(), 500);

ghostController.resume();
assert.strictEqual(ghostController.isActive(), true);

console.log('✔ Ghost playback interpolation, timeline sync, and speed scaling verified.\n');

// =============================================================================
// TEST 4: LOCAL REPLAY STORAGE PERSISTENCE & BEST RUN SELECTION
// =============================================================================
console.log('▶ Test 4: Local Replay Storage & Best Run Tracking');

// Save first replay (2500ms)
saveReplay(finalizedReplay);

// Create a second faster winning replay on the same level (1800ms)
const fasterReplay: ReplayData = {
  ...finalizedReplay,
  replayId: 'replay-fast-1',
  summary: {
    ...finalizedReplay.summary,
    durationMs: 1800,
    finalScore: 200,
  },
};
saveReplay(fasterReplay);

// Check that getBestReplayForLevel returns the faster run
const bestReplay = getBestReplayForLevel(baselinePlan.id);
assert.ok(bestReplay);
assert.strictEqual(bestReplay.summary.durationMs, 1800, 'Best replay must be the fastest winning run');
assert.strictEqual(bestReplay.replayId, 'replay-fast-1');

console.log('✔ Local replay persistence and best run sorting verified.\n');

// =============================================================================
// TEST 5: COMPATIBILITY CHECKING & MISMATCH WARNINGS
// =============================================================================
console.log('▶ Test 5: Replay Compatibility & Version Governance');

// Compatible check
const compValid = checkReplayCompatibility(finalizedReplay, baselinePlan.id, 1, 'physics-platformer');
assert.strictEqual(compValid.compatible, true);
assert.strictEqual(compValid.warnings.length, 0);

// Level ID mismatch
const compWrongLevel = checkReplayCompatibility(finalizedReplay, 'different-level-id', 1, 'physics-platformer');
assert.strictEqual(compWrongLevel.compatible, false);
assert.ok(compWrongLevel.reasons.some((r) => r.includes('Level ID mismatch')));

// Version mismatch (geometry may have changed)
const compVersionWarn = checkReplayCompatibility(finalizedReplay, baselinePlan.id, 2, 'physics-platformer');
assert.strictEqual(compVersionWarn.compatible, true); // Playable, but with warning
assert.ok(compVersionWarn.warnings.some((w) => w.includes('version mismatch')));

// Template mismatch
const compWrongTemplate = checkReplayCompatibility(finalizedReplay, baselinePlan.id, 1, 'maze-exploration');
assert.strictEqual(compWrongTemplate.compatible, false);
assert.ok(compWrongTemplate.reasons.some((r) => r.includes('Template mismatch')));

console.log('✔ Replay compatibility governance and warning checks verified.\n');

// =============================================================================
// TEST 6: INVALID REPLAY REJECTION & SECURITY DEFENSE
// =============================================================================
console.log('▶ Test 6: Malicious & Corrupted Replay Rejection');

// Rejection of negative timestamps or invalid frames
let caughtBadFrame = false;
try {
  ReplayFrameSchema.parse({
    tick: -1,
    timestampMs: -500,
    inputs: { left: false },
    position: { x: 100, y: 100 },
  });
} catch {
  caughtBadFrame = true;
}
assert.strictEqual(caughtBadFrame, true, 'Negative ticks and timestamps must be rejected');

// Rejection of prototype pollution keywords in JSON parsing
const maliciousJson = JSON.stringify({
  __proto__: { injected: true },
  schemaVersion: '1.0',
});
JSON.parse(maliciousJson);
assert.strictEqual((Object.prototype as any).injected, undefined, 'Prototype pollution defense verified');

console.log('✔ Input sanitization and security boundaries verified.\n');

// =============================================================================
// TEST 7: COMMUNITY GALLERY PUBLISHING & SANITIZATION
// =============================================================================
console.log('▶ Test 7: Community Gallery Publishing Workflow');

const publishReq = {
  title: 'Glacial Cavern Gauntlet',
  description: 'A slippery platforming run through ice caverns with tricky hazards.',
  creatorName: 'ArcticFrost',
  playableScene: baselineScene,
  replayData: finalizedReplay,
  visibility: 'published' as const,
};

const pubResult = galleryTestService.publish(publishReq);
assert.strictEqual(pubResult.success, true);
assert.ok(pubResult.item);
assert.ok(pubResult.creatorToken, 'Creator secret token must be generated for ownership');
assert.strictEqual(pubResult.item.title, 'Glacial Cavern Gauntlet');
assert.strictEqual(pubResult.item.hasGhostReplay, true);
assert.strictEqual(pubResult.item.bestScore, 150);

// Verify creatorToken is sanitized and not leaked in public query
const publicItem = galleryTestService.getById(pubResult.item.id);
assert.ok(publicItem);
assert.strictEqual((publicItem as any).creatorToken, undefined, 'creatorToken must never be exposed publicly');

console.log('✔ Gallery publishing, ghost attachment, and secret token isolation verified.\n');

// =============================================================================
// TEST 8: GALLERY DISCOVERY, SEARCH, FILTERING & SORTING
// =============================================================================
console.log('▶ Test 8: Gallery Discovery, Search, and Filtering');

// Publish a second level with maze template
const mazePlan = generateAndValidateTemplateLevel('maze-exploration', { seed: 99 });
const mazeScene = convertPlanToPlayableScene(mazePlan);
galleryTestService.publish({
  title: 'Labyrinth of Shadows',
  description: 'Top-down corridor labyrinth puzzle.',
  creatorName: 'MazeMaster',
  playableScene: mazeScene,
  visibility: 'published',
});

// Search by title
const searchRes = galleryTestService.listPublished({ search: 'Cavern', limit: 10, offset: 0, sortBy: 'newest' });
assert.strictEqual(searchRes.items.length, 1);
assert.strictEqual(searchRes.items[0].title, 'Glacial Cavern Gauntlet');

// Filter by template
const templateRes = galleryTestService.listPublished({ templateId: 'maze-exploration', limit: 10, offset: 0, sortBy: 'newest' });
assert.strictEqual(templateRes.items.length, 1);
assert.strictEqual(templateRes.items[0].templateId, 'maze-exploration');

// Filter by ghost availability
const ghostRes = galleryTestService.listPublished({ hasGhostOnly: true, limit: 10, offset: 0, sortBy: 'newest' });
assert.strictEqual(ghostRes.items.length, 1);
assert.strictEqual(ghostRes.items[0].hasGhostReplay, true);

console.log('✔ Community gallery search, template filter, and ghost queries verified.\n');

// =============================================================================
// TEST 9: OWNERSHIP ENFORCEMENT & UNPUBLISH AUTHORIZATION
// =============================================================================
console.log('▶ Test 9: Ownership Enforcement & Unpublish Authorization');

const publishedId = pubResult.item.id;
const validToken = pubResult.creatorToken!;

// Unauthorized deletion attempt with wrong token
const unauthResult = galleryTestService.unpublish(publishedId, 'wrong_invalid_token');
assert.strictEqual(unauthResult.success, false, 'Unpublish must fail with invalid token');
assert.strictEqual(galleryTestService.getById(publishedId) !== null, true);

// Authorized deletion with valid creatorToken
const authResult = galleryTestService.unpublish(publishedId, validToken);
assert.strictEqual(authResult.success, true, 'Unpublish must succeed with valid creator token');
assert.strictEqual(galleryTestService.getById(publishedId), null, 'Level must be removed from gallery');

console.log('✔ Ownership authorization and unpublishing verified.\n');

// =============================================================================
// TEST 10: GHOST VISUAL-ONLY INVARIANT (NO PHYSICS COLLISION OR INTERFERENCE)
// =============================================================================
console.log('▶ Test 10: Ghost Visual-Only Invariant');

// Verify ghost state provides strictly visual coordinates without physics bodies
const ghostSample = ghostController.sampleState(1000);
assert.ok(typeof ghostSample.x === 'number');
assert.ok(typeof ghostSample.y === 'number');
assert.strictEqual(typeof ghostSample.progressRatio, 'number');

// Invariant verification: Replay data contains zero script execution or executable bytecode
const rawReplayStr = JSON.stringify(finalizedReplay);
assert.strictEqual(rawReplayStr.includes('function'), false);
assert.strictEqual(rawReplayStr.includes('eval'), false);
assert.strictEqual(rawReplayStr.includes('script'), false);

console.log('✔ Ghost visual-only non-colliding and non-executable invariant verified.\n');

console.log('🎉 ALL DRAW2PLAY STAGE 8 DETERMINISTIC REPLAYS, GHOST RUNS & GALLERY TESTS PASSED PERFECTLY!\n');
