import { z } from 'zod';

export const GameCategorySchema = z.enum([
  '2d-platformer',
  'top-down-2d',
  'isometric',
  '3d-world',
  'voxel',
  'racing',
  'puzzle',
  'other',
  'uncertain',
]);
export type GameCategory = z.infer<typeof GameCategorySchema>;

export const CameraPerspectiveSchema = z.enum([
  'side-scrolling-2d',
  'top-down-2d',
  'isometric',
  'first-person-3d',
  'third-person-3d',
  'fixed-angle-3d',
  'unknown',
]);
export type CameraPerspective = z.infer<typeof CameraPerspectiveSchema>;

export const TargetEngineSchema = z.enum([
  'phaser-2d',
  'future-3d-engine',
  'unsupported',
]);
export type TargetEngine = z.infer<typeof TargetEngineSchema>;

export const AnalysisProvenanceSchema = z.enum([
  'gemini-vision',
  'huggingface-vision',
  'mock-heuristic',
  'manual-input',
  'development-mock',
]);
export type AnalysisProvenance = z.infer<typeof AnalysisProvenanceSchema>;

export const PlanStatusSchema = z.enum([
  'draft',
  'validated',
  'ready-for-2d-generation',
  'deferred-future-engine',
]);
export type PlanStatus = z.infer<typeof PlanStatusSchema>;

/**
 * Phase 6.2: Confidence tier for overall analysis quality
 */
export const AnalysisConfidenceTierSchema = z.enum([
  'high',    // >= 0.75 — Gemini confident, ≥2 supporting observations per mechanic
  'medium',  // 0.5-0.74 — Heuristic or 1-2 observations
  'low',     // < 0.5  — Very ambiguous reference
]);
export type AnalysisConfidenceTier = z.infer<typeof AnalysisConfidenceTierSchema>;

/**
 * Validated Reference Input
 */
export const ReferenceInputSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['image', 'video-frame', 'sketch']),
  displayName: z.string().min(1).max(120),
  mimeType: z.string().refine(
    (m) => ['image/png', 'image/jpeg', 'image/webp'].includes(m),
    { message: 'MIME type must be image/png, image/jpeg, or image/webp' }
  ),
  fileSizeBytes: z.number().int().nonnegative().max(10 * 1024 * 1024, 'File size must not exceed 10MB'),
  dimensions: z.object({
    width: z.number().int().positive().max(4096),
    height: z.number().int().positive().max(4096),
  }),
  createdAt: z.string(),
  status: z.enum(['pending', 'analyzed', 'failed']),
  assetUrl: z.string().optional(),
  userDescription: z.string().max(500).optional(),
});
export type ReferenceInput = z.infer<typeof ReferenceInputSchema>;

/**
 * Phase 6.2: Inferred Game Mechanic with explicit Observation Grounding
 *
 * CRITICAL DISTINCTION:
 * - `observationalEvidence`: What was DIRECTLY SEEN in the reference image(s)
 * - `supportingObservations`: Interpretation of those observations (may include inferences)
 * - `description`: How the mechanic likely behaves — ALWAYS labelled as hypothesis
 *
 * Never conflate observed pixel evidence with inferred game logic.
 */
export const InferredMechanicSchema = z.object({
  name: z.string().min(1).max(60),
  /** Hypothesis: How this mechanic may behave. Not confirmed from source code. */
  description: z.string().min(1).max(250),
  confidence: z.number().min(0).max(1),
  /**
   * Phase 6.2: Concrete visual observations that ground this inference.
   * Each item must describe something literally visible in the image —
   * colour, shape, layout, UI element — not a game design assumption.
   */
  observationalEvidence: z.array(z.string().max(200)).min(1).max(6),
  /**
   * Kept for backwards compat — can mirror or supplement observationalEvidence.
   */
  supportingObservations: z.array(z.string().max(150)).max(5),
});
export type InferredMechanic = z.infer<typeof InferredMechanicSchema>;

/**
 * Phase 6.2: Frame-level analysis result for multi-frame video workflows
 */
