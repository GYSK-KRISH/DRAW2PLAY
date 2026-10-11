import {
  type AssetRole,
  type GeneratedAsset,
  type GameAssetBundle,
  type GameDesignPlan,
} from '../../src/types/plan.js';
import { aiProviderRegistry } from '../providers/registry.js';
import { validateAssetDataUrl, sanitizeAssetId } from './assetValidation.service.js';
import { generateProceduralSprite } from './proceduralSpriteGenerator.js';

export interface AssetGenerationOptions {
  artStyle?: string;
  forceFallback?: boolean;
  correlationId?: string;
  promptOverride?: string;
}

/**
 * Generates an original descriptive prompt for a specific asset role,
 * strictly conditioned on validated plan themes, observations, and art direction.
 */
export function generatePromptForAsset(
  role: AssetRole,
  plan: GameDesignPlan,
  options: { artStyle?: string; promptOverride?: string } = {}
): string {
  if (options.promptOverride && options.promptOverride.trim().length > 0) {
    // Sanitize prompt override (remove special script/code injections)
    return options.promptOverride.replace(/<[^>]*>/g, '').slice(0, 300);
  }

  const artStyle = options.artStyle || '2D pixel art retro arcade';
  const theme = plan.theme?.name || 'default';
  const paletteStr = (plan.theme?.palette || ['#06b6d4', '#8b5cf6', '#facc15']).slice(0, 4).join(', ');

  switch (role) {
    case 'player':
      return `Isolated 2D game character sprite for a ${theme} platformer, ${artStyle}, vibrant hero silhouette, colors ${paletteStr}, side view, clean transparent background, no background elements, single game character asset`;

    case 'enemy':
      return `Isolated 2D enemy patrol monster or drone sprite for a ${theme} game, ${artStyle}, hostile red glowing eyes, menacing silhouette, transparent background, no background elements, single arcade creature asset`;

    case 'collectible':
      return `Isolated 2D floating collectible crystal gem or gold coin for a ${theme} level, ${artStyle}, shiny specular glint highlights, colors ${paletteStr}, transparent background, single item sprite`;

    case 'hazard':
      return `Isolated 2D lethal hazard obstacle with sharp spikes or molten trap for a ${theme} level, ${artStyle}, warning danger appearance, transparent background, single hazard sprite`;

    case 'goal':
      return `Isolated 2D victory exit portal or glowing gateway flag for a ${theme} level, ${artStyle}, swirling energy aura, colors ${paletteStr}, transparent background, single gateway sprite`;

    case 'platform':
      return `2D modular platform terrain block texture for a ${theme} level, ${artStyle}, solid stone/metal surface with decorative edge trim, tileable game ledge block, colors ${paletteStr}`;

    case 'background':
      return `2D side-scrolling platformer background landscape panorama for a ${theme} game, ${artStyle}, deep atmospheric horizon, starry neon sky, ambient horizon scenery, palette ${paletteStr}, 800x480 resolution`;
  }
}

/**
 * Returns role-specific default dimensions
 */
export function getAssetDimensionsForRole(role: AssetRole): { width: number; height: number; requiresTransparency: boolean } {
  switch (role) {
    case 'player':
      return { width: 36, height: 36, requiresTransparency: true };
    case 'enemy':
      return { width: 32, height: 32, requiresTransparency: true };
    case 'collectible':
      return { width: 24, height: 24, requiresTransparency: true };
    case 'hazard':
      return { width: 24, height: 24, requiresTransparency: true };
    case 'goal':
      return { width: 36, height: 48, requiresTransparency: true };
    case 'platform':
      return { width: 64, height: 32, requiresTransparency: true };
    case 'background':
      return { width: 400, height: 240, requiresTransparency: false };
  }
}

/**
 * Generates or regenerates a single visual asset for a game plan.
 * Allows retrying individual failed assets without regenerating the entire level.
 */
