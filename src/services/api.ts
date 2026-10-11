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

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');
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
  const response = await fetch(`/api/ai/providers${probe ? '?probe=true' : ''}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch AI providers: status ${response.status}`);
  }
  return response.json();
}

export async function analyzeCharacterImage(
  imageBase64: string,
  promptOverride?: string
): Promise<AnalyzeCharacterResponse> {
  const response = await fetch('/api/ai/analyze-character', {
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
  const response = await fetch('/api/ai/analyze-level', {
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
    const response = await fetch('/api/ai/transform-level', {
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

export interface UploadReferenceResponse {
  success: boolean;
  reference: import('../types/reference.js').ReferenceInput;
  error?: string;
}

export async function uploadReferenceMedia(
  dataBase64: string,
  filename?: string,
  type: 'image' | 'video-frame' | 'sketch' = 'image',
  userDescription?: string
): Promise<UploadReferenceResponse> {
  const response = await fetch('/api/reference/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataBase64,
      filename,
      type,
      userDescription,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Upload failed with status ${response.status}`);
  }

  return response.json();
}

export interface AnalyzeReferenceResponse {
  success: boolean;
  source: 'gemini-vision' | 'mock-heuristic' | 'manual-input';
  analysis: import('../types/reference.js').ReferenceAnalysis;
  notice?: string;
  error?: string;
}

export async function analyzeReferenceVision(
  imageBase64: string,
  userPrompt?: string
): Promise<AnalyzeReferenceResponse> {
  const response = await fetch('/api/reference/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      userPrompt,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Reference analysis failed with status ${response.status}`);
  }

  return response.json();
}

export interface GeneratePlanResponse {
  success: boolean;
  plan: import('../types/reference.js').GameGenerationPlan;
  error?: string;
}

export async function requestGamePlan(
  referenceId: string,
  userPrompt: string,
  analysis: import('../types/reference.js').ReferenceAnalysis,
  targetEngineOverride?: import('../types/reference.js').TargetEngine
): Promise<GeneratePlanResponse> {
  const response = await fetch('/api/reference/generate-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      referenceId,
      userPrompt,
      analysis,
      targetEngineOverride,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Plan generation failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Phase 6.2: Analyze multiple video frames with Gemini Vision.
 * Requires 2-5 base64 encoded frames. Server merges observations across frames.
 * Returns 503 with descriptive error if Gemini Vision is not configured.
 */
export interface AnalyzeMultipleFramesResponse {
  success: boolean;
  source: 'gemini-vision-multiframe';
  frameCount: number;
  analysis: import('../types/reference.js').ReferenceAnalysis;
  notice?: string;
  error?: string;
}

export async function analyzeMultipleFrames(
  frameBase64s: string[],
  userPrompt?: string
): Promise<AnalyzeMultipleFramesResponse> {
  const response = await fetch('/api/reference/analyze-frames', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      frameBase64s,
      userPrompt,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Multi-frame analysis failed with status ${response.status}`);
  }

  return response.json();
}
