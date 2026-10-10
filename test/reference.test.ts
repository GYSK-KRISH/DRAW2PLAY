import assert from 'node:assert';
import {
  inspectImageSignatureAndDimensions,
  sanitizeFilename,
  referenceStorageService,
} from '../server/services/upload.service.js';
import {
  ReferenceInputSchema,
  ReferenceAnalysisSchema,
  GameGenerationPlanSchema,
  InferredMechanicSchema,
  FrameAnalysisResultSchema,
} from '../src/types/reference.js';
import {
  generateHeuristicReferenceAnalysis,
  buildGameGenerationPlan,
} from '../server/services/referenceAnalysis.service.js';
import { convertPlanToPlayableScene } from '../src/game/sceneConverter.js';

console.log('🧪 Starting Draw2Play AI Phase 6.1/6.2 Reference Intake & Detection Test Suite...\n');

// ---------------------------------------------------------------------------
// TEST 1: PNG File Signature & Header Inspection
// ---------------------------------------------------------------------------
console.log('▶ Test 1: PNG Magic byte validation & dimension extraction');
// 1x1 valid PNG minimal binary buffer
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const pngMeta = inspectImageSignatureAndDimensions(pngBuffer);
assert.strictEqual(pngMeta.mimeType, 'image/png');
assert.strictEqual(pngMeta.width, 1);
assert.strictEqual(pngMeta.height, 1);
assert.ok(pngMeta.sizeBytes > 0);
console.log(`  ✓ Valid PNG verified: ${pngMeta.width}x${pngMeta.height} (${pngMeta.sizeBytes} bytes)`);

// ---------------------------------------------------------------------------
// TEST 2: JPEG Magic Byte Signature Inspection
// ---------------------------------------------------------------------------
console.log('▶ Test 2: JPEG Magic byte validation');
const fakeJpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const jpegMeta = inspectImageSignatureAndDimensions(fakeJpegHeader);
assert.strictEqual(jpegMeta.mimeType, 'image/jpeg');
console.log(`  ✓ Valid JPEG signature verified: ${jpegMeta.mimeType}`);

// ---------------------------------------------------------------------------
// TEST 3: WebP Magic Byte Signature Inspection
// ---------------------------------------------------------------------------
console.log('▶ Test 3: WebP Magic byte validation');
const fakeWebpHeader = Buffer.from([
  0x52, 0x49, 0x46, 0x46, // 'RIFF'
  0x20, 0x00, 0x00, 0x00, // file length
  0x57, 0x45, 0x42, 0x50, // 'WEBP'
  0x56, 0x50, 0x38, 0x20, // 'VP8 '
]);
const webpMeta = inspectImageSignatureAndDimensions(fakeWebpHeader);
assert.strictEqual(webpMeta.mimeType, 'image/webp');
console.log(`  ✓ Valid WebP signature verified: ${webpMeta.mimeType}`);

// ---------------------------------------------------------------------------
// TEST 4: Reject Deceptive Non-Image Formats (Text/EXE/Corrupted)
// ---------------------------------------------------------------------------
console.log('▶ Test 4: Reject deceptive payloads');
const maliciousText = Buffer.from('<html><script>alert("pwned")</script></html>');
assert.throws(
  () => inspectImageSignatureAndDimensions(maliciousText),
  /Unsupported or corrupted image format/,
  'Must reject non-image payload'
);
const truncatedBuffer = Buffer.from([0x89, 0x50, 0x4e]);
assert.throws(
  () => inspectImageSignatureAndDimensions(truncatedBuffer),
  /Image payload is too small/,
  'Must reject truncated byte buffer'
);
console.log('  ✓ Properly rejected fake or truncated payloads');

// ---------------------------------------------------------------------------
// TEST 5: Filename Sanitization & Path Traversal Neutralization
// ---------------------------------------------------------------------------
console.log('▶ Test 5: Filename sanitization');
const dirtyFilename1 = '../../../../etc/passwd';
const clean1 = sanitizeFilename(dirtyFilename1);
assert.strictEqual(clean1, 'passwd.png');

