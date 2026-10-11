import type {
  RecognizeCraftResponse,
  RecognizeCraftRequest,
  CraftableItemId,
  CraftableItemDefinition,
} from '../types/sandbox.js';
import {
  RecognizeCraftResponseSchema,
  CRAFTABLE_ITEM_ALLOWLIST,
  CRAFTABLE_ITEMS_CATALOGUE,
} from '../types/sandbox.js';

export interface CraftCatalogueResponse {
  success: boolean;
  allowlist: readonly CraftableItemId[];
  catalogue: Record<CraftableItemId, CraftableItemDefinition>;
}

/**
 * Fetches the craftable sandbox items catalogue from backend or falls back to local definition
 */
export async function fetchCraftCatalogue(): Promise<CraftCatalogueResponse> {
  try {
    const res = await fetch('/api/ai/craft-catalogue');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.catalogue) {
        return data as CraftCatalogueResponse;
      }
    }
  } catch (err) {
    console.warn('[CraftService] Failed to fetch catalogue from server, using local fallback:', err);
  }

  return {
    success: true,
    allowlist: CRAFTABLE_ITEM_ALLOWLIST,
    catalogue: CRAFTABLE_ITEMS_CATALOGUE,
  };
}

/**
 * Sends a hand-drawn sketch to the backend AI recognition pipeline.
 * Fully validates the response schema and provides honest fallback when network fails.
 */
export async function requestSketchRecognition(
  request: RecognizeCraftRequest
): Promise<RecognizeCraftResponse> {
  try {
    const res = await fetch('/api/ai/recognize-craft-sketch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${res.status}`);
    }

    const payload = await res.json();
    if (!payload.success || !payload.result) {
      throw new Error(payload.error || 'Server did not return a valid recognition result');
    }

    // Validate using Zod schema
    const validated = RecognizeCraftResponseSchema.parse(payload.result);
    return validated;
  } catch (error: unknown) {
    console.warn('[CraftService] Network or server error during sketch recognition:', error);

    // If client requested no fallback, return honest provider unavailable
    if (!request.allowFallback) {
      return RecognizeCraftResponseSchema.parse({
        status: 'provider-unavailable',
        predictedLabel: 'Server Unreachable',
        mappedItemId: null,
        confidence: null,
        confidenceTier: 'unknown',
        provenance: 'gemini-vision',
        isFallback: false,
        explanation: 'Could not connect to the recognition backend API.',
        alternativeLabels: [],
        limitationsAndWarnings: [
          error instanceof Error ? error.message : 'Network failure',
          'Manual item selection is available.',
        ],
        candidateItems: [...CRAFTABLE_ITEM_ALLOWLIST],
      });
    }

    // Client-side deterministic heuristic fallback
    const strokeCount = request.strokeCount ?? Math.max(1, Math.floor(request.imageBase64.length / 5000));
    const categories: CraftableItemId[] = ['wood', 'stone', 'dirt', 'grass'];
    const chosen = categories[(strokeCount * 3 + request.imageBase64.length) % categories.length];

    return RecognizeCraftResponseSchema.parse({
      status: 'needs-review',
      predictedLabel: CRAFTABLE_ITEMS_CATALOGUE[chosen].displayName,
      mappedItemId: chosen,
      confidence: null,
      confidenceTier: 'unknown',
      provenance: 'mock-heuristic',
      isFallback: true,
      explanation: `Offline local heuristic selected ${CRAFTABLE_ITEMS_CATALOGUE[chosen].displayName} due to connection error.`,
      alternativeLabels: categories
        .filter((c) => c !== chosen)
        .map((c) => ({ label: CRAFTABLE_ITEMS_CATALOGUE[c].displayName, mappedItemId: c })),
      limitationsAndWarnings: [
        'Backend server was unreachable. Used local heuristic fallback.',
        'Please review or manually select an item before crafting.',
      ],
      candidateItems: [...CRAFTABLE_ITEM_ALLOWLIST],
    });
  }
}
