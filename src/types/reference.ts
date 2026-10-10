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
 * Inferred Game Mechanic with Observation Grounding
 */
export const InferredMechanicSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().min(1).max(250),
  confidence: z.number().min(0).max(1),
  supportingObservations: z.array(z.string().max(150)).max(5),
});
export type InferredMechanic = z.infer<typeof InferredMechanicSchema>;

/**
 * Structured Visual Reference Analysis
 */
export const ReferenceAnalysisSchema = z.object({
  schemaVersion: z.string().default('1.0'),
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
  analyzedAt: z.string(),
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
