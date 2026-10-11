import { z } from 'zod';

/**
 * Master List of All Supported Sandbox Item IDs
 */
export const SANDBOX_ITEM_IDS = [
  // Primary natural blocks (Legacy & Base)
  'grass',
  'dirt',
  'stone',
  'wood',
  // Expanded natural materials
  'sand',
  'coal',
  'iron_ore',
  // Crafted progression items
  'wood_planks',
  'stick',
  'workbench',
  'torch',
  'stone_brick',
  'glass',
] as const;

export const SandboxItemIdSchema = z.enum(SANDBOX_ITEM_IDS);
export type SandboxItemId = z.infer<typeof SandboxItemIdSchema>;

/**
 * Placeable block types (excluding air and non-placeable materials like sticks)
 */
export const PLACEABLE_BLOCK_TYPES = [
  'grass',
  'dirt',
  'stone',
  'wood',
  'sand',
  'coal',
  'iron_ore',
  'wood_planks',
  'workbench',
  'torch',
  'stone_brick',
  'glass',
] as const;

export const PlaceableBlockTypeSchema = z.enum(PLACEABLE_BLOCK_TYPES);
export type PlaceableBlockType = z.infer<typeof PlaceableBlockTypeSchema>;

/**
 * Supported Sandbox Tile Types (air + all placeable blocks)
 */
export const SandboxTileTypeSchema = z.enum([
  'air',
  ...PLACEABLE_BLOCK_TYPES,
]);
export type SandboxTileType = z.infer<typeof SandboxTileTypeSchema>;

/**
 * Item Category classification
 */
export const SandboxItemCategorySchema = z.enum(['block', 'material', 'crafted']);
export type SandboxItemCategory = z.infer<typeof SandboxItemCategorySchema>;

/**
 * Comprehensive Item Definition in the Central Catalogue
 */
export interface SandboxItemDefinition {
  id: SandboxItemId;
  displayName: string;
  category: SandboxItemCategory;
  icon: string;
  description: string;
  keywords: string[];
  isPlaceable: boolean;
  isMinable: boolean;
  hardness: number; // Mining difficulty
  colorHex: string;
  maxStack: number;
}

/**
 * Physical and visual properties of each tile type in the sandbox world
 */
export interface TileDefinition {
  type: SandboxTileType;
  isSolid: boolean;
  hardness: number;
  colorHex: string;
  displayName: string;
}

/**
 * Central Catalogue of All Sandbox Items (Single Source of Truth)
 */
