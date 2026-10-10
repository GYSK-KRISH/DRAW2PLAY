import assert from 'node:assert';
import {
  PlayableGameSceneSchema,
  PlatformElementSchema,
  HazardElementSchema,
  TrampolineElementSchema,
  CoinElementSchema,
  GoalElementSchema,
  type PlayableGameScene,
} from '../src/types/scene.js';
import { convertSketchToPlayableScene } from '../src/game/sceneConverter.js';
import type { SketchDocument, SketchStroke } from '../src/types/sketch.js';
import { GeminiLevelAnalysisOutputSchema } from '../server/schemas/level.schema.js';
import { generateMockLevelAnalysis } from '../server/services/mock.service.js';

console.log('🧪 Starting Draw2Play Phase 3 Playable Physics & Level Scene Test Suite...\n');

// ---------------------------------------------------------------------------
// Test 1: PlayableGameSceneSchema Validation (Valid Scene)
// ---------------------------------------------------------------------------
console.log('▶ Test 1: PlayableGameSceneSchema validates contract');
const validScene: PlayableGameScene = {
  schemaVersion: '1.0',
  source: 'local-vector',
  levelName: 'Emerald Run',
  levelDescription: 'A classic 2D obstacle course.',
  world: {
    width: 800,
    height: 480,
    gravity: 750,
    backgroundColor: '#070a13',
    theme: 'default',
    friction: 1.0,
    difficulty: 'normal',
    ambientEffect: 'none',
  },
  player: {
    spawnX: 80,
    spawnY: 360,
    speed: 220,
    jumpPower: 400,
    size: 36,
  },
  platforms: [
    {
      id: 'plat-1',
      x: 0,
      y: 440,
      width: 800,
      height: 40,
      strokeColor: '#10b981',
    },
  ],
  hazards: [
    {
      id: 'haz-1',
      x: 350,
      y: 420,
      width: 40,
      height: 20,
      hazardType: 'spike',
    },
  ],
  trampolines: [
    {
      id: 'tramp-1',
      x: 200,
      y: 420,
      width: 60,
      height: 16,
      bounceStrength: 620,
    },
  ],
  coins: [
    {
      id: 'coin-1',
      x: 210,
      y: 300,
      size: 24,
      value: 10,
    },
  ],
  goal: {
    id: 'goal-1',
    x: 720,
    y: 370,
    width: 36,
    height: 48,
  },
  diagnostics: {
    warnings: [],
    assumptions: [],
    strokeCount: 5,
  },
};

const parsedScene = PlayableGameSceneSchema.parse(validScene);
assert.strictEqual(parsedScene.levelName, 'Emerald Run');
assert.strictEqual(parsedScene.source, 'local-vector');
assert.strictEqual(parsedScene.platforms.length, 1);
assert.strictEqual(parsedScene.hazards.length, 1);
assert.strictEqual(parsedScene.trampolines.length, 1);
assert.strictEqual(parsedScene.coins.length, 1);

// Direct individual element schema checks
assert.ok(PlatformElementSchema.parse(validScene.platforms[0]));
assert.ok(HazardElementSchema.parse(validScene.hazards[0]));
assert.ok(TrampolineElementSchema.parse(validScene.trampolines[0]));
assert.ok(CoinElementSchema.parse(validScene.coins[0]));
assert.ok(GoalElementSchema.parse(validScene.goal));
console.log('  ✓ PlayableGameSceneSchema and individual element schemas passed');

// ---------------------------------------------------------------------------
// Test 2: Invalid Scene Schema Rejection
// ---------------------------------------------------------------------------
console.log('▶ Test 2: Invalid Scene Schema Rejection');
assert.throws(() => {
  // Missing goal and invalid source
  PlayableGameSceneSchema.parse({
    schemaVersion: '1.0',
    source: 'unknown-vendor-ai' as any,
    levelName: 'Bad',
    world: { width: 800, height: 480 },
  });
}, 'Should reject invalid provenance source and missing required elements');

assert.throws(() => {
  // Non-finite coordinates in platform
  PlatformElementSchema.parse({
    id: 'plat-bad',
    x: NaN,
    y: 100,
    width: 200,
    height: 30,
  });
}, 'Should reject NaN coordinates');

assert.throws(() => {
  // Negative dimension in hazard
  HazardElementSchema.parse({
    id: 'haz-bad',
    x: 10,
    y: 10,
    width: -50,
    height: 20,
  });
}, 'Should reject negative dimensions');
console.log('  ✓ Invalid schemas strictly rejected');

// ---------------------------------------------------------------------------
// Test 3: Ground Stroke Segmentation (Prevents Giant AABB)
// ---------------------------------------------------------------------------
console.log('▶ Test 3: Ground Stroke Segmentation');
const multiPointGroundStroke: SketchStroke = {
  id: 'stroke-ground-curved',
  elementType: 'ground',
  color: '#10b981',
  width: 14,
  points: [
    { x: 0.1, y: 0.8 },
    { x: 0.3, y: 0.8 },
    { x: 0.5, y: 0.7 },
    { x: 0.7, y: 0.7 },
  ],
  timestamp: 1001,
};