export const FrameAnalysisResultSchema = z.object({
  frameIndex: z.number().int().nonnegative(),
  timestampSeconds: z.number().nonnegative(),
  visibleObjects: z.array(z.string().max(80)).max(15),
  terrainNotes: z.string().max(200),
  uniqueObservations: z.array(z.string().max(150)).max(8),
});
export type FrameAnalysisResult = z.infer<typeof FrameAnalysisResultSchema>;

/**
 * Stage 2: Factual visual observations supported directly by the reference image.
 * Must NOT contain speculative gameplay logic or unobserved rules.
 */
export const ObservedEvidenceSchema = z.object({
  majorShapesAndBoundaries: z.array(z.string().max(100)).max(15).default([]),
  platformsAndFloors: z.array(z.string().max(100)).max(15).default([]),
  wallsAndCorridors: z.array(z.string().max(100)).max(15).default([]),
  visibleCharactersAndObjects: z.array(z.string().max(80)).max(15).default([]),
  visibleHazards: z.array(z.string().max(80)).max(10).default([]),
  visibleCollectibles: z.array(z.string().max(80)).max(10).default([]),
  relativeSpatialLayout: z.string().max(300).default(''),
  dominantColors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(1).max(8).default(['#00ffcc']),
  visualStyle: z.string().min(1).max(120).default('2D Pixel Art'),
  uncertainAndOccludedRegions: z.array(z.string().max(200)).max(8).default([]),
});
export type ObservedEvidence = z.infer<typeof ObservedEvidenceSchema>;

/**
 * Stage 2: Creative game design proposals based on observations.
 * Explicitly separated from observed physical evidence.
 */
export const ProposedDesignSchema = z.object({
  suggestedGenre: GameCategorySchema.default('2d-platformer'),
  cameraPerspective: CameraPerspectiveSchema.default('side-scrolling-2d'),
  playerAbilitiesAndMovement: z
    .object({
      movementType: z.string().max(60).default('Run and Jump'),
      abilities: z.array(z.string().max(50)).max(6).default(['walk', 'run', 'jump']),
    })
    .default({ movementType: 'Run and Jump', abilities: ['walk', 'run', 'jump'] }),
  coreGameplayLoop: z.string().max(300).default('Traverse platforms, avoid hazards, collect items, reach the goal.'),
  objectivesAndConditions: z
    .object({
      primaryObjective: z.string().max(150).default('Reach the exit flag'),
      winConditions: z.array(z.string().max(100)).max(5).default(['Reach the goal']),
      loseConditions: z.array(z.string().max(100)).max(5).default(['Fall into hazards']),
    })
    .default({
      primaryObjective: 'Reach the exit flag',
      winConditions: ['Reach the goal'],
      loseConditions: ['Fall into hazards'],
    }),
  proposedEnemiesAndHazards: z
    .array(
      z.object({
        name: z.string().max(60),
        behaviorProposal: z.string().max(200),
      })
    )
    .max(6)
    .default([]),
  proposedCollectibles: z
    .array(
      z.object({
        name: z.string().max(60),
        interactionProposal: z.string().max(200),
      })
    )
    .max(6)
    .default([]),
  difficultyProgression: z
    .object({
      tier: z.enum(['easy', 'medium', 'hard']).default('medium'),
      pacingNotes: z.string().max(200).default('Standard platformer pacing with gradual challenge increase.'),
    })
    .default({ tier: 'medium', pacingNotes: 'Standard platformer pacing.' }),
  audioVisualFeedback: z
    .object({
      visualStyleCues: z.array(z.string().max(80)).max(6).default([]),
      suggestedAudioMood: z.string().max(100).default('Chiptune retro upbeat'),
    })
    .default({ visualStyleCues: [], suggestedAudioMood: 'Chiptune retro upbeat' }),
  inferredMechanics: z.array(InferredMechanicSchema).max(8).default([]),
});
export type ProposedDesign = z.infer<typeof ProposedDesignSchema>;

