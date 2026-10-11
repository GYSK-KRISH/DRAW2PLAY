import assert from 'node:assert';
import {
  generateDefaultSandboxWorld,
  isValidCoordinate,
  getTile,
  mineBlock,
  placeBlock,
  rectanglesIntersect,
  type Rect,
} from '../src/game/sandbox/sandboxWorld.js';
import {
  createDefaultInventory,
  addInventoryItem,
  hasInventoryItem,
  consumeInventoryItem,
  setSelectedSlot,
  getSelectedBlockType,
} from '../src/game/sandbox/sandboxInventory.js';
import {
  saveSandbox,
  loadSandbox,
  clearSandboxGameForTest,
  validateSandboxSaveData,
} from '../src/services/sandboxStorage.js';
import {
  getAllCreations,
  saveCreation,
  clearAllCreationsForTest,
} from '../src/services/creationStorage.js';
import {
  TILE_DEFINITIONS,
  isTileSolid,
  CraftSubmissionSchema,
  SandboxSaveDataSchema,
  type SandboxWorldData,
  type SandboxSaveData,
  type CraftSubmission,
} from '../src/types/sandbox.js';

console.log('🧪 Starting Draw2Play Phase 7.1 Sandbox Mode & Draw-to-Craft Foundation Test Suite...\n');

// Clean slates before testing
clearSandboxGameForTest();
clearAllCreationsForTest();

// ==========================================
// Test 1: World Generation and Tile Definitions
// ==========================================
console.log('▶ Test 1: World generation and tile definitions');
const world = generateDefaultSandboxWorld(64, 36);
assert.strictEqual(world.cols, 64, 'World cols should be 64');
assert.strictEqual(world.rows, 36, 'World rows should be 36');
assert.strictEqual(world.tileSize, 32, 'Tile size should be 32');
assert.strictEqual(world.tiles.length, 36, 'World rows array length should be 36');
assert.strictEqual(world.tiles[0].length, 64, 'World row length should be 64');

// Verify tile definitions
assert.ok(TILE_DEFINITIONS.air, 'Air definition exists');
assert.strictEqual(TILE_DEFINITIONS.air.isSolid, false, 'Air is not solid');
assert.ok(TILE_DEFINITIONS.grass, 'Grass definition exists');
assert.strictEqual(TILE_DEFINITIONS.grass.isSolid, true, 'Grass is solid');
assert.ok(TILE_DEFINITIONS.dirt, 'Dirt definition exists');
assert.strictEqual(TILE_DEFINITIONS.dirt.isSolid, true, 'Dirt is solid');
assert.ok(TILE_DEFINITIONS.stone, 'Stone definition exists');
assert.strictEqual(TILE_DEFINITIONS.stone.isSolid, true, 'Stone is solid');
assert.ok(TILE_DEFINITIONS.wood, 'Wood definition exists');
assert.strictEqual(TILE_DEFINITIONS.wood.isSolid, true, 'Wood is solid');

// Solidity checks
assert.strictEqual(isTileSolid('air'), false);
assert.strictEqual(isTileSolid('grass'), true);
assert.strictEqual(isTileSolid('dirt'), true);
assert.strictEqual(isTileSolid('stone'), true);
assert.strictEqual(isTileSolid('wood'), true);

// Terrain layering: top should be air, bottom rows should be stone
const topTile = getTile(world, 10, 0);
assert.strictEqual(topTile, 'air', 'Sky tile should be air');
const bottomTile = getTile(world, 10, 35);
assert.strictEqual(bottomTile, 'stone', 'Deep bedrock/bottom tile should be stone');
console.log('  ✓ World generation and tile definitions passed');

// ==========================================
// Test 2: Coordinate Bounds & Out-of-bounds Access
// ==========================================
console.log('▶ Test 2: Coordinate bounds and out-of-bounds safety');
assert.strictEqual(isValidCoordinate(world, 0, 0), true);
assert.strictEqual(isValidCoordinate(world, 63, 35), true);
assert.strictEqual(isValidCoordinate(world, -1, 10), false);
assert.strictEqual(isValidCoordinate(world, 10, -1), false);
assert.strictEqual(isValidCoordinate(world, 64, 10), false);
assert.strictEqual(isValidCoordinate(world, 10, 36), false);

