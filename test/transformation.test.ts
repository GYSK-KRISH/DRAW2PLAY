import assert from 'node:assert';
import {
  PlayableGameSceneSchema,
  type PlayableGameScene,
} from '../src/types/scene.js';
import {
  TransformationOperationSchema,
  TransformLevelRequestSchema,
  TransformLevelResponseSchema,
  type TransformationOperation,
} from '../src/types/transformation.js';
import { applyTransformations } from '../src/game/transformationEngine.js';
import { interpretInstructionLocally } from '../src/services/localRuleParser.js';
import { saveCreation, getCreationById } from '../src/services/creationStorage.js';
import { SavedCreationSchema } from '../src/types/creation.js';

console.log('🧪 Starting Draw2Play Phase 5 Natural Language Transformation Test Suite...\n');

// Standard test scene fixture
function createSampleScene(): PlayableGameScene {
  return PlayableGameSceneSchema.parse({
    schemaVersion: '1.0',
    source: 'local-vector',
    levelName: 'Meadow Course',
    levelDescription: 'A balanced introductory platformer.',
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
      { id: 'plat-ground', x: 0, y: 440, width: 800, height: 40 },
      { id: 'plat-mid', x: 250, y: 320, width: 200, height: 24 },
      { id: 'plat-high', x: 520, y: 220, width: 180, height: 24 },
    ],
    hazards: [
      { id: 'haz-1', x: 380, y: 416, width: 24, height: 24, hazardType: 'spike' },
    ],
    trampolines: [
      { id: 'tramp-1', x: 180, y: 424, width: 48, height: 16, bounceStrength: 620 },
    ],
    coins: [
      { id: 'coin-1', x: 280, y: 290, size: 24, value: 10 },
      { id: 'coin-2', x: 320, y: 290, size: 24, value: 10 },
    ],
    goal: {
      id: 'goal-1',
      x: 720,
      y: 392,
      width: 36,
      height: 48,
    },
    diagnostics: {
      warnings: [],
      assumptions: [],
      strokeCount: 6,
    },
  });
}

// ---------------------------------------------------------------------------
// Test 1: Transformation Schema Validation
// ---------------------------------------------------------------------------
console.log('▶ Test 1: Transformation Operation Schema Validation');
const validOps: TransformationOperation[] = [
  { type: 'set_theme', theme: 'ice' },
  { type: 'set_difficulty', difficulty: 'easy' },
  { type: 'adjust_physics', gravity: 500, friction: 0.15 },
  { type: 'add_coins', count: 5 },
  { type: 'adjust_coin_density', multiplier: 1.5 },
  { type: 'add_hazards', count: 2, hazardType: 'lava' },
  { type: 'adjust_hazard_density', multiplier: 0.5 },
  { type: 'adjust_player_jump', jumpPower: 480, multiplier: 1.2 },
  { type: 'adjust_player_speed', speed: 280, multiplier: 1.3 },
  { type: 'set_environment_effects', effect: 'snow' },
];

for (const op of validOps) {
  const parsed = TransformationOperationSchema.parse(op);
  assert.strictEqual(parsed.type, op.type);
}

// Validate request schema
const validReq = TransformLevelRequestSchema.parse({
  scene: createSampleScene(),
  instruction: 'Make this level icy and slippery',
});
assert.strictEqual(validReq.instruction, 'Make this level icy and slippery');

// Validate response schema
const validRes = TransformLevelResponseSchema.parse({
  success: true,
  source: 'local-rules',
  operations: validOps.slice(0, 3),
  explanation: 'Applied ice transformations successfully.',
  warnings: [],
  transformedScene: createSampleScene(),
});
assert.strictEqual(validRes.success, true);
console.log('  ✓ All 10 transformation operation schemas, requests, and responses parsed successfully');

