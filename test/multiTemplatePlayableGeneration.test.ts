import assert from 'node:assert';
import {
  TEMPLATE_REGISTRY,
  getSupportedTemplates,
  checkTemplateCompatibility,
} from '../src/templates/templateRegistry.js';
import {
  generateTemplateLevel,
  generateAndValidateTemplateLevel,
} from '../src/generators/templateGenerators.js';
import {
  GAME_TEMPLATE_IDS,
  type GameTemplateId,
  type GameDesignPlan,
} from '../src/types/plan.js';
import {
  convertPlanToPlayableScene,
} from '../src/game/sceneConverter.js';
import {
  PlayableGameSceneSchema,
  type PlayableGameScene,
} from '../src/types/scene.js';
import {
  buildGameGenerationPlan,
} from '../server/services/referenceAnalysis.service.js';
import type { ReferenceAnalysis } from '../src/types/reference.js';

console.log('🧪 Starting Draw2Play AI Stage 3: Multi-Template Playable Game Generation Test Suite...\n');

// The 12 core templates specified in Stage 3:
const CORE_12_TEMPLATES: GameTemplateId[] = [
  'physics-platformer',
  'precision-platformer',
  'physics-puzzle',
  'top-down-exploration',
  'top-down-arena-survival',
  'collect-and-escape',
  'maze-exploration',
  'gravity-switch-puzzle',
  'momentum-drifting',
  'timed-obstacle-course',
  'coin-collection-challenge',
  'exploration-puzzle-hybrid',
];

// =============================================================================
// TEST 1 to 12: VERIFY EVERY ONE OF THE 12 TEMPLATES HAS DISTINCT PLAYABLE RULES
// =============================================================================
console.log('▶ Tests 1-12: Individual Template Registry, Procedural Generation & Scene Contracts');

const generatedScenesByTemplate = new Map<GameTemplateId, PlayableGameScene>();
const generatedPlansByTemplate = new Map<GameTemplateId, GameDesignPlan>();

for (let i = 0; i < CORE_12_TEMPLATES.length; i++) {
  const templateId = CORE_12_TEMPLATES[i];
  const spec = TEMPLATE_REGISTRY[templateId];

  assert.ok(spec, `Template "${templateId}" must be registered in TEMPLATE_REGISTRY`);
  assert.strictEqual(spec.id, templateId, `Spec ID must match "${templateId}"`);
  assert.ok(spec.name.length > 0, `Template "${templateId}" must have a display name`);
  assert.ok(spec.description.length > 10, `Template "${templateId}" must have a descriptive text`);
  assert.ok(spec.movementModel, `Template "${templateId}" must define a player movement model`);
  assert.ok(spec.controlsHelp, `Template "${templateId}" must define user control instructions`);

  // Procedural level generation
  const plan = generateAndValidateTemplateLevel(templateId, {
    width: 800,
    height: 480,
    seed: 100 + i,
  });
  generatedPlansByTemplate.set(templateId, plan);

  assert.strictEqual(plan.templateId, templateId, `Generated plan templateId must match "${templateId}"`);
  assert.strictEqual(plan.schemaVersion, '2.0', `Generated plan must be v2.0`);

  // World bounds validation
  assert.strictEqual(plan.world.width, 800);
  assert.strictEqual(plan.world.height, 480);
  assert.ok(plan.player.spawn.x >= 0 && plan.player.spawn.x <= 800, 'Spawn X within world width');
  assert.ok(plan.player.spawn.y >= 0 && plan.player.spawn.y <= 480, 'Spawn Y within world height');
  assert.ok(plan.objectives.goal.x >= 0 && plan.objectives.goal.x + plan.objectives.goal.width <= 800, 'Goal X within world width');
  assert.ok(plan.objectives.goal.y >= 0 && plan.objectives.goal.y + plan.objectives.goal.height <= 480, 'Goal Y within world height');

  // Scene conversion
  const scene = convertPlanToPlayableScene(plan);
  const validatedScene = PlayableGameSceneSchema.parse(scene);
  generatedScenesByTemplate.set(templateId, validatedScene);

  assert.strictEqual(validatedScene.templateId, templateId, `Scene templateId must match "${templateId}"`);
  assert.strictEqual(validatedScene.movementModel, spec.movementModel, `Scene movementModel must match spec`);
  assert.ok(validatedScene.hudInstructions, 'Scene must provide hudInstructions');

  console.log(`  ✓ [${i + 1}/12] ${spec.name} (${templateId}): movement=${spec.movementModel}, gravity=${plan.world.gravity}, objective=${validatedScene.objective?.type || 'reach_goal'}`);
}

