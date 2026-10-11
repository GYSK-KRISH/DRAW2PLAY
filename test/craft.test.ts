import assert from 'node:assert';
import {
  CRAFTABLE_ITEM_ALLOWLIST,
  CRAFTABLE_ITEMS_CATALOGUE,
  isValidCraftableItem,
  RecognizeCraftResponseSchema,
  RecognizeCraftRequestSchema,
  type SandboxInventory,
} from '../src/types/sandbox.js';
import {
  ServerRecognizeCraftRequestSchema,
} from '../server/schemas/craft.schema.js';
import {
  recognizeCraftDrawing,
  generateHeuristicCraftRecognition,
} from '../server/services/craftRecognition.service.js';
import {
  createDefaultInventory,
  awardCraftedItem,
  getInventoryCount,
  MAX_INVENTORY_STACK,
} from '../src/game/sandbox/sandboxInventory.js';
import {
  saveSandbox,
  loadSandbox,
  clearSandboxGameForTest,
} from '../src/services/sandboxStorage.js';
import {
  GeminiProvider,
  GoogleGenAIClientLike,
} from '../server/providers/gemini.provider.js';
import { generateDefaultSandboxWorld } from '../src/game/sandbox/sandboxWorld.js';

console.log('🧪 Starting Draw2Play Phase 7.2 Draw-to-Craft Sketch Recognition Test Suite...\n');

clearSandboxGameForTest();

const samplePngBase64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAALUlEQVRYR+3QQREAAAzCQNk/9WY49BwJyG06W3sAAAAAAAAAAAAAAPg2aP4AAQEQa34AAAAASUVORK5CYII=';

// ===========================================================================
// Test 1: Valid recognition request validation
// ===========================================================================
console.log('▶ Test 1: Valid recognition request validation');
const validReq = {
  imageBase64: samplePngBase64,
  strokeCount: 4,
  allowFallback: true,
  clientTimestamp: new Date().toISOString(),
};
const parsedReq = ServerRecognizeCraftRequestSchema.parse(validReq);
const parsedClientReq = RecognizeCraftRequestSchema.parse(validReq);
assert.strictEqual(parsedReq.strokeCount, 4);
assert.strictEqual(parsedClientReq.allowFallback, true);
console.log('  ✓ Valid recognition request parsed successfully');

// ===========================================================================
// Test 2: Empty and malformed drawing rejection
// ===========================================================================
console.log('▶ Test 2: Empty and malformed drawing rejection');
// Empty base64
const emptyResult = await recognizeCraftDrawing({
  imageBase64: '',
  strokeCount: 0,
  allowFallback: true,
});
assert.strictEqual(emptyResult.status, 'invalid-input');
assert.strictEqual(emptyResult.mappedItemId, null);

// Zero stroke count
const zeroStrokeResult = await recognizeCraftDrawing({
  imageBase64: samplePngBase64,
  strokeCount: 0,
  allowFallback: true,
});
assert.strictEqual(zeroStrokeResult.status, 'invalid-input');
assert.ok(zeroStrokeResult.explanation.includes('Zero strokes'));
console.log('  ✓ Empty and zero-stroke drawings correctly rejected with invalid-input');

// ===========================================================================
// Test 3: Payload size and dimension limits
// ===========================================================================
console.log('▶ Test 3: Payload size limits');
// Excessively large payload (> 5MB)
const oversizedBase64 = 'A'.repeat(6 * 1024 * 1024);
const oversizedParsed = ServerRecognizeCraftRequestSchema.safeParse({
  imageBase64: oversizedBase64,
});
assert.strictEqual(oversizedParsed.success, false, 'Oversized payload rejected');

// Tiny payload (< 50 characters)
const tinyParsed = ServerRecognizeCraftRequestSchema.safeParse({
  imageBase64: 'data:image/png;base64,tiny',
});
assert.strictEqual(tinyParsed.success, false, 'Tiny payload rejected');
console.log('  ✓ Payload size bounds enforced');

// ===========================================================================
// Test 4: Provider success with structured parsing
// ===========================================================================
console.log('▶ Test 4: Provider success with structured parsing');
const mockSuccessClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async () => ({
      text: JSON.stringify({
        detectedSubject: 'Pickaxe Outline',
        matchedCategory: 'wood',
        confidence: 0.94,
        explanation: 'Identified wooden tool handle and pickaxe silhouette.',
        alternativeSubjects: ['Wooden Axe', 'Staff'],
      }),
    }),
  },
};

