import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { serverConfig } from '../config.js';
import {
  analyzeCharacterWithGemini,
  analyzeLevelWithGemini,
  transformLevelWithGemini,
} from '../services/gemini.service.js';
import { generateMockCharacterAttributes, generateMockLevelAnalysis } from '../services/mock.service.js';
import { TransformLevelRequestSchema } from '../schemas/transformation.schema.js';
import { interpretInstructionLocally } from '../../src/services/localRuleParser.js';
import { applyTransformations } from '../../src/game/transformationEngine.js';

import { aiProviderRegistry } from '../providers/index.js';
import {
  ServerRecognizeCraftRequestSchema,
  CRAFTABLE_ITEM_ALLOWLIST,
  CRAFTABLE_ITEMS_CATALOGUE,
} from '../schemas/craft.schema.js';
import { recognizeCraftDrawing } from '../services/craftRecognition.service.js';

export const aiRouter = Router();

/**
 * Safe Provider Status and Diagnostics Endpoint
 * Reports registered AI providers, configuration status, and capabilities.
 * Never leaks API keys, secrets, or raw internal credentials.
 */
aiRouter.get('/providers', async (req: Request, res: Response): Promise<void> => {
  try {
    const probe = req.query.probe === 'true';
    const statuses = await aiProviderRegistry.getProviderStatuses(probe);
    res.json({
      success: true,
      defaultProvider: aiProviderRegistry.getDefaultProvider().id,
      providers: statuses,
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to fetch provider status',
    });
  }
});

const CharacterRequestSchema = z.object({
  imageBase64: z.string().min(10, 'Valid base64 image data is required'),
  promptOverride: z.string().optional(),
});

const LevelRequestSchema = z.object({
  imageBase64: z.string().min(10, 'Valid base64 image data is required'),
  strokeSummary: z.string().optional(),
  strokeCount: z.number().int().optional(),
});

/**
 * Character Analysis Endpoint
 */
aiRouter.post('/analyze-character', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = CharacterRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { imageBase64, promptOverride } = parseResult.data;

    if (serverConfig.geminiApiKey) {
      try {
        const geminiAttributes = await analyzeCharacterWithGemini(imageBase64, promptOverride);
        res.json({
          success: true,
          source: 'gemini',
          attributes: geminiAttributes,
        });
        return;
      } catch (geminiError: unknown) {
        console.warn('Gemini character analysis failed, using fallback:', (geminiError as Error).message);
        const fallbackAttributes = generateMockCharacterAttributes(imageBase64);
        res.json({
          success: true,
          source: 'mock-heuristic',
          attributes: fallbackAttributes,
          notice: `Gemini API attempt encountered an error: ${(geminiError as Error).message}. Used deterministic heuristic fallback.`,
        });
        return;
      }
    }

    const mockAttributes = generateMockCharacterAttributes(imageBase64);
    res.json({
      success: true,
      source: 'mock-heuristic',
      attributes: mockAttributes,
      notice: 'GEMINI_API_KEY is not set in .env. Returned deterministic heuristic attributes based on sketch metrics.',
    });
  } catch (error: unknown) {
    console.error('Unhandled character analysis error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Internal server error during character image analysis',
    });
  }
});

/**
 * Level Sketch Vision Analysis Endpoint
 */
aiRouter.post('/analyze-level', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = LevelRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { imageBase64, strokeSummary, strokeCount } = parseResult.data;

    // Check if live Gemini API key is configured
    if (serverConfig.geminiApiKey) {
      try {
        const geminiLevel = await analyzeLevelWithGemini(imageBase64, strokeSummary);
        res.json({
          success: true,
          source: 'gemini-vision',
          analysis: geminiLevel,
          model: serverConfig.geminiModel,
        });
        return;
      } catch (geminiError: unknown) {
        console.warn('Gemini level analysis failed, using fallback:', (geminiError as Error).message);
        const fallbackLevel = generateMockLevelAnalysis(strokeCount || 5);
        res.json({
          success: true,
          source: 'mock-fallback',
          analysis: fallbackLevel,
          notice: `Live Gemini API call failed: ${(geminiError as Error).message}. Switched to local fallback.`,
        });
        return;
      }
    }

    // Default offline development mode
    const mockLevel = generateMockLevelAnalysis(strokeCount || 5);
    res.json({
      success: true,
      source: 'mock-fallback',
      analysis: mockLevel,
      notice: 'GEMINI_API_KEY is not configured on the server. Used deterministic mock fallback.',
    });
  } catch (error: unknown) {
    console.error('Unhandled level analysis error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Internal server error during level analysis',
    });
  }
});

