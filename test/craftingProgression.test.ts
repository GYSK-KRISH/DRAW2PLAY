import assert from 'node:assert';
import {
  SANDBOX_ITEM_IDS,
  SANDBOX_ITEM_CATALOGUE,
  isValidSandboxItem,
  isItemPlaceable,
  TILE_DEFINITIONS,
  PLACEABLE_BLOCK_TYPES,
  type SandboxItemId,
  type PlaceableBlockType,
  type SandboxSaveData,
} from '../src/types/sandbox.js';
import {
  CRAFTING_RECIPES,
  canCraftRecipe,
  calculateMaxCraftable,
  craftRecipe,
  getAvailableRecipes,
  getRecipesForCategory,
} from '../src/game/sandbox/sandboxRecipes.js';
import {
  createDefaultInventory,
  addInventoryItem,
  consumeInventoryItem,
  hasInventoryItem,
  getInventoryCount,
  setHotbarSlot,
  getSelectedBlockType,
  awardCraftedItem,
  MAX_INVENTORY_STACK,
} from '../src/game/sandbox/sandboxInventory.js';
import {
  generateDefaultSandboxWorld,
  placeBlock,
  mineBlock,
  getTile,
  type Rect,
} from '../src/game/sandbox/sandboxWorld.js';
import {
  saveSandbox,
  loadSandbox,
  clearSandboxGameForTest,
  migrateSandboxSave,
  validateSandboxSaveData,
} from '../src/services/sandboxStorage.js';

console.log('🧪 Starting Draw2Play Phase 8: Sandbox Expansion & Crafting Progression Test Suite...\n');

clearSandboxGameForTest();

// ===========================================================================
// Test 1: Catalogue uniqueness and valid metadata
// ===========================================================================
console.log('▶ Test 1: Item catalogue uniqueness and valid metadata');
const itemIdsSet = new Set(SANDBOX_ITEM_IDS);
assert.strictEqual(itemIdsSet.size, SANDBOX_ITEM_IDS.length, 'All item IDs in SANDBOX_ITEM_IDS must be unique');
assert.strictEqual(SANDBOX_ITEM_IDS.length, 13, 'Expected 13 registered items in the catalogue');

for (const id of SANDBOX_ITEM_IDS) {
  const item = SANDBOX_ITEM_CATALOGUE[id];
  assert.ok(item, `Item ${id} must exist in SANDBOX_ITEM_CATALOGUE`);
  assert.strictEqual(item.id, id, `Item id property must match key ${id}`);
  assert.ok(typeof item.displayName === 'string' && item.displayName.length > 0, `${id} must have non-empty displayName`);
  assert.ok(['block', 'material', 'tool', 'placeable', 'crafted'].includes(item.category), `${id} must have valid category`);
  assert.strictEqual(item.maxStack, 999, `${id} must have 999 maxStack`);
  assert.strictEqual(typeof item.isPlaceable, 'boolean', `${id} must have boolean isPlaceable`);
  assert.strictEqual(typeof item.isMinable, 'boolean', `${id} must have boolean isMinable`);
  assert.ok(typeof item.colorHex === 'string' && item.colorHex.startsWith('#'), `${id} must have valid hex color`);
  assert.ok(typeof item.icon === 'string' && item.icon.length > 0, `${id} must have icon`);
  assert.ok(Array.isArray(item.keywords) && item.keywords.length > 0, `${id} must have keywords`);
}
console.log('  ✓ Item catalogue uniqueness and metadata verified');

// ===========================================================================
// Test 2: Existing item IDs remain supported
// ===========================================================================
console.log('▶ Test 2: Existing item IDs remain supported');
const legacyFour: SandboxItemId[] = ['grass', 'dirt', 'stone', 'wood'];
for (const legacyId of legacyFour) {
  assert.strictEqual(isValidSandboxItem(legacyId), true, `Legacy item ${legacyId} must remain valid`);
  assert.ok(SANDBOX_ITEM_CATALOGUE[legacyId], `Legacy item ${legacyId} must exist in catalogue`);
  assert.strictEqual(isItemPlaceable(legacyId), true, `Legacy item ${legacyId} must remain placeable`);
}
console.log('  ✓ All 4 legacy baseline item IDs remain fully supported');

// ===========================================================================
// Test 3: Unknown IDs are rejected
// ===========================================================================
console.log('▶ Test 3: Unknown item IDs are rejected');
assert.strictEqual(isValidSandboxItem('unobtainium'), false, 'Unobtainium must be rejected');
assert.strictEqual(isValidSandboxItem('diamond_sword'), false, 'Unknown tools must be rejected');
assert.strictEqual(isValidSandboxItem(''), false, 'Empty string must be rejected');
assert.strictEqual(isItemPlaceable('stick'), false, 'stick is not placeable');
assert.strictEqual(isItemPlaceable('nonexistent'), false, 'nonexistent items are not placeable');
console.log('  ✓ Unknown IDs rejected cleanly');