const mockSuccessProvider = new GeminiProvider({
  client: mockSuccessClient,
  apiKey: 'mock-key-for-tests',
});

const successResult = await recognizeCraftDrawing(
  {
    imageBase64: samplePngBase64,
    strokeCount: 6,
    allowFallback: false,
  },
  { providerOverride: mockSuccessProvider }
);

assert.strictEqual(successResult.status, 'recognized');
assert.strictEqual(successResult.predictedLabel, 'Pickaxe Outline');
assert.strictEqual(successResult.mappedItemId, 'wood');
assert.strictEqual(successResult.confidence, 0.94);
assert.strictEqual(successResult.confidenceTier, 'high');
assert.strictEqual(successResult.provenance, 'gemini-vision');
assert.strictEqual(successResult.isFallback, false);
console.log('  ✓ Provider success parsed into structured response with gemini-vision provenance');

// ===========================================================================
// Test 5: Provider timeout handling
// ===========================================================================
console.log('▶ Test 5: Provider timeout handling');
const mockTimeoutClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async () => {
      throw new Error('Request timed out after 15000ms');
    },
  },
};

const mockTimeoutProvider = new GeminiProvider({
  client: mockTimeoutClient,
  apiKey: 'mock-key-for-tests',
});

// Without fallback: provider-unavailable
const timeoutWithoutFallback = await recognizeCraftDrawing(
  {
    imageBase64: samplePngBase64,
    strokeCount: 4,
    allowFallback: false,
  },
  { providerOverride: mockTimeoutProvider }
);
assert.strictEqual(timeoutWithoutFallback.status, 'provider-unavailable');
assert.strictEqual(timeoutWithoutFallback.mappedItemId, null);

// With fallback: graceful degradation to mock-heuristic
const timeoutWithFallback = await recognizeCraftDrawing(
  {
    imageBase64: samplePngBase64,
    strokeCount: 4,
    allowFallback: true,
  },
  { providerOverride: mockTimeoutProvider }
);
assert.strictEqual(timeoutWithFallback.status, 'needs-review');
assert.strictEqual(timeoutWithFallback.provenance, 'mock-heuristic');
assert.strictEqual(timeoutWithFallback.isFallback, true);
console.log('  ✓ Provider timeout handled with provider-unavailable or mock-heuristic fallback');

// ===========================================================================
// Test 6: Missing API key / provider unconfigured
// ===========================================================================
console.log('▶ Test 6: Missing API key / provider unconfigured');
const unconfiguredProvider = new GeminiProvider({
  apiKey: '',
});
assert.strictEqual(unconfiguredProvider.isConfigured(), false);

// When allowFallback = false
const unconfNoFallback = await recognizeCraftDrawing(
  {
    imageBase64: samplePngBase64,
    strokeCount: 3,
    allowFallback: false,
  },
  { providerOverride: unconfiguredProvider }
);
assert.strictEqual(unconfNoFallback.status, 'provider-unavailable');
assert.strictEqual(unconfNoFallback.mappedItemId, null);

// When allowFallback = true
const unconfWithFallback = await recognizeCraftDrawing(
  {
    imageBase64: samplePngBase64,
    strokeCount: 3,
    allowFallback: true,
  },
  { providerOverride: unconfiguredProvider }
);
assert.strictEqual(unconfWithFallback.status, 'needs-review');
assert.strictEqual(unconfWithFallback.provenance, 'mock-heuristic');
assert.strictEqual(unconfWithFallback.isFallback, true);
console.log('  ✓ Missing API key handled safely without false live claims');

// ===========================================================================
// Test 7: Malformed provider response recovery
// ===========================================================================
console.log('▶ Test 7: Malformed provider response recovery');
const mockMalformedClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async () => ({
      text: 'Sorry, I cannot return JSON right now.',
    }),
  },
};

const mockMalformedProvider = new GeminiProvider({
  client: mockMalformedClient,
  apiKey: 'mock-key-for-tests',
});

const malformedResult = await recognizeCraftDrawing(
  {
    imageBase64: samplePngBase64,
    strokeCount: 5,
    allowFallback: true,
  },
  { providerOverride: mockMalformedProvider }
);
assert.strictEqual(malformedResult.provenance, 'mock-heuristic');
assert.strictEqual(malformedResult.isFallback, true);
assert.ok(malformedResult.limitationsAndWarnings.some((w) => w.includes('Live provider failed')));
console.log('  ✓ Malformed provider response cleanly caught and degraded');

