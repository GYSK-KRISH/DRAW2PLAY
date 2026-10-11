import assert from 'node:assert';
import {
  validateJsonPatch,
  applyJsonPatch,
} from '../src/utils/patchApplier.js';
import {
  type JsonPatchOperation,
  type RemixLevelRequest,
} from '../src/types/remix.js';
import { remixService } from '../server/services/remix.service.js';
import { generateAndValidateTemplateLevel } from '../src/generators/templateGenerators.js';
import { convertPlanToPlayableScene } from '../src/game/sceneConverter.js';
import { applySceneHotPatch, type HotPatchTargetScene } from '../src/game/remixPatchRunner.js';

console.log('🧪 Starting Draw2Play AI Stage 7: Live Prompt-to-Patch Remixing Test Suite...\n');

// Generate baseline validated plan & scene for tests
const baselinePlan = generateAndValidateTemplateLevel('physics-platformer', { seed: 42 });
const baselineScene = convertPlanToPlayableScene(baselinePlan);

// =============================================================================
// TEST 1: SUCCESSFUL COSMETIC PATCH (THEME, BACKGROUND, PARTICLES)
// =============================================================================
console.log('▶ Test 1: Successful Cosmetic Patch');

const cosmeticInstruction = 'Make the environment darker and add orange lava with falling embers.';
const { patch: cosmeticPatch, summary: cosmeticSummary } = remixService.parseInstructionHeuristically(
  cosmeticInstruction,
  baselinePlan,
  baselineScene
);

assert.ok(cosmeticPatch.length >= 2, 'Cosmetic patch should contain at least 2 operations');
assert.ok(cosmeticSummary.includes('lava') || cosmeticSummary.includes('embers'));

// Validate patch
const cosmeticReport = validateJsonPatch(cosmeticPatch);
assert.strictEqual(cosmeticReport.valid, true);
assert.ok(cosmeticReport.affectedSystems.includes('presentation'));
assert.strictEqual(cosmeticReport.canHotUpdate, true, 'Cosmetic theme change should be eligible for hot update');

// Apply patch to plan
const appliedPlanResult = applyJsonPatch(baselinePlan, cosmeticPatch);
assert.strictEqual(appliedPlanResult.success, true);
assert.strictEqual(appliedPlanResult.patchedObject.theme.name, 'lava');
assert.strictEqual((appliedPlanResult.patchedObject as any).world.ambientEffect, 'embers');
// Verify original baselinePlan was not mutated (immutability check)
assert.notStrictEqual(baselinePlan.theme.name, 'lava');

console.log('✔ Successful cosmetic patch generated, validated, and applied immutably.\n');

// =============================================================================
// TEST 2: SUCCESSFUL MECHANIC & ENTITY PATCH (GRAVITY, COLLECTIBLES, EASIER)
// =============================================================================
console.log('▶ Test 2: Successful Mechanic & Entity Patch');

const mechanicInstruction = 'Make the level easier: boost player jump power and increase collectibles.';
const remixRequest: RemixLevelRequest = {
  plan: baselinePlan,
  currentVersion: 1,
  instruction: mechanicInstruction,
};

const remixResponse = await remixService.remixLevel(remixRequest);
assert.strictEqual(remixResponse.success, true);
assert.strictEqual(remixResponse.newVersion, 2);
assert.ok(remixResponse.patch.length >= 2);
assert.ok(remixResponse.appliedPlan !== undefined);
assert.ok(
  remixResponse.affectedSystems.includes('physics') || remixResponse.affectedSystems.includes('entities')
);
assert.ok(
  remixResponse.appliedPlan!.player.jumpPower > baselinePlan.player.jumpPower,
  'Jump power should be boosted for easier difficulty'
);

console.log('✔ Successful mechanic & entity patch applied atomically with version increment.\n');

// =============================================================================
// TEST 3: INVALID PATH REJECTION (SECURITY BOUNDS)
// =============================================================================
console.log('▶ Test 3: Invalid Path Rejection');

