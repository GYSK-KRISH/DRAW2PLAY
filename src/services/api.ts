import type { AnalyzeCharacterResponse } from '../types/game.js';

export async function fetchHealth(): Promise<{
  status: string;
  project: string;
  hackathon: string;
  theme: string;
  aiProvider: string;
  geminiConfigured: boolean;
}> {
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