const dirtyFilename2 = 'C:\\Windows\\System32\\cmd.exe';
const clean2 = sanitizeFilename(dirtyFilename2);
assert.strictEqual(clean2, 'cmd.exe.png');

const cleanFilename = sanitizeFilename('minecraft_voxel_level.png');
assert.strictEqual(cleanFilename, 'minecraft_voxel_level.png');
console.log(`  ✓ Sanitized: "${dirtyFilename1}" -> "${clean1}"`);

// ---------------------------------------------------------------------------
// TEST 6: Reference Storage Service Intake
// ---------------------------------------------------------------------------
console.log('▶ Test 6: Reference Storage Service intake');
const initialCount = referenceStorageService.count();
const storedRef = await referenceStorageService.storeReference(
  pngBuffer,
  'test_screen.png',
  'image',
  'A test screenshot'
);
ReferenceInputSchema.parse(storedRef);
assert.ok(storedRef.id.startsWith('ref-'));
assert.strictEqual(storedRef.displayName, 'test_screen.png');
assert.strictEqual(storedRef.mimeType, 'image/png');
assert.strictEqual(referenceStorageService.count(), initialCount + 1);
const retrieved = referenceStorageService.getReference(storedRef.id);
assert.ok(retrieved !== undefined);
assert.strictEqual(retrieved?.buffer.length, pngBuffer.length);
console.log(`  ✓ Stored asset ID: ${storedRef.id} with safe metadata`);

// ---------------------------------------------------------------------------
// TEST 7: Heuristic Analysis for Voxel / Minecraft Reference
// ---------------------------------------------------------------------------
console.log('▶ Test 7: Voxel reference detection and analysis');
const voxelPrompt = 'Create an original playable voxel exploration game inspired by this reference.';
const voxelAnalysis = generateHeuristicReferenceAnalysis(voxelPrompt);
const parsedVoxel = ReferenceAnalysisSchema.parse(voxelAnalysis);
assert.strictEqual(parsedVoxel.category, 'voxel');
assert.strictEqual(parsedVoxel.cameraPerspective, 'first-person-3d');
assert.strictEqual(parsedVoxel.recommendedPipeline, 'future-3d-engine');
assert.strictEqual(parsedVoxel.provenance, 'mock-heuristic');
assert.ok(parsedVoxel.inferredMechanics.length > 0);
assert.ok(parsedVoxel.inferredMechanics[0].confidence > 0 && parsedVoxel.inferredMechanics[0].confidence <= 1.0);
console.log(`  ✓ Voxel category detected: ${parsedVoxel.category} -> ${parsedVoxel.recommendedPipeline}`);

// ---------------------------------------------------------------------------
// TEST 8: Heuristic Analysis for 2D Platformer Reference
// ---------------------------------------------------------------------------
console.log('▶ Test 8: 2D Platformer reference detection and analysis');
const platformerPrompt = 'Convert this retro 2D platformer sketch into a playable level.';
const platformerAnalysis = generateHeuristicReferenceAnalysis(platformerPrompt);
const parsedPlatformer = ReferenceAnalysisSchema.parse(platformerAnalysis);
assert.strictEqual(parsedPlatformer.category, '2d-platformer');
assert.strictEqual(parsedPlatformer.cameraPerspective, 'side-scrolling-2d');
assert.strictEqual(parsedPlatformer.recommendedPipeline, 'phaser-2d');
console.log(`  ✓ 2D Platformer category detected: ${parsedPlatformer.category} -> ${parsedPlatformer.recommendedPipeline}`);