/**
 * Phase 6.2 & Stage 2: Structured Visual Reference Analysis
 *
 * KEY INVARIANTS:
 * - `provenance` must accurately reflect how the analysis was produced
 * - `observedEvidence` details what is visibly verifiable in the image
 * - `proposedDesign` details creative hypotheses separated from observations
 */
export const ReferenceAnalysisSchema = z.object({
  schemaVersion: z.string().default('2.0'),
  category: GameCategorySchema,
  cameraPerspective: CameraPerspectiveSchema,
  visualStyle: z.string().min(1).max(120),
  colorPalette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(1).max(8),
  visibleObjects: z.array(z.string().max(80)).max(15),
  terrainLayout: z.string().max(300),
  suggestedRoles: z.object({
    player: z.string().max(80).optional(),
    obstacles: z.array(z.string().max(80)).max(10).optional(),
    collectibles: z.array(z.string().max(80)).max(10).optional(),
    goals: z.array(z.string().max(80)).max(5).optional(),
  }),
  inferredMechanics: z.array(InferredMechanicSchema).max(8),
  uncertaintiesAndWarnings: z.array(z.string().max(300)).max(8),
  recommendedPipeline: TargetEngineSchema,
  provenance: AnalysisProvenanceSchema,
  modelProvenance: z.string().optional(),
  correlationId: z.string().optional(),
  usage: z
    .object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
  analyzedAt: z.string(),
  analysisConfidenceTier: AnalysisConfidenceTierSchema.default('medium'),
  frameCount: z.number().int().min(1).max(10).default(1),
  frameResults: z.array(FrameAnalysisResultSchema).max(10).optional(),

  // Stage 2: Explicit separation of observed evidence vs proposed design
  observedEvidence: ObservedEvidenceSchema.optional(),
  proposedDesign: ProposedDesignSchema.optional(),
});
export type ReferenceAnalysis = z.infer<typeof ReferenceAnalysisSchema>;

/**
 * Structured Game Generation Plan Schema (supports both v1.0 and v2.0 fields)
 */
export const GameGenerationPlanSchema = z.object({
  schemaVersion: z.string().default('2.0'),
  id: z.string().min(1),
  generationId: z.string().optional(),
  referenceId: z.string().min(1),
  userPrompt: z.string().min(1).max(500),
  targetEngine: TargetEngineSchema,
  category: GameCategorySchema,
  requestedFeatures: z.array(z.string().max(100)).max(15).default([]),
  validatedSceneReference: z.string().optional(),
  missingRequirements: z.array(z.string().max(200)).max(15).default([]),
  limitationsAndWarnings: z.array(z.string().max(300)).max(15).default([]),
  status: PlanStatusSchema,
  createdAt: z.string(),
  templateId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  sourceType: z.string().optional(),
  theme: z.record(z.string(), z.unknown()).optional(),
  world: z.record(z.string(), z.unknown()).optional(),
  terrain: z.record(z.string(), z.unknown()).optional(),
  player: z.record(z.string(), z.unknown()).optional(),
  entities: z.record(z.string(), z.unknown()).optional(),
  objectives: z.record(z.string(), z.unknown()).optional(),
  difficulty: z.record(z.string(), z.unknown()).optional(),
  mechanics: z.record(z.string(), z.unknown()).optional(),
  confidenceAndWarnings: z.record(z.string(), z.unknown()).optional(),
  suggested2DConfig: z
    .object({
      theme: z.enum(['default', 'forest', 'ice', 'lava', 'space', 'cyberpunk']),
      playerSpeed: z.number().int().min(80).max(500),
      playerJump: z.number().int().min(0).max(700),
      gravity: z.number().int().min(0).max(2000),
      platformCount: z.number().int().min(1).max(50),
      hazardTypes: z.array(z.string()).max(10),
      collectibleTypes: z.array(z.string()).max(10),
    })
    .optional(),
});
export type GameGenerationPlan = z.infer<typeof GameGenerationPlanSchema>;
