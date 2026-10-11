import { z } from 'zod';
export * from '../../src/types/sandbox.js';

/**
 * Server-side Request Schema with size and format bounds
 */
export const ServerRecognizeCraftRequestSchema = z.object({
  imageBase64: z
    .string()
    .min(50, 'Drawing image payload is too small or missing')
    .max(5 * 1024 * 1024, 'Drawing image payload exceeds maximum allowed size (5MB)'),
  strokeCount: z.number().int().nonnegative().optional(),
  allowFallback: z.boolean().default(true),
  clientTimestamp: z.string().optional(),
});
export type ServerRecognizeCraftRequest = z.infer<typeof ServerRecognizeCraftRequestSchema>;

/**
 * Schema for structured JSON output expected from Gemini Provider
 */
export const GeminiCraftRecognitionOutputSchema = z.object({
  detectedSubject: z.string().min(1).describe('The primary item or entity depicted in the sketch'),
  matchedCategory: z.enum([
    'wood',
    'stone',
    'dirt',
    'grass',
    'sand',
    'coal',
    'iron_ore',
    'wood_planks',
    'stick',
    'workbench',
    'torch',
    'stone_brick',
    'glass',
    'unsupported',
  ]).describe('The craftable sandbox category, or unsupported'),
  confidence: z.number().min(0).max(1).describe('Recognition confidence score between 0.0 and 1.0'),
  explanation: z.string().min(1).describe('Brief justification of the identified item and category'),
  alternativeSubjects: z.array(z.string()).default([]),
});
export type GeminiCraftRecognitionOutput = z.infer<typeof GeminiCraftRecognitionOutputSchema>;