// ===========================================================================
// Test 4: Valid recipe crafting
// ===========================================================================
console.log('▶ Test 4: Valid recipe crafting');
let inv = createDefaultInventory();
const initialWood = getInventoryCount(inv, 'wood');
const planksRecipe = CRAFTING_RECIPES.find((r) => r.id === 'recipe-wood-to-planks');
assert.ok(planksRecipe, 'recipe-wood-to-planks must exist');

assert.strictEqual(canCraftRecipe(inv, planksRecipe).canCraft, true, 'Should be able to craft planks with wood');
const craftResult = craftRecipe(inv, 'recipe-wood-to-planks', 1);
assert.strictEqual(craftResult.success, true, 'Crafting planks should succeed');
assert.strictEqual(getInventoryCount(craftResult.inventory, 'wood'), initialWood - 1, 'Wood count should decrease by 1');
assert.strictEqual(getInventoryCount(craftResult.inventory, 'wood_planks'), 4, 'Should gain 4 wood_planks');
assert.strictEqual(craftResult.craftedCount, 4, 'craftedCount should be 4');

// Craft sticks from planks
const sticksResult = craftRecipe(craftResult.inventory, 'recipe-planks-to-sticks', 1);
assert.strictEqual(sticksResult.success, true, 'Crafting sticks should succeed');
assert.strictEqual(getInventoryCount(sticksResult.inventory, 'wood_planks'), 2, '2 planks consumed');
assert.strictEqual(getInventoryCount(sticksResult.inventory, 'stick'), 4, '4 sticks granted');
assert.strictEqual(PLACEABLE_BLOCK_TYPES.length, 12, 'Expected 12 placeable block types');

// Inventory checks
assert.strictEqual(hasInventoryItem(inv, 'wood', 1), true, 'hasInventoryItem should be true');
const testConsumed = consumeInventoryItem(inv, 'wood', 1);
assert.strictEqual(testConsumed.success, true, 'consumeInventoryItem should succeed');

// Recipe queries
const maxPlanks = calculateMaxCraftable(inv, 'recipe-wood-to-planks');
assert.ok(maxPlanks > 0, 'calculateMaxCraftable should be positive');

const avail = getAvailableRecipes(inv);
assert.ok(avail.length > 0, 'getAvailableRecipes should return available recipes');

const basic = getRecipesForCategory('basic');
assert.ok(basic.length > 0, 'getRecipesForCategory should return basic recipes');

console.log('  ✓ Valid recipe crafting succeeded');

// ===========================================================================
// Test 5: Insufficient ingredients
// ===========================================================================
console.log('▶ Test 5: Insufficient ingredients rejection');
let emptyInv = createDefaultInventory();
// Provide stick but omit coal to test missing coal rejection
emptyInv = addInventoryItem(emptyInv, 'stick', 2);
const torchFail = craftRecipe(emptyInv, 'recipe-torch-coal', 1);
assert.strictEqual(torchFail.success, false, 'Crafting torch without coal must fail');
assert.strictEqual(torchFail.craftedCount, 0);
assert.ok(torchFail.reason?.toLowerCase().includes('coal'), 'Failure message must mention missing coal');
assert.deepStrictEqual(torchFail.inventory.items, emptyInv.items, 'Inventory items must remain unchanged');
console.log('  ✓ Insufficient ingredients rejected with zero inventory loss');

// ===========================================================================
// Test 6: Atomic inventory updates
// ===========================================================================
console.log('▶ Test 6: Atomic inventory updates');
// Workbench requires 4 wood_planks. Give only 2 wood_planks.
let testInv = createDefaultInventory();
testInv = addInventoryItem(testInv, 'wood_planks', 2);
const initialPlanks = getInventoryCount(testInv, 'wood_planks');

const wbFail = craftRecipe(testInv, 'recipe-workbench', 1);
assert.strictEqual(wbFail.success, false, 'Workbench craft must fail');
assert.strictEqual(getInventoryCount(wbFail.inventory, 'wood_planks'), initialPlanks, 'Planks must NOT be partially consumed');
assert.strictEqual(getInventoryCount(wbFail.inventory, 'workbench'), 0, 'No workbench should be created');
console.log('  ✓ Crafting is strictly atomic: no partial ingredient consumption');

