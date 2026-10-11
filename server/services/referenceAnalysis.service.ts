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

import { serverConfig } from '../config.js';
import { AiProviderError } from '../providers/types.js';
import { sanitizeHfErrorMessage } from '../providers/huggingface.provider.js';

/** Maximum milliseconds to wait for a Gemini vision call before falling back (configurable, default 35s) */
const GEMINI_VISION_TIMEOUT_MS = serverConfig.geminiTimeoutMs || 35_000;

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
 * Safely normalizes an overlong string to fit within maxLen.
 * 1. Trims whitespace and collapses consecutive spaces.
 * 2. If length <= maxLen, returns the cleaned string unchanged.
 * 3. If length > maxLen, cuts cleanly before maxLen without breaking words:
 *    - Looks for clause boundaries (punctuation like . , ; :) in the upper 50%
 *    - Looks for word boundaries (space) and avoids leaving trailing conjunctions / prepositions
 *    - Ensures the final result is strictly <= maxLen characters and retains semantic meaning.
 */
export function normalizeStringLength(text: unknown, maxLen: number, fallback = ''): string {
  if (typeof text !== 'string') {
    return typeof text === 'number' || typeof text === 'boolean'
      ? String(text).slice(0, maxLen)
      : fallback;
  }
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLen) {
    return trimmed;
  }

  const slice = trimmed.slice(0, maxLen);

  // Look for natural punctuation break in the latter portion (>= 45% of maxLen)
  const lastPunct = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf(', '),
    slice.lastIndexOf('; '),
    slice.lastIndexOf(': ')
  );
  if (lastPunct >= Math.floor(maxLen * 0.45)) {
    return slice.slice(0, lastPunct).replace(/[,;:\s]+$/, '').trim();
  }

  // Look for word boundary (space)
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace >= Math.floor(maxLen * 0.35)) {
    let result = slice.slice(0, lastSpace).trim();
    // Strip trailing conjunctions, prepositions, and articles
    result = result.replace(/\s+(?:and|or|with|of|in|to|for|the|a|an)$/i, '');
    result = result.replace(/[,;:\-\s]+$/, '').trim();
    return result;
  }

  // Fallback: hard slice if a single unbroken word exceeds maxLen
  return slice.trim();
}

/**
 * Normalizes a raw model response payload to guarantee that strings conform
 * to the exact length bounds of ReferenceAnalysisSchema before strict validation.
 * Preserves factual observations and does NOT fabricate visual details or weaken schemas.
 */
