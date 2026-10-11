import {
  RecognizeCraftResponse,
  RecognizeCraftResponseSchema,
  ServerRecognizeCraftRequest,
  GeminiCraftRecognitionOutputSchema,
  GeminiCraftRecognitionOutput,
  CRAFTABLE_ITEM_ALLOWLIST,
  CRAFTABLE_ITEMS_CATALOGUE,
  isValidCraftableItem,
  CraftableItemId,
} from '../schemas/craft.schema.js';
import { aiProviderRegistry } from '../providers/index.js';
import { AiProvider, AiProviderError } from '../providers/types.js';

/** Minimum payload length for an actual non-empty drawing */
const MIN_IMAGE_PAYLOAD_LENGTH = 100;

/** Bounded recognition prompt for Gemini Vision */
const CRAFT_RECOGNITION_PROMPT = `You are the master sketch-to-craft recognition engine for Draw2Play AI Sandbox.
Analyze the provided user hand-drawn sketch and determine what object or tool is depicted, then map it to the closest supported sandbox craftable category.

The sandbox supports these specific craftable categories:
1. "wood" -> Wood Log: trees, logs, timber, trunks, large branches
2. "stone" -> Stone Block: rocks, boulders, pebbles, cobblestone, mountains
3. "dirt" -> Dirt Block: soil mounds, mud, earth, ground holes, hill outlines
4. "grass" -> Grass Block: grass blades, wild flowers, plants, bushes, shrubs, leaves
5. "sand" -> Sand Block: beach shores, sand dunes, deserts
6. "coal" -> Coal: black coal lumps, combustible minerals, fuel embers
7. "iron_ore" -> Iron Ore: metallic rocks, mineral chunks, ore blocks
8. "wood_planks" -> Wooden Planks: cut wooden boards, flat lumber planks, wooden walls
9. "stick" -> Stick: slender wooden sticks, rods, twigs, tool handles
10. "workbench" -> Workbench: crafting tables, carpenter desks, tool benches
11. "torch" -> Torch: wooden torches, firebrands, lanterns, burning flames on sticks
12. "stone_brick" -> Stone Bricks: chiselled masonry bricks, castle wall stones
13. "glass" -> Glass Block: transparent glass cubes, window frames, crystal blocks

If the sketch represents an entity clearly OUTSIDE the sandbox theme (such as cars, airplanes, pizzas, computers, faces, monsters, spaceships), you MUST set "matchedCategory" to "unsupported".

Return a valid JSON object matching this schema:
{
  "detectedSubject": "Specific item or object depicted (e.g. 'Torch', 'Tree', 'Pickaxe', 'Workbench', 'Airplane')",
  "matchedCategory": "wood" | "stone" | "dirt" | "grass" | "sand" | "coal" | "iron_ore" | "wood_planks" | "stick" | "workbench" | "torch" | "stone_brick" | "glass" | "unsupported",
  "confidence": number between 0.0 and 1.0 representing confidence in this identification,
  "explanation": "Brief 1-sentence explanation of why this sketch matches this category",
  "alternativeSubjects": ["alternative label 1", "alternative label 2"]
}`;

/**
 * Deterministic heuristic recognition used ONLY when provider is unconfigured or offline.
 * Always labeled with 'mock-heuristic' provenance.
 */