export const SANDBOX_ITEM_CATALOGUE: Record<SandboxItemId, SandboxItemDefinition> = {
  wood: {
    id: 'wood',
    displayName: 'Wood Log',
    category: 'block',
    icon: '🪵',
    description: 'Raw timber felled from forest trees. Primary material for planks, sticks, and construction.',
    keywords: ['wood', 'tree', 'log', 'timber', 'trunk', 'bark', 'lumber'],
    isPlaceable: true,
    isMinable: true,
    hardness: 2,
    colorHex: '#b45309',
    maxStack: 999,
  },
  stone: {
    id: 'stone',
    displayName: 'Stone Block',
    category: 'block',
    icon: '🪨',
    description: 'Durable stone cobble mined from bedrock, ideal for fortresses and chiseling into stone bricks.',
    keywords: ['stone', 'rock', 'boulder', 'cobblestone', 'granite', 'mountain'],
    isPlaceable: true,
    isMinable: true,
    hardness: 3,
    colorHex: '#64748b',
    maxStack: 999,
  },
  dirt: {
    id: 'dirt',
    displayName: 'Dirt Block',
    category: 'block',
    icon: '🟫',
    description: 'Basic fertile soil block for terraforming and ground leveling.',
    keywords: ['dirt', 'soil', 'mud', 'ground', 'earth', 'hill', 'mound'],
    isPlaceable: true,
    isMinable: true,
    hardness: 1,
    colorHex: '#854d0e',
    maxStack: 999,
  },
  grass: {
    id: 'grass',
    displayName: 'Grass Block',
    category: 'block',
    icon: '🟩',
    description: 'Natural topsoil covered with lush vegetation and wild greenery.',
    keywords: ['grass', 'turf', 'lawn', 'field', 'foliage', 'meadow', 'plant'],
    isPlaceable: true,
    isMinable: true,
    hardness: 1,
    colorHex: '#22c55e',
    maxStack: 999,
  },
  sand: {
    id: 'sand',
    displayName: 'Sand Block',
    category: 'block',
    icon: '🏖️',
    description: 'Fine granular silica found along coastlines and dunes. Can be smelted into glass.',
    keywords: ['sand', 'dune', 'beach', 'desert', 'silica', 'grain'],
    isPlaceable: true,
    isMinable: true,
    hardness: 1,
    colorHex: '#eab308',
    maxStack: 999,
  },
  coal: {
    id: 'coal',
    displayName: 'Coal',
    category: 'material',
    icon: '⚫',
    description: 'Combustible mineral mined underground, used as furnace fuel and for crafting torches.',
    keywords: ['coal', 'fuel', 'ore', 'carbon', 'lump', 'ember', 'soot'],
    isPlaceable: true,
    isMinable: true,
    hardness: 2,
    colorHex: '#1e293b',
    maxStack: 999,
  },
  iron_ore: {
    id: 'iron_ore',
    displayName: 'Iron Ore',
    category: 'block',
    icon: '⛏️',
    description: 'Raw metallic mineral veined deep within the subterranean stone stratum.',
    keywords: ['iron', 'ore', 'metal', 'mineral', 'vein', 'iron_ore', 'nugget'],
    isPlaceable: true,
    isMinable: true,
    hardness: 3,
    colorHex: '#94a3b8',
    maxStack: 999,
  },
  wood_planks: {
    id: 'wood_planks',
    displayName: 'Wooden Planks',
    category: 'crafted',
    icon: '📦',
    description: 'Refined carpentry timber milled from raw logs, used for building and crafting workbenches.',
    keywords: ['plank', 'planks', 'board', 'carpentry', 'wood_planks', 'timber'],
    isPlaceable: true,
    isMinable: true,
    hardness: 1.5,
    colorHex: '#d97706',
    maxStack: 999,
  },
  stick: {
    id: 'stick',
    displayName: 'Stick',
    category: 'material',
    icon: '🥢',
    description: 'Slender wooden branch whittled from planks. Essential crafting component for tools and torches.',
    keywords: ['stick', 'branch', 'rod', 'handle', 'twig', 'shaft'],
    isPlaceable: false, // Non-placeable crafting material
    isMinable: false,
    hardness: 0,
    colorHex: '#78350f',
    maxStack: 999,
  },
  workbench: {
    id: 'workbench',
    displayName: 'Workbench',
    category: 'crafted',
    icon: '🛠️',
    description: 'Master craftsman table for assembling advanced architectural blueprints and tools.',
    keywords: ['workbench', 'table', 'crafting', 'desk', 'tools', 'anvil', 'workshop'],
    isPlaceable: true,
    isMinable: true,
    hardness: 2,
    colorHex: '#0284c7',
    maxStack: 999,
  },
  torch: {
    id: 'torch',
    displayName: 'Torch',
    category: 'crafted',
    icon: '🔥',
    description: 'Portable firebrand mounted on a wooden stick, providing illumination and warmth.',
    keywords: ['torch', 'light', 'flame', 'fire', 'lantern', 'candle'],
    isPlaceable: true,
    isMinable: true,
    hardness: 0.5,
    colorHex: '#f59e0b',
    maxStack: 999,
  },
  stone_brick: {
    id: 'stone_brick',
    displayName: 'Stone Bricks',
    category: 'crafted',
    icon: '🧱',
    description: 'Square-cut masonry bricks chiselled from raw stone for sturdy castles and towers.',
    keywords: ['brick', 'bricks', 'stone_brick', 'masonry', 'castle', 'wall'],
    isPlaceable: true,
    isMinable: true,
    hardness: 3,
    colorHex: '#475569',
    maxStack: 999,
  },
  glass: {
    id: 'glass',
    displayName: 'Glass Block',
    category: 'crafted',
    icon: '🪟',
    description: 'Smooth, translucent silicate glass block for decorative windows and skylights.',
    keywords: ['glass', 'window', 'pane', 'crystal', 'transparent', 'silica'],
    isPlaceable: true,
    isMinable: true,
    hardness: 0.8,
    colorHex: '#38bdf8',
    maxStack: 999,
  },
};

