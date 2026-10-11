import type { GameDesignPlan, GameAssetBundle, GeneratedAsset, AssetRole } from '../types/plan.js';
import { getApiUrl } from './api.js';

export interface AssetServiceStatus {
  success: boolean;
  imageGenerationConfigured: boolean;
  provider: string;
  maxDimension: number;
}

// In-memory cache for generated asset bundles keyed by plan ID
const bundleCache = new Map<string, GameAssetBundle>();

/**
 * Check backend status and capabilities for asset generation
 */
export async function fetchAssetServiceStatus(): Promise<AssetServiceStatus> {
  try {
    const res = await fetch(getApiUrl('/api/assets/status'));
    if (!res.ok) {
      throw new Error(`Status check failed: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('[AssetGenerationService] Status check failed, using fallback status:', err);
    return {
      success: true,
      imageGenerationConfigured: false,
      provider: 'procedural-rasterizer',
      maxDimension: 512,
    };
  }
}

/**
 * Generate a complete asset bundle (all 7 roles) for a validated game plan.
 * Returns cached bundle if already generated for this plan, unless forceRefresh is true.
 */
export async function generateAssetBundle(
  plan: GameDesignPlan,
  referenceImage?: string,
  forceRefresh = false
): Promise<GameAssetBundle> {
  const cacheKey = plan.id;
  if (!forceRefresh && bundleCache.has(cacheKey)) {
    return bundleCache.get(cacheKey)!;
  }

  const res = await fetch(getApiUrl('/api/assets/generate-bundle'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan,
      referenceImage,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to generate asset bundle: ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.success || !data.bundle) {
    throw new Error(data.error || 'Server did not return a valid asset bundle');
  }

  const bundle = data.bundle as GameAssetBundle;
  bundleCache.set(cacheKey, bundle);
  return bundle;
}

/**
 * Re-generate or retry a single asset (e.g. player, enemy) for a given plan
 * and merge it into the existing bundle in-memory.
 */
export async function generateSingleAsset(
  role: AssetRole,
  plan: GameDesignPlan,
  referenceImage?: string
): Promise<GeneratedAsset> {
  const res = await fetch(getApiUrl('/api/assets/generate-single'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role,
      plan,
      referenceImage,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to generate single asset for ${role}: ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.success || !data.asset) {
    throw new Error(data.error || `Server did not return a valid asset for ${role}`);
  }

  const newAsset = data.asset as GeneratedAsset;

  // Update bundle cache if present
  const existingBundle = bundleCache.get(plan.id);
  if (existingBundle) {
    const idx = existingBundle.assets.findIndex((a) => a.role === role);
    if (idx >= 0) {
      existingBundle.assets[idx] = newAsset;
    } else {
      existingBundle.assets.push(newAsset);
    }
    existingBundle.generatedAt = new Date().toISOString();
  }

  return newAsset;
}

/**
 * Retrieve cached bundle for a plan if available
 */
export function getCachedAssetBundle(planId: string): GameAssetBundle | undefined {
  return bundleCache.get(planId);
}

/**
 * Clear cached bundle for a plan
 */
export function clearCachedAssetBundle(planId: string): void {
  bundleCache.delete(planId);
}
