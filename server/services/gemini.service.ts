import { GoogleGenAI } from '@google/genai';
import { serverConfig } from '../config.js';
import { CharacterAnalysisOutput, CharacterAnalysisOutputSchema } from '../schemas/character.schema.js';
import { GeminiLevelAnalysisOutput, GeminiLevelAnalysisOutputSchema } from '../schemas/level.schema.js';

let genAIClient: GoogleGenAI | null = null;

export function getGenAIClient(): GoogleGenAI | null {
  if (!serverConfig.geminiApiKey) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey: serverConfig.geminiApiKey });
  }
  return genAIClient;
}

export async function analyzeCharacterWithGemini(
  imageBase64: string,
  promptOverride?: string
): Promise<CharacterAnalysisOutput> {
  const client = getGenAIClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  // Strip prefix data URL if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

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

  const response = await client.models.generateContent({
    model: serverConfig.geminiModel,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data,
            },
          },
        ],
      },
    ],
  });

  const responseText = response.text || '';
  const cleaned = responseText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return CharacterAnalysisOutputSchema.parse(parsed);
}

export async function analyzeLevelWithGemini(
  imageBase64: string,
  strokeMetadataSummary?: string
): Promise<GeminiLevelAnalysisOutput> {
  const client = getGenAIClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

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

  const response = await client.models.generateContent({
    model: serverConfig.geminiModel,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data,
            },
          },
        ],
      },
    ],
  });

  const responseText = response.text || '';
  const cleaned = responseText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return GeminiLevelAnalysisOutputSchema.parse(parsed);
}
