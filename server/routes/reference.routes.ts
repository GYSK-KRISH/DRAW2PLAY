import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { serverConfig } from '../config.js';
import {
  UploadReferenceRequestSchema,
  AnalyzeReferenceRequestSchema,
  AnalyzeMultipleFramesRequestSchema,
  GeneratePlanRequestSchema,
  ReferenceAnalysisSchema,
} from '../schemas/reference.schema.js';
import {
  referenceStorageService,
  ImageValidationError,
} from '../services/upload.service.js';
import {
  analyzeReferenceWithGemini,
  analyzeMultipleFramesWithGemini,
  generateHeuristicReferenceAnalysis,
  buildGameGenerationPlan,
} from '../services/referenceAnalysis.service.js';
import { logAnalysisEvent } from '../utils/analysisLogger.js';
import { classifyError } from '../providers/gemini.provider.js';
import { AiProviderError } from '../providers/types.js';

export const referenceRouter = Router();

function getCorrelationId(req: Request): string {
  const fromHeader = req.headers['x-correlation-id'];
  if (typeof fromHeader === 'string' && fromHeader.trim().length > 0) {
    return fromHeader.trim();
  }
  const fromBody = req.body?.correlationId;
  if (typeof fromBody === 'string' && fromBody.trim().length > 0) {
    return fromBody.trim();
  }
  return `corr-${crypto.randomUUID().slice(0, 10)}`;
}

/**
 * Safe Reference Upload Endpoint
 * Checks magic byte signatures, bounds dimensions, enforces 10MB limit.
 */