// ---------------------------------------------------------------------------
// TEST 9: Voxel Plan Generation (Deferred to future 3D engine)
// ---------------------------------------------------------------------------
console.log('▶ Test 9: Voxel Plan Generation (Deferred to future 3D engine)');
const voxelPlan = buildGameGenerationPlan(
  storedRef.id,
  voxelPrompt,
  parsedVoxel
);
const validatedVoxelPlan = GameGenerationPlanSchema.parse(voxelPlan);
assert.strictEqual(validatedVoxelPlan.targetEngine, 'future-3d-engine');
assert.strictEqual(validatedVoxelPlan.status, 'deferred-future-engine');
assert.ok(validatedVoxelPlan.missingRequirements.length >= 2);
assert.ok(
  validatedVoxelPlan.limitationsAndWarnings.some((w) =>
    w.includes('Single 2D reference screenshot cannot reconstruct 3D voxel world geometry') ||
    w.includes('3D Engine phase') ||
    w.includes('voxel world geometry')
  )
);
console.log(`  ✓ Voxel plan status: ${validatedVoxelPlan.status} with ${validatedVoxelPlan.missingRequirements.length} missing requirements recorded`);

// ---------------------------------------------------------------------------
// TEST 10: 2D Plan Generation & Conversion to Playable Scene
// ---------------------------------------------------------------------------
console.log('▶ Test 10: 2D Plan Generation & Scene Conversion');
const platformerPlan = buildGameGenerationPlan(
  storedRef.id,
  platformerPrompt,
  parsedPlatformer
);
const validated2DPlan = GameGenerationPlanSchema.parse(platformerPlan);
assert.strictEqual(validated2DPlan.targetEngine, 'phaser-2d');
assert.strictEqual(validated2DPlan.status, 'ready-for-2d-generation');
assert.ok(validated2DPlan.suggested2DConfig !== undefined);

// Convert to Playable Scene and test contract
const convertedScene = convertPlanToPlayableScene(validated2DPlan);
assert.strictEqual(convertedScene.schemaVersion, '1.0');
assert.ok(convertedScene.platforms.length > 0);
assert.ok(convertedScene.coins.length > 0);
assert.ok(convertedScene.goal !== undefined);
assert.ok(convertedScene.player.speed > 0);
console.log(`  ✓ Playable 2D scene produced: ${convertedScene.levelName} with ${convertedScene.platforms.length} platforms`);

// ===========================================================================
// PHASE 6.2 TESTS — Observation Grounding, Confidence Tiers, Multi-Frame Schema
// ===========================================================================
console.log('\n--- Phase 6.2 Extended Tests ---\n');

// ---------------------------------------------------------------------------
// TEST 11: Phase 6.2 — InferredMechanic schema requires observationalEvidence
// ---------------------------------------------------------------------------
console.log('▶ Test 11: InferredMechanic v2 requires observationalEvidence');
const validMechanic = {
  name: 'Double Jump',
  description: 'Hypothesis: Player can jump again mid-air. Inferred from sprite animation trail.',
  confidence: 0.72,
  observationalEvidence: ['Upward motion trail visible in character sprite', 'Air UI indicator in HUD'],
  supportingObservations: ['Jump arc trajectory visible'],
};
const parsedMech = InferredMechanicSchema.parse(validMechanic);
assert.strictEqual(parsedMech.name, 'Double Jump');
assert.ok(parsedMech.observationalEvidence.length >= 1, 'Must have at least 1 observational evidence');
console.log('  ✓ InferredMechanic with observationalEvidence parsed correctly');

// ---------------------------------------------------------------------------
// TEST 12: Phase 6.2 — Schema rejects mechanic with empty observationalEvidence
// ---------------------------------------------------------------------------
console.log('▶ Test 12: Reject InferredMechanic with empty observationalEvidence');
const invalidMechanic = {
  name: 'Teleport',
  description: 'Hypothesis: Player can teleport.',
  confidence: 0.5,
  observationalEvidence: [], // MUST be rejected — at least 1 required
  supportingObservations: [],
};
const mechResult = InferredMechanicSchema.safeParse(invalidMechanic);
assert.strictEqual(mechResult.success, false, 'Empty observationalEvidence must be rejected');
console.log('  ✓ Empty observationalEvidence correctly rejected by schema');