assert.strictEqual(getTile(world, -1, 5), 'air', 'Out of bounds tile defaults safely to air');
assert.strictEqual(getTile(world, 100, 5), 'air', 'Out of bounds tile defaults safely to air');

const oobMine = mineBlock(world, -5, 10);
assert.strictEqual(oobMine, null, 'Out of bounds mine returns null');

const dummyPlayer: Rect = { x: 100, y: 100, width: 22, height: 32 };
const oobPlace = placeBlock(world, 70, 10, 'wood', dummyPlayer);
assert.strictEqual(oobPlace.success, false);
assert.ok(oobPlace.reason?.includes('outside world boundaries'));
console.log('  ✓ Out-of-bounds access safety passed');

// ==========================================
// Test 3: Mining and Block Collection
// ==========================================
console.log('▶ Test 3: Mining and block collection');
// Find a solid block to mine
let solidCoord: { col: number; row: number } | null = null;
for (let r = 0; r < world.rows; r++) {
  for (let c = 0; c < world.cols; c++) {
    const tile = getTile(world, c, r);
    if (tile && isTileSolid(tile)) {
      solidCoord = { col: c, row: r };
      break;
    }
  }
  if (solidCoord) break;
}
assert.ok(solidCoord, 'Found a solid block in the world');

// Mine air block first (should fail and return null)
const mineAir = mineBlock(world, 0, 0);
assert.strictEqual(mineAir, null, 'Mining air returns null');

// Mine the solid block
const targetTileType = getTile(world, solidCoord.col, solidCoord.row);
const mineResult = mineBlock(world, solidCoord.col, solidCoord.row);
assert.ok(mineResult, 'Mining solid block returns mined result');
assert.strictEqual(mineResult.minedTile, targetTileType);
assert.strictEqual(getTile(world, solidCoord.col, solidCoord.row), 'air', 'Mined block turns to air');

// Collect into inventory
const inventory = createDefaultInventory();
const initialDirt = inventory.items.dirt ?? 0;
const updatedInv = addInventoryItem(inventory, 'dirt', 1);
assert.strictEqual(updatedInv.items.dirt, initialDirt + 1);
console.log('  ✓ Mining and block collection passed');

// ==========================================
// Test 4: Placement and Inventory Decrement
// ==========================================
console.log('▶ Test 4: Block placement and inventory consumption');
// Ensure target coord is currently air
assert.strictEqual(getTile(world, solidCoord.col, solidCoord.row), 'air');

// Safe player position far away
const farPlayer: Rect = { x: 500, y: 500, width: 22, height: 32 };
const placeResult = placeBlock(world, solidCoord.col, solidCoord.row, 'wood', farPlayer);
assert.strictEqual(placeResult.success, true);
assert.strictEqual(getTile(world, solidCoord.col, solidCoord.row), 'wood');

// Place on already solid block should fail
const placeOccupied = placeBlock(world, solidCoord.col, solidCoord.row, 'stone', farPlayer);
assert.strictEqual(placeOccupied.success, false);
assert.ok(placeOccupied.reason?.includes('already occupies'));

// Inventory decrement
const initialWood = updatedInv.items.wood ?? 0;
const afterPlaceInv = consumeInventoryItem(updatedInv, 'wood', 1);
assert.strictEqual(afterPlaceInv.success, true);
assert.strictEqual(afterPlaceInv.inventory.items.wood, initialWood - 1);
console.log('  ✓ Block placement and inventory decrement passed');

// ==========================================
// Test 5: Preventing Placement Inside Player
// ==========================================
console.log('▶ Test 5: Prevent placing block inside player bounding box');
// Mine the wood block back to air
mineBlock(world, solidCoord.col, solidCoord.row);
assert.strictEqual(getTile(world, solidCoord.col, solidCoord.row), 'air');

