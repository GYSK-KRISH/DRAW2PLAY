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
  'mock-heuristic',
  'manual-input',
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
 * Phase 6.2: Structured Visual Reference Analysis (schema version 2.0)
 *
 * KEY INVARIANTS:
 * - `provenance` must accurately reflect how the analysis was produced
 * - `analysisConfidenceTier` summarises overall reliability
 * - `frameResults` is populated only for multi-frame video analysis
 * - All inferred mechanics must have ≥1 observationalEvidence item
 */
export const ReferenceAnalysisSchema = z.object({
  /** v2.0 adds observational grounding, confidence tier, and multi-frame support */
  schemaVersion: z.string().default('2.0'),
  category: GameCategorySchema,
  cameraPerspective: CameraPerspectiveSchema,
  visualStyle: z.string().min(1).max(120),
  colorPalette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(1).max(8),
  /** Directly observed objects/elements — factual, not inferred */
  visibleObjects: z.array(z.string().max(80)).max(15),
  terrainLayout: z.string().max(300),
  suggestedRoles: z.object({
    player: z.string().max(80).optional(),
    obstacles: z.array(z.string().max(80)).max(10).optional(),
    collectibles: z.array(z.string().max(80)).max(10).optional(),
    goals: z.array(z.string().max(80)).max(5).optional(),
  }),
  /** Mechanics are INFERENCES grounded in observations — never presented as fact */
  inferredMechanics: z.array(InferredMechanicSchema).max(8),
  /** Explicit unknowns, limitations, and boundary notes */
  uncertaintiesAndWarnings: z.array(z.string().max(300)).max(8),
  recommendedPipeline: TargetEngineSchema,
  provenance: AnalysisProvenanceSchema,
  modelProvenance: z.string().optional(),
  analyzedAt: z.string(),
  /** Phase 6.2: Overall confidence tier for this analysis */
  analysisConfidenceTier: AnalysisConfidenceTierSchema.default('medium'),
  /** Phase 6.2: Number of frames analysed (1 for single image) */
  frameCount: z.number().int().min(1).max(10).default(1),
  /** Phase 6.2: Per-frame detail, populated for multi-frame video analysis */
  frameResults: z.array(FrameAnalysisResultSchema).max(10).optional(),
});
export type ReferenceAnalysis = z.infer<typeof ReferenceAnalysisSchema>;

/**
 * Structured Game Generation Plan
 */
export const GameGenerationPlanSchema = z.object({
  id: z.string().min(1),
  referenceId: z.string().min(1),
  userPrompt: z.string().min(1).max(500),
  targetEngine: TargetEngineSchema,
  category: GameCategorySchema,
  requestedFeatures: z.array(z.string().max(100)).max(10),
  validatedSceneReference: z.string().optional(),
  missingRequirements: z.array(z.string().max(200)).max(10),
  limitationsAndWarnings: z.array(z.string().max(300)).max(10),
  status: PlanStatusSchema,
  createdAt: z.string(),
  suggested2DConfig: z
    .object({
      theme: z.enum(['default', 'forest', 'ice', 'lava', 'space', 'cyberpunk']),
      playerSpeed: z.number().int().min(100).max(450),
      playerJump: z.number().int().min(250).max(650),
      gravity: z.number().int().min(300).max(1200),
      platformCount: z.number().int().min(1).max(30),
      hazardTypes: z.array(z.string()).max(5),
      collectibleTypes: z.array(z.string()).max(5),
    })
    .optional(),
});
export type GameGenerationPlan = z.infer<typeof GameGenerationPlanSchema>;