export async function generateSingleAsset(
  first: GameDesignPlan | AssetRole,
  second: AssetRole | GameDesignPlan,
  options: AssetGenerationOptions = {}
): Promise<GeneratedAsset> {
  const plan = (typeof first === 'object' ? first : second) as GameDesignPlan;
  const role = (typeof first === 'string' ? first : second) as AssetRole;
  const dims = getAssetDimensionsForRole(role);
  const prompt = generatePromptForAsset(role, plan, options);
  const assetId = sanitizeAssetId(`asset-${role}-${plan.id || 'plan'}-${Date.now() % 10000}`);
  const artStyle = options.artStyle || 'pixel-art';

  const assetBase: GeneratedAsset = {
    id: assetId,
    role,
    name: `${role.charAt(0).toUpperCase() + role.slice(1)} Asset`,
    visualDescription: prompt,
    artStyle,
    targetDimensions: { width: dims.width, height: dims.height },
    aspectRatio: role === 'background' ? '16:9' : role === 'goal' ? '3:4' : '1:1',
    requiresTransparency: dims.requiresTransparency,
    sourceReferenceId: plan.referenceId,
    status: 'generating',
    provenance: 'procedural-fallback',
    isFallback: false,
    promptUsed: prompt,
    generatedAt: new Date().toISOString(),
  };

  // Attempt live AI Image Generation if not forced to fallback
  if (!options.forceFallback) {
    try {
      const provider = aiProviderRegistry.getProvider('gemini');
      if (provider && provider.isConfigured() && provider.capabilities.has('image-generation')) {
        const response = await provider.execute<string>({
          capability: 'image-generation',
          prompt,
          width: dims.width,
          height: dims.height,
          aspectRatio: assetBase.aspectRatio,
          correlationId: options.correlationId,
        });

        if (response?.data && typeof response.data === 'string') {
          const validation = validateAssetDataUrl(response.data, {
            isBackdrop: role === 'background',
          });

          if (validation.isValid) {
            return {
              ...assetBase,
              status: 'ready',
              provenance: 'gemini-imagen',
              isFallback: false,
              dataUrl: response.data,
              mimeType: `image/${validation.format}`,
              fileSizeBytes: validation.sizeBytes,
            };
          }
        }
      }
    } catch {
      // Graceful fallback to procedural generator on provider failure / rate limit / missing config
    }
  }

  // Deterministic Procedural Fallback
  const proceduralResult = generateProceduralSprite(role, {
    width: dims.width,
    height: dims.height,
    theme: plan.theme?.name || 'default',
    palette: plan.theme?.palette,
  });

  const validation = validateAssetDataUrl(proceduralResult.dataUrl, {
    isBackdrop: role === 'background',
  });

  return {
    ...assetBase,
    status: 'ready',
    provenance: 'procedural-fallback',
    isFallback: true,
    dataUrl: proceduralResult.dataUrl,
    mimeType: proceduralResult.mimeType,
    fileSizeBytes: validation.sizeBytes,
  };
}

/**
 * Generates all 7 standard visual assets for a game plan bundle.
 */
export async function generateAssetBundle(
  plan: GameDesignPlan,
  options: AssetGenerationOptions = {}
): Promise<GameAssetBundle> {
  const roles: AssetRole[] = [
    'player',
    'enemy',
    'collectible',
    'hazard',
    'goal',
    'platform',
    'background',
  ];

  const generatedAssets: GeneratedAsset[] = [];

  for (const role of roles) {
    try {
      const asset = await generateSingleAsset(plan, role, options);
      generatedAssets.push(asset);
    } catch (err: unknown) {
      // If procedural generation somehow errors, create a stub with failed status
      const dims = getAssetDimensionsForRole(role);
      generatedAssets.push({
        id: sanitizeAssetId(`asset-${role}-fail`),
        role,
        name: `${role} (Failed)`,
        visualDescription: `Failed to generate ${role}`,
        artStyle: options.artStyle || 'pixel-art',
        targetDimensions: { width: dims.width, height: dims.height },
        aspectRatio: '1:1',
        requiresTransparency: true,
        status: 'failed',
        provenance: 'procedural-fallback',
        isFallback: true,
        error: (err as Error).message || 'Generation failed',
        generatedAt: new Date().toISOString(),
      });
    }
  }

  const hasAnyFailed = generatedAssets.some((a) => a.status === 'failed');
  const hasAnyFallback = generatedAssets.some((a) => a.isFallback);

  return {
    bundleId: `bundle-${plan.id || 'plan'}-${Date.now() % 100000}`,
    planId: plan.id,
    provenance: hasAnyFallback ? 'procedural-fallback' : 'gemini-imagen',
    artStyle: options.artStyle || 'pixel-art',
    palette: plan.theme?.palette || [],
    assets: generatedAssets,
    createdAt: new Date().toISOString(),
    overallStatus: hasAnyFailed ? 'partial' : 'ready',
  };
}
