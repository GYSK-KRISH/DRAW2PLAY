import type {
  SandboxWorldData,
  SandboxInventory,
  PlaceableBlockType,
} from '../../../src/types/sandbox.js';
import {
  isItemPlaceable,
  SANDBOX_ITEM_CATALOGUE,
} from '../../../src/types/sandbox.js';
import {
  mineBlock,
  placeBlock,
  canPlaceBlock,
  generateDefaultSandboxWorld,
  SANDBOX_PLAYER_REACH_PX,
  type Rect,
} from '../../../src/game/sandbox/sandboxWorld.js';
import {
  createDefaultInventory,
  addInventoryItem,
  consumeInventoryItem,
} from '../../../src/game/sandbox/sandboxInventory.js';
import {
  craftRecipe,
} from '../../../src/game/sandbox/sandboxRecipes.js';

export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity
export const MAX_PENDING_ACTIONS = 50;
export const MAX_IDEMPOTENCY_CACHE_SIZE = 100;

export interface PlayerCoordinates {
  x: number;
  y: number;
  col: number;
  row: number;
}

export interface SessionPendingAction {
  id: string;
  type: 'craft' | 'mine' | 'place';
  data: Record<string, unknown>;
  timestamp: number;
}

export interface SandboxSession {
  sessionId: string;
  createdAt: number;
  lastActiveAt: number;
  clientType: 'browser' | 'test' | 'standalone';
  world: SandboxWorldData;
  inventory: SandboxInventory;
  inventoryRevision: number;
  playerPosition?: PlayerCoordinates;
  pendingActions: SessionPendingAction[];
  idempotencyCache: Map<string, unknown>;
}

/**
 * Authoritative Sandbox Session Manager
 * Bridges external MCP requests with active sandbox sessions without fabricating live state.
 */
class SandboxSessionManager {
  private sessions = new Map<string, SandboxSession>();
  private activeSessionId: string | null = null;

  private recordPendingAction(
    session: SandboxSession,
    type: 'craft' | 'mine' | 'place',
    data: Record<string, unknown>
  ): void {
    while (session.pendingActions.length >= MAX_PENDING_ACTIONS) {
      session.pendingActions.shift();
    }
    session.pendingActions.push({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      data,
      timestamp: Date.now(),
    });
  }

  private recordIdempotency(session: SandboxSession, key?: string, result?: unknown): void {
    if (!key || result === undefined) return;
    while (session.idempotencyCache.size >= MAX_IDEMPOTENCY_CACHE_SIZE) {
      const firstKey = session.idempotencyCache.keys().next().value;
      if (firstKey) {
        session.idempotencyCache.delete(firstKey);
      } else {
        break;
      }
    }
    session.idempotencyCache.set(key, result);
  }

  /**
   * Registers a new or refreshed sandbox session (e.g. from browser or automated test)
   */
  public registerSession(params: {
    sessionId: string;
    clientType?: 'browser' | 'test' | 'standalone';
    world?: SandboxWorldData;
    inventory?: SandboxInventory;
    playerPosition?: PlayerCoordinates;
  }): SandboxSession {
    const existing = this.sessions.get(params.sessionId);
    if (existing) {
      existing.lastActiveAt = Date.now();
      existing.clientType = params.clientType ?? existing.clientType;
      if (params.world) existing.world = params.world;
      if (params.playerPosition) existing.playerPosition = params.playerPosition;
      this.activeSessionId = params.sessionId;
      return existing;
    }

    const session: SandboxSession = {
      sessionId: params.sessionId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      clientType: params.clientType ?? 'browser',
      world: params.world ?? generateDefaultSandboxWorld(),
      inventory: params.inventory ?? createDefaultInventory(),
      inventoryRevision: 1,
      playerPosition: params.playerPosition,
      pendingActions: [],
      idempotencyCache: new Map(),
    };

    this.sessions.set(params.sessionId, session);
    this.activeSessionId = params.sessionId;
    return session;
  }

  /**
   * Heartbeat & sync from connected browser client.
   * Protects authoritative inventory against stale client overwrite.
   */
  public syncSession(
    sessionId: string,
    update: {
      inventory?: SandboxInventory;
      clientInventoryRevision?: number;
      playerPosition?: PlayerCoordinates;
      world?: SandboxWorldData;
    }
  ): {
    session: SandboxSession;
    authoritativeInventory: SandboxInventory;
    inventoryRevision: number;
    inventoryWasUpdated: boolean;
  } | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.lastActiveAt = Date.now();
    let inventoryWasUpdated = false;

    if (update.inventory) {
      // If client revision is older than server revision, do NOT overwrite with stale client inventory
      if (
        update.clientInventoryRevision !== undefined &&
        update.clientInventoryRevision < session.inventoryRevision
      ) {
        inventoryWasUpdated = false;
      } else {
        session.inventory = update.inventory;
        session.inventoryRevision++;
        inventoryWasUpdated = true;
      }
    }

