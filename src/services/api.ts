import type { AnalyzeCharacterResponse } from '../types/game.js';
import type { PlayableGameScene } from '../types/scene.js';
import type { TransformLevelResponse } from '../types/transformation.js';
import { interpretInstructionLocally } from './localRuleParser.js';
import { applyTransformations } from '../game/transformationEngine.js';

export interface ProviderStatusInfo {
  providerId: string;
  displayName: string;
  isConfigured: boolean;
  status: 'unconfigured' | 'configured' | 'available' | 'unavailable' | 'unknown';
  capabilities: string[];
  model: string;
  lastErrorCategory?: string;
}

export interface HealthResponse {
  status: string;
  project: string;
  hackathon: string;
  theme: string;
  aiProvider: string;
  geminiConfigured: boolean;
  providers?: ProviderStatusInfo[];
}

/**
 * Resolves the API URL for a given endpoint.
 * Defaults to relative paths ('/api/...') for unified single-service deployments,
 * or prepends VITE_API_BASE_URL if configured for split-domain hosting.
 */
export function getApiUrl(path: string): string {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env : undefined;
  const base = metaEnv?.VITE_API_BASE_URL || '';
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(getApiUrl('/api/health'));
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }
  return response.json();
}

export interface GetProvidersResponse {
  success: boolean;
  defaultProvider: string;
  providers: ProviderStatusInfo[];
}

export async function fetchAiProviders(probe = false): Promise<GetProvidersResponse> {
  const response = await fetch(getApiUrl(`/api/ai/providers${probe ? '?probe=true' : ''}`));
  if (!response.ok) {
    throw new Error(`Failed to fetch AI providers: status ${response.status}`);
  }
  return response.json();
}

export async function analyzeCharacterImage(
  imageBase64: string,
  promptOverride?: string
): Promise<AnalyzeCharacterResponse> {
  const response = await fetch(getApiUrl('/api/ai/analyze-character'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64,
      promptOverride,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Server responded with ${response.status}`);
  }

  return response.json();
}

export interface AnalyzeLevelResponse {
  success: boolean;
  source: 'gemini-vision' | 'mock-fallback';
  analysis: {
    levelName: string;
    levelDescription: string;
    difficultyRating: 'easy' | 'medium' | 'hard';
    visualStyle: string;
    playerTuning: {
      speed: number;
      jumpPower: number;
      gravity: number;
    };
    recognizedElements: string[];
    designFeedback: string;
  };
  notice?: string;
  error?: string;
}

export async function analyzeLevelSketch(
  imageBase64: string,
  strokeSummary?: string,
  strokeCount?: number
): Promise<AnalyzeLevelResponse> {
  const response = await fetch(getApiUrl('/api/ai/analyze-level'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64,
      strokeSummary,
      strokeCount,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Server responded with ${response.status}`);
  }

  return response.json();
}

export async function transformLevelWithAi(
  scene: PlayableGameScene,
  instruction: string
): Promise<TransformLevelResponse> {
  try {
    const response = await fetch(getApiUrl('/api/ai/transform-level'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scene,
        instruction,
      }),
    });

    if (response.ok) {
      return response.json();
    }
  } catch (err) {
    console.warn('[API] Remote transform-level failed, falling back to client local rule engine:', err);
  }

  // Client-side offline fallback
  const local = interpretInstructionLocally(instruction, scene);
  const result = applyTransformations(scene, local.operations, 'local-rules-transformed');

  return {
    success: true,
    source: 'local-rules',
    operations: local.operations,
    explanation: local.explanation,
    warnings: local.warnings,
    transformedScene: result.transformedScene,
    diagnostics: result.diagnostics,
    notice: 'Offline local rule engine applied directly in browser.',
  };
}

export interface RequestOptions {
  correlationId?: string;
  signal?: AbortSignal;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  category?: string;
  isRetryable?: boolean;
  canFallbackToHeuristic?: boolean;
  details?: unknown;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly category?: string;
  public readonly isRetryable: boolean;
  public readonly canFallbackToHeuristic: boolean;
  public readonly correlationId?: string;
  public readonly details?: unknown;