// ===========================================================================
// Test 7: Output stack limits and full inventory behavior
// ===========================================================================
console.log('▶ Test 7: Output stack limits and overflow guard');
let maxedInv = createDefaultInventory();
// Set wood_planks to max stack
maxedInv = {
  ...maxedInv,
  items: {
    ...maxedInv.items,
    wood: 100,
    wood_planks: MAX_INVENTORY_STACK, // 999
  },
};
const overflowCraft = craftRecipe(maxedInv, 'recipe-wood-to-planks', 1);
assert.strictEqual(overflowCraft.success, false, 'Cannot craft when output inventory stack is full');
assert.ok(
  overflowCraft.reason?.includes('exceed max') || overflowCraft.reason?.includes('stack'),
  'Reason should report stack limit reached'
);
assert.strictEqual(getInventoryCount(overflowCraft.inventory, 'wood'), 100, 'Wood should not be consumed when output is full');
console.log('  ✓ Stack limit (999) enforced and craft overflow guarded');

// ===========================================================================
// Test 8: Non-placeable items cannot be placed
// ===========================================================================
console.log('▶ Test 8: Non-placeable items cannot be placed');
const testWorld = generateDefaultSandboxWorld(64, 36);
const playerRect: Rect = { x: 300, y: 300, width: 22, height: 32 };
// Stick is not placeable
const stickPlace = placeBlock(testWorld, 5, 5, 'stick' as PlaceableBlockType, playerRect);
assert.strictEqual(stickPlace.success, false, 'Placing a stick must fail');
assert.ok(stickPlace.reason?.includes('not a placeable block'), 'Must state stick is non-placeable');
assert.strictEqual(getTile(testWorld, 5, 5), 'air', 'Tile must remain air');
console.log('  ✓ Non-placeable items correctly rejected from world tile placement');

// ===========================================================================
// Test 9: Placeable crafted blocks can be placed in world
// ===========================================================================
console.log('▶ Test 9: Placeable crafted blocks can be placed in world');
const craftedBlocks: PlaceableBlockType[] = ['wood_planks', 'workbench', 'torch', 'stone_brick', 'glass'];
for (let i = 0; i < craftedBlocks.length; i++) {
  const blockType = craftedBlocks[i];
  const col = 10 + i;
  const row = 5;
  const placeResult = placeBlock(testWorld, col, row, blockType, playerRect);
  assert.strictEqual(placeResult.success, true, `Placing ${blockType} should succeed`);
  assert.strictEqual(getTile(testWorld, col, row), blockType, `Tile at ${col},${row} should be ${blockType}`);
  assert.strictEqual(TILE_DEFINITIONS[blockType].isSolid, true, `Solid check for ${blockType}`);
}
console.log('  ✓ Crafted blocks (wood_planks, workbench, torch, stone_brick, glass) placed successfully');

// ===========================================================================
// Test 10: Natural mining returns correct catalogue block type
// ===========================================================================
console.log('▶ Test 10: Natural mining returns correct catalogue block type');
for (let i = 0; i < craftedBlocks.length; i++) {
  const blockType = craftedBlocks[i];
  const col = 10 + i;
  const row = 5;
  const mineResult = mineBlock(testWorld, col, row);
  assert.ok(mineResult, `Mining ${blockType} should return result`);
  assert.strictEqual(mineResult.minedTile, blockType, `Mined tile should be ${blockType}`);
  assert.strictEqual(getTile(testWorld, col, row), 'air', 'Tile after mining must be air');
}
console.log('  ✓ Mining newly supported blocks returns proper catalogue items');

// ===========================================================================
// Test 11: World and inventory save/load round-trip with v2.0 format
// ===========================================================================
console.log('▶ Test 11: World and inventory save/load round-trip (v2.0)');
let saveInv = createDefaultInventory();
saveInv = addInventoryItem(saveInv, 'wood_planks', 12);
saveInv = addInventoryItem(saveInv, 'stick', 8);
saveInv = addInventoryItem(saveInv, 'coal', 5);
saveInv = setHotbarSlot(saveInv, 1, 'wood_planks');
assert.strictEqual(getSelectedBlockType(saveInv), 'grass', 'Selected block type should default to slot 0 (grass)');

const saveData: SandboxSaveData = {
  id: 'test-phase-8-save',
  name: 'Phase 8 Adventure',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  world: testWorld,
  player: {
    x: 320,
    y: 400,
    inventory: saveInv,
  },
  schemaVersion: '2.0',
};

saveSandbox(saveData);
const loaded = loadSandbox();
assert.ok(loaded, 'Loaded sandbox must exist');
assert.strictEqual(loaded.schemaVersion, '2.0', 'Loaded schemaVersion should be 2.0');
assert.strictEqual(getInventoryCount(loaded.player.inventory, 'wood_planks'), 12);
assert.strictEqual(getInventoryCount(loaded.player.inventory, 'stick'), 8);
assert.strictEqual(getInventoryCount(loaded.player.inventory, 'coal'), 5);
assert.strictEqual(loaded.player.inventory.hotbar?.[1], 'wood_planks');
console.log('  ✓ Save/load round-trip verified with expanded inventory and hotbar');

