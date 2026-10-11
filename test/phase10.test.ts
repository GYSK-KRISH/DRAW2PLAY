import assert from 'node:assert';
import { sandboxSessionManager, SESSION_IDLE_TIMEOUT_MS } from '../server/mcp/services/sandboxSession.service.js';
import {
  saveSandbox,
  loadSandbox,
  getSandboxSaveStatus,
  getQuarantinedBackup,
  clearSandboxGameForTest,
  sanitizeLoadedSave,
  setStorageRawForTesting,
  SANDBOX_STORAGE_KEY,
} from '../src/services/sandboxStorage.js';
import { generateDefaultSandboxWorld, SANDBOX_PLAYER_REACH_PX } from '../src/game/sandbox/sandboxWorld.js';
import { createDefaultInventory } from '../src/game/sandbox/sandboxInventory.js';
import type { SandboxSaveData } from '../src/types/sandbox.js';

console.log('🧪 Starting Draw2Play Phase 10: Reliability, Integration & Security Test Suite...\n');

async function runPhase10Tests() {
  // Test 1: Shared Reach Limit Constant (220px ~= 6.875 tiles)
  console.log('▶ Test 1: Reach limit consistency across world, server, and client');
  assert.strictEqual(SANDBOX_PLAYER_REACH_PX, 220, 'SANDBOX_PLAYER_REACH_PX must be exactly 220px');
  const tilesEquivalent = SANDBOX_PLAYER_REACH_PX / 32;
  assert.ok(tilesEquivalent > 6.8 && tilesEquivalent < 7.0, '220px corresponds to ~6.875 tiles');
  console.log(`  ✓ Reach constant verified: ${SANDBOX_PLAYER_REACH_PX}px (${tilesEquivalent.toFixed(3)} tiles)`);

  // Test 2: Session Registration and Authoritative Inventory Synchronization
  console.log('▶ Test 2: Session registration and inventory revisioning');
  sandboxSessionManager.clearAllSessions();
  const testSessionId = 'sess-p10-sync-01';
  const world = generateDefaultSandboxWorld(64, 36);
  const inventory = createDefaultInventory();
  // Player at col 10, row 10 -> pixel (336, 336)
  const playerPosition = { x: 336, y: 336, col: 10, row: 10 };

  const session = sandboxSessionManager.registerSession({
    sessionId: testSessionId,
    clientType: 'standalone',
    world,
    inventory,
    playerPosition,
  });

  assert.ok(session, 'Session must register successfully');
  assert.strictEqual(session.inventoryRevision, 1, 'Initial revision must be 1');

  // Perform an MCP craft: give 2 wood, craft planks
  session.inventory.items.wood = 2;
  const craftRes = sandboxSessionManager.executeCraft(testSessionId, 'recipe-wood-to-planks', 2);
  assert.strictEqual(craftRes.success, true);
  assert.strictEqual(craftRes.inventoryRevision, 2, 'Crafting must increment inventoryRevision to 2');
  assert.strictEqual(session.inventory.items.wood_planks, 8);

  // Stale browser sync: client sends revision 1 with 0 planks
  const staleInventory = createDefaultInventory();
  staleInventory.items.wood = 2; // stale snapshot
  staleInventory.items.wood_planks = 0;

  const syncResultStale = sandboxSessionManager.syncSession(testSessionId, {
    inventory: staleInventory,
    clientInventoryRevision: 1, // older than session.inventoryRevision (2)
  });

  assert.ok(syncResultStale, 'Sync must return result object');
  assert.strictEqual(syncResultStale.inventoryWasUpdated, false, 'Stale client inventory must NOT overwrite server state');
  assert.strictEqual(syncResultStale.authoritativeInventory.items.wood_planks, 8, 'Authoritative inventory must retain crafted 8 planks');
  assert.strictEqual(syncResultStale.inventoryRevision, 2, 'Revision must stay at 2');

  // Client updates to revision 2: future sync accepted
  const updatedClientInventory = { ...syncResultStale.authoritativeInventory };
  updatedClientInventory.items.dirt = 20; // user mined dirt in browser
  const syncResultFresh = sandboxSessionManager.syncSession(testSessionId, {
    inventory: updatedClientInventory,
    clientInventoryRevision: 2, // matching current revision
  });

  assert.ok(syncResultFresh);
  assert.strictEqual(syncResultFresh.inventoryWasUpdated, true, 'Up-to-date client inventory must be accepted');
  assert.strictEqual(syncResultFresh.inventoryRevision, 3, 'Accepted client inventory increments revision');
  assert.strictEqual(session.inventory.items.dirt, 20);
  console.log('  ✓ Authoritative inventory and revision conflicts resolved safely');

  // Test 3: Reach limit enforcement in mining and placement
  console.log('▶ Test 3: Strict reach limit enforcement in mining and placement');
  // Player is at (336, 336).
  // Target A: col 10, row 16 -> center x = 336, y = 16*32 + 16 = 528. dist = 528 - 336 = 192px (< 220px) -> REACHABLE
  world.tiles[16][10] = 'stone';
  const inReachMine = sandboxSessionManager.executeMine(testSessionId, 10, 16);
  assert.strictEqual(inReachMine.success, true, 'Block at 192px must be in reach');

  // Target B: col 10, row 17 -> center x = 336, y = 17*32 + 16 = 560. dist = 560 - 336 = 224px (> 220px) -> OUT OF REACH
  world.tiles[17][10] = 'stone';
  const outReachMine = sandboxSessionManager.executeMine(testSessionId, 10, 17);
  assert.strictEqual(outReachMine.success, false, 'Block at 224px must be rejected for out-of-reach');
  assert.ok(outReachMine.reason?.includes('220px'), 'Failure reason must mention 220px reach limit');

  // Placement out of reach
  const outReachPlace = sandboxSessionManager.executePlace(testSessionId, 10, 17, 'dirt');
  assert.strictEqual(outReachPlace.success, false, 'Placement at 224px must be rejected');
  assert.ok(outReachPlace.reason?.includes('220px'), 'Placement failure must mention 220px reach limit');
  console.log('  ✓ Reach limit (220px) enforced strictly on both mining and placement');

  // Test 4: Queue Bounds and Idempotency Cache Protection
  console.log('▶ Test 4: Pending action queue bounds and idempotency cache limits');
  // Fill pending actions beyond 50
  for (let i = 0; i < 60; i++) {
    session.pendingActions.push({
      id: `act-${i}`,
      type: 'mine',
      data: { col: 10, row: 10 },
      timestamp: Date.now(),
    });
  }
  // Recording one more action through manager enforces MAX_PENDING_ACTIONS = 50
  (sandboxSessionManager as any).recordPendingAction(session, 'mine', { col: 1, row: 1 });
  assert.strictEqual(session.pendingActions.length, 50, 'Pending actions queue must be capped at 50');

  // Fill idempotency cache beyond 100
  for (let i = 0; i < 110; i++) {
    (sandboxSessionManager as any).recordIdempotency(session, `idem-key-${i}`, { success: true });
  }
  assert.strictEqual(session.idempotencyCache.size, 100, 'Idempotency cache must be capped at 100');
  console.log('  ✓ Pending actions queue (50) and idempotency cache (100) bounds verified');

  // Test 5: Session Idle Timeout and Stale Session Cleanup
  console.log('▶ Test 5: Session idle timeout and stale session cleanup');
  const timeoutSessionId = 'sess-p10-stale-01';
  sandboxSessionManager.registerSession({
    sessionId: timeoutSessionId,
    clientType: 'standalone',
    world,
    inventory,
    playerPosition,
  });

  const activeCheck = sandboxSessionManager.getSession(timeoutSessionId);
  assert.ok(activeCheck, 'Newly created session must be active');

  // Simulate inactivity over 15 minutes
  activeCheck.lastActiveAt = Date.now() - (SESSION_IDLE_TIMEOUT_MS + 5000);

  // Calling getSession should detect timeout, evict session, and return null
  const staleCheck = sandboxSessionManager.getSession(timeoutSessionId);
  assert.strictEqual(staleCheck, null, 'Expired session must be evicted and return null');

  // Test cleanupStaleSessions batch pruner
  const timeoutSessionId2 = 'sess-p10-stale-02';
  sandboxSessionManager.registerSession({
    sessionId: timeoutSessionId2,
    clientType: 'standalone',
    world,
    inventory,
    playerPosition,
  });
  const session2 = sandboxSessionManager.getSession(timeoutSessionId2)!;
  session2.lastActiveAt = Date.now() - (SESSION_IDLE_TIMEOUT_MS + 10000);

  const purgedCount = sandboxSessionManager.cleanupStaleSessions();
  assert.ok(purgedCount >= 1, 'cleanupStaleSessions must report at least 1 purged session');
  assert.strictEqual(sandboxSessionManager.getSession(timeoutSessionId2), null);
  console.log('  ✓ Session idle timeout (15m) and garbage collection verified');

  // Test 6: Save and Data Integrity: Corrupted Save Quarantine Protection
  console.log('▶ Test 6: Corrupted save quarantine and zero data destruction');
  clearSandboxGameForTest();

  // Create valid save
  const validSave: SandboxSaveData = {
    id: 'save-p10-test',
    name: 'P10 Test Save',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    world: generateDefaultSandboxWorld(64, 36),
    player: {
      x: 496,
      y: 464,
      inventory: createDefaultInventory(),
    },
    schemaVersion: '2.0',
  };
  saveSandbox(validSave);
  const loadedValid = loadSandbox();
  assert.ok(loadedValid, 'Valid save must load successfully');

  // Inject corrupted JSON directly into storage key
  const corruptPayload = '{"invalidJson": true, truncated...';
  setStorageRawForTesting(SANDBOX_STORAGE_KEY, corruptPayload);

  // Attempting to load corrupted save:
  const loadResult = loadSandbox();
  assert.strictEqual(loadResult, null, 'Corrupted save must return null');

  // Verify quarantine backup was preserved
  const backup = getQuarantinedBackup();
  assert.strictEqual(backup, corruptPayload, 'Corrupted payload must be quarantined');

  const statusCorrupt = getSandboxSaveStatus();
  assert.strictEqual(statusCorrupt.isCorrupted, true);
  assert.strictEqual(statusCorrupt.hasQuarantinedBackup, true);
  console.log('  ✓ Corrupted save detection and quarantine verified');

  // Test 7: Clamping Out-of-Bounds Player Position and Stack Limits
  console.log('▶ Test 7: Player position clamping and inventory stack sanitization');
  const dirtySave: SandboxSaveData = {
    id: 'save-dirty',
    name: 'Dirty Save',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    world: generateDefaultSandboxWorld(64, 36),
    player: {
      x: 999999, // way beyond world width (64*32 = 2048px)
      y: -500,   // negative y
      inventory: {
        items: {
          wood: 5000, // exceeds stack limit 999
          dirt: -10,  // negative count
        },
        hotbar: ['grass', 'dirt', 'stone', 'wood'],
        selectedSlot: 0,
      },
    },
    schemaVersion: '2.0',
  };

  const sanitized = sanitizeLoadedSave(dirtySave);
  assert.strictEqual(sanitized.player.x, 2048 - 32, 'Player x must be clamped within world boundary');
  assert.strictEqual(sanitized.player.y, 32, 'Negative player y must be clamped to min world boundary');
  assert.strictEqual(sanitized.player.inventory.items.wood, 999, 'Excess stack count must be clamped to 999');
  assert.strictEqual(sanitized.player.inventory.items.dirt, 0, 'Negative item count must be clamped to 0');
  console.log('  ✓ Coordinate and stack limit sanitation verified');

  // Test 8: Revalidation of Remote Actions
  console.log('▶ Test 8: Remote mining and placement revalidation');
  // Revalidates solid tile before mining
  world.tiles[10][10] = 'air';
  const mineAir = sandboxSessionManager.executeMine(testSessionId, 10, 10);
  assert.strictEqual(mineAir.success, false, 'Cannot mine air');
  assert.ok(mineAir.reason?.includes('air'));

  // Revalidates air tile before placing
  world.tiles[10][10] = 'stone';
  const placeOnSolid = sandboxSessionManager.executePlace(testSessionId, 10, 10, 'dirt');
  assert.strictEqual(placeOnSolid.success, false, 'Cannot place on solid tile');
  assert.ok(placeOnSolid.reason?.includes('occupies') || placeOnSolid.reason?.includes('space'));

  // Revalidates player collision
  // Player is at col 10, row 10. Let's make it air and try to place on player
  world.tiles[10][10] = 'air';
  session.playerPosition = { x: 336, y: 336, col: 10, row: 10 };
  const placeOnPlayer = sandboxSessionManager.executePlace(testSessionId, 10, 10, 'dirt');
  assert.strictEqual(placeOnPlayer.success, false, 'Cannot place block inside player hitbox');
  assert.ok(placeOnPlayer.reason?.includes('player'));
  console.log('  ✓ Revalidation of solid, air, and collision states verified');

  console.log('\n🎉 ALL 8 PHASE 10 RELIABILITY & INTEGRATION TESTS PASSED!\n');
}

runPhase10Tests().catch((err) => {
  console.error('❌ Phase 10 Test Failed:', err);
  process.exit(1);
});