// Player standing directly inside the target tile:
const overlappingPlayer: Rect = {
  x: solidCoord.col * 32 + 5,
  y: solidCoord.row * 32 + 5,
  width: 22,
  height: 32,
};

assert.strictEqual(
  rectanglesIntersect(
    { x: solidCoord.col * 32, y: solidCoord.row * 32, width: 32, height: 32 },
    overlappingPlayer
  ),
  true,
  'AABB intersection helper correctly detects overlap'
);

const placeInsidePlayer = placeBlock(world, solidCoord.col, solidCoord.row, 'stone', overlappingPlayer);
assert.strictEqual(placeInsidePlayer.success, false);
assert.ok(placeInsidePlayer.reason?.includes('inside the player'));
assert.strictEqual(getTile(world, solidCoord.col, solidCoord.row), 'air', 'Tile remains air');
console.log('  ✓ Preventing placement inside player passed');

// ==========================================
// Test 6: Inventory Bounds and Hotbar Slots
// ==========================================
console.log('▶ Test 6: Inventory non-negative bounds and hotbar selection');
let testInv = createDefaultInventory();
// Wood has initial quantity 8
assert.strictEqual(testInv.items.wood, 8);
assert.strictEqual(hasInventoryItem(testInv, 'wood', 8), true);
assert.strictEqual(hasInventoryItem(testInv, 'wood', 9), false);

// Consuming more than available must fail and not change inventory
const overConsume = consumeInventoryItem(testInv, 'wood', 99);
assert.strictEqual(overConsume.success, false);
assert.strictEqual(overConsume.inventory.items.wood, 8, 'Count unchanged on failure');

// Consuming all down to 0
const consumeAll = consumeInventoryItem(testInv, 'wood', 8);
assert.strictEqual(consumeAll.success, true);
assert.strictEqual(consumeAll.inventory.items.wood, 0);

// Consuming from 0 must fail
const consumeZero = consumeInventoryItem(consumeAll.inventory, 'wood', 1);
assert.strictEqual(consumeZero.success, false);
assert.strictEqual(consumeZero.inventory.items.wood, 0);

// Hotbar selection
testInv = setSelectedSlot(testInv, 1);
assert.strictEqual(testInv.selectedSlot, 1);
const selectedType = getSelectedBlockType(testInv);
assert.strictEqual(selectedType, 'dirt');

// Out of range slot selection is clamped
const clampedInvLow = setSelectedSlot(testInv, -5);
assert.strictEqual(clampedInvLow.selectedSlot, 0);
const clampedInvHigh = setSelectedSlot(testInv, 99);
assert.strictEqual(clampedInvHigh.selectedSlot, 3);
console.log('  ✓ Inventory bounds and hotbar selection passed');

// ==========================================
// Test 7: Persistence Round-Trip
// ==========================================
console.log('▶ Test 7: Sandbox save and load round-trip');
const customWorld: SandboxWorldData = {
  ...world,
  spawnPoint: { x: 320, y: 240 },
};
const customInv = createDefaultInventory();
customInv.items.dirt = 42;

const savePayload: SandboxSaveData = {
  id: 'sandbox-test-save-1',
  name: 'My Custom Sandbox',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  world: customWorld,
  player: {
    x: 350,
    y: 260,
    inventory: customInv,
  },
  schemaVersion: '1.0',
};

const saveResult = saveSandbox(savePayload);
assert.strictEqual(saveResult, true, 'Save succeeds');

const loaded = loadSandbox();
assert.ok(loaded, 'Loaded save data exists');
assert.strictEqual(loaded.schemaVersion, '1.0');
assert.strictEqual(loaded.world.cols, customWorld.cols);
assert.strictEqual(loaded.world.spawnPoint.x, 320);
assert.strictEqual(loaded.player.x, 350);
assert.strictEqual(loaded.player.inventory.items.dirt, 42);
console.log('  ✓ Persistence round-trip passed');

