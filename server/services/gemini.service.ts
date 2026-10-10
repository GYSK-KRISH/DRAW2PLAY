import { GoogleGenAI } from '@google/genai';
import { serverConfig } from '../config.js';
import { CharacterAnalysisOutput, CharacterAnalysisOutputSchema } from '../schemas/character.schema.js';

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
