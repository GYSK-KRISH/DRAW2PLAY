import assert from 'node:assert';
import {
  saveCreation,
  getAllCreations,
  getCreationById,
  renameCreation,
  duplicateCreation,
  deleteCreation,
  exportCreationJson,
  clearAllCreationsForTest,
} from '../src/services/creationStorage.js';
import { SavedCreationSchema } from '../src/types/creation.js';
import type { SketchDocument } from '../src/types/sketch.js';
import { convertSketchToPlayableScene } from '../src/game/sceneConverter.js';
import { audioService } from '../src/services/audioService.js';

console.log('🧪 Starting Draw2Play Phase 4 Storage, Audio & Polish Test Suite...\n');

// Clean slate before tests
clearAllCreationsForTest();

const sampleDocument: SketchDocument = {
  id: 'doc-persisted-1',
  name: 'Sky Haven',
  canvasWidth: 800,
  canvasHeight: 500,
  coordinateConvention: 'normalized-unit',
  strokes: [
    {
      id: 'stroke-1',
      elementType: 'ground',
      color: '#10b981',
      width: 12,
      points: [
        { x: 0.1, y: 0.8 },
        { x: 0.4, y: 0.8 },
      ],
      timestamp: 1000,
    },
    {
      id: 'stroke-2',
      elementType: 'coin',
      color: '#eab308',
      width: 14,
      points: [{ x: 0.25, y: 0.6 }],
      timestamp: 1001,
    },
    {
      id: 'stroke-3',
      elementType: 'goal',
      color: '#a855f7',
      width: 16,
      points: [
        { x: 0.85, y: 0.7 },
        { x: 0.85, y: 0.5 },
      ],
      timestamp: 1002,
    },
  ],
  createdAt: '2026-10-10T12:00:00Z',
  updatedAt: '2026-10-10T12:00:00Z',
  schemaVersion: '1.0',
};

// ---------------------------------------------------------------------------
// Test 1: Save Creation and Schema Validation
// ---------------------------------------------------------------------------
console.log('▶ Test 1: Save Creation and validate stored record');
const playableScene = convertSketchToPlayableScene(sampleDocument, {
  source: 'local-vector',
  levelName: sampleDocument.name,
});

const saved1 = saveCreation({
  name: 'Sky Haven',
  document: sampleDocument,
  playableScene,
  thumbnailDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  provenance: 'local-vector',
  tags: ['featured', 'tutorial'],
});

assert.ok(saved1.id.length > 0);
assert.strictEqual(saved1.name, 'Sky Haven');
assert.strictEqual(saved1.document.strokes.length, 3);
assert.strictEqual(saved1.provenance, 'local-vector');
assert.strictEqual(saved1.schemaVersion, '1.0');

// Verify read back with schema
const all = getAllCreations();
assert.strictEqual(all.length, 1);
const retrieved = getCreationById(saved1.id);
assert.ok(retrieved !== null);
assert.strictEqual(retrieved?.name, 'Sky Haven');
assert.strictEqual(retrieved?.playableScene?.platforms.length, 1);
console.log('  ✓ Saved creation conforms to schema and stores document');

// ---------------------------------------------------------------------------
// Test 2: Update Existing Creation
// ---------------------------------------------------------------------------
console.log('▶ Test 2: Update Existing Creation');
const updatedDoc: SketchDocument = {
  ...sampleDocument,
  strokes: [
    ...sampleDocument.strokes,
    {
      id: 'stroke-4',
      elementType: 'trampoline',
      color: '#06b6d4',
      width: 14,
      points: [{ x: 0.5, y: 0.8 }],
      timestamp: 1003,
    },
  ],
};

const updatedCreation = saveCreation({
  id: saved1.id,
  name: 'Sky Haven Deluxe',
  document: updatedDoc,
  provenance: 'local-vector',
});

assert.strictEqual(updatedCreation.id, saved1.id, 'ID must remain stable across updates');
assert.strictEqual(updatedCreation.name, 'Sky Haven Deluxe');
assert.strictEqual(updatedCreation.document.strokes.length, 4);

const allAfterUpdate = getAllCreations();
assert.strictEqual(allAfterUpdate.length, 1, 'Total creation count should still be 1 after update');
console.log('  ✓ Update preserved stable ID and refreshed document content');

// ---------------------------------------------------------------------------
// Test 3: Rename Creation
// ---------------------------------------------------------------------------
console.log('▶ Test 3: Rename Creation');
const renamed = renameCreation(saved1.id, 'Cloud Runner');
assert.strictEqual(renamed, true);

const fetchedAfterRename = getCreationById(saved1.id);
assert.strictEqual(fetchedAfterRename?.name, 'Cloud Runner');
assert.strictEqual(fetchedAfterRename?.document.name, 'Cloud Runner');

// Invalid name (empty) rejection
const renameEmpty = renameCreation(saved1.id, '   ');
assert.strictEqual(renameEmpty, false);
console.log('  ✓ Renaming updates record and guards against empty names');

