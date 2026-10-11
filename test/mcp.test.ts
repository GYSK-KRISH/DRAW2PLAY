import assert from 'node:assert';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createDraw2PlayMcpServer } from '../server/mcp/server.js';
import { sandboxSessionManager } from '../server/mcp/services/sandboxSession.service.js';
import {
  SANDBOX_ITEM_IDS,
} from '../src/types/sandbox.js';
import { CRAFTING_RECIPES } from '../src/game/sandbox/sandboxRecipes.js';
import { createDefaultInventory } from '../src/game/sandbox/sandboxInventory.js';
import { generateDefaultSandboxWorld } from '../src/game/sandbox/sandboxWorld.js';

console.log('🧪 Starting Draw2Play Phase 9 MCP Integration Tests...\n');

interface CallToolResponse {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

function parseContentJson(toolRes: unknown): any {
  const r = toolRes as CallToolResponse;
  if (!r?.content || !r.content[0] || !r.content[0].text) return {};
  return JSON.parse(r.content[0].text);
}

function getErrorText(toolRes: unknown): string {
  const r = toolRes as CallToolResponse;
  return r?.content?.[0]?.text ?? '';
}

async function runMcpTests() {
  // Reset session manager before tests
  sandboxSessionManager.clearAllSessions();

  // 1. Server initialization & Tool Discovery
  console.log('Test 1: MCP Server initialization and Tool Discovery');
  const server = createDraw2PlayMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client(
    { name: 'test-mcp-client', version: '1.0.0' },
    { capabilities: {} }
  );

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  const toolsResult = await client.listTools();
  assert.ok(toolsResult.tools, 'Expected client.listTools() to return tools array');
  const toolNames = toolsResult.tools.map((t) => t.name);
  console.log('Discovered tools:', toolNames);

  const expectedTools = [
    'get_sandbox_status',
    'get_save_status',
    'list_sandbox_items',
    'list_crafting_recipes',
    'check_crafting_recipe',
    'craft_item',
    'mine_block',
    'place_block',
  ];

  for (const exp of expectedTools) {
    assert.ok(
      toolNames.includes(exp),
      `Expected tool '${exp}' to be registered in MCP server`
    );
  }
  console.log('✅ Test 1 passed: All 8 MCP tools discovered over transport.\n');

  // 2. Read-only: list_sandbox_items
  console.log('Test 2: list_sandbox_items tool execution');
  const allItemsRes = await client.callTool({
    name: 'list_sandbox_items',
    arguments: {},
  });
  const allItemsData = parseContentJson(allItemsRes);
  assert.strictEqual(allItemsData.totalItems, SANDBOX_ITEM_IDS.length);
  assert.strictEqual(allItemsData.categoryFilter, 'all');

  const blockItemsRes = await client.callTool({
    name: 'list_sandbox_items',
    arguments: { category: 'block' },
  });
  const blockItemsData = parseContentJson(blockItemsRes);
  assert.strictEqual(blockItemsData.categoryFilter, 'block');
  assert.ok(
    blockItemsData.items.every((it: any) => it.category === 'block'),
    'All returned items must match the category filter'
  );
  console.log('✅ Test 2 passed: list_sandbox_items supports full catalog and category filtering.\n');

  // 3. Read-only: list_crafting_recipes
  console.log('Test 3: list_crafting_recipes tool execution');
  const allRecipesRes = await client.callTool({
    name: 'list_crafting_recipes',
    arguments: {},
  });
  const allRecipesData = parseContentJson(allRecipesRes);
  assert.strictEqual(allRecipesData.totalRecipes, CRAFTING_RECIPES.length);
  assert.ok(Array.isArray(allRecipesData.recipes));

  const basicRecipesRes = await client.callTool({
    name: 'list_crafting_recipes',
    arguments: { category: 'basic' },
  });
  const basicRecipesData = parseContentJson(basicRecipesRes);
  assert.ok(
    basicRecipesData.recipes.every((r: any) => r.category === 'basic'),
    'All returned recipes must have category "basic"'
  );
  console.log('✅ Test 3 passed: list_crafting_recipes lists recipes with ingredients.\n');

  // 4. check_crafting_recipe with valid and invalid recipes
  console.log('Test 4: check_crafting_recipe tool execution');
  const checkPlanksRes = await client.callTool({
    name: 'check_crafting_recipe',
    arguments: { recipeId: 'recipe-wood-to-planks', batches: 2 },
  });
  const checkPlanksData = parseContentJson(checkPlanksRes);
  assert.strictEqual(checkPlanksData.recipeId, 'recipe-wood-to-planks');
  assert.strictEqual(checkPlanksData.canCraft, false, 'Should be false when no active session has wood');
  assert.strictEqual(checkPlanksData.expectedOutput.count, 8, '2 batches of 4 planks should produce 8');

  // Unknown recipe
  const unknownRecipeRes = await client.callTool({
    name: 'check_crafting_recipe',
    arguments: { recipeId: 'nonexistent_blueprint' },
  });
  assert.strictEqual((unknownRecipeRes as CallToolResponse).isError, true);
  const unknownRecipeData = parseContentJson(unknownRecipeRes);
  assert.strictEqual(unknownRecipeData.found, false);
  console.log('✅ Test 4 passed: check_crafting_recipe verifies requirements and rejects unknown recipes.\n');

  // 5. get_sandbox_status without active session
  console.log('Test 5: get_sandbox_status without active session');
  const statusResNoSession = await client.callTool({
    name: 'get_sandbox_status',
    arguments: {},
  });
  const statusDataNoSession = parseContentJson(statusResNoSession);
  assert.strictEqual(statusDataNoSession.hasActiveSession, false);
  assert.ok(
    statusDataNoSession.message.includes('No active sandbox session'),
    'Should explain honestly that no session is connected'
  );
  console.log('✅ Test 5 passed: Reports hasActiveSession: false honestly without inventing fake state.\n');

  // 6. Mutations without active session return safe failure
  console.log('Test 6: Mutation attempts without active session');
  const craftNoSessionRes = await client.callTool({
    name: 'craft_item',
    arguments: { recipeId: 'recipe-wood-to-planks' },
  });
  assert.strictEqual((craftNoSessionRes as CallToolResponse).isError, true);
  const craftNoSessionData = parseContentJson(craftNoSessionRes);
  assert.strictEqual(craftNoSessionData.success, false);
  assert.ok(craftNoSessionData.error.includes('No active sandbox session'));

  const mineNoSessionRes = await client.callTool({
    name: 'mine_block',
    arguments: { col: 10, row: 10 },
  });
  assert.strictEqual((mineNoSessionRes as CallToolResponse).isError, true);
  const mineNoSessionData = parseContentJson(mineNoSessionRes);
  assert.strictEqual(mineNoSessionData.success, false);
  assert.ok(mineNoSessionData.error.includes('No active sandbox session'));

  const placeNoSessionRes = await client.callTool({
    name: 'place_block',
    arguments: { col: 10, row: 10, blockType: 'dirt' },
  });
  assert.strictEqual((placeNoSessionRes as CallToolResponse).isError, true);
  const placeNoSessionData = parseContentJson(placeNoSessionRes);
  assert.strictEqual(placeNoSessionData.success, false);
  assert.ok(placeNoSessionData.error.includes('No active sandbox session'));
  console.log('✅ Test 6 passed: Mutation tools reject safely when no session is active.\n');

  // 7. Register an active session and verify live status
  console.log('Test 7: Active session registration and status inspection');
  const testSessionId = 'sess-test-unit-01';
  const testWorld = generateDefaultSandboxWorld(64, 36);
  const testInventory = createDefaultInventory();
  // Player standing at tile (15, 14) -> pixel x = 15*32 + 16 = 496, y = 14*32 + 16 = 464
  const testPlayerPos = { x: 496, y: 464, col: 15, row: 14 };

  sandboxSessionManager.registerSession({
    sessionId: testSessionId,
    clientType: 'standalone',
    world: testWorld,
    inventory: testInventory,
    playerPosition: testPlayerPos,
  });

  const activeStatusRes = await client.callTool({
    name: 'get_sandbox_status',
    arguments: { sessionId: testSessionId },
  });
  const activeStatusData = parseContentJson(activeStatusRes);
  assert.strictEqual(activeStatusData.hasActiveSession, true);
  assert.strictEqual(activeStatusData.sessionId, testSessionId);
  assert.strictEqual(activeStatusData.world.cols, 64);
  assert.strictEqual(activeStatusData.world.rows, 36);
  assert.strictEqual(activeStatusData.player.col, 15);
  assert.strictEqual(activeStatusData.player.row, 14);
  console.log('✅ Test 7 passed: Active session reports real live state.\n');

  // 8. Crafting when ingredients are missing leaves inventory unchanged
  console.log('Test 8: Crafting with missing ingredients');
  const failCraftRes = await client.callTool({
    name: 'craft_item',
    arguments: { sessionId: testSessionId, recipeId: 'recipe-workbench' },
  });
  assert.strictEqual((failCraftRes as CallToolResponse).isError, true);
  const failCraftData = parseContentJson(failCraftRes);
  assert.strictEqual(failCraftData.success, false);
  assert.ok(failCraftData.error.includes('Not enough') || failCraftData.error.includes('Insufficient'));

  // Ensure inventory items remain 0
  const sessionAfterFail = sandboxSessionManager.getSession(testSessionId);
  assert.strictEqual(sessionAfterFail?.inventory.items.workbench ?? 0, 0);
  console.log('✅ Test 8 passed: Failed crafting leaves inventory unchanged.\n');

  // 9. Crafting when ingredients are present updates inventory atomically
  console.log('Test 9: Successful crafting updates inventory atomically');
  // Give player 2 wood logs
  testInventory.items.wood = 2;
  sandboxSessionManager.syncSession(testSessionId, {
    inventory: testInventory,
  });

  const craftPlanksRes = await client.callTool({
    name: 'craft_item',
    arguments: {
      sessionId: testSessionId,
      recipeId: 'recipe-wood-to-planks',
      batches: 2,
    },
  });
  const craftPlanksData = parseContentJson(craftPlanksRes);
  assert.strictEqual(craftPlanksData.success, true);
  assert.strictEqual(craftPlanksData.outputItem, 'wood_planks');
  assert.strictEqual(craftPlanksData.craftedCount, 8); // 2 batches * 4 planks

  const sessionAfterCraft = sandboxSessionManager.getSession(testSessionId);
  assert.strictEqual(sessionAfterCraft?.inventory.items.wood, 0, '2 wood consumed');
  assert.strictEqual(sessionAfterCraft?.inventory.items.wood_planks, 8, '8 planks granted');
  console.log('✅ Test 9 passed: Successful crafting deducted wood and granted wood_planks.\n');

  // 10. Idempotency test: duplicate request with same key returns cached result without double granting
  console.log('Test 10: Crafting idempotency key caching');
  // Add 1 more wood log
  sessionAfterCraft!.inventory.items.wood = 1;
  const idemKey = 'craft-req-unique-999';

  const craft1 = await client.callTool({
    name: 'craft_item',
    arguments: {
      sessionId: testSessionId,
      recipeId: 'recipe-wood-to-planks',
      batches: 1,
      idempotencyKey: idemKey,
    },
  });
  const data1 = parseContentJson(craft1);
  assert.strictEqual(data1.success, true);
  assert.strictEqual(data1.cached, false);
  const planksAfterFirst = sessionAfterCraft!.inventory.items.wood_planks;

  // Re-run with the same idempotency key
  const craft2 = await client.callTool({
    name: 'craft_item',
    arguments: {
      sessionId: testSessionId,
      recipeId: 'recipe-wood-to-planks',
      batches: 1,
      idempotencyKey: idemKey,
    },
  });
  const data2 = parseContentJson(craft2);
  assert.strictEqual(data2.success, true);
  assert.strictEqual(data2.cached, true, 'Second request must report cached: true');
  assert.strictEqual(
    sessionAfterCraft!.inventory.items.wood_planks,
    planksAfterFirst,
    'Planks must not be awarded a second time!'
  );
  console.log('✅ Test 10 passed: Idempotent repeat request prevents duplicate awards.\n');

  // 11. Mine block: successfully mines adjacent mineable solid block
  console.log('Test 11: Mining a solid block within reach');
  // Player is at col 15, row 14. Let's make tile (15, 16) stone
  const currentWorld = sessionAfterCraft!.world;
  currentWorld.tiles[16][15] = 'stone';

  const mineRes = await client.callTool({
    name: 'mine_block',
    arguments: {
      sessionId: testSessionId,
      col: 15,
      row: 16,
    },
  });
  const mineData = parseContentJson(mineRes);
  assert.strictEqual(mineData.success, true);
  assert.strictEqual(mineData.minedTile, 'stone');
  assert.strictEqual(currentWorld.tiles[16][15], 'air', 'Tile must be replaced with air');
  assert.strictEqual(
    sessionAfterCraft!.inventory.items.stone,
    6,
    'Mined stone block added to inventory (started with default 5, now 6)'
  );
  console.log('✅ Test 11 passed: mine_block replaces tile with air and adds block to inventory.\n');

  // 12. Mining out-of-bounds rejected
  console.log('Test 12: Mining out-of-bounds coordinates rejected');
  const outBoundsRes = await client.callTool({
    name: 'mine_block',
    arguments: {
      sessionId: testSessionId,
      col: 999,
      row: 999,
    },
  });
  assert.strictEqual((outBoundsRes as CallToolResponse).isError, true);
  assert.ok(
    getErrorText(outBoundsRes).includes('Invalid params') ||
    getErrorText(outBoundsRes).includes('error')
  );
  console.log('✅ Test 12 passed: Out-of-bounds coordinates rejected safely by schema.\n');

  // 13. Mining beyond reach rejected
  console.log('Test 13: Mining out-of-reach block rejected');
  currentWorld.tiles[30][60] = 'stone';
  const outReachRes = await client.callTool({
    name: 'mine_block',
    arguments: {
      sessionId: testSessionId,
      col: 60,
      row: 30,
    },
  });
  assert.strictEqual((outReachRes as CallToolResponse).isError, true);
  const outReachData = parseContentJson(outReachRes);
  assert.strictEqual(outReachData.success, false);
  assert.ok(outReachData.error.includes('reach'));
  console.log('✅ Test 13 passed: Block farther than reach limit is rejected.\n');

  // 14. Place block: successfully places block into adjacent air tile
  console.log('Test 14: Place block into adjacent air tile');
  // Tile (15, 16) is air right now. Place dirt there.
  // Ensure player has dirt in inventory
  sessionAfterCraft!.inventory.items.dirt = 5;

  const placeRes = await client.callTool({
    name: 'place_block',
    arguments: {
      sessionId: testSessionId,
      col: 15,
      row: 16,
      blockType: 'dirt',
    },
  });
  const placeData = parseContentJson(placeRes);
  assert.strictEqual(placeData.success, true);
  assert.strictEqual(currentWorld.tiles[16][15], 'dirt');
  assert.strictEqual(sessionAfterCraft!.inventory.items.dirt, 4, '1 dirt consumed');
  console.log('✅ Test 14 passed: place_block places block and deducts inventory.\n');

  // 15. Place block: rejects non-placeable items (e.g., stick)
  console.log('Test 15: Non-placeable item rejected for place_block');
  sessionAfterCraft!.inventory.items.stick = 10;
  const placeStickRes = await client.callTool({
    name: 'place_block',
    arguments: {
      sessionId: testSessionId,
      col: 15,
      row: 17,
      blockType: 'stick',
    },
  });
  assert.strictEqual((placeStickRes as CallToolResponse).isError, true);
  assert.ok(
    getErrorText(placeStickRes).includes('Invalid params') ||
    getErrorText(placeStickRes).includes('error')
  );
  console.log('✅ Test 15 passed: Non-placeable items like stick rejected by placeable schema.\n');

  // 16. Place block: rejects placing inside player body
  console.log('Test 16: Collision check prevents placing inside player body');
  // Player is at col 15, row 14
  const placeCollisionRes = await client.callTool({
    name: 'place_block',
    arguments: {
      sessionId: testSessionId,
      col: 15,
      row: 14,
      blockType: 'dirt',
    },
  });
  assert.strictEqual((placeCollisionRes as CallToolResponse).isError, true);
  const placeCollisionData = parseContentJson(placeCollisionRes);
  assert.strictEqual(placeCollisionData.success, false);
  assert.ok(placeCollisionData.error.includes('player'));
  console.log('✅ Test 16 passed: Block placement inside player bounding box rejected.\n');

  // 17. get_save_status reports version and state without leaking filesystem
  console.log('Test 17: get_save_status tool execution');
  const saveStatusRes = await client.callTool({
    name: 'get_save_status',
    arguments: { sessionId: testSessionId },
  });
  const saveStatusData = parseContentJson(saveStatusRes);
  assert.strictEqual(saveStatusData.storageMechanism, 'localStorage');
  assert.strictEqual(saveStatusData.schemaVersion, '2.0');
  assert.strictEqual(typeof saveStatusData.safeToSave, 'boolean');
  assert.strictEqual(saveStatusData.filesystemAccess, 'none');
  console.log('✅ Test 17 passed: get_save_status safe sandbox metadata without path leakage.\n');

  // Cleanup
  await client.close();
  await server.close();

  console.log('🎉 ALL 17 MCP INTEGRATION AND DOMAIN TESTS PASSED!\n');
}

runMcpTests().catch((err) => {
  console.error('❌ MCP Test Failed:', err);
  process.exit(1);
});