referenceRouter.post('/upload', async (req: Request, res: Response): Promise<void> => {
  const correlationId = getCorrelationId(req);
  res.setHeader('X-Correlation-ID', correlationId);
  const startTime = Date.now();

  try {
    const parseResult = UploadReferenceRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      logAnalysisEvent({
        correlationId,
        stage: 'error',
        durationMs: Date.now() - startTime,
        provider: 'upload',
        model: 'validator',
        httpStatus: 400,
        errorCategory: 'invalid_request',
        isFallback: false,
        details: 'Upload schema validation failed',
      });

      res.status(400).json({
        success: false,
        correlationId,
        error: {
          code: 'UPLOAD_VALIDATION_FAILED',
          message: 'Upload request failed validation',
          category: 'invalid_request',
          isRetryable: false,
          details: parseResult.error.flatten(),
        },
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

    logAnalysisEvent({
      correlationId,
      stage: 'uploading',
      durationMs: Date.now() - startTime,
      provider: 'upload',
      model: 'memory-storage',
      httpStatus: 200,
      isFallback: false,
    });

    res.json({
      success: true,
      correlationId,
      reference: storedRef,
    });
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    let statusCode = 400;
    let errorCode = 'UPLOAD_PROCESSING_FAILED';
    let errorCategory = 'invalid_request';

    if (err instanceof ImageValidationError) {
      statusCode = err.statusCode;
      errorCode = err.code;
      errorCategory = 'unsupported_image';
    }

    const safeMessage = err instanceof Error ? err.message : 'Failed to process reference upload';

    logAnalysisEvent({
      correlationId,
      stage: 'error',
      durationMs,
      provider: 'upload',
      model: 'validator',
      httpStatus: statusCode,
      errorCategory,
      isFallback: false,
      details: safeMessage,
    });

    res.status(statusCode).json({
      success: false,
      correlationId,
      error: {
        code: errorCode,
        message: safeMessage,
        category: errorCategory,
        isRetryable: false,
      },
    });
  }
});

/**
 * Reference Vision Analysis Endpoint (single image / frame)
 * Truthfully executes live provider or explicit heuristic fallback.
 * Never silently returns hardcoded mock heuristic disguised as Gemini output.
 */
referenceRouter.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  const correlationId = getCorrelationId(req);
  res.setHeader('X-Correlation-ID', correlationId);
  const startTime = Date.now();

  try {
    const parseResult = AnalyzeReferenceRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      logAnalysisEvent({
        correlationId,
        stage: 'error',
        durationMs: Date.now() - startTime,
        provider: 'gemini',
        model: serverConfig.geminiModel,
        httpStatus: 400,
        errorCategory: 'invalid_request',
        isFallback: false,
        details: 'Analysis request schema validation failed',
      });

      res.status(400).json({
        success: false,
        correlationId,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Analysis request payload validation failed',
          category: 'invalid_request',
          isRetryable: false,
          details: parseResult.error.flatten(),
        },
      });
      return;
    }

    const { imageBase64, userPrompt, mode = 'auto', allowFallback = false } = parseResult.data;

    // 1. Explicit heuristic-only mode
    if (mode === 'heuristic-only') {
      const fallback = generateHeuristicReferenceAnalysis(userPrompt, 800, 600, correlationId);
      logAnalysisEvent({
        correlationId,
        stage: 'fallback',
        durationMs: Date.now() - startTime,
        provider: 'local-heuristic',
        model: 'deterministic-keywords-v2',
        httpStatus: 200,
        isFallback: true,
      });

      res.json({
        success: true,
        correlationId,
        source: 'mock-heuristic',
        provider: {
          id: 'local-heuristic',
          model: 'deterministic-keywords-v2',
          isFallback: true,
        },
        analysis: fallback,
        notice:
          'Local heuristic analysis based on prompt keywords. Results do not reflect actual image content.',
      });
      return;
    }

    // 2. Auto or Gemini-only with missing configuration
    if (!serverConfig.geminiApiKey) {
      if (allowFallback && mode !== 'gemini-only') {
        const fallback = generateHeuristicReferenceAnalysis(userPrompt, 800, 600, correlationId);
        logAnalysisEvent({
          correlationId,
          stage: 'fallback',
          durationMs: Date.now() - startTime,
          provider: 'local-heuristic',
          model: 'deterministic-keywords-v2',
          httpStatus: 200,
          isFallback: true,
          details: 'Fallback allowed and used because GEMINI_API_KEY is not configured',
        });

        res.json({
          success: true,
          correlationId,
          source: 'mock-heuristic',
          provider: {
            id: 'local-heuristic',
            model: 'deterministic-keywords-v2',
            isFallback: true,
          },
          analysis: fallback,
          notice:
            'GEMINI_API_KEY is not configured on the server. Used deterministic keyword heuristic analysis.',
        });
        return;
      }

      logAnalysisEvent({
        correlationId,
        stage: 'error',
        durationMs: Date.now() - startTime,
        provider: 'gemini',
        model: serverConfig.geminiModel,
        httpStatus: 503,
        errorCategory: 'missing_configuration',
        isFallback: false,
        details: 'GEMINI_API_KEY is not configured on the server',
      });

      res.status(503).json({
        success: false,
        correlationId,
        error: {
          code: 'MISSING_CONFIGURATION',
          message: 'GEMINI_API_KEY is not configured on the server.',
          category: 'missing_configuration',
          isRetryable: false,
          canFallbackToHeuristic: true,
        },
      });
      return;
    }

    // 3. Live Gemini Vision call
    try {
      const analysis = await analyzeReferenceWithGemini(imageBase64, userPrompt, correlationId);
      const durationMs = Date.now() - startTime;

      logAnalysisEvent({
        correlationId,
        stage: 'success',
        durationMs,
        provider: 'gemini',
        model: serverConfig.geminiModel,
        httpStatus: 200,
        isFallback: false,
      });

      res.json({
        success: true,
        correlationId,
        source: 'gemini-vision',
        provider: {
          id: 'gemini',
          model: analysis.modelProvenance || serverConfig.geminiModel,
          isFallback: false,
        },
        analysis,
        usage: analysis.usage,
      });
    } catch (geminiError: unknown) {
      const durationMs = Date.now() - startTime;
      const classification = classifyError(geminiError);
      const safeMsg =
        geminiError instanceof Error ? geminiError.message : 'Gemini Vision analysis failed';
      const statusCode =
        (geminiError as AiProviderError)?.statusCode || classification.statusCode || 500;
      const errorCode =
        (geminiError as AiProviderError)?.code || classification.category.toUpperCase();

      logAnalysisEvent({
        correlationId,
        stage: 'error',
        durationMs,
        provider: 'gemini',
        model: serverConfig.geminiModel,
        httpStatus: statusCode,
        errorCategory: classification.category,
        isFallback: false,
        details: safeMsg,
      });

      // Never silently replace a failed live call with mock output unless client explicitly permits it
      if (allowFallback && mode !== 'gemini-only') {
        const fallback = generateHeuristicReferenceAnalysis(userPrompt, 800, 600, correlationId);
        logAnalysisEvent({
          correlationId,
          stage: 'fallback',
          durationMs,
          provider: 'local-heuristic',
          model: 'deterministic-keywords-v2',
          httpStatus: 200,
          isFallback: true,
          details: `Fallback used after live failure: ${safeMsg}`,
        });

        res.json({
          success: true,
          correlationId,
          source: 'mock-heuristic',
          provider: {
            id: 'local-heuristic',
            model: 'deterministic-keywords-v2',
            isFallback: true,
          },
          analysis: fallback,
          notice: `Live Gemini call failed (${safeMsg}). Switched to deterministic keyword heuristic analysis. Results do not reflect actual image content.`,
        });
        return;
      }

      res.status(statusCode).json({
        success: false,
        correlationId,
        error: {
          code: errorCode,
          message: safeMsg,
          category: classification.category,
          isRetryable: classification.isRetryable,
          canFallbackToHeuristic: true,
        },
      });
    }
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const safeMsg = (err as Error).message || 'Internal server error during reference analysis';

    logAnalysisEvent({
      correlationId,
      stage: 'error',
      durationMs,
      provider: 'server',
      model: 'unknown',
      httpStatus: 500,
      errorCategory: 'server_error',
      isFallback: false,
      details: safeMsg,
    });

    res.status(500).json({
      success: false,
      correlationId,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: safeMsg,
        category: 'server_error',
        isRetryable: false,
        canFallbackToHeuristic: true,
      },
    });
  }
});