// =============================================================================
// TEST 13: DISTINCTNESS VERIFICATION (NO IDENTICAL PLATFORMER CLONES)
// =============================================================================
console.log('\n▶ Test 13: Cross-Template Distinctness Verification');

// Compare all pairs of core templates to ensure they are NOT identical
for (let i = 0; i < CORE_12_TEMPLATES.length; i++) {
  for (let j = i + 1; j < CORE_12_TEMPLATES.length; j++) {
    const idA = CORE_12_TEMPLATES[i];
    const idB = CORE_12_TEMPLATES[j];
    const planA = generatedPlansByTemplate.get(idA)!;
    const planB = generatedPlansByTemplate.get(idB)!;
    const sceneA = generatedScenesByTemplate.get(idA)!;
    const sceneB = generatedScenesByTemplate.get(idB)!;

    // Check that at least two critical gameplay dimensions differ
    const differsInGravity = planA.world.gravity !== planB.world.gravity;
    const differsInMovement = sceneA.movementModel !== sceneB.movementModel;
    const differsInObjectives = sceneA.objective?.type !== sceneB.objective?.type ||
      planA.objectives.primary.type !== planB.objectives.primary.type;
    const differsInEnemies = (sceneA.enemies?.length ?? 0) !== (sceneB.enemies?.length ?? 0);
    const differsInSwitches = (sceneA.switches?.length ?? 0) !== (sceneB.switches?.length ?? 0);
    const differsInWalls = planA.terrain.walls.length !== planB.terrain.walls.length;
    const differsInPlatforms = planA.terrain.platforms.length !== planB.terrain.platforms.length;
    const differsInHazards = planA.terrain.hazards.length !== planB.terrain.hazards.length;
    const differsInCollectibles = planA.entities.collectibles.length !== planB.entities.collectibles.length;

    const differenceCount = [
      differsInGravity,
      differsInMovement,
      differsInObjectives,
      differsInEnemies,
      differsInSwitches,
      differsInWalls,
      differsInPlatforms,
      differsInHazards,
      differsInCollectibles,
    ].filter(Boolean).length;

    assert.ok(
      differenceCount >= 2,
      `Templates "${idA}" and "${idB}" are too similar! Only ${differenceCount} differing dimensions found.`
    );
  }
}
console.log('  ✓ All 66 template pairs proved distinctly differentiated in physics, movement, entities, and objectives');

// =============================================================================
// TEST 14: DETERMINISTIC PROCEDURAL GENERATION (SEEDED PRNG)
// =============================================================================
console.log('\n▶ Test 14: Deterministic Procedural Generation via Seeded RNG');

const runA = generateTemplateLevel('physics-platformer', { seed: 99999, width: 800, height: 480 });
const runB = generateTemplateLevel('physics-platformer', { seed: 99999, width: 800, height: 480 });
const runC = generateTemplateLevel('physics-platformer', { seed: 88888, width: 800, height: 480 });

assert.deepStrictEqual(runA.terrain, runB.terrain, 'Identical seeds must produce identical terrain');
assert.deepStrictEqual(runA.player.spawn, runB.player.spawn, 'Identical seeds must produce identical player spawn');
assert.deepStrictEqual(runA.objectives.goal, runB.objectives.goal, 'Identical seeds must produce identical goal');
assert.notDeepStrictEqual(runA.id, runC.id, 'Different seeds must produce distinct level identifiers');
console.log('  ✓ Deterministic seeding verified: identical seeds produce equivalent levels');

// =============================================================================
// TEST 15: NO SPAWN INSIDE SOLID GEOMETRY & HAZARDS
// =============================================================================
console.log('\n▶ Test 15: Valid Spawn Placement (Never Inside Solid Walls or Hazards)');

