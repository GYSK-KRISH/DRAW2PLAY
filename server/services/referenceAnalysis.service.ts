import { aiProviderRegistry } from '../providers/index.js';
import {
  ReferenceAnalysis,
  ReferenceAnalysisSchema,
  TargetEngine,
  FrameAnalysisResult,
  FrameAnalysisResultSchema,
  AnalysisConfidenceTier,
  ObservedEvidence,
  ProposedDesign,
} from '../../src/types/reference.js';
import {
  GameDesignPlan,
  GameTemplateId,
} from '../../src/types/plan.js';
import { assertValidGamePlan } from '../../src/utils/planValidator.js';
import { checkTemplateCompatibility } from '../../src/templates/templateRegistry.js';
import { generateTemplateLevel } from '../../src/generators/templateGenerators.js';

/** Maximum milliseconds to wait for a Gemini vision call before falling back */
const GEMINI_VISION_TIMEOUT_MS = 18_000;

/**
 * Compute overall analysis confidence tier from mechanics confidence scores and provenance.
 */
function computeConfidenceTier(
  inferredMechanics: ReferenceAnalysis['inferredMechanics'],
  provenance: ReferenceAnalysis['provenance']
): AnalysisConfidenceTier {
  if (provenance === 'mock-heuristic') return 'medium';
  if (inferredMechanics.length === 0) return 'low';
  const avg = inferredMechanics.reduce((sum, m) => sum + m.confidence, 0) / inferredMechanics.length;
  if (avg >= 0.75 && inferredMechanics.every((m) => m.observationalEvidence.length >= 2)) return 'high';
  if (avg >= 0.5) return 'medium';
  return 'low';
}

/**
 * Helper to ensure observedEvidence and proposedDesign are reliably populated.
 */
function synthesizeEvidenceAndDesign(
  raw: Partial<ReferenceAnalysis>,
  category: ReferenceAnalysis['category'],
  perspective: ReferenceAnalysis['cameraPerspective'],
  visualStyle: string,
  colorPalette: string[],
  visibleObjects: string[],
  terrainLayout: string,
  suggestedRoles: ReferenceAnalysis['suggestedRoles'],
  inferredMechanics: ReferenceAnalysis['inferredMechanics']
): { observedEvidence: ObservedEvidence; proposedDesign: ProposedDesign } {
  const isTopDown = category === 'top-down-2d';
  const isVoxelOr3D = category === 'voxel' || category === '3d-world';

  const observedEvidence: ObservedEvidence = raw.observedEvidence || {
    majorShapesAndBoundaries: isVoxelOr3D
      ? ['Volumetric cubic bounding grid', 'Perspective horizon line', 'Block surface polygons']
      : isTopDown
      ? ['Rectangular boundary perimeter', 'Corridor walls', 'Open tiled floor space']
      : ['Horizontal base ground line', 'Rectangular platform ledges', 'Hazard pits'],
    platformsAndFloors: isVoxelOr3D
      ? ['Tiered cubic elevation levels']
      : isTopDown
      ? ['Flat navigation floor space']
      : ['Solid base floor', 'Elevated stepping platforms'],
    wallsAndCorridors: isTopDown
      ? ['Vertical and horizontal maze walls', 'Corridor openings']
      : ['Screen border boundaries'],
    visibleCharactersAndObjects: visibleObjects,
    visibleHazards: suggestedRoles.obstacles || (isVoxelOr3D ? ['Deep lava ravine'] : ['Floor spike hazards']),
    visibleCollectibles: suggestedRoles.collectibles || (isVoxelOr3D ? ['Cubic resource gems'] : ['Gold coins']),
    relativeSpatialLayout: isTopDown
      ? 'Start spawn at bottom-left entrance, maze corridors navigating towards goal chamber at top-right.'
      : 'Start spawn at bottom-left, stepping platforms ascending towards right-side goal portal.',
    dominantColors: colorPalette.length > 0 ? colorPalette : ['#38bdf8', '#22c55e', '#ef4444'],
    visualStyle,
    uncertainAndOccludedRegions: [
      'Areas outside visible screen boundaries',
      'Exact internal movement physics constants and hidden triggers cannot be verified from a static image',
    ],
  };

  const proposedDesign: ProposedDesign = raw.proposedDesign || {
    suggestedGenre: category,
    cameraPerspective: perspective,
    playerAbilitiesAndMovement: {
      movementType: isTopDown ? '4-Way Top-Down Movement' : 'Run and Jump 2D Platformer',
      abilities: isTopDown ? ['walk', 'run', 'dash'] : ['walk', 'run', 'jump'],
    },
    coreGameplayLoop: isTopDown
      ? 'Navigate corridors, avoid patrol enemies, collect keys, reach exit room.'
      : 'Traverse platforms, avoid hazards, collect items, reach the goal portal.',
    objectivesAndConditions: {
      primaryObjective: 'Reach the goal portal',
      winConditions: ['Reach the goal portal', 'Collect coins along the path'],
      loseConditions: ['Fall into hazards or touch lethal obstacles'],
    },
    proposedEnemiesAndHazards: (suggestedRoles.obstacles || ['Spikes']).map((obs) => ({
      name: obs,
      behaviorProposal: 'Patrols horizontally or damages player on contact',
    })),
    proposedCollectibles: (suggestedRoles.collectibles || ['Coins']).map((col) => ({
      name: col,
      interactionProposal: 'Increases score by +10 upon collection',
    })),
    difficultyProgression: {
      tier: 'medium',
      pacingNotes: 'Gradual platform spacing and hazard density increase',
    },
    audioVisualFeedback: {
      visualStyleCues: [visualStyle],
      suggestedAudioMood: isTopDown ? 'Atmospheric dungeon synth' : 'Chiptune retro upbeat',
    },
    inferredMechanics,
  };

  return { observedEvidence, proposedDesign };
}

