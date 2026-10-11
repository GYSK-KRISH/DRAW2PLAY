import { Router, Request, Response } from 'express';
import { RemixLevelRequestSchema } from '../../src/types/remix.js';
import { remixService } from '../services/remix.service.js';
import { ALLOWLISTED_MECHANIC_IDS } from '../../src/types/plan.js';
import { ALLOWLISTED_REMIX_PATH_PATTERNS } from '../../src/types/remix.js';

export const remixRouter = Router();

/**
 * GET /api/remix-level/status
 * Returns remix engine capabilities, allowlisted path patterns, and supported mechanics
 */
remixRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    capabilities: {
      patchFormat: 'RFC 6902 JSON Patch',
      supportedOperations: ['add', 'replace', 'remove'],
      allowlistedPathPatternsCount: ALLOWLISTED_REMIX_PATH_PATTERNS.length,
      supportedMechanics: ALLOWLISTED_MECHANIC_IDS,
      hotUpdateSupported: true,
      optimisticConcurrencySupported: true,
      maxInstructionLength: 400,
    },
  });
});

/**
 * POST /api/remix-level
 * Generates and applies a validated RFC 6902 JSON patch to remix an active game level
 */
remixRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parseResult = RemixLevelRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid remix request payload',
        details: parseResult.error.issues.map((i) => i.message),
      });
    }

    const remixResult = await remixService.remixLevel(parseResult.data);
    return res.json(remixResult);
  } catch (err: any) {
    console.error('[RemixRouter] Remix processing error:', err.message);
    return res.status(422).json({
      success: false,
      error: err.message || 'Failed to remix game level',
    });
  }
});
