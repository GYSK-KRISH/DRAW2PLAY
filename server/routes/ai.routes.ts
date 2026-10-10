import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { serverConfig } from '../config.js';
import { analyzeCharacterWithGemini, analyzeLevelWithGemini } from '../services/gemini.service.js';
import { generateMockCharacterAttributes, generateMockLevelAnalysis } from '../services/mock.service.js';

export const aiRouter = Router();

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
