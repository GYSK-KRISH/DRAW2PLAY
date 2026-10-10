import { z } from 'zod';
export * from '../../src/types/reference.js';

export const UploadReferenceRequestSchema = z.object({
  dataBase64: z.string().min(10, 'Base64 image data is required'),
  filename: z.string().max(120).optional(),
  type: z.enum(['image', 'video-frame', 'sketch']).default('image'),
  userDescription: z.string().max(500).optional(),
});
export type UploadReferenceRequest = z.infer<typeof UploadReferenceRequestSchema>;

export const AnalyzeReferenceRequestSchema = z.object({
  imageBase64: z.string().min(10, 'Base64 image data is required'),
  userPrompt: z.string().max(500).optional(),
  referenceId: z.string().optional(),
});
export type AnalyzeReferenceRequest = z.infer<typeof AnalyzeReferenceRequestSchema>;

export const GeneratePlanRequestSchema = z.object({
  referenceId: z.string().min(1),
  userPrompt: z.string().min(1).max(500),
  analysis: z.record(z.string(), z.any()), // Validated with ReferenceAnalysisSchema in route
  targetEngineOverride: z.enum(['phaser-2d', 'future-3d-engine', 'unsupported']).optional(),
});
export type GeneratePlanRequest = z.infer<typeof GeneratePlanRequestSchema>;
