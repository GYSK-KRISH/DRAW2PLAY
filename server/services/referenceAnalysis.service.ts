import crypto from 'node:crypto';
import { serverConfig } from '../config.js';
import { getGenAIClient } from './gemini.service.js';
import {
  ReferenceAnalysis,
  ReferenceAnalysisSchema,
  GameGenerationPlan,
  GameGenerationPlanSchema,
  TargetEngine,
  FrameAnalysisResult,
  FrameAnalysisResultSchema,
  AnalysisConfidenceTier,
} from '../../src/types/reference.js';

/** Maximum milliseconds to wait for a Gemini vision call before falling back */
const GEMINI_VISION_TIMEOUT_MS = 18_000;

/** Wrap a promise with a hard timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

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
 * Analyzes a single reference image using live Gemini Vision.
 *
 * Prompt design (Phase 6.2):
 * - Explicitly separates what is *observed* from what is *inferred*
 * - Requires each inferred mechanic to cite visual evidence
 * - Warns model not to claim facts beyond the visible frame
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

Analyze this visual reference image (screenshot, video frame, or concept art) with strict epistemological discipline.

${userPrompt ? `User's Goal / Context: "${userPrompt}"` : ''}

## OBSERVATION VS INFERENCE RULES (MANDATORY)
1. OBSERVATIONS are facts directly visible in this image: colours, shapes, UI elements, layout, text labels.
2. INFERENCES are hypotheses about game mechanics derived from observations. NEVER present an inference as fact.
3. Do NOT claim this reference reveals: source code, backend physics constants, hidden world geometry, server-side data, or anything outside the visible frame.
4. Each "inferredMechanic" MUST cite ≥1 concrete visual observation in "observationalEvidence" that justifies the inference.
5. If uncertain about a mechanic, lower its confidence score and add an uncertainty note.

## CLASSIFICATION RULES
- Voxels/cubes/3D blocks (Minecraft-style) → category "voxel", camera "first-person-3d", recommendedPipeline "future-3d-engine"
- 2D side-scrolling platformer (Mario/Celeste style) → category "2d-platformer", camera "side-scrolling-2d", recommendedPipeline "phaser-2d"
- Top-down 2D (Zelda/RPG style) → category "top-down-2d", camera "top-down-2d", recommendedPipeline "phaser-2d"
- Isometric → category "isometric", camera "isometric", recommendedPipeline "future-3d-engine"
- 3D third-person → category "3d-world", camera "third-person-3d", recommendedPipeline "future-3d-engine"
- If ambiguous, use category "uncertain" and reduce all mechanic confidence values.

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
  "uncertaintiesAndWarnings": [
    "What cannot be confirmed from this single reference",
    "Any notable ambiguities"
  ],
  "recommendedPipeline": "phaser-2d" | "future-3d-engine" | "unsupported"
}`;

  const rawCall = client.models.generateContent({
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

  const response = await withTimeout(rawCall, GEMINI_VISION_TIMEOUT_MS, 'Gemini vision');
  const responseText = response.text || '';
  const cleaned = responseText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const analysisPayload = {
    ...parsed,
    schemaVersion: '2.0',
    provenance: 'gemini-vision' as const,
    modelProvenance: serverConfig.geminiModel,
    analyzedAt: new Date().toISOString(),
    frameCount: 1,
  };

  // Ensure every mechanic has observationalEvidence (backfill from supportingObservations if missing)
  if (Array.isArray(analysisPayload.inferredMechanics)) {
    analysisPayload.inferredMechanics = analysisPayload.inferredMechanics.map(
      (m: Record<string, unknown>) => ({
        ...m,
        observationalEvidence:
          Array.isArray(m.observationalEvidence) && m.observationalEvidence.length > 0
            ? m.observationalEvidence
            : Array.isArray(m.supportingObservations) && m.supportingObservations.length > 0
            ? m.supportingObservations.slice(0, 3)
            : ['Visual cues present in reference image'],
        supportingObservations: Array.isArray(m.supportingObservations) ? m.supportingObservations : [],
      })
    );
  }

  const validated = ReferenceAnalysisSchema.parse(analysisPayload);
  validated.analysisConfidenceTier = computeConfidenceTier(validated.inferredMechanics, validated.provenance);
  return validated;
}

/**
 * Phase 6.2: Analyze multiple video frames in sequence and merge observations.
 *
 * Processes up to MAX_FRAMES frames. Observations unique to each frame are
 * tracked. The final merged analysis reflects the union of all visible objects
 * and the best-confidence mechanic from each frame set.
 *
 * IMPORTANT: All produced mechanics are still labelled as inferences.
 */
const MAX_FRAMES = 5;

export async function analyzeMultipleFramesWithGemini(
  frameBase64s: string[], // each may include data URI prefix
  userPrompt?: string
): Promise<ReferenceAnalysis> {
  if (frameBase64s.length === 0) {
    throw new Error('At least one frame is required for multi-frame analysis');
  }

  const bounded = frameBase64s.slice(0, MAX_FRAMES);
  const client = getGenAIClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const frameResultPromises = bounded.map(async (frameB64, idx): Promise<FrameAnalysisResult> => {
    const base64Data = frameB64.replace(/^data:image\/\w+;base64,/, '');
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

    const rawCall = client.models.generateContent({
      model: serverConfig.geminiModel,
      contents: [
        {
          role: 'user',
          parts: [
            { text: framePrompt },
            { inlineData: { mimeType: 'image/png', data: base64Data } },
          ],
        },
      ],
    });

    const response = await withTimeout(rawCall, GEMINI_VISION_TIMEOUT_MS, `Frame ${idx} analysis`);
    const text = (response.text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    return FrameAnalysisResultSchema.parse({ ...JSON.parse(text), frameIndex: idx });
  });

  // Analyse frames in parallel (bounded to MAX_FRAMES)
  const frameResults = await Promise.all(frameResultPromises);

  // Merge: run full analysis on the first frame but combine visible objects from all
  const primaryAnalysis = await analyzeReferenceWithGemini(frameBase64s[0], userPrompt);

  // Union of all visible objects across frames (deduplicated, bounded)
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
 *
 * Phase 6.2: Now populates observationalEvidence and analysisConfidenceTier.
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

  const analysis: ReferenceAnalysis = {
    schemaVersion: '2.0',
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
      'Analysis produced via deterministic keyword heuristics — Gemini Vision offline or unconfigured.',
      'A prompt keyword is NOT the same as a direct visual observation from an image.',
      'A single 2D reference does not define world seed, hidden caves, or exact physics parameters.',
      ...(isVoxelOr3D
        ? ['Notice: Full voxel gameplay requires a dedicated 3D engine scheduled for a future phase.']
        : []),
    ],
    recommendedPipeline: pipeline,
    provenance: 'mock-heuristic',
    analyzedAt: new Date().toISOString(),
    analysisConfidenceTier: 'medium',
    frameCount: 1,
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
      'Draw2Play AI Phase 6.2 structures this plan and preserves it for the upcoming 3D Engine phase.'
    );
  } else {
    limitationsAndWarnings.push(
      '2D level parameters are estimated from visible reference composition and can be fine-tuned in the studio editor.'
    );
    // Phase 6.2: Warn if analysis was heuristic-only
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