// ---------------------------------------------------------------------------
// TEST 13: Phase 6.2 — ReferenceAnalysis v2.0 schema with new fields
// ---------------------------------------------------------------------------
console.log('▶ Test 13: ReferenceAnalysisSchema v2.0 new fields');
const v2Analysis = generateHeuristicReferenceAnalysis('Create a 2D platformer from this reference.');
assert.strictEqual(v2Analysis.schemaVersion, '2.0', 'Schema version must be 2.0');
assert.ok(v2Analysis.analysisConfidenceTier !== undefined, 'analysisConfidenceTier must be present');
assert.ok(['high', 'medium', 'low'].includes(v2Analysis.analysisConfidenceTier), 'Confidence tier must be valid');
assert.ok(typeof v2Analysis.frameCount === 'number', 'frameCount must be a number');
assert.strictEqual(v2Analysis.frameCount, 1, 'Single-reference analysis must have frameCount = 1');
console.log(`  ✓ v2.0 analysis: schemaVersion=${v2Analysis.schemaVersion}, confidenceTier=${v2Analysis.analysisConfidenceTier}, frameCount=${v2Analysis.frameCount}`);

// ---------------------------------------------------------------------------
// TEST 14: Phase 6.2 — Heuristic provenance is always 'mock-heuristic'
// ---------------------------------------------------------------------------
console.log('▶ Test 14: Heuristic analysis provenance never claims gemini-vision');
const heuristicResult = generateHeuristicReferenceAnalysis('Some random prompt');
assert.strictEqual(heuristicResult.provenance, 'mock-heuristic',
  'Heuristic analysis MUST NOT claim gemini-vision provenance');
assert.ok(
  heuristicResult.uncertaintiesAndWarnings.some((w) => w.includes('heuristic') || w.includes('keyword')),
  'Heuristic analysis must include a warning about keyword-only analysis'
);
console.log(`  ✓ Provenance correctly set to '${heuristicResult.provenance}' with heuristic warnings`);

// ---------------------------------------------------------------------------
// TEST 15: Phase 6.2 — All mechanics have observationalEvidence ≥ 1
// ---------------------------------------------------------------------------
console.log('▶ Test 15: All heuristic mechanics have valid observationalEvidence');
const testAnalysis2D = generateHeuristicReferenceAnalysis('2D platformer game');
const testAnalysisVoxel = generateHeuristicReferenceAnalysis('voxel mining game');

for (const analysis of [testAnalysis2D, testAnalysisVoxel]) {
  for (const mech of analysis.inferredMechanics) {
    assert.ok(
      mech.observationalEvidence.length >= 1,
      `Mechanic "${mech.name}" must have at least 1 observationalEvidence item`
    );
    // Confidence must be within [0, 1] bounds
    assert.ok(mech.confidence >= 0 && mech.confidence <= 1, 'Confidence must be in [0, 1]');
  }
}
console.log('  ✓ All heuristic mechanics contain valid observationalEvidence and confidence');

// ---------------------------------------------------------------------------
// TEST 16: Phase 6.2 — FrameAnalysisResultSchema validation
// ---------------------------------------------------------------------------
console.log('▶ Test 16: FrameAnalysisResultSchema validates multi-frame data');
const frameResult = {
  frameIndex: 0,
  timestampSeconds: 2.5,
  visibleObjects: ['Player sprite', 'Platform blocks', 'Coin collectible', 'Enemy enemy'],
  terrainNotes: 'Horizontal platforms at varying heights with gaps between them.',
  uniqueObservations: ['Player appears to be mid-jump', 'HUD shows 3 lives remaining'],
};
const parsedFrame = FrameAnalysisResultSchema.parse(frameResult);
assert.strictEqual(parsedFrame.frameIndex, 0);
assert.strictEqual(parsedFrame.timestampSeconds, 2.5);
assert.ok(parsedFrame.visibleObjects.length > 0);
console.log(`  ✓ FrameAnalysisResult parsed: frame ${parsedFrame.frameIndex} at ${parsedFrame.timestampSeconds}s`);