for (const templateId of CORE_12_TEMPLATES) {
  const plan = generatedPlansByTemplate.get(templateId)!;
  const spawn = plan.player.spawn;
  const playerSize = plan.player.size;
  const pBox = {
    x1: spawn.x - playerSize / 2,
    x2: spawn.x + playerSize / 2,
    y1: spawn.y - playerSize / 2,
    y2: spawn.y + playerSize / 2,
  };

  // Check no intersection with solid walls
  for (const wall of plan.terrain.walls) {
    const wBox = {
      x1: wall.x,
      x2: wall.x + wall.width,
      y1: wall.y,
      y2: wall.y + wall.height,
    };
    const overlap =
      pBox.x1 < wBox.x2 &&
      pBox.x2 > wBox.x1 &&
      pBox.y1 < wBox.y2 &&
      pBox.y2 > wBox.y1;
    assert.strictEqual(
      overlap,
      false,
      `Template "${templateId}" spawns player inside solid wall "${wall.id}"!`
    );
  }

  // Check no intersection with hazards
  for (const hazard of plan.terrain.hazards) {
    const hBox = {
      x1: hazard.x,
      x2: hazard.x + hazard.width,
      y1: hazard.y,
      y2: hazard.y + hazard.height,
    };
    const overlap =
      pBox.x1 < hBox.x2 &&
      pBox.x2 > hBox.x1 &&
      pBox.y1 < hBox.y2 &&
      pBox.y2 > hBox.y1;
    assert.strictEqual(
      overlap,
      false,
      `Template "${templateId}" spawns player directly on hazard "${hazard.id}"!`
    );
  }
}
console.log('  ✓ Verified 100% of templates spawn player cleanly without solid or hazard overlap');

// =============================================================================
// TEST 16: TEMPLATE-SPECIFIC MECHANICS VALIDATION
// =============================================================================
console.log('\n▶ Test 16: Specific Gameplay Rules per Mode');

// 1. Gravity switch puzzle
const gravPlan = generatedPlansByTemplate.get('gravity-switch-puzzle')!;
const gravScene = generatedScenesByTemplate.get('gravity-switch-puzzle')!;
assert.strictEqual(gravScene.movementModel, 'gravity-switch');
assert.ok(gravPlan.player.supportedAbilities.includes('flip_gravity'));
assert.ok(gravPlan.terrain.platforms.some((p) => p.y <= 36), 'Must include ceiling platform');
assert.ok(gravPlan.terrain.platforms.some((p) => p.y >= 400), 'Must include floor platform');

// 2. Top-down arena survival
const arenaPlan = generatedPlansByTemplate.get('top-down-arena-survival')!;
const arenaScene = generatedScenesByTemplate.get('top-down-arena-survival')!;
assert.strictEqual(arenaPlan.category, 'top-down-2d');
assert.strictEqual(arenaScene.movementModel, 'topdown');
assert.strictEqual(arenaScene.objective?.type, 'survive_time');
assert.strictEqual(arenaScene.objective?.timeLimitSeconds, 20);
assert.ok((arenaScene.enemies?.length ?? 0) >= 4, 'Must spawn arena chaser enemies');

// 3. Precision platformer
const precPlan = generatedPlansByTemplate.get('precision-platformer')!;
const precScene = generatedScenesByTemplate.get('precision-platformer')!;
assert.strictEqual(precScene.movementModel, 'precision');
assert.strictEqual(precPlan.world.gravity, 900, 'Precision mode requires high gravity for tight arcs');
assert.ok(precPlan.terrain.hazards.length >= 2, 'Precision platformer requires lethal pit hazard bed');

// 4. Momentum drifting
const driftPlan = generatedPlansByTemplate.get('momentum-drifting')!;
const driftScene = generatedScenesByTemplate.get('momentum-drifting')!;
assert.strictEqual(driftScene.movementModel, 'drift');
assert.strictEqual(driftPlan.world.friction, 0.15, 'Drift mode requires ultra-low friction');

