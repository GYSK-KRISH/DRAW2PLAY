import type { AnalyzeCharacterResponse } from '../types/game.js';
import type { PlayableGameScene } from '../types/scene.js';
import type { TransformLevelResponse } from '../types/transformation.js';
import { interpretInstructionLocally } from './localRuleParser.js';
import { applyTransformations } from '../game/transformationEngine.js';

export interface HealthResponse {
  status: string;
  project: string;
  hackathon: string;
  theme: string;
  aiProvider: string;
  geminiConfigured: boolean;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
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