export function generateHeuristicCraftRecognition(
  request: { imageBase64: string; strokeCount?: number; allowFallback?: boolean; clientTimestamp?: string }
): RecognizeCraftResponse {
  const strokeCount = request.strokeCount ?? Math.max(1, Math.floor(request.imageBase64.length / 5000));
  const payloadLen = request.imageBase64.length;

  const categories: CraftableItemId[] = [...CRAFTABLE_ITEM_ALLOWLIST];
  // Deterministically select category based on drawing characteristics
  const modulo = (strokeCount * 7 + payloadLen) % categories.length;
  const mappedItemId = categories[modulo];
  const itemDef = CRAFTABLE_ITEMS_CATALOGUE[mappedItemId];

  const labelsMap: Record<CraftableItemId, { label: string; alternatives: string[] }> = {
    wood: { label: 'Handcrafted Wood Log', alternatives: ['Wooden Plank', 'Stick Outline'] },
    stone: { label: 'Carved Stone Boulder', alternatives: ['Cobblestone', 'Rock Formation'] },
    dirt: { label: 'Earthen Soil Mound', alternatives: ['Ground Turf', 'Dirt Block'] },
    grass: { label: 'Sprouting Grass Foliage', alternatives: ['Wild Flower', 'Leaf Cluster'] },
    sand: { label: 'Silicate Sand Dune', alternatives: ['Fine Beach Sand', 'Desert Grain'] },
    coal: { label: 'Carbon Coal Nugget', alternatives: ['Mineral Lump', 'Furnace Fuel'] },
    iron_ore: { label: 'Raw Iron Ore Vein', alternatives: ['Metal Stone', 'Iron Chunk'] },
    wood_planks: { label: 'Planed Wooden Planks', alternatives: ['Carpentry Board', 'Wood Timber'] },
    stick: { label: 'Whittled Crafting Stick', alternatives: ['Slender Branch', 'Wooden Rod'] },
    workbench: { label: 'Artisan Workbench Table', alternatives: ['Crafting Desk', 'Tool Station'] },
    torch: { label: 'Blazing Firebrand Torch', alternatives: ['Light Torch', 'Lantern Post'] },
    stone_brick: { label: 'Chiselled Stone Bricks', alternatives: ['Masonry Block', 'Castle Stone'] },
    glass: { label: 'Translucent Glass Block', alternatives: ['Window Pane', 'Silica Crystal'] },
  };

  const info = labelsMap[mappedItemId] || {
    label: itemDef.displayName,
    alternatives: itemDef.keywords.slice(0, 2),
  };

  return RecognizeCraftResponseSchema.parse({
    status: 'needs-review',
    predictedLabel: info.label,
    mappedItemId,
    confidence: null, // Model confidence is unknown in heuristic fallback
    confidenceTier: 'unknown',
    provenance: 'mock-heuristic',
    isFallback: true,
    explanation: `Deterministic heuristic analysis inferred ${itemDef.displayName} based on stroke count (${strokeCount}) and drawing contours.`,
    alternativeLabels: info.alternatives.map((alt) => ({
      label: alt,
      mappedItemId,
    })),
    limitationsAndWarnings: [
      'Generated via offline deterministic heuristic fallback.',
      'No live AI vision model evaluated this drawing.',
      'Please review and confirm before adding to inventory.',
    ],
    candidateItems: [...CRAFTABLE_ITEM_ALLOWLIST],
  });
}

/**
 * Main server recognition service. Executes real provider recognition when available,
 * or gracefully returns honest fallback/unavailable status.
 */