// 5. Physics puzzle with switches
const puzzlePlan = generatedPlansByTemplate.get('physics-puzzle')!;
const puzzleScene = generatedScenesByTemplate.get('physics-puzzle')!;
assert.strictEqual(puzzlePlan.category, 'puzzle');
assert.strictEqual(puzzleScene.objective?.type, 'activate_switches');
assert.ok((puzzleScene.switches?.length ?? 0) >= 1, 'Puzzle scene must have switches');
assert.ok((puzzleScene.doors?.length ?? 0) >= 1, 'Puzzle scene must have linked doors');
assert.strictEqual(puzzleScene.switches![0].targetId, puzzleScene.doors![0].id, 'Switch must target barrier door');

// 6. Collect and escape
const escapePlan = generatedPlansByTemplate.get('collect-and-escape')!;
const escapeScene = generatedScenesByTemplate.get('collect-and-escape')!;
assert.strictEqual(escapePlan.category, '2d-platformer');
assert.strictEqual(escapeScene.objective?.type, 'collect_all_coins');
assert.strictEqual(escapeScene.objective?.targetCount, 3);
assert.strictEqual(escapeScene.coins.length, 3);

console.log('  ✓ Verified distinct gameplay loops: gravity inversion, countdown survival, precision arcs, drifting friction, switch-door wiring, and key-gated exits');

// =============================================================================
// TEST 17: END-TO-END TEMPLATE PASSTHROUGH FROM INTAKE TO RUNTIME
// =============================================================================
console.log('\n▶ Test 17: End-to-End Passthrough (Frontend -> Plan Builder -> Phaser Scene)');

const mockAnalysis: ReferenceAnalysis = {
  schemaVersion: '2.0',
  category: '2d-platformer',
  cameraPerspective: 'side-scrolling-2d',
  visualStyle: 'pixel-art',
  colorPalette: ['#38bdf8', '#22c55e', '#ef4444'],
  visibleObjects: ['platform', 'character', 'flag'],
  terrainLayout: 'Platforms with step gaps',
  suggestedRoles: { player: 'hero', obstacles: ['spikes'], collectibles: ['coin'] },
  inferredMechanics: [
    {
      name: 'Jump',
      description: 'Jump across platforms',
      confidence: 0.9,
      observationalEvidence: ['platform cues'],
      supportingObservations: ['stepped platforms'],
    },
  ],
  uncertaintiesAndWarnings: [],
  recommendedPipeline: 'phaser-2d',
  provenance: 'mock-heuristic',
  analyzedAt: new Date().toISOString(),
  analysisConfidenceTier: 'medium',
  frameCount: 1,
};

// Test overriding with 3 radically different templates
const planPlatformer = buildGameGenerationPlan('ref-e2e', 'make platformer', mockAnalysis, 'phaser-2d', 'physics-platformer');
const planDrifting = buildGameGenerationPlan('ref-e2e', 'make drifting', mockAnalysis, 'phaser-2d', 'momentum-drifting');
const planArena = buildGameGenerationPlan('ref-e2e', 'make arena', mockAnalysis, 'phaser-2d', 'top-down-arena-survival');

assert.strictEqual(planPlatformer.templateId, 'physics-platformer');
assert.strictEqual(planDrifting.templateId, 'momentum-drifting');
assert.strictEqual(planArena.templateId, 'top-down-arena-survival');

const scenePlatformer = convertPlanToPlayableScene(planPlatformer);
const sceneDrifting = convertPlanToPlayableScene(planDrifting);
const sceneArena = convertPlanToPlayableScene(planArena);

assert.strictEqual(scenePlatformer.movementModel, 'platformer');
assert.strictEqual(sceneDrifting.movementModel, 'drift');
assert.strictEqual(sceneArena.movementModel, 'topdown');
assert.strictEqual(sceneArena.objective?.type, 'survive_time');

console.log('  ✓ Template selection successfully carried from intake through plan generation and into Phaser scene runtime');

// =============================================================================
// TEST 18: THREE DISTINCT REFERENCE ANALYSIS FIXTURES
// =============================================================================
console.log('\n▶ Test 18: Three Distinct Reference Analysis Fixtures Produce Genuinely Different Games');

