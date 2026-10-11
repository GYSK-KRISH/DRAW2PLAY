import { z } from 'zod';

/**
 * Supported Sandbox Tile Types
 */
export const SandboxTileTypeSchema = z.enum([
  'air',
  'grass',
  'dirt',
  'stone',
  'wood',
]);
export type SandboxTileType = z.infer<typeof SandboxTileTypeSchema>;

/**
 * Placeable block types (excluding air)
 */
export const PlaceableBlockTypeSchema = z.enum([
  'grass',
  'dirt',
  'stone',
  'wood',
]);
export type PlaceableBlockType = z.infer<typeof PlaceableBlockTypeSchema>;

/**
 * Physical and visual properties of each tile type
 */
export interface TileDefinition {
  type: SandboxTileType;
  isSolid: boolean;
  hardness: number; // Mining difficulty
  colorHex: string;
  displayName: string;
}

export const TILE_DEFINITIONS: Record<SandboxTileType, TileDefinition> = {
  air: {
    type: 'air',
    isSolid: false,
    hardness: 0,
    colorHex: '#0f172a',
    displayName: 'Air',
  },
  grass: {
    type: 'grass',
    isSolid: true,
    hardness: 1,
    colorHex: '#22c55e',
    displayName: 'Grass Block',
  },
  dirt: {
    type: 'dirt',
    isSolid: true,
    hardness: 1,
    colorHex: '#854d0e',
    displayName: 'Dirt Block',
  },
  stone: {
    type: 'stone',
    isSolid: true,
    hardness: 3,
    colorHex: '#64748b',
    displayName: 'Stone Block',
  },
  wood: {
    type: 'wood',
    isSolid: true,
    hardness: 2,
    colorHex: '#b45309',
    displayName: 'Wood Log',
  },
};

/**
 * Checks if a tile type is solid (blocks player movement and placement)
 */
export function isTileSolid(type: SandboxTileType): boolean {
  return TILE_DEFINITIONS[type]?.isSolid ?? false;
}

/**
 * Inventory Counts Schema
 */
export const SandboxInventorySchema = z.object({
  items: z.record(PlaceableBlockTypeSchema, z.number().int().nonnegative()),
  selectedSlot: z.number().int().min(0).max(3).default(0),
});
export type SandboxInventory = z.infer<typeof SandboxInventorySchema>;

/**
 * Default starter inventory
 */
export const DEFAULT_SANDBOX_INVENTORY: SandboxInventory = {
  items: {
    grass: 10,
    dirt: 15,
    stone: 5,
    wood: 8,
  },
  selectedSlot: 0,
};

/**
 * Order of hotbar items
 */
export const HOTBAR_BLOCK_ORDER: PlaceableBlockType[] = [
  'grass',
  'dirt',
  'stone',
  'wood',
];

/**
 * World representation schema
 */
export const SandboxWorldDataSchema = z.object({
  cols: z.number().int().positive().max(256),
  rows: z.number().int().positive().max(128),
  tileSize: z.number().int().positive().default(32),
  tiles: z.array(z.array(SandboxTileTypeSchema)),
  spawnPoint: z.object({
    x: z.number(),
    y: z.number(),
  }),
});
export type SandboxWorldData = z.infer<typeof SandboxWorldDataSchema>;

/**
 * Sandbox Save Record Schema
 */
export const SandboxSaveDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).default('Sandbox World'),
  createdAt: z.string(),
  updatedAt: z.string(),
  world: SandboxWorldDataSchema,
  player: z.object({
    x: z.number(),
    y: z.number(),
    inventory: SandboxInventorySchema,
  }),
  schemaVersion: z.literal('1.0').default('1.0'),
});
export type SandboxSaveData = z.infer<typeof SandboxSaveDataSchema>;

/**
 * Finite allowlist of craftable sandbox item IDs
 */
export const CRAFTABLE_ITEM_ALLOWLIST = ['grass', 'dirt', 'stone', 'wood'] as const;
export const CraftableItemIdSchema = z.enum(CRAFTABLE_ITEM_ALLOWLIST);
export type CraftableItemId = z.infer<typeof CraftableItemIdSchema>;

/**
 * Metadata definition for each craftable sandbox item
 */
export interface CraftableItemDefinition {
  id: CraftableItemId;
  displayName: string;
  category: 'block' | 'material';
  icon: string;
  description: string;
  keywords: string[];
}

export const CRAFTABLE_ITEMS_CATALOGUE: Record<CraftableItemId, CraftableItemDefinition> = {
  wood: {
    id: 'wood',
    displayName: 'Wood Block',
    category: 'block',
    icon: '🪵',
    description: 'Sturdy wooden log or timber for constructing walls, frames, and shelter.',
    keywords: ['wood', 'tree', 'log', 'stick', 'plank', 'pickaxe', 'axe', 'sword', 'hammer', 'bench', 'torch', 'timber'],
  },
  stone: {
    id: 'stone',
    displayName: 'Stone Block',
    category: 'block',
    icon: '🪨',
    description: 'Durable stone cobble mined from bedrock, ideal for fortresses and pillars.',
    keywords: ['stone', 'rock', 'boulder', 'cobblestone', 'anvil', 'mountain', 'brick', 'castle'],
  },
  dirt: {
    id: 'dirt',
    displayName: 'Dirt Block',
    category: 'block',
    icon: '🟫',
    description: 'Basic fertile soil block for terraforming and ground leveling.',
    keywords: ['dirt', 'soil', 'mud', 'ground', 'earth', 'shovel', 'hill', 'mound'],
  },
  grass: {
    id: 'grass',
    displayName: 'Grass Block',
    category: 'block',
    icon: '🟩',
    description: 'Natural topsoil covered with lush vegetation and wild greenery.',
    keywords: ['grass', 'flower', 'plant', 'leaf', 'bush', 'shrub', 'lawn', 'garden'],
  },
};

