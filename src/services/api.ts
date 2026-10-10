import type { AnalyzeCharacterResponse } from '../types/game.js';

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