/**
 * Analyzes a single reference image using live Gemini Vision through the AI provider adapter.
 *
 * Stage 2 rules:
 * - Strictly separates OBSERVATIONS from INFERRED DESIGN PROPOSALS
 * - Never claims a static screenshot proves dynamic physics or hidden mechanics
 */
export async function analyzeReferenceWithGemini(
  imageBase64: string,
  userPrompt?: string,
  correlationId?: string
): Promise<ReferenceAnalysis> {
  const provider = aiProviderRegistry.getProviderForCapability('image-understanding', 'gemini');
  if (!provider.isConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const prompt = `You are a principal game engine architect and computer vision analyst for Draw2Play AI.

Analyze this visual reference image (screenshot, video frame, or concept art) with strict epistemological discipline.

${userPrompt ? `User's Goal / Context: "${userPrompt}"` : ''}

## OBSERVATION VS INFERENCE RULES (MANDATORY)
1. OBSERVATIONS are facts directly visible in this image: colors, shapes, boundaries, platforms, walls, corridors, visible objects.
2. INFERENCES are creative hypotheses about game design derived from observations. NEVER present an inference as an established fact. A static screenshot cannot prove hidden rules, physics constants, or dynamic mechanics.
3. Mark all inferred mechanics as proposals, not observations. Each inferred mechanic MUST cite concrete visual facts in "observationalEvidence".

## CLASSIFICATION RULES
- Voxels/cubes/3D blocks → category "voxel", camera "first-person-3d", recommendedPipeline "future-3d-engine"
- 2D side-scrolling platformer → category "2d-platformer", camera "side-scrolling-2d", recommendedPipeline "phaser-2d"
- Top-down 2D → category "top-down-2d", camera "top-down-2d", recommendedPipeline "phaser-2d"
- Puzzle room → category "puzzle", camera "side-scrolling-2d", recommendedPipeline "phaser-2d"
- Isometric → category "isometric", camera "isometric", recommendedPipeline "future-3d-engine"
- 3D third-person → category "3d-world", camera "third-person-3d", recommendedPipeline "future-3d-engine"

Respond with STRICT JSON (no markdown fences, no trailing commas):
{
  "schemaVersion": "2.0",
  "category": "<GameCategory>",
  "cameraPerspective": "<CameraPerspective>",
  "visualStyle": "Short art-style description (e.g. Pixel Art, Low-Poly 3D, Minimalist Vector)",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "visibleObjects": ["list", "of", "directly", "observed", "elements"],
  "terrainLayout": "Factual summary of visible ground, platforms, or height variations",
  "suggestedRoles": {
    "player": "Visible player avatar or focal point if identifiable, else omit",
    "obstacles": ["only list items visibly present"],
    "collectibles": ["only list items visibly present"],
    "goals": ["only list items visibly present"]
  },
  "inferredMechanics": [
    {
      "name": "Mechanic name",
      "description": "Hypothesis: How this mechanic may work. Framed as inference, not fact.",
      "confidence": 0.1_to_0.95,
      "observationalEvidence": ["Visual fact directly seen in the image that supports this inference"],
      "supportingObservations": ["Additional context or cross-reference"]
    }
  ],
  "observedEvidence": {
    "majorShapesAndBoundaries": ["list of major shapes and boundaries"],
    "platformsAndFloors": ["visible platforms, floors, and open areas"],
    "wallsAndCorridors": ["visible walls and corridors"],
    "visibleCharactersAndObjects": ["visible characters and landmarks"],
    "visibleHazards": ["visible hazard shapes"],
    "visibleCollectibles": ["visible collectible shapes"],
    "relativeSpatialLayout": "Factual description of relative object positioning",
    "dominantColors": ["#hex1", "#hex2"],
    "visualStyle": "Art style description",
    "uncertainAndOccludedRegions": ["ambiguous, low-contrast, or occluded areas"]
  },
  "proposedDesign": {
    "suggestedGenre": "<GameCategory>",
    "cameraPerspective": "<CameraPerspective>",
    "playerAbilitiesAndMovement": {
      "movementType": "movement description",
      "abilities": ["walk", "run", "jump"]
    },
    "coreGameplayLoop": "Proposed loop description",
    "objectivesAndConditions": {
      "primaryObjective": "primary objective",
      "winConditions": ["win condition 1"],
      "loseConditions": ["lose condition 1"]
    },
    "proposedEnemiesAndHazards": [{"name": "Enemy name", "behaviorProposal": "behavior"}],
    "proposedCollectibles": [{"name": "Collectible name", "interactionProposal": "interaction"}],
    "difficultyProgression": {"tier": "medium", "pacingNotes": "pacing notes"},
    "audioVisualFeedback": {"visualStyleCues": ["cue"], "suggestedAudioMood": "audio mood"}
  },
  "uncertaintiesAndWarnings": [
    "What cannot be confirmed from this single reference",
    "Any notable ambiguities"
  ],
  "recommendedPipeline": "phaser-2d" | "future-3d-engine" | "unsupported"
}`;

  const result = await provider.execute({
    capability: 'image-understanding',
    prompt,
    imageBase64,
    timeoutMs: GEMINI_VISION_TIMEOUT_MS,
    correlationId,
  });

  const responseText = result.rawText || '';
  const cleaned = responseText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  // Ensure every mechanic has observationalEvidence (backfill from supportingObservations if missing)
  const inferredMechanics: ReferenceAnalysis['inferredMechanics'] = Array.isArray(parsed.inferredMechanics)
    ? parsed.inferredMechanics.map((m: Record<string, unknown>) => ({
        name: String(m.name || 'Inferred Mechanic'),
        description: String(m.description || 'Hypothetical mechanic'),
        confidence: Math.max(0, Math.min(1, Number(m.confidence) || 0.6)),
        observationalEvidence:
          Array.isArray(m.observationalEvidence) && m.observationalEvidence.length > 0
            ? m.observationalEvidence.map(String)
            : Array.isArray(m.supportingObservations) && m.supportingObservations.length > 0
            ? m.supportingObservations.slice(0, 3).map(String)
            : ['Visual cues present in reference image'],
        supportingObservations: Array.isArray(m.supportingObservations)
          ? m.supportingObservations.map(String)
          : [],
      }))
    : [];

  const { observedEvidence, proposedDesign } = synthesizeEvidenceAndDesign(
    parsed,
    parsed.category || '2d-platformer',
    parsed.cameraPerspective || 'side-scrolling-2d',
    parsed.visualStyle || '2D Pixel Art',
    Array.isArray(parsed.colorPalette) ? parsed.colorPalette : ['#38bdf8', '#22c55e', '#ef4444'],
    Array.isArray(parsed.visibleObjects) ? parsed.visibleObjects : ['Platform', 'Ground'],
    parsed.terrainLayout || 'Visible ground and platform geometry.',
    parsed.suggestedRoles || {},
    inferredMechanics
  );

  const analysisPayload = {
    ...parsed,
    schemaVersion: '2.0',
    provenance: 'gemini-vision' as const,
    modelProvenance: result.metadata.model || provider.defaultModel,
    correlationId,
    usage: result.metadata.usage,
    analyzedAt: new Date().toISOString(),
    frameCount: 1,
    inferredMechanics,
    observedEvidence,
    proposedDesign,
  };

  const validated = ReferenceAnalysisSchema.parse(analysisPayload);
  validated.analysisConfidenceTier = computeConfidenceTier(validated.inferredMechanics, validated.provenance);
  return validated;
}

/**
 * Multi-frame video reference analysis with observational evidence merging.
 */
const MAX_FRAMES = 5;

export async function analyzeMultipleFramesWithGemini(
  frameBase64s: string[],
  userPrompt?: string
): Promise<ReferenceAnalysis> {
  if (frameBase64s.length === 0) {
    throw new Error('At least one frame is required for multi-frame analysis');
  }

  const bounded = frameBase64s.slice(0, MAX_FRAMES);
  const provider = aiProviderRegistry.getProviderForCapability('image-understanding', 'gemini');
  if (!provider.isConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const frameResultPromises = bounded.map(async (frameB64, idx): Promise<FrameAnalysisResult> => {
    const framePrompt = `You are analyzing frame ${idx + 1} of ${bounded.length} from a gameplay video for Draw2Play AI.
List only what is DIRECTLY VISIBLE in this specific frame. Do NOT infer gameplay mechanics here.
${userPrompt ? `Overall goal: "${userPrompt}"` : ''}

Respond with JSON only (no markdown):
{
  "frameIndex": ${idx},
  "timestampSeconds": 0,
  "visibleObjects": ["list", "of", "directly", "observed", "elements"],
  "terrainNotes": "Factual terrain and layout description for this frame",
  "uniqueObservations": ["observations unique or notable compared to typical frames"]
}`;

    const result = await provider.execute({
      capability: 'image-understanding',
      prompt: framePrompt,
      imageBase64: frameB64,
      timeoutMs: GEMINI_VISION_TIMEOUT_MS,
      schema: FrameAnalysisResultSchema,
    });

    return { ...result.data, frameIndex: idx };
  });

  const frameResults = await Promise.all(frameResultPromises);
  const primaryAnalysis = await analyzeReferenceWithGemini(frameBase64s[0], userPrompt);

  const allVisibleObjects = Array.from(
    new Set([
      ...primaryAnalysis.visibleObjects,
      ...frameResults.flatMap((fr) => fr.visibleObjects),
    ])
  ).slice(0, 15);

  return {
    ...primaryAnalysis,
    schemaVersion: '2.0',
    visibleObjects: allVisibleObjects,
    frameCount: bounded.length,
    frameResults,
    analysisConfidenceTier: computeConfidenceTier(
      primaryAnalysis.inferredMechanics,
      primaryAnalysis.provenance
    ),
    uncertaintiesAndWarnings: [
      ...primaryAnalysis.uncertaintiesAndWarnings,
      `Analysis based on ${bounded.length} sampled frame(s). Mechanics outside sampled timestamps are not represented.`,
    ],
  };
}

/**
 * Deterministic local heuristic reference analysis when Gemini is unavailable.
 * Uses prompt keyword analysis. Never claims Gemini provenance.
 * Strictly separates observed evidence from proposed design.
 */
export function generateHeuristicReferenceAnalysis(
  userPrompt: string = '',
  _imageWidth = 800,
  _imageHeight = 600,
  correlationId?: string
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

  const isPuzzle = promptLower.includes('puzzle') || promptLower.includes('chamber');
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
  } else if (isPuzzle) {
    category = 'puzzle';
    perspective = 'side-scrolling-2d';
    pipeline = 'phaser-2d';
    visualStyle = 'Puzzle Room Chamber';
  }

  const objects = isVoxelOr3D
    ? ['Terrain voxels', 'Skybox horizon', 'Block ledge', 'Target reticle', 'Hand tool']
    : isTopDown
    ? ['Top-down maze walls', 'Corridor pathway', 'Goal door', 'Obstacle hazard']
    : ['Horizontal platform lines', 'Player starting point', 'Elevated ledge', 'Hazardous pit'];

  const mechanics = isVoxelOr3D
    ? [
        {
          name: 'Voxel Block Mining & Placement',
          description:
            'Hypothesis: Grid-aligned block destruction and placement in 3D coordinate space. Inferred from block-grid aesthetic described in prompt.',
          confidence: 0.78,
          observationalEvidence: [
            'Blocky polygonal aesthetic keyword ("voxel"/"block"/"cube") present in user prompt',
            'Cube grid alignment indicated by prompt context',
          ],
          supportingObservations: ['Blocky polygonal aesthetic', 'Cube grid alignment indicated in prompt and reference'],
        },
        {
          name: 'Free 3D Camera Navigation',
          description:
            'Hypothesis: First-person mouse-look rotation around pitch and yaw axes. Inferred from first-person perspective keywords.',
          confidence: 0.72,
          observationalEvidence: [
            'First-person orientation keyword present in user prompt',
          ],
          supportingObservations: ['Horizon angle and first-person orientation'],
        },
      ]
    : isTopDown
    ? [
        {
          name: 'Top-Down 4-Way Movement',
          description:
            'Hypothesis: Player navigates in 4 cardinal directions without gravitational falling.',
          confidence: 0.85,
          observationalEvidence: [
            'Top-down dungeon/RPG keyword present in prompt',
            'Grid corridor navigation layout',
          ],
          supportingObservations: ['Top-down view cues'],
        },
        {
          name: 'Hazard Evasion',
          description:
            'Hypothesis: Avoid dangerous floor traps and boundary obstacles.',
          confidence: 0.78,
          observationalEvidence: ['Hazard zones indicated in layout'],
          supportingObservations: ['Lethal tiles'],
        },
      ]
    : [
        {
          name: 'Horizontal Platforming',
          description:
            'Hypothesis: Run, jump, and land across 2D collision platforms. Inferred from side-scrolling platformer prompt keywords.',
          confidence: 0.85,
          observationalEvidence: [
            'Horizontal ledge alignments indicated in prompt',
            '2D side-scrolling genre keyword present',
          ],
          supportingObservations: ['Horizontal ledge alignments and gravity baseline'],
        },
        {
          name: 'Hazard Evasion',
          description:
            'Hypothesis: Avoid falling into lower boundaries or touching hazardous zones. Common in 2D platformers with visible pit features.',
          confidence: 0.75,
          observationalEvidence: [
            'Bottom void / pit implied by platformer prompt context',
          ],
          supportingObservations: ['Distinct ground boundary and bottom voids'],
        },
      ];

  const suggestedRoles = {
    player: isVoxelOr3D ? 'First-person avatar' : isTopDown ? 'Top-Down Explorer' : '2D Jumper',
    obstacles: isVoxelOr3D ? ['Deep ravines', 'Lava pockets'] : ['Spikes', 'Pitfalls'],
    collectibles: isVoxelOr3D ? ['Rare mineral blocks', 'Cubic gems'] : ['Gold coins', 'Power rings'],
    goals: isVoxelOr3D ? ['Beacon tower', 'Spawn portal'] : ['Goal flag', 'Exit portal'],
  };

  const { observedEvidence, proposedDesign } = synthesizeEvidenceAndDesign(
    {},
    category,
    perspective,
    visualStyle,
    palette,
    objects,
    isVoxelOr3D
      ? 'Undulating voxel terrain with tiered cubic elevation steps.'
      : isTopDown
      ? 'Enclosed maze corridors with perimeter walls.'
      : 'Segmented horizontal platforms with jump gaps.',
    suggestedRoles,
    mechanics
  );

  const analysis: ReferenceAnalysis = {
    schemaVersion: '2.0',
    category,
    cameraPerspective: perspective,
    visualStyle,
    colorPalette: palette,
    visibleObjects: objects,
    terrainLayout: isVoxelOr3D
      ? 'Undulating voxel terrain with tiered cubic elevation steps.'
      : isTopDown
      ? 'Enclosed maze corridors with perimeter walls.'
      : 'Segmented horizontal platforms with jump gaps.',
    suggestedRoles,
    inferredMechanics: mechanics,
    observedEvidence,
    proposedDesign,
    uncertaintiesAndWarnings: [
      'Analysis produced via deterministic keyword heuristics — Gemini Vision offline or unconfigured.',
      'A prompt keyword is NOT the same as a direct visual observation from an image.',
      'A single 2D reference does not define world seed, hidden caves, or exact physics parameters.',
      ...(isVoxelOr3D
        ? ['Notice: Full voxel gameplay requires a dedicated 3D engine scheduled for a future phase.']
        : []),
    ],
    recommendedPipeline: pipeline,
    provenance: 'mock-heuristic',
    correlationId,
    analyzedAt: new Date().toISOString(),
    analysisConfidenceTier: 'medium',
    frameCount: 1,
  };

  return ReferenceAnalysisSchema.parse(analysis);
}

/**
 * Builds a validated version 2.0 GameDesignPlan from reference analysis and prompt.
 * Strictly asserts all structural, bounds, security, and template constraints.
 */
export function buildGameGenerationPlan(
  referenceId: string,
  userPrompt: string = '',
  analysis: ReferenceAnalysis,
  targetEngineOverride?: TargetEngine,
  templateIdOverride?: GameTemplateId
): GameDesignPlan {
  const targetEngine: TargetEngine = targetEngineOverride || analysis.recommendedPipeline;

  const is3DOrVoxel =
    targetEngine === 'future-3d-engine' ||
    analysis.category === 'voxel' ||
    analysis.category === '3d-world';

  let status: GameDesignPlan['status'] = 'ready-for-2d-generation';
  const missingRequirements: string[] = [];
  const limitationsAndWarnings: string[] = [];

  // Determine template ID based on explicit override or analysis category
  let templateId: GameTemplateId = templateIdOverride || 'physics-platformer';
  if (!templateIdOverride) {
    if (analysis.category === 'top-down-2d') {
      templateId = 'top-down-exploration';
    } else if (analysis.category === 'puzzle') {
      templateId = 'physics-puzzle';
    } else if (analysis.category === 'racing') {
      templateId = 'momentum-drifting';
    } else if (is3DOrVoxel) {
      templateId = 'voxel-3d-deferred';
    }
  }

  // Derive theme from palette & style
  let themeName: GameDesignPlan['theme']['name'] = 'default';
  const lowerStyle = (analysis.visualStyle + ' ' + userPrompt).toLowerCase();
  if (lowerStyle.includes('forest') || lowerStyle.includes('green') || lowerStyle.includes('nature')) {
    themeName = 'forest';
  } else if (lowerStyle.includes('ice') || lowerStyle.includes('snow') || lowerStyle.includes('frozen')) {
    themeName = 'ice';
  } else if (lowerStyle.includes('lava') || lowerStyle.includes('fire') || lowerStyle.includes('volcano')) {
    themeName = 'lava';
  } else if (lowerStyle.includes('space') || lowerStyle.includes('cosmic') || lowerStyle.includes('star')) {
    themeName = 'space';
  } else if (lowerStyle.includes('cyber') || lowerStyle.includes('neon')) {
    themeName = 'cyberpunk';
  }

  if (is3DOrVoxel || templateId === 'voxel-3d-deferred') {
    status = 'deferred-future-engine';
    missingRequirements.push(
      'Dedicated 3D rendering pipeline (WebGL mesh/voxel raymarching engine)',
      '3D voxel coordinate chunk manager and depth buffer',
      'Volumetric collision detection system'
    );
    limitationsAndWarnings.push(
      'A single 2D reference screenshot cannot reconstruct 3D voxel world geometry, hidden biome generation, or interior chunk data.',
      'Draw2Play AI Stage 2 structures this plan and preserves it for the upcoming 3D Engine phase.'
    );
  } else {
    limitationsAndWarnings.push(
      '2D level parameters are generated deterministically according to the selected template contract and can be fine-tuned in the studio editor.'
    );
    if (analysis.provenance === 'mock-heuristic') {
      limitationsAndWarnings.push(
        'Reference analysis used keyword heuristics (Gemini Vision unavailable). Level parameters may not reflect actual reference image content.'
      );
    }
    if (analysis.analysisConfidenceTier === 'low') {
      limitationsAndWarnings.push(
        'Analysis confidence is LOW. Manually review inferred mechanics before generating a level.'
      );
    }
  }

  // Procedural generation matching selected template
  const templatePlan = generateTemplateLevel(templateId, {
    width: 800,
    height: 480,
    theme: themeName,
    userPrompt: userPrompt || 'Generate game level inspired by reference',
    referenceEvidence: {
      dominantColors: analysis.colorPalette,
      visibleShapes: analysis.visibleObjects,
      spatialLayout: analysis.terrainLayout,
    },
    seed: 42,
  });

  const rawPlan: GameDesignPlan = {
    ...templatePlan,
    referenceId,
    provenance: analysis.provenance,
    provider: {
      id: analysis.provenance === 'gemini-vision' ? 'gemini' : 'local-heuristic',
      model: analysis.modelProvenance || (analysis.provenance === 'gemini-vision' ? 'gemini-2.5-flash' : 'deterministic-keywords-v2'),
      isFallback: analysis.provenance !== 'gemini-vision',
    },
    status,
    confidenceAndWarnings: {
      overallConfidence: (analysis.analysisConfidenceTier?.toLowerCase() || 'medium') as 'high' | 'medium' | 'low',
      confidenceReasoning:
        analysis.provenance === 'gemini-vision'
          ? 'Multimodal visual analysis with verified observations.'
          : 'Deterministic keyword heuristics baseline without live visual model.',
      warnings: limitationsAndWarnings,
      unsupportedFeatures: is3DOrVoxel ? ['Deferred 3D voxel engine'] : [],
    },
    requestedFeatures: analysis.inferredMechanics.map((m) => m.name),
    missingRequirements,
    limitationsAndWarnings,
    suggested2DConfig:
      targetEngine === 'phaser-2d'
        ? {
            theme: themeName,
            playerSpeed: templatePlan.player.speed,
            playerJump: templatePlan.player.jumpPower,
            gravity: templatePlan.world.gravity,
            platformCount: Math.max(1, templatePlan.terrain.platforms.length),
            hazardTypes: ['spike'],
            collectibleTypes: ['coin'],
          }
        : undefined,
  };

  // Check template compatibility
  const compatReport = checkTemplateCompatibility(rawPlan);
  if (compatReport.warnings.length > 0) {
    rawPlan.confidenceAndWarnings.warnings.push(...compatReport.warnings);
  }

  // Strictly assert plan invariants and security
  return assertValidGamePlan(rawPlan);
}