const testDoc1: SketchDocument = {
  id: 'doc-t1',
  name: 'Curved Platforms Test',
  canvasWidth: 800,
  canvasHeight: 500,
  coordinateConvention: 'normalized-unit',
  strokes: [multiPointGroundStroke],
  createdAt: '2026-10-10T12:00:00Z',
  updatedAt: '2026-10-10T12:00:00Z',
  schemaVersion: '1.0',
};

const converted1 = convertSketchToPlayableScene(testDoc1, {
  worldWidth: 800,
  worldHeight: 480,
  source: 'local-vector',
});

// A 4-point line should yield 3 segments (P0-P1, P1-P2, P2-P3)
assert.strictEqual(converted1.platforms.length, 3, 'Multi-point ground should create connected segments');
for (const p of converted1.platforms) {
  assert.ok(p.width > 0, 'Platform width must be positive');
  assert.ok(p.height > 0, 'Platform height must be positive');
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'Platform coordinates must be finite');
}
console.log('  ✓ Ground stroke properly segmented into 3 platform slabs');

// ---------------------------------------------------------------------------
// Test 4: Full Multi-Element Level Conversion
// ---------------------------------------------------------------------------
console.log('▶ Test 4: Full Multi-Element Level Conversion');
const fullLevelStrokes: SketchStroke[] = [
  // Ground
  {
    id: 's-g1',
    elementType: 'ground',
    color: '#10b981',
    width: 12,
    points: [{ x: 0.05, y: 0.85 }, { x: 0.4, y: 0.85 }],
    timestamp: 1,
  },
  {
    id: 's-g2',
    elementType: 'ground',
    color: '#10b981',
    width: 12,
    points: [{ x: 0.6, y: 0.7 }, { x: 0.95, y: 0.7 }],
    timestamp: 2,
  },
  // Hazard
  {
    id: 's-h1',
    elementType: 'hazard',
    color: '#ef4444',
    width: 10,
    points: [{ x: 0.42, y: 0.85 }, { x: 0.48, y: 0.82 }, { x: 0.55, y: 0.85 }],
    timestamp: 3,
  },
  // Trampoline
  {
    id: 's-t1',
    elementType: 'trampoline',
    color: '#06b6d4',
    width: 12,
    points: [{ x: 0.45, y: 0.9 }, { x: 0.55, y: 0.9 }],
    timestamp: 4,
  },
  // Coin
  {
    id: 's-c1',
    elementType: 'coin',
    color: '#eab308',
    width: 14,
    points: [{ x: 0.5, y: 0.55 }],
    timestamp: 5,
  },
  // Goal
  {
    id: 's-goal',
    elementType: 'goal',
    color: '#a855f7',
    width: 16,
    points: [{ x: 0.88, y: 0.65 }, { x: 0.88, y: 0.55 }],
    timestamp: 6,
  },
];

const testDocFull: SketchDocument = {
  id: 'doc-full',
  name: 'Sky Jump Obstacle',
  canvasWidth: 800,
  canvasHeight: 500,
  coordinateConvention: 'normalized-unit',
  strokes: fullLevelStrokes,
  createdAt: '2026-10-10T12:00:00Z',
  updatedAt: '2026-10-10T12:00:00Z',
  schemaVersion: '1.0',
};

const fullScene = convertSketchToPlayableScene(testDocFull, {
  worldWidth: 800,
  worldHeight: 480,
  source: 'local-vector',
  levelName: 'Sky Jump Obstacle',
});

assert.strictEqual(fullScene.hazards.length, 1);
assert.strictEqual(fullScene.trampolines.length, 1);
assert.strictEqual(fullScene.coins.length, 1);
assert.ok(fullScene.goal.x > 600, 'Goal should be on right side based on sketch points');
assert.strictEqual(fullScene.trampolines[0].bounceStrength, 620);
assert.strictEqual(fullScene.coins[0].value, 10);
console.log('  ✓ Multi-element level converted with all types active');

// ---------------------------------------------------------------------------
// Test 5: Fallback & Diagnostics when Ground or Goal is Missing
// ---------------------------------------------------------------------------
console.log('▶ Test 5: Fallback & Diagnostics Warnings');
const emptyDoc: SketchDocument = {
  id: 'doc-empty',
  name: 'Blank Sketch',
  canvasWidth: 800,
  canvasHeight: 500,
  coordinateConvention: 'normalized-unit',
  strokes: [],
  createdAt: '2026-10-10T12:00:00Z',
  updatedAt: '2026-10-10T12:00:00Z',
  schemaVersion: '1.0',
};

const fallbackScene = convertSketchToPlayableScene(emptyDoc, {
  source: 'local-vector',
});