// ---------------------------------------------------------------------------
// TEST 17: Phase 6.2 — ReferenceAnalysis with multi-frame results
// ---------------------------------------------------------------------------
console.log('▶ Test 17: ReferenceAnalysis accepts multi-frame frameResults');
const multiFrameAnalysis: import('../src/types/reference.js').ReferenceAnalysis = {
  ...generateHeuristicReferenceAnalysis('2D platformer with enemies'),
  frameCount: 3,
  frameResults: [
    {
      frameIndex: 0,
      timestampSeconds: 0.5,
      visibleObjects: ['Player', 'Platform'],
      terrainNotes: 'Starting area',
      uniqueObservations: ['Player at left edge'],
    },
    {
      frameIndex: 1,
      timestampSeconds: 2.0,
      visibleObjects: ['Enemy', 'Coin', 'Platform'],
      terrainNotes: 'Mid-level with obstacles',
      uniqueObservations: ['Enemy patrol pattern visible'],
    },
    {
      frameIndex: 2,
      timestampSeconds: 4.5,
      visibleObjects: ['Goal flag', 'Platform', 'Player'],
      terrainNotes: 'End of level with goal',
      uniqueObservations: ['Goal flag in top right'],
    },
  ],
};

const parsedMultiFrame = ReferenceAnalysisSchema.parse(multiFrameAnalysis);
assert.strictEqual(parsedMultiFrame.frameCount, 3);
assert.ok(parsedMultiFrame.frameResults !== undefined);
assert.strictEqual(parsedMultiFrame.frameResults!.length, 3);
assert.strictEqual(parsedMultiFrame.frameResults![1].frameIndex, 1);
console.log(`  ✓ Multi-frame analysis with ${parsedMultiFrame.frameCount} frames parsed correctly`);

// ---------------------------------------------------------------------------
// TEST 18: Phase 6.2 — Plan generation warns on mock-heuristic provenance
// ---------------------------------------------------------------------------
console.log('▶ Test 18: Plan generation includes heuristic-provenance warning for 2D targets');
const heuristicPlatformerAnalysis = generateHeuristicReferenceAnalysis('2D platformer game reference');
const plan2DFromHeuristic = buildGameGenerationPlan(
  'ref-test',
  '2D platformer from reference',
  heuristicPlatformerAnalysis
);
assert.ok(
  plan2DFromHeuristic.limitationsAndWarnings.some((w) =>
    w.includes('keyword heuristic') || w.includes('Gemini Vision unavailable')
  ),
  'Plan must warn when built from heuristic analysis'
);
console.log('  ✓ Plan correctly includes heuristic provenance warning in limitationsAndWarnings');

// ---------------------------------------------------------------------------
// TEST 19: Phase 6.2 — Schema rejects analysis with invalid confidence tier
// ---------------------------------------------------------------------------
console.log('▶ Test 19: Schema rejects invalid analysisConfidenceTier values');
const invalidAnalysis = {
  ...generateHeuristicReferenceAnalysis('test'),
  analysisConfidenceTier: 'very-high', // Not a valid value
};
const invalidResult = ReferenceAnalysisSchema.safeParse(invalidAnalysis);
assert.strictEqual(invalidResult.success, false, 'Invalid confidence tier must be rejected');
console.log('  ✓ Invalid analysisConfidenceTier "very-high" correctly rejected');

// ---------------------------------------------------------------------------
// TEST 20: Phase 6.2 — frameCount defaults to 1 for single-reference analysis
// ---------------------------------------------------------------------------
console.log('▶ Test 20: frameCount defaults to 1 for heuristic analysis');
const singleRefAnalysis = generateHeuristicReferenceAnalysis('top-down RPG dungeon');
assert.strictEqual(singleRefAnalysis.frameCount, 1);
assert.strictEqual(singleRefAnalysis.frameResults, undefined, 'frameResults must be absent for single-reference');
console.log(`  ✓ Single-reference analysis: frameCount=${singleRefAnalysis.frameCount}, frameResults=${singleRefAnalysis.frameResults}`);

console.log('\n🎉 ALL 20 PHASE 6.1/6.2 REFERENCE INTAKE TESTS PASSED SUCCESSFULLY!');