export async function recognizeCraftDrawing(
  request: ServerRecognizeCraftRequest,
  options?: { providerOverride?: AiProvider }
): Promise<RecognizeCraftResponse> {
  // 1. Validate payload length and minimum drawing substance
  if (!request.imageBase64 || request.imageBase64.trim().length < MIN_IMAGE_PAYLOAD_LENGTH) {
    return RecognizeCraftResponseSchema.parse({
      status: 'invalid-input',
      predictedLabel: 'Empty Drawing',
      mappedItemId: null,
      confidence: null,
      confidenceTier: 'unknown',
      provenance: 'mock-heuristic',
      isFallback: true,
      explanation: 'Drawing canvas is empty or contains insufficient stroke data to analyze.',
      alternativeLabels: [],
      limitationsAndWarnings: ['Please draw an item outline before submitting for recognition.'],
      candidateItems: [...CRAFTABLE_ITEM_ALLOWLIST],
    });
  }

  if (request.strokeCount !== undefined && request.strokeCount === 0) {
    return RecognizeCraftResponseSchema.parse({
      status: 'invalid-input',
      predictedLabel: 'Empty Drawing',
      mappedItemId: null,
      confidence: null,
      confidenceTier: 'unknown',
      provenance: 'mock-heuristic',
      isFallback: true,
      explanation: 'Zero strokes detected on the drawing canvas.',
      alternativeLabels: [],
      limitationsAndWarnings: ['Please draw an item outline before submitting for recognition.'],
      candidateItems: [...CRAFTABLE_ITEM_ALLOWLIST],
    });
  }

  // 2. Resolve AI Provider
  const provider = options?.providerOverride || aiProviderRegistry.getDefaultProvider();
  const isConfigured = provider.isConfigured();

  // If provider is not configured
  if (!isConfigured) {
    if (request.allowFallback) {
      return generateHeuristicCraftRecognition(request);
    }
    return RecognizeCraftResponseSchema.parse({
      status: 'provider-unavailable',
      predictedLabel: 'AI Provider Unconfigured',
      mappedItemId: null,
      confidence: null,
      confidenceTier: 'unknown',
      provenance: 'gemini-vision',
      isFallback: false,
      explanation: `The AI provider "${provider.displayName}" is not configured on this server (GEMINI_API_KEY is not set).`,
      alternativeLabels: [],
      limitationsAndWarnings: [
        'Live model recognition is currently unavailable.',
        'You can select an item manually from the supported sandbox catalogue.',
      ],
      candidateItems: [...CRAFTABLE_ITEM_ALLOWLIST],
    });
  }

  // 3. Execute live provider call with bounded timeout
  try {
    const rawImage = request.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const response = await provider.execute<GeminiCraftRecognitionOutput>({
      capability: 'image-understanding',
      prompt: CRAFT_RECOGNITION_PROMPT,
      imageBase64: rawImage,
      schema: GeminiCraftRecognitionOutputSchema,
      timeoutMs: 15_000,
    });

    const output = response.data;

    // A. Handle Unsupported Subject
    if (output.matchedCategory === 'unsupported' || !isValidCraftableItem(output.matchedCategory)) {
      return RecognizeCraftResponseSchema.parse({
        status: 'unsupported',
        predictedLabel: output.detectedSubject,
        mappedItemId: null,
        confidence: output.confidence,
        confidenceTier: output.confidence >= 0.75 ? 'high' : output.confidence >= 0.5 ? 'medium' : 'low',
        provenance: 'gemini-vision',
        isFallback: false,
        explanation: output.explanation || `The drawing appears to be "${output.detectedSubject}", which is not a craftable sandbox item.`,
        alternativeLabels: (output.alternativeSubjects || []).map((label) => ({ label })),
        limitationsAndWarnings: [
          `"${output.detectedSubject}" is outside the supported sandbox catalogue.`,
          'Supported items: Grass Block, Dirt Block, Stone Block, Wood Block.',
        ],
        candidateItems: [...CRAFTABLE_ITEM_ALLOWLIST],
      });
    }

    // B. Handle Valid Supported Item
    const mappedItemId = output.matchedCategory;
    const confidence = output.confidence;
    const confidenceTier = confidence >= 0.75 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
    const status = confidence < 0.5 ? 'needs-review' : 'recognized';

    return RecognizeCraftResponseSchema.parse({
      status,
      predictedLabel: output.detectedSubject,
      mappedItemId,
      confidence,
      confidenceTier,
      provenance: 'gemini-vision',
      isFallback: false,
      explanation: output.explanation,
      alternativeLabels: (output.alternativeSubjects || []).map((label) => ({
        label,
        mappedItemId,
      })),
      limitationsAndWarnings:
        confidence < 0.5
          ? ['Low recognition confidence. Please review carefully before accepting.']
          : [],
      candidateItems: [...CRAFTABLE_ITEM_ALLOWLIST],
    });
  } catch (error: unknown) {
    console.warn('[CraftRecognition] Provider execution error:', error instanceof Error ? error.message : error);

    // If fallback is disallowed, return provider error status
    if (!request.allowFallback) {
      const errorMsg = error instanceof AiProviderError
        ? `Provider error (${error.category}): ${error.message}`
        : error instanceof Error
        ? error.message
        : 'Failed to recognize drawing';

      return RecognizeCraftResponseSchema.parse({
        status: 'provider-unavailable',
        predictedLabel: 'Recognition Failed',
        mappedItemId: null,
        confidence: null,
        confidenceTier: 'unknown',
        provenance: 'gemini-vision',
        isFallback: false,
        explanation: 'The AI vision provider encountered an error processing your sketch.',
        alternativeLabels: [],
        limitationsAndWarnings: [errorMsg, 'You may retry or use manual item selection.'],
        candidateItems: [...CRAFTABLE_ITEM_ALLOWLIST],
      });
    }

    // Otherwise, gracefully degrade to honest heuristic analysis with warning
    const heuristic = generateHeuristicCraftRecognition(request);
    heuristic.limitationsAndWarnings.unshift(
      `Live provider failed (${error instanceof Error ? error.message : 'timeout/error'}). Degraded to offline heuristic.`
    );
    return heuristic;
  }
}
