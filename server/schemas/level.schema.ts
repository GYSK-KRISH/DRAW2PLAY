import { z } from 'zod';

export const GeminiLevelAnalysisOutputSchema = z.object({
  levelName: z.string().min(1).describe('Creative theme-based name for this drawn level'),
  levelDescription: z.string().describe('Short 1-2 sentence description of the level atmosphere and challenge'),
  difficultyRating: z.enum(['easy', 'medium', 'hard']).default('medium'),
  visualStyle: z.string().describe('Visual aesthetic observed in the sketch, e.g., neon synthwave, rugged caverns, alien platformer'),
  playerTuning: z.object({
    speed: z.number().int().min(120).max(350).default(220),
    jumpPower: z.number().int().min(250).max(550).default(400),
    gravity: z.number().int().min(400).max(1100).default(750),
  }).default({
    speed: 220,
    jumpPower: 400,
    gravity: 750,
  }),
  recognizedElements: z.array(z.string()).default([]),
  designFeedback: z.string().describe('Game designer feedback on platform spacing, hazard positioning, and jump flow'),
});

export type GeminiLevelAnalysisOutput = z.infer<typeof GeminiLevelAnalysisOutputSchema>;
