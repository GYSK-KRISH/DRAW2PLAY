import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { serverConfig } from '../config.js';
import { analyzeCharacterWithGemini } from '../services/gemini.service.js';
import { generateMockCharacterAttributes } from '../services/mock.service.js';

export const aiRouter = Router();

const RequestSchema = z.object({
  imageBase64: z.string().min(10, 'Valid base64 image data is required'),
  promptOverride: z.string().optional(),
});

aiRouter.post('/analyze-character', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = RequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { imageBase64, promptOverride } = parseResult.data;

    // Check if real Gemini API Key is available
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
        console.warn('Gemini API call failed, falling back to heuristic mock:', (geminiError as Error).message);
        // Graceful fallback to heuristic analysis while recording the error
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

    // Default development mode: Deterministic Heuristic Service
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
      error: (error as Error).message || 'Internal server error during image analysis',
    });
  }
});
