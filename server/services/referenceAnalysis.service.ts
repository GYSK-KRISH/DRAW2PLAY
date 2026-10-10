import crypto from 'node:crypto';
import { serverConfig } from '../config.js';
import { getGenAIClient } from './gemini.service.js';
import {
  ReferenceAnalysis,
  ReferenceAnalysisSchema,
  GameGenerationPlan,
  GameGenerationPlanSchema,
  TargetEngine,
} from '../../src/types/reference.js';

/**
 * Analyzes a reference image using live Gemini Vision when available.
 */
export async function analyzeReferenceWithGemini(
  imageBase64: string,
  userPrompt?: string
): Promise<ReferenceAnalysis> {
  const client = getGenAIClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const prompt = `You are a principal game engine architect and computer vision analyst for Draw2Play AI.
Analyze this visual reference image (screenshot, video frame, or concept art) to deduce game genre, camera perspective, visual style, and likely mechanics.
${userPrompt ? `User's Goal / Context: "${userPrompt}"` : ''}

CRITICAL RULES:
1. Ground all mechanics in visible observations. Do not claim the screenshot reveals full source code, hidden backend physics, or unseen worlds.
2. If the image depicts voxels, cubes, blocks, or 3D geometry (like Minecraft, Roblox, or 3D meshes), classify category as "voxel" or "3d-world", camera as "first-person-3d" or "third-person-3d", and recommendedPipeline as "future-3d-engine".
3. If it depicts a 2D side-view platformer (like Mario, Celeste, or Doodle Jump), classify as "2d-platformer", camera as "side-scrolling-2d", and recommendedPipeline as "phaser-2d".
4. If it depicts a top-down 2D game, classify as "top-down-2d", camera as "top-down-2d", and recommendedPipeline as "phaser-2d".

Respond with STRICT JSON conforming to this schema without markdown fences:
{
  "schemaVersion": "1.0",
  "category": "2d-platformer" | "top-down-2d" | "isometric" | "3d-world" | "voxel" | "racing" | "puzzle" | "other" | "uncertain",
  "cameraPerspective": "side-scrolling-2d" | "top-down-2d" | "isometric" | "first-person-3d" | "third-person-3d" | "fixed-angle-3d" | "unknown",
  "visualStyle": "Short description of art style, e.g. Pixel Art, Voxel Blocks, Minimalist Vector, 3D Realistic",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "visibleObjects": ["list", "of", "clearly", "visible", "elements"],
  "terrainLayout": "Summary of visible ground, blocks, platforms, or height variations",
  "suggestedRoles": {
    "player": "Visible player avatar or camera focal point if any",
    "obstacles": ["spikes", "cliffs", "enemies", "lava"],
    "collectibles": ["coins", "gems", "resources", "stars"],
    "goals": ["portal", "flagpole", "exit gate"]
  },
  "inferredMechanics": [
    {
      "name": "Mechanic name (e.g. Block Placement, Platform Jumping)",
      "description": "How this mechanic likely behaves",
      "confidence": number between 0.1 and 0.95,
      "supportingObservations": ["Visual cues observed in reference"]
    }
  ],
  "uncertaintiesAndWarnings": [
    "Acknowledge that single reference frames cannot confirm exact friction, jump velocity, or hidden game state."
  ],
  "recommendedPipeline": "phaser-2d" | "future-3d-engine" | "unsupported"
}`;

  const response = await client.models.generateContent({
    model: serverConfig.geminiModel,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data,
            },
          },
        ],
      },
    ],
  });

  const responseText = response.text || '';
  const cleaned = responseText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const analysisPayload = {
    ...parsed,
    schemaVersion: '1.0',
    provenance: 'gemini-vision',
    modelProvenance: serverConfig.geminiModel,
    analyzedAt: new Date().toISOString(),
  };

  return ReferenceAnalysisSchema.parse(analysisPayload);
}

/**
 * Deterministic local heuristic reference analysis when Gemini is unavailable.
 * Inspects prompt keywords and metadata without fabricating live AI provenance.
 */
export function generateHeuristicReferenceAnalysis(
  userPrompt: string = '',
  _imageWidth = 800,
  _imageHeight = 600
): ReferenceAnalysis {
  const promptLower = userPrompt.toLowerCase();
  const isVoxelOr3D =
    promptLower.includes('voxel') ||
    promptLower.includes('minecraft') ||
    promptLower.includes('3d') ||
    promptLower.includes('block') ||
    promptLower.includes('cube') ||
    promptLower.includes('first person');

  const isTopDown =
    promptLower.includes('top-down') ||
    promptLower.includes('topdown') ||
    promptLower.includes('rpg') ||
    promptLower.includes('dungeon');

  const isIsometric = promptLower.includes('isometric') || promptLower.includes('iso');

  let category: ReferenceAnalysis['category'] = '2d-platformer';
  let perspective: ReferenceAnalysis['cameraPerspective'] = 'side-scrolling-2d';
  let pipeline: TargetEngine = 'phaser-2d';
  let visualStyle = '2D Vector Doodle / Flat Shading';
  let palette = ['#38bdf8', '#22c55e', '#ef4444', '#facc15', '#a855f7'];

  if (isVoxelOr3D) {
    category = 'voxel';
    perspective = 'first-person-3d';
    pipeline = 'future-3d-engine';
    visualStyle = 'Voxel Block Grid / Modular 3D Cubes';
    palette = ['#4ade80', '#854d0e', '#60a5fa', '#94a3b8', '#166534'];
  } else if (isIsometric) {
    category = 'isometric';
    perspective = 'isometric';
    pipeline = 'future-3d-engine';
    visualStyle = 'Isometric Angled Diorama';
  } else if (isTopDown) {
    category = 'top-down-2d';
    perspective = 'top-down-2d';
    pipeline = 'phaser-2d';
    visualStyle = 'Top-Down 2D Exploration Grid';
  }

  const objects = isVoxelOr3D
    ? ['Terrain voxels', 'Skybox horizon', 'Block ledge', 'Target reticle', 'Hand tool']
    : ['Horizontal platform lines', 'Player starting point', 'Elevated ledge', 'Hazardous pit'];

  const mechanics = isVoxelOr3D
    ? [
        {
          name: 'Voxel Block Mining & Placement',
          description: 'Grid-aligned block destruction and continuous block placement in 3D coordinate space.',
          confidence: 0.88,
          supportingObservations: ['Blocky polygonal aesthetic', 'Cube grid alignment indicated in prompt and reference'],
        },
        {
          name: 'Free 3D Camera Rotation',
          description: 'First-person mouse-look rotation around pitch and yaw axes.',
          confidence: 0.82,
          supportingObservations: ['Horizon angle and first-person orientation'],
        },
      ]
    : [
        {
          name: 'Horizontal Platforming',
          description: 'Run, jump, and land across 2D collision platforms.',
          confidence: 0.92,
          supportingObservations: ['Horizontal ledge alignments and gravity baseline'],
        },
        {
          name: 'Hazard Evasion',
          description: 'Avoid falling into lower boundaries or touching hazardous zones.',
          confidence: 0.85,
          supportingObservations: ['Distinct ground boundary and bottom voids'],
        },
      ];

  const analysis: ReferenceAnalysis = {
    schemaVersion: '1.0',
    category,
    cameraPerspective: perspective,
    visualStyle,
    colorPalette: palette,
    visibleObjects: objects,
    terrainLayout: isVoxelOr3D
      ? 'Undulating voxel terrain with tiered cubic elevation steps.'
      : 'Segmented horizontal platforms with jump gaps.',
    suggestedRoles: {
      player: isVoxelOr3D ? 'First-person avatar' : '2D Jumper',
      obstacles: isVoxelOr3D ? ['Deep ravines', 'Lava pockets'] : ['Spikes', 'Pitfalls'],
      collectibles: isVoxelOr3D ? ['Rare mineral blocks', 'Cubic gems'] : ['Gold coins', 'Power rings'],
      goals: isVoxelOr3D ? ['Beacon tower', 'Spawn portal'] : ['Goal flag', 'Exit portal'],
    },
    inferredMechanics: mechanics,
    uncertaintiesAndWarnings: [
      'Analysis produced via deterministic visual heuristics (Gemini Vision offline or unconfigured).',
      'A single 2D image does not define complete world seed, interior cave layout, or full physics parameters.',
      ...(isVoxelOr3D
        ? ['Notice: Full voxel gameplay requires a dedicated 3D engine currently scheduled for a future phase.']
        : []),
    ],
    recommendedPipeline: pipeline,
    provenance: 'mock-heuristic',
    analyzedAt: new Date().toISOString(),
  };

  return ReferenceAnalysisSchema.parse(analysis);
}

/**
 * Builds a validated GameGenerationPlan from user prompt and analysis.
 */
export function buildGameGenerationPlan(
  referenceId: string,
  userPrompt: string,
  analysis: ReferenceAnalysis,
  targetEngineOverride?: TargetEngine
): GameGenerationPlan {
  const targetEngine: TargetEngine = targetEngineOverride || analysis.recommendedPipeline;

  const is3DOrVoxel =
    targetEngine === 'future-3d-engine' ||
    analysis.category === 'voxel' ||
    analysis.category === '3d-world';

  let status: GameGenerationPlan['status'] = 'ready-for-2d-generation';
  const missingRequirements: string[] = [];
  const limitationsAndWarnings: string[] = [];

  if (is3DOrVoxel) {
    status = 'deferred-future-engine';
    missingRequirements.push(
      'Dedicated 3D rendering pipeline (WebGL mesh/voxel raymarching engine)',
      '3D voxel coordinate chunk manager and depth buffer',
      'Volumetric collision detection system'
    );
    limitationsAndWarnings.push(
      'A single 2D reference screenshot cannot reconstruct 3D voxel world geometry, hidden biome generation, or interior chunk data.',
      'Draw2Play AI Phase 6.1 structures this plan and preserves it for the upcoming 3D Engine phase.'
    );
  } else {
    limitationsAndWarnings.push(
      '2D level parameters are estimated from visible reference composition and can be fine-tuned in the studio editor.'
    );
  }

  // Derive theme from palette & style
  let theme: 'default' | 'forest' | 'ice' | 'lava' | 'space' | 'cyberpunk' = 'default';
  const lowerStyle = (analysis.visualStyle + ' ' + userPrompt).toLowerCase();
  if (lowerStyle.includes('forest') || lowerStyle.includes('green') || lowerStyle.includes('nature')) {
    theme = 'forest';
  } else if (lowerStyle.includes('ice') || lowerStyle.includes('snow') || lowerStyle.includes('frozen')) {
    theme = 'ice';
  } else if (lowerStyle.includes('lava') || lowerStyle.includes('fire') || lowerStyle.includes('volcano')) {
    theme = 'lava';
  } else if (lowerStyle.includes('space') || lowerStyle.includes('cosmic') || lowerStyle.includes('star')) {
    theme = 'space';
  } else if (lowerStyle.includes('cyber') || lowerStyle.includes('neon')) {
    theme = 'cyberpunk';
  }

  const planId = `plan-${crypto.randomUUID().slice(0, 10)}`;

  const plan: GameGenerationPlan = {
    id: planId,
    referenceId,
    userPrompt: userPrompt || 'Generate game level inspired by reference',
    targetEngine,
    category: analysis.category,
    requestedFeatures: analysis.inferredMechanics.map((m) => m.name),
    missingRequirements,
    limitationsAndWarnings,
    status,
    createdAt: new Date().toISOString(),
    suggested2DConfig:
      targetEngine === 'phaser-2d'
        ? {
            theme,
            playerSpeed: 240,
            playerJump: 440,
            gravity: 750,
            platformCount: 5,
            hazardTypes: ['spike'],
            collectibleTypes: ['coin'],
          }
        : undefined,
  };

  return GameGenerationPlanSchema.parse(plan);
}