    if (update.playerPosition) session.playerPosition = update.playerPosition;
    if (update.world) session.world = update.world;

    this.activeSessionId = sessionId;
    return {
      session,
      authoritativeInventory: session.inventory,
      inventoryRevision: session.inventoryRevision,
      inventoryWasUpdated,
    };
  }

  /**
   * Fetches active session or explicitly specified session with idle expiration
   */
  public getSession(sessionId?: string): SandboxSession | null {
    const now = Date.now();

    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (!session) return null;
      if (now - session.lastActiveAt > SESSION_IDLE_TIMEOUT_MS) {
        this.sessions.delete(sessionId);
        if (this.activeSessionId === sessionId) {
          this.activeSessionId = null;
        }
        return null;
      }
      return session;
    }

    if (this.activeSessionId) {
      const active = this.sessions.get(this.activeSessionId);
      if (active) {
        if (now - active.lastActiveAt > SESSION_IDLE_TIMEOUT_MS) {
          this.sessions.delete(this.activeSessionId);
          this.activeSessionId = null;
          return null;
        }
        return active;
      }
    }
    return null;
  }

  public hasActiveSession(): boolean {
    return this.getSession() !== null;
  }

  /**
   * Cleans up expired inactive sessions
   */
  public cleanupStaleSessions(): number {
    const now = Date.now();
    let purged = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActiveAt > SESSION_IDLE_TIMEOUT_MS) {
        this.sessions.delete(id);
        if (this.activeSessionId === id) {
          this.activeSessionId = null;
        }
        purged++;
      }
    }
    return purged;
  }

  /**
   * Retrieves and clears queued pending actions for browser scene playback
   */
  public pollPendingActions(sessionId: string): SessionPendingAction[] {
    const session = this.getSession(sessionId);
    if (!session) return [];
    const actions = [...session.pendingActions];
    session.pendingActions = [];
    return actions;
  }

  /**
   * Executes craft on session using the atomic recipe engine
   */
  public executeCraft(
    sessionId: string | undefined,
    recipeId: string,
    batches = 1,
    idempotencyKey?: string
  ): {
    success: boolean;
    recipeId?: string;
    outputItem?: string;
    craftedCount?: number;
    inventory?: SandboxInventory;
    inventoryRevision?: number;
    reason?: string;
    cached?: boolean;
  } {
    const session = this.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        reason: 'No active sandbox session available. Please open Draw2Play Sandbox in your browser.',
      };
    }

    // Idempotency check
    if (idempotencyKey && session.idempotencyCache.has(idempotencyKey)) {
      const cached = session.idempotencyCache.get(idempotencyKey) as Record<string, unknown>;
      return { ...cached, cached: true } as any;
    }

    const craftResult = craftRecipe(session.inventory, recipeId, batches);
    if (!craftResult.success || !craftResult.recipe) {
      return {
        success: false,
        reason: craftResult.reason ?? 'Crafting failed.',
      };
    }

    session.inventory = craftResult.inventory;
    session.inventoryRevision++;
    session.lastActiveAt = Date.now();

    const outputItem = craftResult.recipe.output.itemId;
    const result = {
      success: true,
      recipeId,
      outputItem,
      craftedCount: craftResult.craftedCount ?? 0,
      inventory: session.inventory,
      inventoryRevision: session.inventoryRevision,
    };

    this.recordIdempotency(session, idempotencyKey, result);
    this.recordPendingAction(session, 'craft', result);

    return result;
  }

  /**
   * Executes block mining on session
   */
  public executeMine(
    sessionId: string | undefined,
    col: number,
    row: number,
    idempotencyKey?: string
  ): {
    success: boolean;
    col?: number;
    row?: number;
    minedTile?: string;
    inventory?: SandboxInventory;
    inventoryRevision?: number;
    reason?: string;
    cached?: boolean;
  } {
    const session = this.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        reason: 'No active sandbox session available. Please open Draw2Play Sandbox in your browser.',
      };
    }

    if (idempotencyKey && session.idempotencyCache.has(idempotencyKey)) {
      const cached = session.idempotencyCache.get(idempotencyKey) as Record<string, unknown>;
      return { ...cached, cached: true } as any;
    }

    if (col < 0 || col >= session.world.cols || row < 0 || row >= session.world.rows) {
      return {
        success: false,
        reason: `Target (${col}, ${row}) is outside world bounds (0-${session.world.cols - 1}, 0-${session.world.rows - 1}).`,
      };
    }

    const currentTile = session.world.tiles[row]?.[col];
    if (!currentTile || currentTile === 'air') {
      return {
        success: false,
        reason: `No solid block at (${col}, ${row}) to mine. Tile is already air.`,
      };
    }

    // Reach verification if player coordinates are available
    if (session.playerPosition) {
      const tileSize = session.world.tileSize;
      const tileCenterX = col * tileSize + tileSize / 2;
      const tileCenterY = row * tileSize + tileSize / 2;
      const dist = Math.hypot(
        session.playerPosition.x - tileCenterX,
        session.playerPosition.y - tileCenterY
      );
      if (dist > SANDBOX_PLAYER_REACH_PX) {
        return {
          success: false,
          reason: `Target block is too far from player (${Math.round(dist)}px > ${SANDBOX_PLAYER_REACH_PX}px reach limit).`,
        };
      }
    }

    const mined = mineBlock(session.world, col, row);
    if (!mined) {
      return {
        success: false,
        reason: `Block at (${col}, ${row}) could not be mined.`,
      };
    }

    // Add mined block to inventory
    session.inventory = addInventoryItem(session.inventory, mined.minedTile, 1);
    session.inventoryRevision++;
    session.lastActiveAt = Date.now();

    const result = {
      success: true,
      col,
      row,
      minedTile: mined.minedTile,
      inventory: session.inventory,
      inventoryRevision: session.inventoryRevision,
    };

    this.recordIdempotency(session, idempotencyKey, result);
    this.recordPendingAction(session, 'mine', result);

    return result;
  }

  /**
   * Executes block placement on session
   */
  public executePlace(
    sessionId: string | undefined,
    col: number,
    row: number,
    blockType: PlaceableBlockType,
    idempotencyKey?: string
  ): {
    success: boolean;
    col?: number;
    row?: number;
    placedBlock?: string;
    inventory?: SandboxInventory;
    inventoryRevision?: number;
    reason?: string;
    cached?: boolean;
  } {
    const session = this.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        reason: 'No active sandbox session available. Please open Draw2Play Sandbox in your browser.',
      };
    }

    if (idempotencyKey && session.idempotencyCache.has(idempotencyKey)) {
      const cached = session.idempotencyCache.get(idempotencyKey) as Record<string, unknown>;
      return { ...cached, cached: true } as any;
    }

    if (!isItemPlaceable(blockType)) {
      return {
        success: false,
        reason: `Item "${blockType}" is not placeable. Only placeable blocks are permitted.`,
      };
    }

    const owned = session.inventory.items[blockType] ?? 0;
    if (owned <= 0) {
      const name = SANDBOX_ITEM_CATALOGUE[blockType]?.displayName ?? blockType;
      return {
        success: false,
        reason: `Out of ${name}! You have 0 in your inventory.`,
      };
    }

    let playerRect: Rect | undefined;
    if (session.playerPosition) {
      playerRect = {
        x: session.playerPosition.x - 11,
        y: session.playerPosition.y - 16,
        width: 22,
        height: 32,
      };

      // Reach distance check
      const tileSize = session.world.tileSize;
      const tileCenterX = col * tileSize + tileSize / 2;
      const tileCenterY = row * tileSize + tileSize / 2;
      const dist = Math.hypot(
        session.playerPosition.x - tileCenterX,
        session.playerPosition.y - tileCenterY
      );
      if (dist > SANDBOX_PLAYER_REACH_PX) {
        return {
          success: false,
          reason: `Placement target is out of reach (${Math.round(dist)}px > ${SANDBOX_PLAYER_REACH_PX}px limit).`,
        };
      }
    }

    const check = canPlaceBlock(session.world, col, row, playerRect, blockType);
    if (!check.allowed) {
      return {
        success: false,
        reason: check.reason ?? 'Cannot place block at target coordinate.',
      };
    }

    const placed = placeBlock(session.world, col, row, blockType, playerRect);
    if (!placed.success) {
      return {
        success: false,
        reason: placed.reason ?? 'Placement failed.',
      };
    }

    // Safely deduct block from inventory
    const consumed = consumeInventoryItem(session.inventory, blockType, 1);
    if (consumed.success) {
      session.inventory = consumed.inventory;
    }
    session.inventoryRevision++;
    session.lastActiveAt = Date.now();

    const result = {
      success: true,
      col,
      row,
      placedBlock: blockType,
      inventory: session.inventory,
      inventoryRevision: session.inventoryRevision,
    };

    this.recordIdempotency(session, idempotencyKey, result);
    this.recordPendingAction(session, 'place', result);

    return result;
  }

  /**
   * Resets all sessions (useful for test isolates)
   */
  public resetForTest(): void {
    this.sessions.clear();
    this.activeSessionId = null;
  }

  public clearAllSessions(): void {
    this.resetForTest();
  }
}

export const sandboxSessionManager = new SandboxSessionManager();