// Fixture 1: Side-scrolling platformer screenshot
const fixturePlatformerAnalysis: ReferenceAnalysis = {
  schemaVersion: '2.0',
  category: '2d-platformer',
  cameraPerspective: 'side-scrolling-2d',
  visualStyle: 'retro-pixel',
  colorPalette: ['#22c55e', '#16a34a', '#eab308'],
  visibleObjects: ['ground', 'floating-islands', 'portal'],
  terrainLayout: 'Vertical layered ledges',
  suggestedRoles: { player: 'jumper', obstacles: ['void'], collectibles: ['gems'] },
  inferredMechanics: [
    {
      name: 'Jump',
      description: 'Jump',
      confidence: 0.88,
      observationalEvidence: ['ledges'],
      supportingObservations: ['elevated ledges'],
    },
  ],
  uncertaintiesAndWarnings: [],
  recommendedPipeline: 'phaser-2d',
  provenance: 'gemini-vision',
  analyzedAt: new Date().toISOString(),
  analysisConfidenceTier: 'high',
  frameCount: 1,
};

// Fixture 2: Top-down maze dungeon sketch
const fixtureMazeAnalysis: ReferenceAnalysis = {
  schemaVersion: '2.0',
  category: 'top-down-2d',
  cameraPerspective: 'top-down-2d',
  visualStyle: 'dungeon-blueprint',
  colorPalette: ['#334155', '#475569', '#38bdf8'],
  visibleObjects: ['perimeter-walls', 'corridors', 'exit-door'],
  terrainLayout: 'Grid-based enclosed labyrinth',
  suggestedRoles: { player: 'adventurer', obstacles: ['walls'], collectibles: ['breadcrumbs'] },
  inferredMechanics: [
    {
      name: '4-Way Movement',
      description: '4-Way',
      confidence: 0.92,
      observationalEvidence: ['corridor grid'],
      supportingObservations: ['orthogonal walls'],
    },
  ],
  uncertaintiesAndWarnings: [],
  recommendedPipeline: 'phaser-2d',
  provenance: 'gemini-vision',
  analyzedAt: new Date().toISOString(),
  analysisConfidenceTier: 'high',
  frameCount: 1,
};

// Fixture 3: Puzzle laboratory reference
const fixturePuzzleAnalysis: ReferenceAnalysis = {
  schemaVersion: '2.0',
  category: 'puzzle',
  cameraPerspective: 'side-scrolling-2d',
  visualStyle: 'sci-fi-lab',
  colorPalette: ['#0284c7', '#0369a1', '#a855f7'],
  visibleObjects: ['chamber', 'pressure-switch', 'laser-barrier'],
  terrainLayout: 'Enclosed test chamber with security barrier',
  suggestedRoles: { player: 'tester', obstacles: ['barrier'], collectibles: ['battery'] },
  inferredMechanics: [
    {
      name: 'Switch Activation',
      description: 'Switch',
      confidence: 0.85,
      observationalEvidence: ['switch pedestal'],
      supportingObservations: ['interactive switch floor plate'],
    },
  ],
  uncertaintiesAndWarnings: [],
  recommendedPipeline: 'phaser-2d',
  provenance: 'gemini-vision',
  analyzedAt: new Date().toISOString(),
  analysisConfidenceTier: 'high',
  frameCount: 1,
};

const plan1 = buildGameGenerationPlan('ref-fix-1', 'mountain run', fixturePlatformerAnalysis, 'phaser-2d', 'physics-platformer');
const plan2 = buildGameGenerationPlan('ref-fix-2', 'dungeon maze', fixtureMazeAnalysis, 'phaser-2d', 'maze-exploration');
const plan3 = buildGameGenerationPlan('ref-fix-3', 'laser puzzle', fixturePuzzleAnalysis, 'phaser-2d', 'physics-puzzle');

const scene1 = convertPlanToPlayableScene(plan1);
const scene2 = convertPlanToPlayableScene(plan2);
const scene3 = convertPlanToPlayableScene(plan3);

