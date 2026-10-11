import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sandboxSessionManager } from '../mcp/services/sandboxSession.service.js';
import {
  SandboxWorldDataSchema,
  SandboxInventorySchema,
} from '../../src/types/sandbox.js';

export const sandboxSessionRouter = Router();

const ConnectSessionSchema = z.object({
  sessionId: z.string().min(1).max(100).optional(),
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
  sessionId: z.string().min(1).max(100),
  inventory: SandboxInventorySchema.optional(),
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
    message: 'Sandbox session connected successfully to MCP bridge.',
  });
});

/**
 * Heartbeat and sync state from active browser scene, returning pending MCP actions
 */
sandboxSessionRouter.post('/sync', (req: Request, res: Response): void => {
  const parsed = SyncSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid session sync payload', details: parsed.error.issues });
    return;
  }

  const session = sandboxSessionManager.syncSession(parsed.data.sessionId, {
    inventory: parsed.data.inventory,
    playerPosition: parsed.data.playerPosition,
    world: parsed.data.world,
  });

  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found or expired.' });
    return;
  }

  // Drain pending actions queued by external MCP tool calls
  const pendingActions = sandboxSessionManager.pollPendingActions(parsed.data.sessionId);

  res.json({
    success: true,
    sessionId: session.sessionId,
    lastActiveAt: session.lastActiveAt,
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