  constructor(options: {
    message: string;
    statusCode: number;
    code?: string;
    category?: string;
    isRetryable?: boolean;
    canFallbackToHeuristic?: boolean;
    correlationId?: string;
    details?: unknown;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.statusCode = options.statusCode;
    this.code = options.code || `HTTP_${options.statusCode}`;
    this.category = options.category;
    this.isRetryable = options.isRetryable ?? false;
    this.canFallbackToHeuristic = options.canFallbackToHeuristic ?? false;
    this.correlationId = options.correlationId;
    this.details = options.details;
  }
}

export interface UploadReferenceResponse {
  success: boolean;
  correlationId?: string;
  reference: import('../types/reference.js').ReferenceInput;
  error?: string | ApiErrorDetail;
}

export async function uploadReferenceMedia(
  dataBase64: string,
  filename?: string,
  type: 'image' | 'video-frame' | 'sketch' = 'image',
  userDescription?: string,
  options?: RequestOptions
): Promise<UploadReferenceResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.correlationId) {
    headers['X-Correlation-ID'] = options.correlationId;
  }

  const response = await fetch(getApiUrl('/api/reference/upload'), {
    method: 'POST',
    headers,
    signal: options?.signal,
    body: JSON.stringify({
      dataBase64,
      filename,
      type,
      userDescription,
      correlationId: options?.correlationId,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errObj = typeof errorBody.error === 'object' ? errorBody.error : null;
    const safeMsg = errObj?.message || errorBody.error || `Upload failed with status ${response.status}`;
    throw new ApiError({
      message: safeMsg,
      statusCode: response.status,
      code: errObj?.code || `HTTP_${response.status}`,
      category: errObj?.category,
      isRetryable: errObj?.isRetryable ?? false,
      canFallbackToHeuristic: false,
      correlationId: errorBody.correlationId || options?.correlationId,
      details: errObj?.details,
    });
  }

  return response.json();
}

export interface AnalyzeReferenceResponse {
  success: boolean;
  correlationId?: string;
  source: 'gemini-vision' | 'mock-heuristic' | 'manual-input' | 'development-mock';
  provider?: {
    id: string;
    model: string;
    isFallback: boolean;
  };
  analysis: import('../types/reference.js').ReferenceAnalysis;
  notice?: string;
  error?: string | ApiErrorDetail;
}

export async function analyzeReferenceVision(
  imageBase64: string,
  userPrompt?: string,
  options?: RequestOptions & {
    mode?: 'auto' | 'gemini-only' | 'heuristic-only';
    allowFallback?: boolean;
    referenceId?: string;
  }
): Promise<AnalyzeReferenceResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.correlationId) {
    headers['X-Correlation-ID'] = options.correlationId;
  }

  const response = await fetch(getApiUrl('/api/reference/analyze'), {
    method: 'POST',
    headers,
    signal: options?.signal,
    body: JSON.stringify({
      imageBase64,
      userPrompt,
      referenceId: options?.referenceId,
      mode: options?.mode || 'auto',
      allowFallback: options?.allowFallback ?? false,
      correlationId: options?.correlationId,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errObj = typeof errorBody.error === 'object' ? errorBody.error : null;
    const safeMsg =
      errObj?.message || errorBody.error || `Reference analysis failed with status ${response.status}`;
    throw new ApiError({
      message: safeMsg,
      statusCode: response.status,
      code: errObj?.code || `HTTP_${response.status}`,
      category: errObj?.category,
      isRetryable:
        errObj?.isRetryable ??
        (response.status === 504 || response.status === 503 || response.status === 429),
      canFallbackToHeuristic: errObj?.canFallbackToHeuristic ?? true,
      correlationId: errorBody.correlationId || options?.correlationId,
      details: errObj?.details,
    });
  }

  return response.json();
}

export interface GeneratePlanResponse {
  success: boolean;
  correlationId?: string;
  plan: import('../types/reference.js').GameGenerationPlan;
  error?: string | ApiErrorDetail;
}

export async function requestGamePlan(
  referenceId: string,
  userPrompt: string,
  analysis: import('../types/reference.js').ReferenceAnalysis,
  targetEngineOverride?: import('../types/reference.js').TargetEngine,
  templateIdOverride?: import('../types/plan.js').GameTemplateId,
  options?: RequestOptions
): Promise<GeneratePlanResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.correlationId) {
    headers['X-Correlation-ID'] = options.correlationId;
  }

  const response = await fetch(getApiUrl('/api/reference/generate-plan'), {
    method: 'POST',
    headers,
    signal: options?.signal,
    body: JSON.stringify({
      referenceId,
      userPrompt,
      analysis,
      targetEngineOverride,
      templateIdOverride,
      correlationId: options?.correlationId,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errObj = typeof errorBody.error === 'object' ? errorBody.error : null;
    const safeMsg = errObj?.message || errorBody.error || `Plan generation failed with status ${response.status}`;
    throw new ApiError({
      message: safeMsg,
      statusCode: response.status,
      code: errObj?.code || `HTTP_${response.status}`,
      category: errObj?.category,
      isRetryable: false,
      correlationId: errorBody.correlationId || options?.correlationId,
    });
  }

  return response.json();
}

export interface AnalyzeMultipleFramesResponse {
  success: boolean;
  correlationId?: string;
  source: 'gemini-vision-multiframe';
  provider?: {
    id: string;
    model: string;
    isFallback: boolean;
  };
  frameCount: number;
  analysis: import('../types/reference.js').ReferenceAnalysis;
  notice?: string;
  error?: string | ApiErrorDetail;
}

export async function analyzeMultipleFrames(
  frameBase64s: string[],
  userPrompt?: string,
  options?: RequestOptions
): Promise<AnalyzeMultipleFramesResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.correlationId) {
    headers['X-Correlation-ID'] = options.correlationId;
  }

  const response = await fetch(getApiUrl('/api/reference/analyze-frames'), {
    method: 'POST',
    headers,
    signal: options?.signal,
    body: JSON.stringify({
      frameBase64s,
      userPrompt,
      correlationId: options?.correlationId,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errObj = typeof errorBody.error === 'object' ? errorBody.error : null;
    const safeMsg =
      errObj?.message || errorBody.error || `Multi-frame analysis failed with status ${response.status}`;
    throw new ApiError({
      message: safeMsg,
      statusCode: response.status,
      code: errObj?.code || `HTTP_${response.status}`,
      category: errObj?.category,
      isRetryable:
        errObj?.isRetryable ??
        (response.status === 504 || response.status === 503 || response.status === 429),
      canFallbackToHeuristic: false,
      correlationId: errorBody.correlationId || options?.correlationId,
    });
  }

  return response.json();
}
