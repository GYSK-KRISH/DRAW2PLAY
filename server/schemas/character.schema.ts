import { z } from 'zod';

export const CharacterAnalysisOutputSchema = z.object({
  name: z.string().describe('Fun, creative name for this drawn character based on its look'),
  archetype: z.enum(['speedster', 'brawler', 'tank', 'mystic', 'balanced'])
    .describe('Game archetype based on visual shape: thin/pointy -> speedster, bulky/round -> tank, spiked/muscular -> brawler, ethereal/star -> mystic'),
  speed: z.number().int().min(100).max(350).describe('Movement speed between 100 (heavy) and 350 (fast)'),
  jumpPower: z.number().int().min(250).max(550).describe('Jump impulse velocity between 250 (low jump) and 550 (high leap)'),
  gravity: z.number().int().min(400).max(1000).describe('Gravity force pulling character down'),
  health: z.number().int().min(50).max(200).describe('Starting health points'),
  colorPalette: z.array(z.string()).min(1).max(5).describe('Dominant hex colors identified in the sketch'),
  visualDescription: z.string().describe('A 1-2 sentence lively summary of what makes this character unique'),
  detectedFeatures: z.array(z.string()).describe('Identified visual elements, e.g. horns, wings, cape, sword, wheels, eyes'),
});

export type CharacterAnalysisOutput = z.infer<typeof CharacterAnalysisOutputSchema>;
