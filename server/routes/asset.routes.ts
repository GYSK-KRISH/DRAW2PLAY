import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  AssetRoleSchema,
  GameDesignPlanSchema,
} from '../../src/types/plan.js';
import {
  generateAssetBundle,
  generateSingleAsset,
} from '../services/assetGeneration.service.js';
import { aiProviderRegistry } from '../providers/registry.js';

export const assetRouter = Router();

const GenerateBundleRequestSchema = z.object({
  plan: GameDesignPlanSchema,
  artStyle: z.string().max(80).optional(),
  forceFallback: z.boolean().optional(),
});

const GenerateSingleRequestSchema = z.object({
  plan: GameDesignPlanSchema,
  role: AssetRoleSchema,
  promptOverride: z.string().max(400).optional(),
  forceFallback: z.boolean().optional(),
  artStyle: z.string().max(80).optional(),
});

/**
 * GET /api/assets/status
 * Returns current asset generation provider capabilities and health
 */
assetRouter.get('/status', async (_req: Request, res: Response) => {
  const gemini = aiProviderRegistry.getProvider('gemini');
  const isConfigured = gemini ? gemini.isConfigured() : false;
  const hasImageCap = gemini ? gemini.capabilities.has('image-generation') : false;

  res.json({
    success: true,
    provider: {
      id: gemini?.id || 'gemini',
      displayName: gemini?.displayName || 'Google Gemini Vision & Imagen',
      isConfigured,
      hasImageGenerationCapability: hasImageCap,
      supportedRoles: [
        'player',
        'enemy',
        'collectible',
        'hazard',
        'goal',
        'platform',
        'background',
      ],
      fallbackAvailable: true,
      fallbackType: 'procedural-png-rasterizer',
    },
  });
});

/**
 * POST /api/assets/generate-bundle
 * Generates all 7 level visual assets for a given game plan
 */
assetRouter.post('/generate-bundle', async (req: Request, res: Response) => {
  try {
    const parseResult = GenerateBundleRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid generate-bundle request payload',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { plan, artStyle, forceFallback } = parseResult.data;
    const bundle = await generateAssetBundle(plan, {
      artStyle,
      forceFallback,
    });

    res.json({
      success: true,
      bundle,
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: (err as Error).message || 'Asset bundle generation failed',
    });
  }
});

/**
 * POST /api/assets/generate-single
 * Generates or regenerates a single visual asset for a game plan
 */
assetRouter.post('/generate-single', async (req: Request, res: Response) => {
  try {
    const parseResult = GenerateSingleRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid generate-single request payload',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { plan, role, promptOverride, forceFallback, artStyle } = parseResult.data;
    const asset = await generateSingleAsset(plan, role, {
      promptOverride,
      forceFallback,
      artStyle,
    });

    res.json({
      success: true,
      asset,
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: (err as Error).message || 'Single asset generation failed',
    });
  }
});