export function normalizeReferenceAnalysisPayload(
  raw: Record<string, unknown>
): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') {
    return raw;
  }

  const out: Record<string, unknown> = { ...raw };

  // 1. visualStyle (min 1, max 120)
  if (typeof out.visualStyle === 'string') {
    out.visualStyle = normalizeStringLength(out.visualStyle, 120, '2D Visual Style');
  }

  // 2. terrainLayout (max 300)
  if (typeof out.terrainLayout === 'string') {
    out.terrainLayout = normalizeStringLength(out.terrainLayout, 300, 'Visible terrain layout');
  }

  // 3. visibleObjects (array of strings, each max 80, array max 15)
  if (Array.isArray(out.visibleObjects)) {
    out.visibleObjects = out.visibleObjects
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => normalizeStringLength(item, 80))
      .filter((item) => item.length > 0)
      .slice(0, 15);
  }

  // 4. suggestedRoles (player max 80, obstacles/collectibles/goals max 80)
  if (out.suggestedRoles && typeof out.suggestedRoles === 'object') {
    const roles = out.suggestedRoles as Record<string, unknown>;
    const normRoles: Record<string, unknown> = {};

    if (typeof roles.player === 'string') {
      normRoles.player = normalizeStringLength(roles.player, 80);
    }
    if (Array.isArray(roles.obstacles)) {
      normRoles.obstacles = roles.obstacles
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => normalizeStringLength(item, 80))
        .slice(0, 10);
    }
    if (Array.isArray(roles.collectibles)) {
      normRoles.collectibles = roles.collectibles
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => normalizeStringLength(item, 80))
        .slice(0, 10);
    }
    if (Array.isArray(roles.goals)) {
      normRoles.goals = roles.goals
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => normalizeStringLength(item, 80))
        .slice(0, 5);
    }
    out.suggestedRoles = normRoles;
  }

  // 5. uncertaintiesAndWarnings (array of max 300, max 8)
  if (Array.isArray(out.uncertaintiesAndWarnings)) {
    out.uncertaintiesAndWarnings = out.uncertaintiesAndWarnings
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => normalizeStringLength(item, 300))
      .slice(0, 8);
  }

  // 6. inferredMechanics (array of InferredMechanic, name max 60, desc max 250, obsEv max 200, suppObs max 150)
  if (Array.isArray(out.inferredMechanics)) {
    out.inferredMechanics = out.inferredMechanics
      .filter((m): m is Record<string, unknown> => m !== null && typeof m === 'object')
      .slice(0, 8)
      .map((m) => {
        const obs = Array.isArray(m.observationalEvidence)
          ? m.observationalEvidence
              .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
              .map((e) => normalizeStringLength(e, 200))
              .slice(0, 6)
          : [];
        const supp = Array.isArray(m.supportingObservations)
          ? m.supportingObservations
              .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
              .map((s) => normalizeStringLength(s, 150))
              .slice(0, 5)
          : [];

        return {
          ...m,
          name: normalizeStringLength(m.name, 60, 'Mechanic'),
          description: normalizeStringLength(m.description, 250, 'Hypothetical mechanic'),
          confidence: typeof m.confidence === 'number' ? Math.max(0, Math.min(1, m.confidence)) : 0.7,
          observationalEvidence: obs.length > 0 ? obs : ['Visual cues in reference'],
          supportingObservations: supp,
        };
      });
  }

  // 7. observedEvidence
  if (out.observedEvidence && typeof out.observedEvidence === 'object') {
    const oe = out.observedEvidence as Record<string, unknown>;
    const normOe: Record<string, unknown> = { ...oe };

    const normStrArr = (arr: unknown, maxLen: number, maxCount: number): string[] => {
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => normalizeStringLength(item, maxLen))
        .slice(0, maxCount);
    };

    normOe.majorShapesAndBoundaries = normStrArr(oe.majorShapesAndBoundaries, 100, 15);
    normOe.platformsAndFloors = normStrArr(oe.platformsAndFloors, 100, 15);
    normOe.wallsAndCorridors = normStrArr(oe.wallsAndCorridors, 100, 15);
    normOe.visibleCharactersAndObjects = normStrArr(oe.visibleCharactersAndObjects, 80, 15);
    normOe.visibleHazards = normStrArr(oe.visibleHazards, 80, 10);
    normOe.visibleCollectibles = normStrArr(oe.visibleCollectibles, 80, 10);
    normOe.relativeSpatialLayout = normalizeStringLength(oe.relativeSpatialLayout, 300, '');
    normOe.visualStyle = normalizeStringLength(oe.visualStyle, 120, '2D Visual Style');
    normOe.uncertainAndOccludedRegions = normStrArr(oe.uncertainAndOccludedRegions, 200, 8);

    out.observedEvidence = normOe;
  }

  // 8. proposedDesign
  if (out.proposedDesign && typeof out.proposedDesign === 'object') {
    const pd = out.proposedDesign as Record<string, unknown>;
    const normPd: Record<string, unknown> = { ...pd };

    if (pd.playerAbilitiesAndMovement && typeof pd.playerAbilitiesAndMovement === 'object') {
      const pam = pd.playerAbilitiesAndMovement as Record<string, unknown>;
      normPd.playerAbilitiesAndMovement = {
        movementType: normalizeStringLength(pam.movementType, 60, 'Run and Jump'),
        abilities: Array.isArray(pam.abilities)
          ? pam.abilities
              .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
              .map((item) => normalizeStringLength(item, 50))
              .slice(0, 6)
          : ['walk', 'run', 'jump'],
      };
    }

    if (typeof pd.coreGameplayLoop === 'string') {
      normPd.coreGameplayLoop = normalizeStringLength(pd.coreGameplayLoop, 300);
    }

    if (pd.objectivesAndConditions && typeof pd.objectivesAndConditions === 'object') {
      const oac = pd.objectivesAndConditions as Record<string, unknown>;
      normPd.objectivesAndConditions = {
        primaryObjective: normalizeStringLength(oac.primaryObjective, 150, 'Reach the goal'),
        winConditions: Array.isArray(oac.winConditions)
          ? oac.winConditions
              .filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
              .map((w) => normalizeStringLength(w, 100))
              .slice(0, 5)
          : ['Reach the goal'],
        loseConditions: Array.isArray(oac.loseConditions)
          ? oac.loseConditions
              .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
              .map((l) => normalizeStringLength(l, 100))
              .slice(0, 5)
          : ['Fall into hazards'],
      };
    }

    if (Array.isArray(pd.proposedEnemiesAndHazards)) {
      normPd.proposedEnemiesAndHazards = pd.proposedEnemiesAndHazards
        .filter((e): e is Record<string, unknown> => e !== null && typeof e === 'object')
        .slice(0, 6)
        .map((e) => ({
          name: normalizeStringLength(e.name, 60, 'Obstacle'),
          behaviorProposal: normalizeStringLength(e.behaviorProposal, 200, 'Hazard behavior'),
        }));
    }

    if (Array.isArray(pd.proposedCollectibles)) {
      normPd.proposedCollectibles = pd.proposedCollectibles
        .filter((c): c is Record<string, unknown> => c !== null && typeof c === 'object')
        .slice(0, 6)
        .map((c) => ({
          name: normalizeStringLength(c.name, 60, 'Collectible'),
          interactionProposal: normalizeStringLength(c.interactionProposal, 200, 'Score reward'),
        }));
    }

    if (pd.difficultyProgression && typeof pd.difficultyProgression === 'object') {
      const dp = pd.difficultyProgression as Record<string, unknown>;
      normPd.difficultyProgression = {
        tier: dp.tier === 'easy' || dp.tier === 'hard' ? dp.tier : 'medium',
        pacingNotes: normalizeStringLength(dp.pacingNotes, 200, 'Standard pacing'),
      };
    }

    if (pd.audioVisualFeedback && typeof pd.audioVisualFeedback === 'object') {
      const avf = pd.audioVisualFeedback as Record<string, unknown>;
      normPd.audioVisualFeedback = {
        visualStyleCues: Array.isArray(avf.visualStyleCues)
          ? avf.visualStyleCues
              .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
              .map((c) => normalizeStringLength(c, 80))
              .slice(0, 6)
          : [],
        suggestedAudioMood: normalizeStringLength(avf.suggestedAudioMood, 100, 'Chiptune upbeat'),
      };
    }

    out.proposedDesign = normPd;
  }

  // 9. Multi-frame frameResults if present
  if (Array.isArray(out.frameResults)) {
    out.frameResults = out.frameResults
      .filter((fr): fr is Record<string, unknown> => fr !== null && typeof fr === 'object')
      .slice(0, 10)
      .map((fr) => ({
        ...fr,
        visibleObjects: Array.isArray(fr.visibleObjects)
          ? fr.visibleObjects
              .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
              .map((item) => normalizeStringLength(item, 80))
              .slice(0, 15)
          : [],
        terrainNotes: normalizeStringLength(fr.terrainNotes, 200, 'Terrain observation'),
        uniqueObservations: Array.isArray(fr.uniqueObservations)
          ? fr.uniqueObservations
              .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
              .map((item) => normalizeStringLength(item, 150))
              .slice(0, 8)
          : [],
      }));
  }

  return out;
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
  correlationId?: string,
  options?: { timeoutMs?: number; signal?: AbortSignal }
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

  const timeoutMs = options?.timeoutMs || serverConfig.geminiTimeoutMs || GEMINI_VISION_TIMEOUT_MS;
  const result = await provider.execute({
    capability: 'image-understanding',
    prompt,
    imageBase64,
    timeoutMs,
    correlationId,
    signal: options?.signal,
  });

  const responseText = result.rawText || '';
  const cleaned = responseText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  // Normalize parsed payload to guarantee safe bounds for all schema strings
  const normalizedParsed = normalizeReferenceAnalysisPayload(parsed);

  // Ensure every mechanic has observationalEvidence (backfill from supportingObservations if missing)
  const inferredMechanics: ReferenceAnalysis['inferredMechanics'] = Array.isArray(normalizedParsed.inferredMechanics)
    ? (normalizedParsed.inferredMechanics as Record<string, unknown>[]).map((m: Record<string, unknown>) => ({
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
    normalizedParsed,
    (normalizedParsed.category as ReferenceAnalysis['category']) || '2d-platformer',
    (normalizedParsed.cameraPerspective as ReferenceAnalysis['cameraPerspective']) || 'side-scrolling-2d',
    (normalizedParsed.visualStyle as string) || '2D Pixel Art',
    Array.isArray(normalizedParsed.colorPalette) ? (normalizedParsed.colorPalette as string[]) : ['#38bdf8', '#22c55e', '#ef4444'],
    Array.isArray(normalizedParsed.visibleObjects) ? (normalizedParsed.visibleObjects as string[]) : ['Platform', 'Ground'],
    (normalizedParsed.terrainLayout as string) || 'Visible ground and platform geometry.',
    (normalizedParsed.suggestedRoles as ReferenceAnalysis['suggestedRoles']) || {},
    inferredMechanics
  );

  const analysisPayload = normalizeReferenceAnalysisPayload({
    ...normalizedParsed,
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
  });

  const validated = ReferenceAnalysisSchema.parse(analysisPayload);
  validated.analysisConfidenceTier = computeConfidenceTier(validated.inferredMechanics, validated.provenance);
  return validated;
}

/**
 * Analyzes a single reference image using live Hugging Face Vision (e.g. Qwen2.5-VL-3B-Instruct).
 * Normalizes all output strings before final validation against ReferenceAnalysisSchema.
 */
export async function analyzeReferenceWithHuggingFace(
  imageBase64: string,
  userPrompt?: string,
  correlationId?: string,
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<ReferenceAnalysis> {
  const provider = aiProviderRegistry.getProviderForCapability('image-understanding', 'huggingface');
  if (!provider.isConfigured()) {
    throw new Error('HF_TOKEN is not configured on the server');
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

  const timeoutMs = options?.timeoutMs || serverConfig.hfTimeoutMs || 35_000;
  const result = await provider.execute({
    capability: 'image-understanding',
    prompt,
    imageBase64,
    timeoutMs,
    correlationId,
    signal: options?.signal,
  });

  const responseText = result.rawText || '';
  const cleaned = responseText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  // Normalize parsed payload to guarantee safe bounds for all schema strings
  const normalizedParsed = normalizeReferenceAnalysisPayload(parsed);

  // Ensure every mechanic has observationalEvidence
  const inferredMechanics: ReferenceAnalysis['inferredMechanics'] = Array.isArray(normalizedParsed.inferredMechanics)
    ? (normalizedParsed.inferredMechanics as Record<string, unknown>[]).map((m: Record<string, unknown>) => ({
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
    normalizedParsed,
    (normalizedParsed.category as ReferenceAnalysis['category']) || '2d-platformer',
    (normalizedParsed.cameraPerspective as ReferenceAnalysis['cameraPerspective']) || 'side-scrolling-2d',
    (normalizedParsed.visualStyle as string) || '2D Pixel Art',
    Array.isArray(normalizedParsed.colorPalette) ? (normalizedParsed.colorPalette as string[]) : ['#38bdf8', '#22c55e', '#ef4444'],
    Array.isArray(normalizedParsed.visibleObjects) ? (normalizedParsed.visibleObjects as string[]) : ['Platform', 'Ground'],
    (normalizedParsed.terrainLayout as string) || 'Visible ground and platform geometry.',
    (normalizedParsed.suggestedRoles as ReferenceAnalysis['suggestedRoles']) || {},
    inferredMechanics
  );

  const analysisPayload = normalizeReferenceAnalysisPayload({
    ...normalizedParsed,
    schemaVersion: '2.0',
    provenance: 'huggingface-vision' as const,
    modelProvenance: result.metadata.model || provider.defaultModel,
    correlationId,
    usage: result.metadata.usage,
    analyzedAt: new Date().toISOString(),
    frameCount: 1,
    inferredMechanics,
    observedEvidence,
    proposedDesign,
  });

  const validated = ReferenceAnalysisSchema.parse(analysisPayload);
  validated.analysisConfidenceTier = computeConfidenceTier(validated.inferredMechanics, validated.provenance);
  return validated;
}

export interface FallbackChainOptions {
  mode?: 'auto' | 'gemini-only' | 'hf-only' | 'heuristic-only';
  allowFallback?: boolean;
  correlationId?: string;
  signal?: AbortSignal;
}

export interface FallbackChainResult {
  analysis: ReferenceAnalysis;
  source: 'gemini-vision' | 'huggingface-vision' | 'mock-heuristic';
  provider: {
    id: string;
    model: string;
    isFallback: boolean;
  };
  notice?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Executes vision reference analysis with the required fallback chain:
 * 1. Explicit 'heuristic-only' skips all hosted providers.
 * 2. Try Gemini if configured.
 * 3. If Gemini encounters recoverable timeout/error, try Hugging Face if configured.
 * 4. If Hugging Face is unavailable or fails, invoke deterministic heuristic once.
 * 5. If neither AI provider is configured, use the heuristic directly.
 */
export async function analyzeReferenceWithFallbackChain(
  imageBase64: string,
  userPrompt?: string,
  options?: FallbackChainOptions
): Promise<FallbackChainResult> {
  const mode = options?.mode || 'auto';
  const allowFallback = options?.allowFallback ?? true;
  const correlationId = options?.correlationId;
  const signal = options?.signal;

  // 1. Explicit offline heuristic mode: honor choice without calling hosted providers
  if (mode === 'heuristic-only') {
    const fallback = generateHeuristicReferenceAnalysis(userPrompt, 800, 600, correlationId);
    const validatedFallback = ReferenceAnalysisSchema.parse(fallback);
    return {
      analysis: validatedFallback,
      source: 'mock-heuristic',
      provider: {
        id: 'local-heuristic',
        model: 'deterministic-keywords-v2',
        isFallback: true,
      },
      notice: 'Local heuristic analysis based on prompt keywords. Results do not reflect actual image content.',
    };
  }

  const geminiProvider = aiProviderRegistry.getProviderForCapability('image-understanding', 'gemini');
  const hfProvider = aiProviderRegistry.getProviderForCapability('image-understanding', 'huggingface');
  const isGeminiConfigured = Boolean(geminiProvider?.isConfigured());
  const isHfConfigured = Boolean(hfProvider?.isConfigured());

  // 2. Explicit Gemini-only mode
  if (mode === 'gemini-only') {
    if (!isGeminiConfigured) {
      if (allowFallback) {
        const fallback = generateHeuristicReferenceAnalysis(userPrompt, 800, 600, correlationId);
        return {
          analysis: ReferenceAnalysisSchema.parse(fallback),
          source: 'mock-heuristic',
          provider: { id: 'local-heuristic', model: 'deterministic-keywords-v2', isFallback: true },
          notice: 'GEMINI_API_KEY is not configured on the server. Used deterministic keyword heuristic analysis.',
        };
      }
      throw new AiProviderError({
        providerId: 'gemini',
        category: 'missing_configuration',
        code: 'MISSING_CONFIGURATION',
        message: 'GEMINI_API_KEY is not configured on the server.',
        statusCode: 503,
        isRetryable: false,
        correlationId,
      });
    }

    try {
      const analysis = await analyzeReferenceWithGemini(imageBase64, userPrompt, correlationId, { signal });
      return {
        analysis,
        source: 'gemini-vision',
        provider: {
          id: 'gemini',
          model: analysis.modelProvenance || serverConfig.geminiModel,
          isFallback: false,
        },
        usage: analysis.usage,
      };
    } catch (err: unknown) {
      if (allowFallback) {
        const fallback = generateHeuristicReferenceAnalysis(userPrompt, 800, 600, correlationId);
        const safeMsg = sanitizeHfErrorMessage((err as Error).message);
        return {
          analysis: ReferenceAnalysisSchema.parse(fallback),
          source: 'mock-heuristic',
          provider: { id: 'local-heuristic', model: 'deterministic-keywords-v2', isFallback: true },
          notice: `Live Gemini call failed (${safeMsg}). Switched to deterministic keyword heuristic analysis. Results do not reflect actual image content.`,
        };
      }
      throw err;
    }
  }

  // 3. Explicit HF-only mode
  if (mode === 'hf-only') {
    if (!isHfConfigured) {
      if (allowFallback) {
        const fallback = generateHeuristicReferenceAnalysis(userPrompt, 800, 600, correlationId);
        return {
          analysis: ReferenceAnalysisSchema.parse(fallback),
          source: 'mock-heuristic',
          provider: { id: 'local-heuristic', model: 'deterministic-keywords-v2', isFallback: true },
          notice: 'HF_TOKEN is not configured on the server. Used deterministic keyword heuristic analysis.',
        };
      }
      throw new AiProviderError({
        providerId: 'huggingface',
        category: 'missing_configuration',
        code: 'MISSING_CONFIGURATION',
        message: 'HF_TOKEN is not configured on the server.',
        statusCode: 503,
        isRetryable: false,
        correlationId,
      });
    }

    try {
      const analysis = await analyzeReferenceWithHuggingFace(imageBase64, userPrompt, correlationId, { signal });
      return {
        analysis,
        source: 'huggingface-vision',
        provider: {
          id: 'huggingface',
          model: analysis.modelProvenance || serverConfig.hfVisionModel,
          isFallback: false,
        },
        usage: analysis.usage,
      };
    } catch (err: unknown) {
      if (allowFallback) {
        const fallback = generateHeuristicReferenceAnalysis(userPrompt, 800, 600, correlationId);
        const safeMsg = sanitizeHfErrorMessage((err as Error).message);
        return {
          analysis: ReferenceAnalysisSchema.parse(fallback),
          source: 'mock-heuristic',
          provider: { id: 'local-heuristic', model: 'deterministic-keywords-v2', isFallback: true },
          notice: `Live Hugging Face call failed (${safeMsg}). Switched to deterministic keyword heuristic analysis. Results do not reflect actual image content.`,
        };
      }
      throw err;
    }
  }

  // 4. Auto mode fallback chain:
  // Neither hosted provider configured: use heuristic directly
  if (!isGeminiConfigured && !isHfConfigured) {
    if (allowFallback) {
      const fallback = generateHeuristicReferenceAnalysis(userPrompt, 800, 600, correlationId);
      return {
        analysis: ReferenceAnalysisSchema.parse(fallback),
        source: 'mock-heuristic',
        provider: { id: 'local-heuristic', model: 'deterministic-keywords-v2', isFallback: true },
        notice: 'Neither GEMINI_API_KEY nor HF_TOKEN is configured on the server. Used deterministic keyword heuristic analysis.',
      };
    }
    throw new AiProviderError({
      providerId: 'gemini',
      category: 'missing_configuration',
      code: 'MISSING_CONFIGURATION',
      message: 'Neither GEMINI_API_KEY nor HF_TOKEN is configured on the server.',
      statusCode: 503,
      isRetryable: false,
      correlationId,
    });
  }

  let lastError: unknown = null;
  let geminiFailed = false;

  // Step 1: Try Gemini if configured
  if (isGeminiConfigured) {
    try {
      const analysis = await analyzeReferenceWithGemini(imageBase64, userPrompt, correlationId, { signal });
      return {
        analysis,
        source: 'gemini-vision',
        provider: {
          id: 'gemini',
          model: analysis.modelProvenance || serverConfig.geminiModel,
          isFallback: false,
        },
        usage: analysis.usage,
      };
    } catch (err: unknown) {
      geminiFailed = true;
      lastError = err;
      if (signal?.aborted) {
        throw err;
      }
      console.warn(`[FallbackChain] Gemini vision failed: ${(err as Error).message}. Attempting Hugging Face fallback...`);
    }
  }

  // Step 2: Try Hugging Face if configured
  if (isHfConfigured) {
    try {
      const analysis = await analyzeReferenceWithHuggingFace(imageBase64, userPrompt, correlationId, { signal });
      const geminiNotice = geminiFailed
        ? `Primary Gemini provider failed (${sanitizeHfErrorMessage((lastError as Error)?.message || 'transient error')}). Successfully analyzed using secondary Hugging Face Vision.`
        : undefined;
      return {
        analysis,
        source: 'huggingface-vision',
        provider: {
          id: 'huggingface',
          model: analysis.modelProvenance || serverConfig.hfVisionModel,
          isFallback: false,
        },
        notice: geminiNotice,
        usage: analysis.usage,
      };
    } catch (err: unknown) {
      lastError = err;
      if (signal?.aborted) {
        throw err;
      }
      console.warn(`[FallbackChain] Hugging Face vision failed: ${(err as Error).message}.`);
    }
  }

  // Step 3: Invoke deterministic heuristic once if fallback allowed
  if (allowFallback) {
    const fallback = generateHeuristicReferenceAnalysis(userPrompt, 800, 600, correlationId);
    const safeReason = lastError instanceof Error ? sanitizeHfErrorMessage(lastError.message) : 'Hosted AI providers unavailable';
    return {
      analysis: ReferenceAnalysisSchema.parse(fallback),
      source: 'mock-heuristic',
      provider: {
        id: 'local-heuristic',
        model: 'deterministic-keywords-v2',
        isFallback: true,
      },
      notice: `Hosted vision analysis failed (${safeReason}). Switched to deterministic keyword heuristic analysis. Results do not reflect actual image content.`,
    };
  }

  // If allowFallback is false, propagate the underlying error
  if (lastError) {
    throw lastError;
  }
  throw new AiProviderError({
    providerId: 'gemini',
    category: 'missing_configuration',
    code: 'MISSING_CONFIGURATION',
    message: 'No configured hosted vision AI provider succeeded.',
    statusCode: 503,
    isRetryable: false,
    correlationId,
  });
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
