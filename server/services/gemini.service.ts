import { z } from 'zod';
import type { GoogleGenAI } from '@google/genai';
import { aiProviderRegistry } from '../providers/index.js';
import type { GeminiProvider } from '../providers/gemini.provider.js';
import { CharacterAnalysisOutput, CharacterAnalysisOutputSchema } from '../schemas/character.schema.js';
import { GeminiLevelAnalysisOutput, GeminiLevelAnalysisOutputSchema } from '../schemas/level.schema.js';
import {
  TransformationOperationSchema,
  type TransformationOperation,
} from '../schemas/transformation.schema.js';
import type { PlayableGameScene } from '../../src/types/scene.js';

/**
 * Backward compatibility helper to retrieve underlying client if needed.
 */
export function getGenAIClient(): GoogleGenAI | null {
  const provider = aiProviderRegistry.getProvider('gemini') as GeminiProvider | undefined;
  if (!provider || !provider.isConfigured()) {
    return null;
  }
  try {
    return provider.getClient() as unknown as GoogleGenAI;
  } catch {
    return null;
  }
}

/**
 * Analyze character sketch using Gemini adapter via provider registry.
 */
export async function analyzeCharacterWithGemini(
  imageBase64: string,
  promptOverride?: string
): Promise<CharacterAnalysisOutput> {
  const provider = aiProviderRegistry.getProviderForCapability('image-understanding', 'gemini');
  if (!provider.isConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const prompt = promptOverride || `You are an expert game designer analyzing a player-drawn character sketch for a 2D action-platformer game.
Carefully inspect the visual characteristics of this drawing:
1. Is it heavy, bulky, nimble, sharp, spiked, smooth, or rounded?
2. What are the dominant colors?
3. What accessories or limbs does it have (wings, boots, eyes, horns, weapons)?

Extract game attributes and return STRICT JSON conforming to this schema:
{
  "name": "Creative name reflecting visual style (string)",
  "archetype": "speedster" | "brawler" | "tank" | "mystic" | "balanced",
  "speed": integer between 100 and 350,
  "jumpPower": integer between 250 and 550,
  "gravity": integer between 400 and 1000,
  "health": integer between 50 and 200,
  "colorPalette": ["#hex1", "#hex2"],
  "visualDescription": "1-2 sentence lively summary of what makes this character unique",
  "detectedFeatures": ["list", "of", "visual", "elements"]
}
Output raw JSON only without markdown formatting.`;

  const result = await provider.execute({
    capability: 'image-understanding',
    prompt,
    imageBase64,
    schema: CharacterAnalysisOutputSchema,
  });

  return result.data;
}

/**
 * Analyze level sketch using Gemini adapter via provider registry.
 */
export async function analyzeLevelWithGemini(
  imageBase64: string,
  strokeMetadataSummary?: string
): Promise<GeminiLevelAnalysisOutput> {
  const provider = aiProviderRegistry.getProviderForCapability('image-understanding', 'gemini');
  if (!provider.isConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const prompt = `You are a creative level designer and game architect analyzing a player's hand-drawn 2D physics level sketch for Draw2Play.
The sketch contains semantic game elements drawn with colors:
- Ground: platforms & terrain (green)
- Hazard: spikes & dangerous zones (red)
- Trampoline: high-bounce springboards (cyan)
- Coin: collectible bonus items (gold/yellow)
- Goal: destination flag/portal (purple)
${strokeMetadataSummary ? `Drawn Vector Context: ${strokeMetadataSummary}` : ''}

Inspect the visual level design and respond with STRICT JSON conforming to this schema:
{
  "levelName": "A catchy, imaginative title for this level (string)",
  "levelDescription": "1-2 sentence atmospheric summary of the level's gameplay and vibe (string)",
  "difficultyRating": "easy" | "medium" | "hard",
  "visualStyle": "Visual aesthetic observed in the doodle, e.g. Neon Cavern, Skyward Peaks, Cyber Ruins",
  "playerTuning": {
    "speed": integer between 120 and 350 (ideal hero movement speed for this layout),
    "jumpPower": integer between 250 and 550 (ideal jump velocity to clear platforms),
    "gravity": integer between 400 and 1100 (ideal gravity)
  },
  "recognizedElements": ["list of recognized features in the sketch"],
  "designFeedback": "Constructive 1-2 sentence advice from a level designer about platform spacing, jumps, and hazard danger"
}
Output raw JSON only without markdown formatting.`;

  const result = await provider.execute({
    capability: 'image-understanding',
    prompt,
    imageBase64,
    schema: GeminiLevelAnalysisOutputSchema,
  });

  return result.data;
}

export interface GeminiTransformationOutput {
  operations: TransformationOperation[];
  explanation: string;
  warnings: string[];
}

/**
 * Transform level with natural language prompt using Gemini adapter via provider registry.
 */
export async function transformLevelWithGemini(
  scene: PlayableGameScene,
  instruction: string
): Promise<GeminiTransformationOutput> {
  const provider = aiProviderRegistry.getProviderForCapability('text-generation', 'gemini');
  if (!provider.isConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const prompt = `You are a creative 2D physics game level designer for Draw2Play AI.
The user wants to transform their existing 2D platformer level based on this natural language instruction:
"${instruction}"

Current Scene Context:
- Theme: ${scene.world.theme}
- Gravity: ${scene.world.gravity}
- Friction: ${scene.world.friction}
- Player Speed: ${scene.player.speed}
- Player Jump: ${scene.player.jumpPower}
- Platforms: ${scene.platforms.length}
- Coins: ${scene.coins.length}
- Hazards: ${scene.hazards.length}

Choose applicable transformation operations to fulfill the request. Return STRICT JSON conforming to this schema:
{
  "operations": [
    { "type": "set_theme", "theme": "default" | "forest" | "ice" | "lava" | "space" | "cyberpunk" },
    { "type": "set_difficulty", "difficulty": "easy" | "normal" | "hard" },
    { "type": "adjust_physics", "gravity": number between 200 and 2000, "friction": number between 0.01 and 1.0 },
    { "type": "add_coins", "count": integer between 1 and 20 },
    { "type": "adjust_coin_density", "multiplier": number between 0.2 and 3.0 },
    { "type": "add_hazards", "count": integer between 1 and 15, "hazardType": "spike" | "lava" },
    { "type": "adjust_hazard_density", "multiplier": number between 0.0 and 3.0 },
    { "type": "adjust_player_jump", "jumpPower": integer between 200 and 700, "multiplier": number between 0.5 and 2.0 },
    { "type": "adjust_player_speed", "speed": integer between 80 and 500, "multiplier": number between 0.5 and 2.0 },
    { "type": "set_environment_effects", "effect": "none" | "snow" | "embers" | "stardust" | "sparks" | "leaves" }
  ],
  "explanation": "1-2 sentence lively summary of how the level was transformed to fulfill the user's vision",
  "warnings": ["any constraint warnings, or empty array if none"]
}
Output raw JSON only without markdown formatting.`;

  const TransformationOutputSchema = z.object({
    operations: z.array(TransformationOperationSchema),
    explanation: z.string(),
    warnings: z.array(z.string()).default([]),
  });

  const result = await provider.execute({
    capability: 'text-generation',
    prompt,
    schema: TransformationOutputSchema,
  });

  return result.data;
}