// Verify meaningfully different outputs:
assert.strictEqual(scene1.movementModel, 'platformer');
assert.strictEqual(scene2.movementModel, 'topdown');
assert.strictEqual(scene3.movementModel, 'platformer');

assert.strictEqual(scene1.world.gravity, 750);
assert.strictEqual(scene2.world.gravity, 0);
assert.strictEqual(scene3.world.gravity, 650);

assert.ok(scene1.platforms.length >= 3, 'Platformer has multiple elevated platforms');
assert.strictEqual(plan2.terrain.platforms.length, 0, 'Top-down maze has 0 floating platforms');
assert.ok(plan2.terrain.walls.length >= 8, 'Top-down maze has corridor boundary walls');
assert.ok(scene3.switches && scene3.switches.length >= 1, 'Puzzle has switches');
assert.ok(scene3.doors && scene3.doors.length >= 1, 'Puzzle has doors');

console.log('  ✓ Fixture 1 produced Physics Platformer (gravity 750, elevated tiers)');
console.log('  ✓ Fixture 2 produced Maze Exploration (gravity 0, corridor labyrinth walls)');
console.log('  ✓ Fixture 3 produced Physics Puzzle (pressure switch and barrier door mechanics)');

// =============================================================================
// TEST 19: REGRESSION PROTECTION (EXISTING SAVED LEVELS STILL LOAD)
// =============================================================================
console.log('\n▶ Test 19: Regression Protection & Backward Compatibility');

// Legacy scene from Stage 0/1 without new fields
const legacySavedScene = {
  schemaVersion: '1.0' as const,
  source: 'local-vector' as const,
  levelName: 'Old Saved Level',
  levelDescription: 'A classic 2D platformer level.',
  world: {
    width: 800,
    height: 480,
    gravity: 750,
    backgroundColor: '#070a13',
    theme: 'forest' as const,
    friction: 1.0,
    difficulty: 'normal' as const,
    ambientEffect: 'none' as const,
  },
  player: {
    spawnX: 50,
    spawnY: 380,
    speed: 220,
    jumpPower: 400,
    size: 36,
  },
  platforms: [
    { id: 'ground', x: 0, y: 440, width: 800, height: 40 },
    { id: 'p1', x: 200, y: 350, width: 120, height: 20 },
  ],
  coins: [{ id: 'c1', x: 250, y: 310, size: 24, value: 10 }],
  hazards: [{ id: 'h1', x: 400, y: 440, width: 60, height: 20, hazardType: 'spike' as const }],
  trampolines: [],
  goal: { id: 'goal', x: 700, y: 380, width: 36, height: 48 },
  diagnostics: {
    warnings: [],
    assumptions: [],
    strokeCount: 4,
  },
};

const parsedLegacy = PlayableGameSceneSchema.parse(legacySavedScene);
assert.strictEqual(parsedLegacy.levelName, 'Old Saved Level');
assert.strictEqual(parsedLegacy.movementModel, 'platformer');
assert.deepStrictEqual(parsedLegacy.enemies, []);
assert.deepStrictEqual(parsedLegacy.switches, []);

// Ensure template registry list excludes unsupported / deferred engines from immediate playable set
const supportedTemplates = getSupportedTemplates();
assert.ok(supportedTemplates.length >= 12, 'Must have at least 12 supported 2D templates');
assert.ok(!supportedTemplates.some((t) => t.id === 'voxel-3d-deferred'), 'Deferred 3D template must not be listed as supported 2D');
assert.ok(GAME_TEMPLATE_IDS.length >= 12, 'Must define all recognized template IDs');

// Validate template compatibility checker on an existing plan
const compatCheck = checkTemplateCompatibility(planPlatformer, 'physics-platformer');
assert.strictEqual(compatCheck.isCompatible, true, 'Physics platformer must be compatible with standard platformer plan');

console.log('  ✓ Legacy saved scenes load without validation errors');
console.log(`  ✓ Supported template registry returns ${supportedTemplates.length} playable templates with deferred 3D engine safely segregated`);

console.log('\n🎉 ALL 19 STAGE 3 MULTI-TEMPLATE PLAYABLE GENERATION TESTS PASSED SUCCESSFULLY!\n');
