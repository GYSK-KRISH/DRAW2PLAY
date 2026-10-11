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
 * Future Craft Recognition Result Contract (Phase 7.2 interface)
 */
export const CraftRecognitionResultSchema = z.object({
  predictedLabel: z.string().min(1),
  confidence: z.number().min(0).max(1),
  alternativeLabels: z
    .array(
      z.object({
        label: z.string(),
        confidence: z.number().min(0).max(1),
      })
    )
    .optional(),
  provenance: z.enum(['local-onnx', 'mock-heuristic', 'manual-input']),
  isEligibleForCrafting: z.boolean(),
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
    'craftable',
    'unrecognized',
    'insufficient-materials',
  ]),
  recognition: CraftRecognitionResultSchema.optional(),
});
export type CraftSubmission = z.infer<typeof CraftSubmissionSchema>;