/**
 * Validates whether an ID is an allowlisted craftable sandbox item
 */
export function isValidCraftableItem(id: unknown): id is CraftableItemId {
  return typeof id === 'string' && CRAFTABLE_ITEM_ALLOWLIST.includes(id as CraftableItemId);
}

/**
 * Discriminated recognition status for sketch recognition
 */
export const CraftRecognitionStatusSchema = z.enum([
  'recognized',
  'needs-review',
  'unsupported',
  'provider-unavailable',
  'invalid-input',
]);
export type CraftRecognitionStatus = z.infer<typeof CraftRecognitionStatusSchema>;

/**
 * Provenance of recognition result
 */
export const CraftRecognitionProvenanceSchema = z.enum([
  'gemini-vision',
  'mock-heuristic',
  'manual-input',
]);
export type CraftRecognitionProvenance = z.infer<typeof CraftRecognitionProvenanceSchema>;

/**
 * Model confidence classification tier
 */
export const ConfidenceTierSchema = z.enum([
  'high',
  'medium',
  'low',
  'unknown',
]);
export type ConfidenceTier = z.infer<typeof ConfidenceTierSchema>;

/**
 * Request payload for sketch recognition
 */
export const RecognizeCraftRequestSchema = z.object({
  imageBase64: z.string().min(1, 'Drawing image payload is required'),
  strokeCount: z.number().int().nonnegative().optional(),
  allowFallback: z.boolean().default(true),
  clientTimestamp: z.string().optional(),
});
export type RecognizeCraftRequest = z.infer<typeof RecognizeCraftRequestSchema>;

/**
 * Full server response for sketch recognition
 */
export const RecognizeCraftResponseSchema = z.object({
  status: CraftRecognitionStatusSchema,
  predictedLabel: z.string(),
  mappedItemId: CraftableItemIdSchema.nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  confidenceTier: ConfidenceTierSchema,
  provenance: CraftRecognitionProvenanceSchema,
  isFallback: z.boolean(),
  explanation: z.string(),
  alternativeLabels: z
    .array(
      z.object({
        label: z.string(),
        confidence: z.number().min(0).max(1).optional(),
        mappedItemId: CraftableItemIdSchema.nullable().optional(),
      })
    )
    .default([]),
  limitationsAndWarnings: z.array(z.string()).default([]),
  candidateItems: z.array(z.string()).default(() => [...CRAFTABLE_ITEM_ALLOWLIST]),
});
export type RecognizeCraftResponse = z.infer<typeof RecognizeCraftResponseSchema>;

/**
 * Craft Recognition Result Contract
 */
export const CraftRecognitionResultSchema = z.object({
  predictedLabel: z.string().min(1),
  mappedItemId: CraftableItemIdSchema.nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  confidenceTier: ConfidenceTierSchema.optional(),
  alternativeLabels: z
    .array(
      z.object({
        label: z.string(),
        confidence: z.number().min(0).max(1).optional(),
        mappedItemId: CraftableItemIdSchema.nullable().optional(),
      })
    )
    .optional(),
  provenance: CraftRecognitionProvenanceSchema,
  isEligibleForCrafting: z.boolean(),
  explanation: z.string().optional(),
  notes: z.string().optional(),
  requiredIngredients: z
    .array(
      z.object({
        tileType: PlaceableBlockTypeSchema,
        count: z.number().int().positive(),
      })
    )
    .optional(),
  resultingItem: z
    .object({
      id: z.string(),
      displayName: z.string(),
      icon: z.string(),
      type: z.enum(['tool', 'block', 'item']),
    })
    .optional(),
});
export type CraftRecognitionResult = z.infer<typeof CraftRecognitionResultSchema>;

/**
 * Drawing Submission Record for Draw-to-Craft Modal
 */
export const CraftSubmissionSchema = z.object({
  id: z.string().min(1),
  strokesCount: z.number().int().nonnegative(),
  submittedAt: z.string(),
  thumbnailDataUrl: z.string().optional(),
  status: z.enum([
    'submitted-pending-recognition',
    'recognized',
    'needs-review',
    'accepted-awarded',
    'rejected',
    'unsupported',
    'provider-unavailable',
    'invalid-input',
  ]),
  recognition: CraftRecognitionResultSchema.optional(),
  awardedItemId: CraftableItemIdSchema.optional(),
  awardedAt: z.string().optional(),
});
export type CraftSubmission = z.infer<typeof CraftSubmissionSchema>;