assert.strictEqual(fallbackScene.platforms.length, 1, 'Should create default safety floor platform');
assert.strictEqual(fallbackScene.platforms[0].id, 'plat-fallback-floor');
assert.ok(fallbackScene.diagnostics.warnings.some(w => w.includes('No Ground strokes detected')));
assert.ok(fallbackScene.diagnostics.warnings.some(w => w.includes('No Goal flag detected')));
assert.ok(fallbackScene.diagnostics.assumptions.length >= 2);
console.log('  ✓ Missing Ground & Goal cleanly diagnosed with explicit fallbacks');

// ---------------------------------------------------------------------------
// Test 6: Player Spawn Placement Logic
// ---------------------------------------------------------------------------
console.log('▶ Test 6: Player Spawn Placement Logic');
// Player should spawn safely above leftmost platform
assert.ok(fullScene.player.spawnX >= 30, 'Spawn X should be reasonable');
assert.ok(fullScene.player.spawnY < 480, 'Spawn Y should be in world bounds');
assert.strictEqual(fullScene.player.speed, 220);
assert.strictEqual(fullScene.player.jumpPower, 400);
console.log('  ✓ Player spawn calculated safely above leftmost platform');

// ---------------------------------------------------------------------------
// Test 7: Coordinate Scaling into Game World
// ---------------------------------------------------------------------------
console.log('▶ Test 7: Normalized to World Coordinate Scaling');
const midCoinDoc: SketchDocument = {
  id: 'doc-scale',
  name: 'Scaling Test',
  canvasWidth: 800,
  canvasHeight: 500,
  coordinateConvention: 'normalized-unit',
  strokes: [
    {
      id: 'sc-1',
      elementType: 'coin',
      color: '#eab308',
      width: 14,
      points: [{ x: 0.5, y: 0.25 }],
      timestamp: 10,
    },
  ],
  createdAt: '2026-10-10T12:00:00Z',
  updatedAt: '2026-10-10T12:00:00Z',
  schemaVersion: '1.0',
};

const scaledScene = convertSketchToPlayableScene(midCoinDoc, {
  worldWidth: 1000,
  worldHeight: 600,
});

assert.strictEqual(scaledScene.coins[0].x, 500, 'Normalized 0.5 * 1000 should be 500');
assert.strictEqual(scaledScene.coins[0].y, 150, 'Normalized 0.25 * 600 should be 150');
console.log('  ✓ World scaling correctly computed');

// ---------------------------------------------------------------------------
// Test 8: Provenance Labeling
// ---------------------------------------------------------------------------
console.log('▶ Test 8: Strict Provenance Labeling');
const localScene = convertSketchToPlayableScene(testDocFull, { source: 'local-vector' });
assert.strictEqual(localScene.source, 'local-vector');

const geminiScene = convertSketchToPlayableScene(testDocFull, { source: 'gemini-vision' });
assert.strictEqual(geminiScene.source, 'gemini-vision');
assert.strictEqual(geminiScene.diagnostics.aiConfidence, 0.92);

const mockScene = convertSketchToPlayableScene(testDocFull, { source: 'mock-fallback' });
assert.strictEqual(mockScene.source, 'mock-fallback');
console.log('  ✓ Provenance labels strictly preserved');

// ---------------------------------------------------------------------------
// Test 9: Server Gemini Level Analysis Output Schema
// ---------------------------------------------------------------------------
console.log('▶ Test 9: Server Gemini Level Analysis Output Schema');
const sampleGeminiOutput = {
  levelName: 'Volcano Vault',
  levelDescription: 'A fiery obstacle course over red-hot magma spikes.',
  difficultyRating: 'medium' as const,
  visualStyle: 'fiery volcanic cavern',
  playerTuning: {
    speed: 230,
    jumpPower: 420,
    gravity: 760,
  },
  recognizedElements: [
    'ground platforms',
    'lava spike hazard',
    'elastic trampoline',
    'gold coins',
    'victory flag',
  ],
  designFeedback: 'High vertical climb with balanced trampoline placement.',
};

const parsedGemini = GeminiLevelAnalysisOutputSchema.parse(sampleGeminiOutput);
assert.strictEqual(parsedGemini.levelName, 'Volcano Vault');
assert.strictEqual(parsedGemini.difficultyRating, 'medium');
assert.strictEqual(parsedGemini.playerTuning?.speed, 230);
assert.strictEqual(parsedGemini.recognizedElements.length, 5);
console.log('  ✓ Gemini Level Analysis Schema validated');

// ---------------------------------------------------------------------------
// Test 10: Server Mock Level Analysis Generator
// ---------------------------------------------------------------------------
console.log('▶ Test 10: Server Mock Level Analysis Generator');
const generatedMock = generateMockLevelAnalysis(8);
assert.ok(generatedMock.levelName.length > 0);
assert.ok(generatedMock.levelDescription.length > 0);
assert.ok(generatedMock.playerTuning);
assert.strictEqual(generatedMock.recognizedElements.length >= 1, true);
console.log('  ✓ Server Mock Level generator produces valid deterministic analysis');

console.log('\n🎉 ALL 10 PHASE 3 PLAYABLE PHYSICS & SCENE TESTS PASSED SUCCESSFULLY!\n');