// ==========================================
// Test 8: Corrupted Save Data Handling
// ==========================================
console.log('▶ Test 8: Corrupted save data rejection');
// Direct validation test
const corruptedPayload = {
  world: { invalidKey: 'bad' },
  player: 'not-an-object',
};
const validatedNull = validateSandboxSaveData(corruptedPayload);
assert.strictEqual(validatedNull, null, 'Corrupted data rejected by validator');

// Missing required fields
const partialPayload = {
  schemaVersion: '1.0',
  world: { cols: 10 }, // incomplete
};
assert.strictEqual(validateSandboxSaveData(partialPayload), null);

// Valid schema check
const parsed = SandboxSaveDataSchema.safeParse(savePayload);
assert.strictEqual(parsed.success, true, 'Valid payload passes Zod schema');
console.log('  ✓ Corrupted save data handling passed');

// ==========================================
// Test 9: Drawing Submission Contract (No Fake AI)
// ==========================================
console.log('▶ Test 9: Draw to Craft submission contract (Phase 7.2 placeholder)');
const sampleSubmission: CraftSubmission = {
  id: 'craft-sub-1',
  strokesCount: 5,
  submittedAt: new Date().toISOString(),
  status: 'submitted-pending-recognition',
  recognition: {
    predictedLabel: 'Pending Recognition (Phase 7.2)',
    confidence: 0,
    provenance: 'mock-heuristic',
    isEligibleForCrafting: false,
  },
};

const parsedSubmission = CraftSubmissionSchema.parse(sampleSubmission);
assert.strictEqual(parsedSubmission.status, 'submitted-pending-recognition');
assert.strictEqual(parsedSubmission.recognition?.isEligibleForCrafting, false);
assert.strictEqual(parsedSubmission.recognition?.provenance, 'mock-heuristic');
assert.strictEqual(parsedSubmission.recognition?.predictedLabel, 'Pending Recognition (Phase 7.2)');
console.log('  ✓ Draw to Craft submission contract verified (No fake AI predictions)');

// ==========================================
// Test 10: Backward Compatibility with My Creations
// ==========================================
console.log('▶ Test 10: Preservation of My Creations storage');
// Save a creation in the studio storage
const sampleDocument = {
  id: 'doc-compat-1',
  name: 'Platformer Paradise',
  canvasWidth: 800,
  canvasHeight: 500,
  coordinateConvention: 'normalized-unit' as const,
  strokes: [
    {
      id: 'stroke-1',
      elementType: 'ground' as const,
      color: '#10b981',
      width: 12,
      points: [
        { x: 0.1, y: 0.8 },
        { x: 0.4, y: 0.8 },
      ],
      timestamp: 1000,
    },
  ],
  createdAt: '2026-10-10T12:00:00Z',
  updatedAt: '2026-10-10T12:00:00Z',
  schemaVersion: '1.0' as const,
};

const creation = saveCreation({
  name: 'Platformer Paradise',
  document: sampleDocument,
  provenance: 'local-vector',
  tags: ['sandbox-isolation-test'],
});
assert.ok(creation.id);

// Verify creation exists
const creationsBefore = getAllCreations();
const countBefore = creationsBefore.length;
assert.ok(countBefore >= 1);

// Now perform sandbox save & load
saveSandbox(savePayload);
const sandboxData = loadSandbox();
assert.ok(sandboxData);

// Verify creations remain untouched
const creationsAfter = getAllCreations();
assert.strictEqual(creationsAfter.length, countBefore, 'Creations count unaffected by sandbox save');
assert.strictEqual(
  creationsAfter.some((c) => c.name === 'Platformer Paradise'),
  true,
  'Existing creation preserved'
);
console.log('  ✓ Backward compatibility with My Creations verified');

console.log('\n🎉 ALL 10 Draw2Play Phase 7.1 Sandbox Tests Passed Successfully!\n');