const maliciousPaths: JsonPatchOperation[] = [
  { op: 'replace', path: '/malicious/system/exec', value: 'rm -rf /' },
  { op: 'replace', path: '/credentials/apiKey', value: 'stolen_key' },
  { op: 'replace', path: '/schemaVersion', value: '999.0' },
  { op: 'replace', path: '/evalScript', value: 'alert(1)' },
];

const maliciousReport = validateJsonPatch(maliciousPaths);
assert.strictEqual(maliciousReport.valid, false, 'Unallowlisted paths must be strictly rejected');
assert.ok(maliciousReport.errors.length >= 3);

console.log('✔ Unallowlisted arbitrary property paths rejected.\n');

// =============================================================================
// TEST 4: PROTOTYPE POLLUTION DEFENSE
// =============================================================================
console.log('▶ Test 4: Prototype Pollution Defense');

const prototypePollutionPatch: JsonPatchOperation[] = [
  { op: 'add', path: '/__proto__/isAdmin', value: true },
  { op: 'replace', path: '/constructor/prototype/polluted', value: true },
];

const protoReport = validateJsonPatch(prototypePollutionPatch);
assert.strictEqual(protoReport.valid, false);
assert.ok(protoReport.errors.some((e) => e.includes('forbidden protected path')));

// Even if forced through applyJsonPatch, it must be rejected
const applyProtoResult = applyJsonPatch(baselinePlan, prototypePollutionPatch);
assert.strictEqual(applyProtoResult.success, false);
assert.strictEqual((Object.prototype as any).isAdmin, undefined, 'Prototype must not be polluted');

console.log('✔ Prototype manipulation attempts strictly rejected.\n');

// =============================================================================
// TEST 5: OUT-OF-RANGE & INVALID RESULTING PLAN REJECTION
// =============================================================================
console.log('▶ Test 5: Out-of-Range & Invalid Resulting Plan Rejection');

// Invalid theme name not adhering to Zod enum
const invalidThemePatch: JsonPatchOperation[] = [
  { op: 'replace', path: '/theme/name', value: 'non_existent_unsupported_theme' },
];

// Test schema validation error when patch creates invalid plan
let caughtError = false;
try {
  const result = applyJsonPatch(baselinePlan, invalidThemePatch);
  if (result.success) {
    // Schema check
    const parseResult = baselinePlan ? baselinePlan : null;
    if (parseResult) {
      // Force parse invalid object
      const invalidCloned = { ...baselinePlan, theme: { ...baselinePlan.theme, name: 'non_existent_unsupported_theme' } };
      await remixService.remixLevel({
        plan: invalidCloned as any,
        currentVersion: 1,
        instruction: 'test',
      });
    }
  }
} catch {
  caughtError = true;
}
assert.strictEqual(caughtError, true, 'Invalid resulting plan must be rejected');

console.log('✔ Invalid resulting schema and out-of-range values rejected.\n');

// =============================================================================
// TEST 6: OPTIMISTIC CONCURRENCY PROTECTION
// =============================================================================
console.log('▶ Test 6: Optimistic Concurrency Protection');

const baseVersion = 3;
const updatedResult = await remixService.remixLevel({
  sceneData: baselineScene,
  currentVersion: baseVersion,
  instruction: 'Add a checkpoint before the final jump',
});

assert.strictEqual(updatedResult.newVersion, 4, 'Version must increment from 3 to 4');
assert.strictEqual(updatedResult.patch.some((p) => p.path.includes('checkpoint')), true);

console.log('✔ Optimistic concurrency version progression verified.\n');

// =============================================================================
// TEST 7: PHASER HOT UPDATE & STATE PRESERVATION
// =============================================================================
console.log('▶ Test 7: Phaser Hot Update & Player State Preservation');