// ---------------------------------------------------------------------------
// Test 2: Invalid Operations Rejection
// ---------------------------------------------------------------------------
console.log('▶ Test 2: Invalid Operations Rejection');
assert.throws(
  () => {
    TransformationOperationSchema.parse({ type: 'set_theme', theme: 'candyland' } as unknown);
  },
  /Invalid/,
  'Should reject unsupported theme'
);

assert.throws(
  () => {
    // Negative jump power
    TransformationOperationSchema.parse({ type: 'adjust_player_jump', jumpPower: -50 });
  },
  /Too small/,
  'Should reject negative jump power'
);

assert.throws(
  () => {
    // Excessive coin count (> 20)
    TransformationOperationSchema.parse({ type: 'add_coins', count: 99 });
  },
  /Too big/,
  'Should reject excessive coin count'
);
console.log('  ✓ Invalid and out-of-range operations strictly rejected');

// ---------------------------------------------------------------------------
// Test 3: Original Scene Immutability
// ---------------------------------------------------------------------------
console.log('▶ Test 3: Original Scene Immutability');
const original = createSampleScene();
const originalJsonBefore = JSON.stringify(original);

const transformResult = applyTransformations(original, [
  { type: 'set_theme', theme: 'ice' },
  { type: 'add_coins', count: 5 },
  { type: 'adjust_player_speed', multiplier: 1.5 },
]);

const originalJsonAfter = JSON.stringify(original);
assert.strictEqual(
  originalJsonBefore,
  originalJsonAfter,
  'Original scene must remain strictly untouched after transformation'
);
assert.notStrictEqual(
  original.world.theme,
  transformResult.transformedScene.world.theme,
  'Transformed scene must have updated theme'
);
assert.strictEqual(transformResult.transformedScene.world.theme, 'ice');
console.log('  ✓ Original scene is strictly immutable; clone is safely transformed');

// ---------------------------------------------------------------------------
// Test 4: Real Ice Friction & Acceleration Physics
// ---------------------------------------------------------------------------
console.log('▶ Test 4: Real Ice Friction & Acceleration Physics');
const iceResult = applyTransformations(original, [
  { type: 'set_theme', theme: 'ice' },
]);
assert.strictEqual(iceResult.transformedScene.world.theme, 'ice');
assert.strictEqual(iceResult.transformedScene.world.ambientEffect, 'snow');
assert.strictEqual(iceResult.transformedScene.world.friction, 0.12, 'Ice must set friction to 0.12');
assert.strictEqual(iceResult.transformedScene.world.backgroundColor, '#082f49');
console.log('  ✓ Ice theme sets authentic low friction (0.12), snow particles, and blue palette');

// ---------------------------------------------------------------------------
// Test 5: Difficulty Presets Mechanics
// ---------------------------------------------------------------------------
console.log('▶ Test 5: Difficulty Presets Mechanics');
// Easy preset
const easySceneWithHazards = createSampleScene();
easySceneWithHazards.hazards.push(
  { id: 'haz-2', x: 280, y: 416, width: 24, height: 24, hazardType: 'spike' },
  { id: 'haz-3', x: 500, y: 416, width: 24, height: 24, hazardType: 'spike' }
);
const easyResult = applyTransformations(easySceneWithHazards, [
  { type: 'set_difficulty', difficulty: 'easy' },
]);
assert.strictEqual(easyResult.transformedScene.world.difficulty, 'easy');
assert.ok(
  easyResult.transformedScene.hazards.length < easySceneWithHazards.hazards.length,
  'Easy mode must reduce lethal hazard count'
);
assert.ok(
  easyResult.transformedScene.player.jumpPower >= easySceneWithHazards.player.jumpPower,
  'Easy mode must maintain or boost player jump clearance'
);
assert.ok(
  easyResult.transformedScene.coins.length > easySceneWithHazards.coins.length,
  'Easy mode must add bonus reward coins'
);

// Hard preset
const hardResult = applyTransformations(original, [
  { type: 'set_difficulty', difficulty: 'hard' },
]);
assert.strictEqual(hardResult.transformedScene.world.difficulty, 'hard');
assert.ok(
  hardResult.transformedScene.hazards.length > original.hazards.length,
  'Hard mode must add additional challenge hazards'
);
console.log('  ✓ Easy reduces hazards and boosts jump; Hard adds challenge obstacles');

