import { z } from 'zod';
export * from '../../src/types/reference.js';

export const UploadReferenceRequestSchema = z.object({
  dataBase64: z.string().min(10, 'Base64 image data is required'),
  filename: z.string().max(120).optional(),
  type: z.enum(['image', 'video-frame', 'sketch']).default('image'),
  userDescription: z.string().max(500).optional(),
  correlationId: z.string().optional(),
});
export type UploadReferenceRequest = z.infer<typeof UploadReferenceRequestSchema>;

export const AnalyzeReferenceRequestSchema = z.object({
  imageBase64: z.string().min(10, 'Base64 image data is required'),
  userPrompt: z.string().max(500).optional(),
  referenceId: z.string().optional(),
  mode: z.enum(['auto', 'gemini-only', 'hf-only', 'heuristic-only']).optional().default('auto'),
  allowFallback: z.boolean().optional().default(false),
  correlationId: z.string().optional(),
});
export type AnalyzeReferenceRequest = z.infer<typeof AnalyzeReferenceRequestSchema>;

/**
 * Phase 6.2: Multi-frame analysis — bounded to 5 frames to limit API cost.
 */
export const AnalyzeMultipleFramesRequestSchema = z.object({
  frameBase64s: z
    .array(z.string().min(10))
    .min(2, 'At least 2 frames are required for multi-frame analysis')
    .max(5, 'Maximum 5 frames per analysis request'),
  userPrompt: z.string().max(500).optional(),
  correlationId: z.string().optional(),
});
export type AnalyzeMultipleFramesRequest = z.infer<typeof AnalyzeMultipleFramesRequestSchema>;

export const GeneratePlanRequestSchema = z.object({
  referenceId: z.string().min(1),
  userPrompt: z.string().min(1).max(500),
  analysis: z.record(z.string(), z.any()), // Validated with ReferenceAnalysisSchema in route
  targetEngineOverride: z.enum(['phaser-2d', 'future-3d-engine', 'unsupported']).optional(),
  templateIdOverride: z.string().optional(),
});
export type GeneratePlanRequest = z.infer<typeof GeneratePlanRequestSchema>;