// ---------------------------------------------------------------------------
// Test 4: Duplicate Creation
// ---------------------------------------------------------------------------
console.log('▶ Test 4: Duplicate Creation');
const cloned = duplicateCreation(saved1.id);
assert.ok(cloned !== null);
assert.notStrictEqual(cloned?.id, saved1.id, 'Cloned ID must be distinct');
assert.strictEqual(cloned?.name, 'Cloud Runner (Copy)');
assert.strictEqual(cloned?.document.strokes.length, 4);

const allAfterClone = getAllCreations();
assert.strictEqual(allAfterClone.length, 2, 'Creation count must now be 2');
console.log('  ✓ Duplication created distinct clone with (Copy) suffix');

// ---------------------------------------------------------------------------
// Test 5: Delete Creation
// ---------------------------------------------------------------------------
console.log('▶ Test 5: Delete Creation');
const deleted = deleteCreation(saved1.id);
assert.strictEqual(deleted, true);

const allAfterDelete = getAllCreations();
assert.strictEqual(allAfterDelete.length, 1);
assert.strictEqual(allAfterDelete[0].id, cloned?.id);

// Deleting nonexistent ID returns false
assert.strictEqual(deleteCreation('nonexistent-id'), false);
console.log('  ✓ Deletion removed targeted record safely');

// ---------------------------------------------------------------------------
// Test 6: Export Creation as JSON
// ---------------------------------------------------------------------------
console.log('▶ Test 6: Export Creation as JSON');
assert.ok(cloned);
const jsonString = exportCreationJson(cloned.id);
assert.ok(jsonString.includes('"name": "Cloud Runner (Copy)"'));
assert.ok(jsonString.includes('"schemaVersion": "1.0"'));

const parsedBack = JSON.parse(jsonString);
const validatedBack = SavedCreationSchema.parse(parsedBack);
assert.strictEqual(validatedBack.name, 'Cloud Runner (Copy)');
console.log('  ✓ Exported JSON parses back with full schema validity');

// ---------------------------------------------------------------------------
// Test 7: Schema Validation Rejection on Corrupted Object
// ---------------------------------------------------------------------------
console.log('▶ Test 7: Schema Validation Rejection on Corrupted Record');
assert.throws(() => {
  // Missing document and missing id
  SavedCreationSchema.parse({
    name: 'Broken',
  });
}, 'Should throw on missing required fields');

assert.throws(() => {
  // Invalid schemaVersion
  SavedCreationSchema.parse({
    id: 'corrupt-1',
    name: 'Broken',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    document: sampleDocument,
    schemaVersion: '99.0' as any,
  });
}, 'Should reject unsupported schema version');
console.log('  ✓ Corrupted record schema rejection verified');

// ---------------------------------------------------------------------------
// Test 8: Procedural Audio Service Resilience
// ---------------------------------------------------------------------------
console.log('▶ Test 8: Procedural Audio Service Resilience');
// In a headless Node testing environment without browser AudioContext,
// audio methods should safely no-op without throwing unhandled exceptions.
assert.doesNotThrow(() => {
  audioService.playJump();
  audioService.playBounce();
  audioService.playCoin();
  audioService.playHazard();
  audioService.playVictory();
  audioService.playClick();
});

const initialMute = audioService.getIsMuted();
const toggled = audioService.toggleMute();
assert.strictEqual(toggled, !initialMute);
const restored = audioService.toggleMute();
assert.strictEqual(restored, initialMute);

audioService.setVolume(0.8);
assert.strictEqual(audioService.getVolume(), 0.8);

// Clamping volume [0, 1]
audioService.setVolume(1.5);
assert.strictEqual(audioService.getVolume(), 1.0);
audioService.setVolume(-0.5);
assert.strictEqual(audioService.getVolume(), 0.0);
audioService.setVolume(0.5); // restore default
console.log('  ✓ Audio service operations are resilient and safely bounded');

// ---------------------------------------------------------------------------
// Test 9: Saved Playable Scene Ready for Immediate Launch
// ---------------------------------------------------------------------------
console.log('▶ Test 9: Saved Playable Scene Ready for Immediate Launch');
assert.ok(cloned?.playableScene);
assert.strictEqual(cloned.playableScene.schemaVersion, '1.0');
assert.strictEqual(cloned.playableScene.source, 'local-vector');
assert.strictEqual(cloned.playableScene.world.width, 800);
assert.strictEqual(cloned.playableScene.world.height, 480);
assert.ok(cloned.playableScene.player.spawnX >= 0);
assert.ok(cloned.playableScene.player.spawnY >= 0);
console.log('  ✓ Playable scene contract preserved inside saved creation');

// ---------------------------------------------------------------------------
// Test 10: Clean Storage Reset
// ---------------------------------------------------------------------------
console.log('▶ Test 10: Clean Storage Reset');
clearAllCreationsForTest();
const remaining = getAllCreations();
assert.strictEqual(remaining.length, 0);
console.log('  ✓ Storage cleared cleanly');

console.log('\n🎉 ALL 10 PHASE 4 STORAGE & POLISH TESTS PASSED SUCCESSFULLY!\n');