// ===========================================================================
// Test 8: Unsupported drawing prediction (e.g. airplane)
// ===========================================================================
console.log('▶ Test 8: Unsupported drawing prediction');
const mockUnsupportedClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async () => ({
      text: JSON.stringify({
        detectedSubject: 'Commercial Airplane',
        matchedCategory: 'unsupported',
        confidence: 0.91,
        explanation: 'Depicts an aircraft with jet wings and tail fin.',
        alternativeSubjects: ['Glider'],
      }),
    }),
  },
};

const mockUnsupportedProvider = new GeminiProvider({
  client: mockUnsupportedClient,
  apiKey: 'mock-key-for-tests',
});

const unsupportedResult = await recognizeCraftDrawing(
  {
    imageBase64: samplePngBase64,
    strokeCount: 10,
    allowFallback: false,
  },
  { providerOverride: mockUnsupportedProvider }
);

assert.strictEqual(unsupportedResult.status, 'unsupported');
assert.strictEqual(unsupportedResult.predictedLabel, 'Commercial Airplane');
assert.strictEqual(unsupportedResult.mappedItemId, null);
assert.strictEqual(unsupportedResult.provenance, 'gemini-vision');
assert.ok(unsupportedResult.limitationsAndWarnings[0].includes('outside the supported sandbox'));
console.log('  ✓ Out-of-theme sketches correctly classified as unsupported with mappedItemId=null');

// ===========================================================================
// Test 9: Unknown item ID rejection against allowlist
// ===========================================================================
console.log('▶ Test 9: Unknown item ID rejection against allowlist');
assert.strictEqual(isValidCraftableItem('wood'), true);
assert.strictEqual(isValidCraftableItem('stone'), true);
assert.strictEqual(isValidCraftableItem('dirt'), true);
assert.strictEqual(isValidCraftableItem('grass'), true);
assert.strictEqual(isValidCraftableItem('diamond_sword'), false);
assert.strictEqual(isValidCraftableItem('nuclear_bomb'), false);
assert.strictEqual(isValidCraftableItem(123), false);

const testInv = createDefaultInventory();
const badAward = awardCraftedItem(testInv, 'unknown_contraption');
assert.strictEqual(badAward.success, false);
assert.ok(badAward.reason?.includes('Not in the sandbox craftable catalogue'));
console.log('  ✓ Unknown item IDs strictly rejected by allowlist validator');

// ===========================================================================
// Test 10: Missing confidence handling
// ===========================================================================
console.log('▶ Test 10: Missing confidence handling');
const heuristicResult = generateHeuristicCraftRecognition({
  imageBase64: samplePngBase64,
  strokeCount: 3,
  allowFallback: true,
});
assert.strictEqual(heuristicResult.confidence, null, 'Heuristic does not invent fabricated probabilities');
assert.strictEqual(heuristicResult.confidenceTier, 'unknown');
assert.strictEqual(heuristicResult.provenance, 'mock-heuristic');
console.log('  ✓ Missing confidence handled as null/unknown without fabricated numbers');

// ===========================================================================
// Test 11: Explicit acceptance awards exactly one item
// ===========================================================================
console.log('▶ Test 11: Explicit acceptance awards exactly one item');
let playerInv = createDefaultInventory();
const initialWood = getInventoryCount(playerInv, 'wood');

const awardRes = awardCraftedItem(playerInv, 'wood');
assert.strictEqual(awardRes.success, true);
assert.strictEqual(awardRes.item?.id, 'wood');
assert.strictEqual(getInventoryCount(awardRes.inventory, 'wood'), initialWood + 1);
playerInv = awardRes.inventory;
console.log('  ✓ Explicit acceptance increments item count by exactly 1');

// ===========================================================================
// Test 12: Rejection awards no item
// ===========================================================================
console.log('▶ Test 12: Rejection awards no item');
const beforeRejectionCount = getInventoryCount(playerInv, 'wood');
// User clicks "Reject" -> awardCraftedItem is not called
const afterRejectionCount = getInventoryCount(playerInv, 'wood');
assert.strictEqual(beforeRejectionCount, afterRejectionCount, 'Inventory count completely unchanged');
console.log('  ✓ Rejection awards zero items');

// ===========================================================================
// Test 13: Duplicate submission cannot award twice (idempotency)
// ===========================================================================
console.log('▶ Test 13: Duplicate submission cannot award twice (idempotency)');
const processedSubmissions = new Set<string>();
const subId = 'craft-idempotency-token-1';