/**
 * Natural Language Level Transformation Endpoint
 */
aiRouter.post('/transform-level', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = TransformLevelRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed for level transformation request',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { scene, instruction } = parseResult.data;

    // 1. Live Gemini AI Path (when API key is present)
    if (serverConfig.geminiApiKey) {
      try {
        const geminiResult = await transformLevelWithGemini(scene, instruction);
        const transformed = applyTransformations(
          scene,
          geminiResult.operations,
          'gemini-transformed'
        );

        res.json({
          success: true,
          source: 'gemini',
          operations: geminiResult.operations,
          explanation: geminiResult.explanation,
          warnings: [...geminiResult.warnings, ...transformed.warnings],
          transformedScene: transformed.transformedScene,
          diagnostics: transformed.diagnostics,
        });
        return;
      } catch (geminiError: unknown) {
        console.warn(
          'Gemini level transformation failed, falling back to local rule engine:',
          (geminiError as Error).message
        );
        const localResult = interpretInstructionLocally(instruction, scene);
        const transformed = applyTransformations(
          scene,
          localResult.operations,
          'local-rules-transformed'
        );

        res.json({
          success: true,
          source: 'local-rules',
          operations: localResult.operations,
          explanation: localResult.explanation,
          warnings: [
            `Live Gemini call failed (${(geminiError as Error).message}). Switched to local rule engine.`,
            ...localResult.warnings,
            ...transformed.warnings,
          ],
          transformedScene: transformed.transformedScene,
          diagnostics: transformed.diagnostics,
          notice: 'Gemini API encountered an error. Evaluated with local rules fallback.',
        });
        return;
      }
    }

    // 2. Offline / Deterministic Local Rule Engine Path
    const localResult = interpretInstructionLocally(instruction, scene);
    const transformed = applyTransformations(
      scene,
      localResult.operations,
      'local-rules-transformed'
    );

    res.json({
      success: true,
      source: 'local-rules',
      operations: localResult.operations,
      explanation: localResult.explanation,
      warnings: [...localResult.warnings, ...transformed.warnings],
      transformedScene: transformed.transformedScene,
      diagnostics: transformed.diagnostics,
      notice: 'Deterministic local rules applied (GEMINI_API_KEY not set).',
    });
  } catch (error: unknown) {
    console.error('Unhandled level transformation error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Internal server error during level transformation',
    });
  }
});

/**
 * Craftable Items Catalogue Endpoint (Phase 7.2)
 * Returns the finite allowlist and metadata definitions of craftable sandbox items.
 */
aiRouter.get('/craft-catalogue', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    allowlist: CRAFTABLE_ITEM_ALLOWLIST,
    catalogue: CRAFTABLE_ITEMS_CATALOGUE,
  });
});

/**
 * Sketch-to-Craft Recognition Endpoint (Phase 7.2)
 * Evaluates hand-drawn sketches for the Draw-to-Craft Sandbox mode.
 */
aiRouter.post('/recognize-craft-sketch', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = ServerRecognizeCraftRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const recognitionResult = await recognizeCraftDrawing(parseResult.data);
    res.json({
      success: true,
      result: recognitionResult,
    });
  } catch (error: unknown) {
    console.error('Unhandled sketch recognition error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Internal server error during sketch recognition',
    });
  }
});