/**
 * World Tile definitions map
 */
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
  sand: {
    type: 'sand',
    isSolid: true,
    hardness: 1,
    colorHex: '#eab308',
    displayName: 'Sand Block',
  },
  coal: {
    type: 'coal',
    isSolid: true,
    hardness: 2,
    colorHex: '#1e293b',
    displayName: 'Coal Ore',
  },
  iron_ore: {
    type: 'iron_ore',
    isSolid: true,
    hardness: 3,
    colorHex: '#94a3b8',
    displayName: 'Iron Ore',
  },
  wood_planks: {
    type: 'wood_planks',
    isSolid: true,
    hardness: 1.5,
    colorHex: '#d97706',
    displayName: 'Wooden Planks',
  },
  workbench: {
    type: 'workbench',
    isSolid: true,
    hardness: 2,
    colorHex: '#0284c7',
    displayName: 'Workbench',
  },
  torch: {
    type: 'torch',
    isSolid: true,
    hardness: 0.5,
    colorHex: '#f59e0b',
    displayName: 'Torch',
  },
  stone_brick: {
    type: 'stone_brick',
    isSolid: true,
    hardness: 3,
    colorHex: '#475569',
    displayName: 'Stone Bricks',
  },
  glass: {
    type: 'glass',
    isSolid: true,
    hardness: 0.8,
    colorHex: '#38bdf8',
    displayName: 'Glass Block',
  },
};

/**
 * Checks if a tile type is solid (blocks player movement and placement)
 */
export function isTileSolid(type: SandboxTileType): boolean {
  return TILE_DEFINITIONS[type]?.isSolid ?? false;
}

/**
 * Checks if an item ID can be placed as a tile in the world
 */
export function isItemPlaceable(itemId: unknown): itemId is PlaceableBlockType {
  return typeof itemId === 'string' && (PLACEABLE_BLOCK_TYPES as readonly string[]).includes(itemId);
}

/**
 * Validates whether an ID exists in the sandbox item catalogue
 */
export function isValidSandboxItem(id: unknown): id is SandboxItemId {
  return typeof id === 'string' && (SANDBOX_ITEM_IDS as readonly string[]).includes(id);
}

/**
 * Backwards compatibility aliases for Phase 7.1/7.2
 */
export const CRAFTABLE_ITEM_ALLOWLIST = SANDBOX_ITEM_IDS;
export const CraftableItemIdSchema = SandboxItemIdSchema;
export type CraftableItemId = SandboxItemId;
export type CraftableItemDefinition = SandboxItemDefinition;
export const CRAFTABLE_ITEMS_CATALOGUE = SANDBOX_ITEM_CATALOGUE;
export const isValidCraftableItem = isValidSandboxItem;

/**
 * Crafting Recipe Ingredient Schema
 */
export const CraftingIngredientSchema = z.object({
  itemId: SandboxItemIdSchema,
  count: z.number().int().positive(),
});
export type CraftingIngredient = z.infer<typeof CraftingIngredientSchema>;

/**
 * Deterministic Crafting Recipe Schema
 */
export const CraftingRecipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(['basic', 'building', 'tools', 'utility']),
  inputs: z.array(CraftingIngredientSchema).min(1),
  output: z.object({
    itemId: SandboxItemIdSchema,
    count: z.number().int().positive(),
  }),
  requiresWorkbench: z.boolean().default(false),
});
export type CraftingRecipe = z.infer<typeof CraftingRecipeSchema>;

/**
 * Inventory Counts Schema
 */
export const SandboxInventorySchema = z.object({
  items: z.record(z.string(), z.number().int().nonnegative()),
  selectedSlot: z.number().int().min(0).max(3).default(0),
  hotbar: z.array(PlaceableBlockTypeSchema).default(['grass', 'dirt', 'stone', 'wood']),
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
  hotbar: ['grass', 'dirt', 'stone', 'wood'],
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
 * Sandbox Save Record Schema (supports v1.0 and v2.0)
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
  schemaVersion: z.string().default('2.0'),
});
export type SandboxSaveData = z.infer<typeof SandboxSaveDataSchema>;

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