// ---------------------------------------------------------------------------
// Test 6: Coin and Hazard Placement Boundaries
// ---------------------------------------------------------------------------
console.log('▶ Test 6: Coin and Hazard Placement Boundaries');
const crowdedResult = applyTransformations(original, [
  { type: 'add_coins', count: 6 },
  { type: 'add_hazards', count: 4, hazardType: 'spike' },
]);

// Verify all coins are within world bounds
for (const coin of crowdedResult.transformedScene.coins) {
  assert.ok(coin.x >= 0 && coin.x <= original.world.width, `Coin X ${coin.x} within bounds`);
  assert.ok(coin.y >= 0 && coin.y <= original.world.height, `Coin Y ${coin.y} within bounds`);
}

// Verify hazards are away from player spawn point
for (const hazard of crowdedResult.transformedScene.hazards) {
  const distToSpawn = Math.hypot(
    hazard.x - original.player.spawnX,
    hazard.y - original.player.spawnY
  );
  assert.ok(distToSpawn >= 100, `Hazard must be at least 100px from player spawn (got ${distToSpawn})`);

  const distToGoal = Math.hypot(
    hazard.x - original.goal.x,
    hazard.y - original.goal.y
  );
  assert.ok(distToGoal >= 75, `Hazard must not sit directly on goal (got ${distToGoal})`);
}
console.log('  ✓ Generated coins and hazards placed safely inside world bounds');

// ---------------------------------------------------------------------------
// Test 7: Deterministic Natural Language Local Rule Parser
// ---------------------------------------------------------------------------
console.log('▶ Test 7: Deterministic Natural Language Local Rule Parser');
// 1. Ice request
const parseIce = interpretInstructionLocally('Make this level icy and slippery with falling snow');
assert.strictEqual(parseIce.isSupported, true);
assert.ok(parseIce.operations.some((op) => op.type === 'set_theme' && op.theme === 'ice'));
assert.ok(parseIce.operations.some((op) => op.type === 'adjust_physics' && op.friction === 0.12));

// 2. Lava request
const parseLava = interpretInstructionLocally('Create a volcanic lava world with lots of heat');
assert.strictEqual(parseLava.isSupported, true);
assert.ok(parseLava.operations.some((op) => op.type === 'set_theme' && op.theme === 'lava'));

// 3. Space request
const parseSpace = interpretInstructionLocally('Turn this into a zero-g cosmic space level');
assert.strictEqual(parseSpace.isSupported, true);
assert.ok(parseSpace.operations.some((op) => op.type === 'set_theme' && op.theme === 'space'));

// 4. Coin quantity extraction
const parseCoins = interpretInstructionLocally('Add 8 coins for a treasure hunt');
assert.strictEqual(parseCoins.isSupported, true);
const coinOp = parseCoins.operations.find((op) => op.type === 'add_coins');
assert.ok(coinOp && coinOp.type === 'add_coins' && coinOp.count === 8, 'Parsed exact coin count of 8');

// 5. Jump boost
const parseJump = interpretInstructionLocally('Make the player jump higher');
assert.strictEqual(parseJump.isSupported, true);
assert.ok(parseJump.operations.some((op) => op.type === 'adjust_player_jump'));
console.log('  ✓ Natural language parser correctly identifies themes, physics, coins, and jump');

// ---------------------------------------------------------------------------
// Test 8: Unsupported Instruction Handling
// ---------------------------------------------------------------------------
console.log('▶ Test 8: Unsupported Instruction Handling');
const unsupported = interpretInstructionLocally('Order a large pepperoni pizza');
assert.strictEqual(unsupported.isSupported, false);
assert.strictEqual(unsupported.operations.length, 0);
assert.ok(unsupported.warnings.length > 0);
assert.ok(unsupported.explanation.includes('Could not map instruction'));