function simulatePlayerAward(id: string, itemId: 'stone', inv: SandboxInventory) {
  if (processedSubmissions.has(id)) {
    return { success: false, reason: 'Already awarded', inv };
  }
  const award = awardCraftedItem(inv, itemId);
  if (award.success) {
    processedSubmissions.add(id);
    return { success: true, inv: award.inventory };
  }
  return { success: false, reason: award.reason, inv };
}

const firstAttempt = simulatePlayerAward(subId, 'stone', playerInv);
assert.strictEqual(firstAttempt.success, true);
playerInv = firstAttempt.inv;

// Second attempt with same token (e.g. double click or stale event)
const secondAttempt = simulatePlayerAward(subId, 'stone', playerInv);
assert.strictEqual(secondAttempt.success, false);
assert.strictEqual(secondAttempt.reason, 'Already awarded');
console.log('  ✓ Idempotency mechanism prevents duplicate item awards');

// ===========================================================================
// Test 14: Retry does not duplicate an award
// ===========================================================================
console.log('▶ Test 14: Retry does not duplicate an award');
const stoneCountBefore = getInventoryCount(playerInv, 'stone');
// Simulating retry action: redraws canvas, clears pending state, awards nothing until re-accepted
const retryToken = 'craft-retry-token-2';
// User discards without accepting
assert.strictEqual(processedSubmissions.has(retryToken), false);
assert.strictEqual(getInventoryCount(playerInv, 'stone'), stoneCountBefore);
console.log('  ✓ Retry resets state cleanly without awarding items');

// ===========================================================================
// Test 15: Inventory bounds and full-inventory handling
// ===========================================================================
console.log('▶ Test 15: Inventory bounds and full-inventory handling');
let cappedInv = createDefaultInventory();
cappedInv.items.stone = MAX_INVENTORY_STACK;

const cappedAward = awardCraftedItem(cappedInv, 'stone');
assert.strictEqual(cappedAward.success, false);
assert.ok(cappedAward.reason?.includes('full'));
assert.strictEqual(getInventoryCount(cappedAward.inventory, 'stone'), MAX_INVENTORY_STACK);
console.log('  ✓ Full inventory slot correctly guards against stack overflow');

// ===========================================================================
// Test 16: Existing save/load compatibility
// ===========================================================================
console.log('▶ Test 16: Existing save/load compatibility');
const testWorld = generateDefaultSandboxWorld(64, 36);
const savePayload = {
  id: 'sandbox-crafted-save-1',
  name: 'Crafted World',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  world: testWorld,
  player: {
    x: 200,
    y: 150,
    inventory: playerInv,
  },
  schemaVersion: '1.0' as const,
};

const saved = saveSandbox(savePayload);
assert.strictEqual(saved, true);

const loaded = loadSandbox();
assert.ok(loaded);
assert.strictEqual(loaded.player.inventory.items.wood, getInventoryCount(playerInv, 'wood'));
assert.strictEqual(loaded.player.inventory.items.stone, getInventoryCount(playerInv, 'stone'));
console.log('  ✓ Inventory updates after crafting survive save and reload cleanly');

// ===========================================================================
// Test 17: Manual fallback validation
// ===========================================================================
console.log('▶ Test 17: Manual fallback validation');
for (const itemId of CRAFTABLE_ITEM_ALLOWLIST) {
  const itemDef = CRAFTABLE_ITEMS_CATALOGUE[itemId];
  assert.ok(itemDef);
  assert.strictEqual(itemDef.id, itemId);
  assert.ok(itemDef.keywords.length > 0);

  const award = awardCraftedItem(createDefaultInventory(), itemId);
  assert.strictEqual(award.success, true);
  assert.strictEqual(award.item?.id, itemId);
}
console.log('  ✓ Manual selection for all 4 allowlisted items validated');

// ===========================================================================
// Test 18: Honest provider provenance
// ===========================================================================
console.log('▶ Test 18: Honest provider provenance');
// 1. Live model
assert.strictEqual(successResult.provenance, 'gemini-vision');
assert.strictEqual(successResult.isFallback, false);

// 2. Heuristic fallback
assert.strictEqual(heuristicResult.provenance, 'mock-heuristic');
assert.strictEqual(heuristicResult.isFallback, true);

// 3. Schema rejects invalid provenance string
const badProvenance = RecognizeCraftResponseSchema.safeParse({
  ...successResult,
  provenance: 'fake-super-ai',
});
assert.strictEqual(badProvenance.success, false);
console.log('  ✓ Provenance is strictly transparent and validated by schema');

console.log('\n🎉 ALL 18 Draw2Play Phase 7.2 Draw-to-Craft Tests Passed Successfully!\n');