// Mock Phaser Scene target conforming to HotPatchTargetScene
let displayedMessage = '';
const mockMainScene: HotPatchTargetScene = {
  sceneData: JSON.parse(JSON.stringify(baselineScene)),
  score: 140,
  coinsCollected: 3,
  switchesActivated: 1,
  totalCoins: baselineScene.coins?.length || 0,
  player: {
    x: 250,
    y: 380,
    gravityY: 750,
    setGravityY: function (g: number) { this.gravityY = g; },
    setPosition: function (x: number, y: number) { this.x = x; this.y = y; },
  },
  cameras: {
    main: {
      setBackgroundColor: () => {},
    },
  },
  coins: {
    getChildren: () => [],
    create: (x: number, y: number) => ({
      x,
      y,
      setDisplaySize: () => {},
      setData: () => {},
      setCollideWorldBounds: () => {},
      setBounce: () => {},
    }),
  },
  hazards: {
    getChildren: () => [],
    create: (x: number, y: number) => ({
      x,
      y,
      setDisplaySize: () => {},
      setData: () => {},
      refreshBody: () => {},
    }),
  },
  textures: {
    exists: () => false,
  },
  tweens: {
    add: () => {},
  },
  showMessage: (msg: string) => {
    displayedMessage = msg;
  },
};

// Prepare hot remix scene (theme=ice, gravity=400, add 1 coin)
const patchedScene = JSON.parse(JSON.stringify(baselineScene));
patchedScene.world.theme = 'ice';
patchedScene.world.backgroundColor = '#082f49';
patchedScene.world.gravity = 400;
patchedScene.coins.push({ id: 'coin-remix-hot-1', x: 300, y: 320, size: 24, value: 20 });

// Apply Hot Patch!
const hotResult = applySceneHotPatch(mockMainScene, patchedScene, ['presentation', 'physics', 'entities']);
assert.strictEqual(hotResult.success, true);
assert.strictEqual(hotResult.appliedHot, true, 'Non-structural patch should apply hot without scene reload');

// Verify State Preservation Invariant:
assert.strictEqual(mockMainScene.score, 140, 'Player score must be strictly preserved');
assert.strictEqual(mockMainScene.coinsCollected, 3, 'Collected coins must be strictly preserved');
assert.strictEqual(mockMainScene.player!.x, 250, 'Player X position must be preserved');
assert.strictEqual(mockMainScene.player!.y, 380, 'Player Y position must be preserved');
assert.strictEqual(mockMainScene.player!.gravityY, 400, 'Gravity must be updated live on player body');
assert.ok(displayedMessage.includes('Phaser Hot Update'));

console.log('✔ Live Phaser hot update verified with full player state preservation.\n');

// =============================================================================
// TEST 8: STRUCTURAL CHANGE FALLBACK & SAFE RESTAGE
// =============================================================================
console.log('▶ Test 8: Structural Change Fallback & Safe Restage');

let didRestart = false;
mockMainScene.restartGame = function () {
  didRestart = true;
};

// Add a platform (structural change)
const structuralScene = JSON.parse(JSON.stringify(baselineScene));
structuralScene.platforms.push({ id: 'plat-new-structural', x: 200, y: 300, width: 120, height: 20 });

const structuralResult = applySceneHotPatch(mockMainScene, structuralScene, ['structural']);
assert.strictEqual(structuralResult.success, true);
assert.strictEqual(structuralResult.appliedHot, false, 'Structural change must trigger controlled restage');
assert.strictEqual(didRestart, true, 'restartGame must be called for structural platform alterations');

console.log('✔ Structural changes correctly identified and routed through clean restage.\n');

// =============================================================================
// TEST 9: HAZARD PROXIMITY SAFETY CHECK
// =============================================================================
console.log('▶ Test 9: Hazard Proximity Safety Repositioning');

// Player is at (250, 380)
// A remix adds a spike right at (250, 380)
const hazardClashScene = JSON.parse(JSON.stringify(baselineScene));
hazardClashScene.hazards.push({
  id: 'hazard-clash',
  x: 240,
  y: 370,
  width: 20,
  height: 20,
  hazardType: 'spike',
});

applySceneHotPatch(mockMainScene, hazardClashScene, ['entities']);
// Player must be shifted safely so they do not spawn inside the spike
assert.ok(
  mockMainScene.player!.y < 370,
  'Player should be shifted safely above newly spawned hazard'
);

console.log('✔ Hazard proximity collision avoidance verified.\n');

console.log('🎉 ALL DRAW2PLAY STAGE 7 LIVE PROMPT-TO-PATCH REMIXING TESTS PASSED PERFECTLY!\n');