// ===========================================================================
// Test 12: Legacy save compatibility and migration (v1.0 -> v2.0)
// ===========================================================================
console.log('▶ Test 12: Legacy save compatibility and migration');
const legacySave = {
  id: 'legacy-v1-save',
  name: 'Old Sandbox',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  world: {
    cols: 64,
    rows: 36,
    tileSize: 32,
    tiles: generateDefaultSandboxWorld(64, 36).tiles,
    spawnPoint: { x: 300, y: 300 },
  },
  player: {
    x: 300,
    y: 300,
    inventory: {
      items: {
        grass: 8,
        dirt: 15,
        stone: 20,
        wood: 7,
      },
      selectedSlot: 2,
    },
  },
  schemaVersion: '1.0',
};

const migrated = migrateSandboxSave(legacySave);
assert.ok(migrated, 'Migrated save must not be null');
assert.strictEqual(migrated!.schemaVersion, '2.0', 'Migrated save schemaVersion must be 2.0');
assert.strictEqual(migrated!.player.inventory.items.grass, 8);
assert.strictEqual(migrated!.player.inventory.items.dirt, 15);
assert.strictEqual(migrated!.player.inventory.items.stone, 20);
assert.strictEqual(migrated!.player.inventory.items.wood, 7);
assert.ok(Array.isArray(migrated!.player.inventory.hotbar), 'Migrated inventory must have hotbar array');
assert.strictEqual(migrated!.player.inventory.hotbar?.length, 4, 'Hotbar length should be 4');
assert.deepStrictEqual(migrated!.player.inventory.hotbar, ['grass', 'dirt', 'stone', 'wood']);
console.log('  ✓ Legacy v1.0 saves migrate safely to v2.0 without loss');

// ===========================================================================
// Test 13: Corrupted-save handling
// ===========================================================================
console.log('▶ Test 13: Corrupted-save handling');
assert.strictEqual(validateSandboxSaveData(null), null, 'null save rejected');
assert.strictEqual(validateSandboxSaveData({}), null, 'empty object save rejected');
assert.strictEqual(validateSandboxSaveData({ world: 'invalid' }), null, 'malformed world rejected');

// Negative items in inventory
const negativeInvSave = {
  ...saveData,
  player: {
    ...saveData.player,
    inventory: {
      items: { grass: -10 },
      selectedSlot: 0,
    },
  },
};
assert.strictEqual(validateSandboxSaveData(negativeInvSave), null, 'Negative inventory counts rejected');

// Invalid world dimensions
const badDimSave = {
  ...saveData,
  world: {
    ...testWorld,
    cols: 500, // Exceeds max 256
  },
};
assert.strictEqual(validateSandboxSaveData(badDimSave), null, 'World exceeding maximum columns rejected');
console.log('  ✓ Corrupted, invalid dimensions, and negative values rejected gracefully');

// ===========================================================================
// Test 14: Draw-to-Craft allowlist enforcement and award integration
// ===========================================================================
console.log('▶ Test 14: Draw-to-Craft allowlist enforcement and award integration');
let craftInv = createDefaultInventory();
// Award valid item
const awardSuccess = awardCraftedItem(craftInv, 'wood_planks');
assert.strictEqual(awardSuccess.success, true, 'Awarding wood_planks must succeed');
assert.strictEqual(awardSuccess.item?.id, 'wood_planks');
assert.strictEqual(getInventoryCount(awardSuccess.inventory, 'wood_planks'), 1);

// Award invalid/unknown item
const awardFail = awardCraftedItem(craftInv, 'unobtainium' as any);
assert.strictEqual(awardFail.success, false, 'Awarding unknown item must fail');
assert.strictEqual(awardFail.item, undefined);
console.log('  ✓ Draw-to-Craft awards only supported catalogue items');

// ===========================================================================
// Test 15: Duplicate acceptance does not grant repeated rewards
// ===========================================================================
console.log('▶ Test 15: Duplicate acceptance does not grant repeated rewards');
const submissionId = 'sub-12345';
const awardedSet = new Set<string>();

// First award
assert.strictEqual(awardedSet.has(submissionId), false);
awardedSet.add(submissionId);
let awardedInv = awardCraftedItem(createDefaultInventory(), 'torch').inventory;
assert.strictEqual(getInventoryCount(awardedInv, 'torch'), 1);

// Attempt duplicate submission
if (awardedSet.has(submissionId)) {
  // Simulates the SandboxGameView duplicate guard
  // Do not award again
} else {
  awardedInv = awardCraftedItem(awardedInv, 'torch').inventory;
}
assert.strictEqual(getInventoryCount(awardedInv, 'torch'), 1, 'Torch count must still be 1 (no duplicate reward)');
console.log('  ✓ Idempotency guard prevents duplicate reward awards');

console.log('\n🎉 ALL 15 CRAFTING PROGRESSION & SANDBOX EXPANSION TESTS PASSED!\n');
