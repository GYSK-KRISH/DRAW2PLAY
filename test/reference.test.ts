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
} from '../src/types/reference.js';
import {
  generateHeuristicReferenceAnalysis,
  buildGameGenerationPlan,
} from '../server/services/referenceAnalysis.service.js';
import { convertPlanToPlayableScene } from '../src/game/sceneConverter.js';

console.log('🧪 Starting Draw2Play AI Phase 6.1 Reference Intake & Detection Test Suite...\n');

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
// TEST 9: Plan Generation for Voxel Target (Deferred Future Engine)
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
    w.includes('3D Engine phase')
  )
);
console.log(`  ✓ Voxel plan status: ${validatedVoxelPlan.status} with ${validatedVoxelPlan.missingRequirements.length} missing requirements recorded`);

// ---------------------------------------------------------------------------
// TEST 10: Plan Generation for 2D Platformer & Conversion to Playable Scene
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

console.log('\n🎉 ALL 10 PHASE 6.1 REFERENCE INTAKE TESTS PASSED SUCCESSFULLY!');
