import { Router, Request, Response } from 'express';
import { serverConfig } from '../config.js';
import {
  UploadReferenceRequestSchema,
  AnalyzeReferenceRequestSchema,
  GeneratePlanRequestSchema,
  ReferenceAnalysisSchema,
} from '../schemas/reference.schema.js';
import { referenceStorageService } from '../services/upload.service.js';
import {
  analyzeReferenceWithGemini,
  generateHeuristicReferenceAnalysis,
  buildGameGenerationPlan,
} from '../services/referenceAnalysis.service.js';

export const referenceRouter = Router();

/**
 * Safe Reference Upload Endpoint
 * Checks magic byte signatures, bounds dimensions, enforces 10MB limit.
 */
referenceRouter.post('/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = UploadReferenceRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Upload validation failed',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { dataBase64, filename, type, userDescription } = parseResult.data;

    // Convert base64 to binary buffer
    const base64Clean = dataBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    const storedRef = await referenceStorageService.storeReference(
      buffer,
      filename,
      type,
      userDescription
    );

    res.json({
      success: true,
      reference: storedRef,
    });
  } catch (err: unknown) {
    console.error('Reference upload error:', err);
    res.status(400).json({
      success: false,
      error: (err as Error).message || 'Failed to process and store reference upload',
    });
  }
});

/**
 * Reference Vision Analysis Endpoint
 */
referenceRouter.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = AnalyzeReferenceRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Analysis request validation failed',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { imageBase64, userPrompt } = parseResult.data;

    if (serverConfig.geminiApiKey) {
      try {
        const analysis = await analyzeReferenceWithGemini(imageBase64, userPrompt);
        res.json({
          success: true,
          source: 'gemini-vision',
          analysis,
        });
        return;
      } catch (geminiError: unknown) {
        console.warn(
          'Gemini reference vision analysis failed, falling back to heuristic:',
          (geminiError as Error).message
        );
        const fallback = generateHeuristicReferenceAnalysis(userPrompt);
        res.json({
          success: true,
          source: 'mock-heuristic',
          analysis: fallback,
          notice: `Live Gemini call failed (${(geminiError as Error).message}). Switched to deterministic heuristic analysis.`,
        });
        return;
      }
    }

    const heuristic = generateHeuristicReferenceAnalysis(userPrompt);
    res.json({
      success: true,
      source: 'mock-heuristic',
      analysis: heuristic,
      notice: 'GEMINI_API_KEY is not configured on the server. Used deterministic heuristic analysis.',
    });
  } catch (err: unknown) {
    console.error('Unhandled reference analysis error:', err);
    res.status(500).json({
      success: false,
      error: (err as Error).message || 'Internal server error during reference analysis',
    });
  }
});

/**
 * Plan Generation Endpoint
 */
referenceRouter.post('/generate-plan', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = GeneratePlanRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Plan request validation failed',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { referenceId, userPrompt, analysis, targetEngineOverride } = parseResult.data;

    // Validate incoming analysis against schema
    const validatedAnalysis = ReferenceAnalysisSchema.parse(analysis);

    const plan = buildGameGenerationPlan(
      referenceId,
      userPrompt,
      validatedAnalysis,
      targetEngineOverride
    );

    res.json({
      success: true,
      plan,
    });
  } catch (err: unknown) {
    console.error('Plan generation error:', err);
    res.status(400).json({
      success: false,
      error: (err as Error).message || 'Failed to generate game generation plan',
    });
  }
});