// Applying unsupported operations safely returns original scene
const fallbackApply = applyTransformations(original, unsupported.operations);
assert.strictEqual(fallbackApply.transformedScene.world.theme, original.world.theme);
assert.strictEqual(fallbackApply.transformedScene.coins.length, original.coins.length);
console.log('  ✓ Unsupported prompt cleanly rejected without breaking or emptying level');

// ---------------------------------------------------------------------------
// Test 9: Saving Transformed Level in My Creations
// ---------------------------------------------------------------------------
console.log('▶ Test 9: Saving Transformed Level in My Creations');
const transformedForSave = applyTransformations(original, [
  { type: 'set_theme', theme: 'cyberpunk' },
  { type: 'adjust_player_speed', multiplier: 1.3 },
]);

const savedCreation = saveCreation({
  name: 'Cyber Meadow (Transformed)',
  document: {
    id: 'doc-cyber',
    name: 'Cyber Meadow',
    canvasWidth: 800,
    canvasHeight: 480,
    coordinateConvention: 'normalized-unit',
    strokes: [],
    extractedElements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: '1.0',
  },
  playableScene: transformedForSave.transformedScene,
  provenance: 'local-rules-transformed',
  tags: ['cyberpunk', 'speedrun'],
});

assert.strictEqual(savedCreation.name, 'Cyber Meadow (Transformed)');
assert.strictEqual(savedCreation.playableScene?.world.theme, 'cyberpunk');
assert.strictEqual(savedCreation.provenance, 'local-rules-transformed');

// Read back from storage service
const retrieved = getCreationById(savedCreation.id);
assert.ok(retrieved !== null);
assert.strictEqual(retrieved.playableScene?.world.theme, 'cyberpunk');
assert.strictEqual(SavedCreationSchema.safeParse(retrieved).success, true);
console.log('  ✓ Transformed scene saved to creation storage and validated on read');

// ---------------------------------------------------------------------------
// Test 10: Backward Compatibility with Existing Un-themed Scenes
// ---------------------------------------------------------------------------
console.log('▶ Test 10: Backward Compatibility with Existing Un-themed Scenes');
const legacySceneRaw = {
  schemaVersion: '1.0',
  source: 'local-vector',
  levelName: 'Legacy Phase 3 Level',
  levelDescription: 'Older level without theme fields',
  world: {
    width: 800,
    height: 480,
    gravity: 750,
    backgroundColor: '#070a13',
  },
  player: {
    spawnX: 80,
    spawnY: 360,
    speed: 220,
    jumpPower: 400,
    size: 36,
  },
  platforms: [{ id: 'floor', x: 0, y: 440, width: 800, height: 40 }],
  hazards: [],
  trampolines: [],
  coins: [],
  goal: { id: 'g', x: 700, y: 400, width: 36, height: 48 },
  diagnostics: { warnings: [], assumptions: [], strokeCount: 2 },
};

// Must parse successfully and fill defaults
const parsedLegacy = PlayableGameSceneSchema.parse(legacySceneRaw);
assert.strictEqual(parsedLegacy.world.theme, 'default');
assert.strictEqual(parsedLegacy.world.friction, 1.0);
assert.strictEqual(parsedLegacy.world.difficulty, 'normal');
assert.strictEqual(parsedLegacy.world.ambientEffect, 'none');

// Can be transformed seamlessly
const transformedLegacy = applyTransformations(parsedLegacy, [
  { type: 'set_theme', theme: 'lava' },
]);
assert.strictEqual(transformedLegacy.transformedScene.world.theme, 'lava');
assert.strictEqual(transformedLegacy.transformedScene.world.ambientEffect, 'embers');
console.log('  ✓ Legacy un-themed scenes parse seamlessly with defaults and transform cleanly');

console.log('\n🎉 ALL 10 PHASE 5 TRANSFORMATION TESTS PASSED SUCCESSFULLY!\n');
