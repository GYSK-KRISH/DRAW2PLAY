import { z } from 'zod';

/**
 * Character Attributes determined by Image-AI analysis
 */
export const CharacterAttributesSchema = z.object({
  name: z.string().min(1).default('Sketch Hero'),
  archetype: z.enum(['speedster', 'brawler', 'tank', 'mystic', 'balanced']).default('balanced'),
  speed: z.number().min(50).max(400).default(200),
  jumpPower: z.number().min(200).max(600).default(380),
  gravity: z.number().min(300).max(1200).default(800),
  health: z.number().min(1).max(200).default(100),
  colorPalette: z.array(z.string()).default(['#3b82f6', '#1d4ed8']),
  visualDescription: z.string().default('A hand-drawn hero brought to life.'),
  detectedFeatures: z.array(z.string()).default([]),
});

export type CharacterAttributes = z.infer<typeof CharacterAttributesSchema>;

/**
 * Complete Character Configuration in the game engine
 */
export interface CharacterConfig {
  id: string;
  attributes: CharacterAttributes;
  drawingDataUrl: string; // Base64 PNG drawn by user
  createdAt: string;
}

/**
 * Analysis Request sent from Canvas to Backend
 */
export const AnalyzeCharacterRequestSchema = z.object({
  imageBase64: z.string().min(1, 'Image data is required'),
  promptOverride: z.string().optional(),
});

export type AnalyzeCharacterRequest = z.infer<typeof AnalyzeCharacterRequestSchema>;

/**
 * Analysis Response returned by Backend
 */
export interface AnalyzeCharacterResponse {
  success: boolean;
  source: 'gemini' | 'mock-heuristic';
  attributes: CharacterAttributes;
  error?: string;
}

/**
 * Journey Steps matching the Hackathon specification
 */
export type JourneyStep = 'draw' | 'analyze' | 'transform' | 'play' | 'customize';
