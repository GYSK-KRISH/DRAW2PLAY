import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sandboxSessionManager } from '../mcp/services/sandboxSession.service.js';
import {
  SandboxWorldDataSchema,
  SandboxInventorySchema,
} from '../../src/types/sandbox.js';

export const sandboxSessionRouter = Router();

// In-memory rate limiting map (IP -> { count, windowStart })
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_REQUESTS_PER_WINDOW;
}

const SessionIdSchema = z
  .string()
  .min(4)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Session ID must be alphanumeric and may include hyphens or underscores');

const ConnectSessionSchema = z.object({
  sessionId: SessionIdSchema.optional(),
  world: SandboxWorldDataSchema.optional(),
  inventory: SandboxInventorySchema.optional(),
  playerPosition: z
    .object({
      x: z.number(),
      y: z.number(),
      col: z.number().int(),
      row: z.number().int(),
    })
    .optional(),
});

const SyncSessionSchema = z.object({
  sessionId: SessionIdSchema,
  inventory: SandboxInventorySchema.optional(),
  clientInventoryRevision: z.number().int().min(0).optional(),
  playerPosition: z
    .object({
      x: z.number(),
      y: z.number(),
      col: z.number().int(),
      row: z.number().int(),
    })
    .optional(),
  world: SandboxWorldDataSchema.optional(),
});

/**
 * Connect a live browser sandbox scene to the backend session manager
 */
sandboxSessionRouter.post('/connect', (req: Request, res: Response): void => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
    return;
  }

  const parsed = ConnectSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid session connection payload', details: parsed.error.issues });
    return;
  }

  const sessionId = parsed.data.sessionId ?? `session-${Date.now()}`;
  const session = sandboxSessionManager.registerSession({
    sessionId,
    clientType: 'browser',
    world: parsed.data.world,
    inventory: parsed.data.inventory,
    playerPosition: parsed.data.playerPosition,
  });

  res.json({
    success: true,
    sessionId: session.sessionId,
    inventoryRevision: session.inventoryRevision,
    message: 'Sandbox session connected successfully to MCP bridge.',
  });
});

/**
 * Heartbeat and sync state from active browser scene, returning pending MCP actions
 */
sandboxSessionRouter.post('/sync', (req: Request, res: Response): void => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
    return;
  }

  const parsed = SyncSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid session sync payload', details: parsed.error.issues });
    return;
  }

  const syncResult = sandboxSessionManager.syncSession(parsed.data.sessionId, {
    inventory: parsed.data.inventory,
    clientInventoryRevision: parsed.data.clientInventoryRevision,
    playerPosition: parsed.data.playerPosition,
    world: parsed.data.world,
  });

  if (!syncResult) {
    res.status(404).json({ success: false, error: 'Session not found or expired.' });
    return;
  }

  // Drain pending actions queued by external MCP tool calls
  const pendingActions = sandboxSessionManager.pollPendingActions(parsed.data.sessionId);

  res.json({
    success: true,
    sessionId: syncResult.session.sessionId,
    lastActiveAt: syncResult.session.lastActiveAt,
    inventoryRevision: syncResult.inventoryRevision,
    authoritativeInventory: syncResult.authoritativeInventory,
    inventoryWasUpdated: syncResult.inventoryWasUpdated,
    pendingActions,
  });
});

/**
 * Inspect active session state
 */
sandboxSessionRouter.get('/status', (req: Request, res: Response): void => {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
  const session = sandboxSessionManager.getSession(sessionId);

  if (!session) {
    res.json({
      hasActiveSession: false,
      message: 'No active sandbox session is connected.',
    });
    return;
  }

  res.json({
    hasActiveSession: true,
    sessionId: session.sessionId,
    clientType: session.clientType,
    lastActiveAt: session.lastActiveAt,
    playerPosition: session.playerPosition,
    inventorySummary: session.inventory.items,
  });
});