/**
 * Phase 6.2: Multi-Frame Reference Analysis Endpoint
 * Accepts 2-5 base64 video frames and returns a merged analysis.
 * Requires Gemini Vision — no silent mock substitution.
 */
referenceRouter.post('/analyze-frames', async (req: Request, res: Response): Promise<void> => {
  const correlationId = getCorrelationId(req);
  res.setHeader('X-Correlation-ID', correlationId);
  const startTime = Date.now();

  try {
    const parseResult = AnalyzeMultipleFramesRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      logAnalysisEvent({
        correlationId,
        stage: 'error',
        durationMs: Date.now() - startTime,
        provider: 'gemini',
        model: serverConfig.geminiModel,
        httpStatus: 400,
        errorCategory: 'invalid_request',
        isFallback: false,
        details: 'Multi-frame analysis schema validation failed',
      });

      res.status(400).json({
        success: false,
        correlationId,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Multi-frame analysis request validation failed',
          category: 'invalid_request',
          isRetryable: false,
          details: parseResult.error.flatten(),
        },
      });
      return;
    }

    const { frameBase64s, userPrompt } = parseResult.data;

    if (!serverConfig.geminiApiKey) {
      logAnalysisEvent({
        correlationId,
        stage: 'error',
        durationMs: Date.now() - startTime,
        provider: 'gemini',
        model: serverConfig.geminiModel,
        httpStatus: 503,
        errorCategory: 'missing_configuration',
        isFallback: false,
        details: 'GEMINI_API_KEY is not configured for multi-frame analysis',
      });

      res.status(503).json({
        success: false,
        correlationId,
        error: {
          code: 'MISSING_CONFIGURATION',
          message: 'Multi-frame analysis requires Gemini Vision. GEMINI_API_KEY is not configured on the server.',
          category: 'missing_configuration',
          isRetryable: false,
        },
        notice: 'Configure GEMINI_API_KEY and retry, or use the single-frame /analyze endpoint with heuristic fallback.',
      });
      return;
    }

    try {
      const analysis = await analyzeMultipleFramesWithGemini(frameBase64s, userPrompt);
      const durationMs = Date.now() - startTime;

      logAnalysisEvent({
        correlationId,
        stage: 'success',
        durationMs,
        provider: 'gemini',
        model: serverConfig.geminiModel,
        httpStatus: 200,
        isFallback: false,
      });

      res.json({
        success: true,
        correlationId,
        source: 'gemini-vision-multiframe',
        provider: {
          id: 'gemini',
          model: analysis.modelProvenance || serverConfig.geminiModel,
          isFallback: false,
        },
        frameCount: analysis.frameCount,
        analysis,
        usage: analysis.usage,
      });
    } catch (geminiError: unknown) {
      const durationMs = Date.now() - startTime;
      const classification = classifyError(geminiError);
      const safeMsg =
        geminiError instanceof Error ? geminiError.message : 'Multi-frame vision analysis failed';
      const statusCode =
        (geminiError as AiProviderError)?.statusCode || classification.statusCode || 502;
      const errorCode =
        (geminiError as AiProviderError)?.code || classification.category.toUpperCase();

      logAnalysisEvent({
        correlationId,
        stage: 'error',
        durationMs,
        provider: 'gemini',
        model: serverConfig.geminiModel,
        httpStatus: statusCode,
        errorCategory: classification.category,
        isFallback: false,
        details: safeMsg,
      });

      res.status(statusCode).json({
        success: false,
        correlationId,
        error: {
          code: errorCode,
          message: safeMsg,
          category: classification.category,
          isRetryable: classification.isRetryable,
        },
        notice: 'Try reducing the number of frames or use single-frame /analyze endpoint.',
      });
    }
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const safeMsg = (err as Error).message || 'Internal server error during multi-frame analysis';

    logAnalysisEvent({
      correlationId,
      stage: 'error',
      durationMs,
      provider: 'server',
      model: 'unknown',
      httpStatus: 500,
      errorCategory: 'server_error',
      isFallback: false,
      details: safeMsg,
    });

    res.status(500).json({
      success: false,
      correlationId,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: safeMsg,
        category: 'server_error',
        isRetryable: false,
      },
    });
  }
});

/**
 * Plan Generation Endpoint
 */
referenceRouter.post('/generate-plan', async (req: Request, res: Response): Promise<void> => {
  const correlationId = getCorrelationId(req);
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    const parseResult = GeneratePlanRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        correlationId,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Plan generation request validation failed',
          category: 'invalid_request',
          isRetryable: false,
          details: parseResult.error.flatten(),
        },
      });
      return;
    }

    const { referenceId, userPrompt, analysis, targetEngineOverride, templateIdOverride } = parseResult.data;

    // Validate incoming analysis against schema
    const validatedAnalysis = ReferenceAnalysisSchema.parse(analysis);

    const plan = buildGameGenerationPlan(
      referenceId,
      userPrompt,
      validatedAnalysis,
      targetEngineOverride,
      templateIdOverride as any
    );

    res.json({
      success: true,
      correlationId,
      plan,
    });
  } catch (err: unknown) {
    console.error('Plan generation error:', err);
    res.status(400).json({
      success: false,
      correlationId,
      error: {
        code: 'PLAN_GENERATION_FAILED',
        message: (err as Error).message || 'Failed to generate game generation plan',
        category: 'invalid_request',
        isRetryable: false,
      },
    });
  }
});
