import { z } from 'zod';

/**
 * Semantic Element Types for Draw2Play levels
 */
export type SceneElementType = 'ground' | 'hazard' | 'trampoline' | 'coin' | 'goal';

export const SceneElementTypeSchema = z.enum(['ground', 'hazard', 'trampoline', 'coin', 'goal']);

/**
 * Visual metadata and physical meaning for each element type
 */
export interface ElementTypeDefinition {
  type: SceneElementType;
  label: string;
  color: string;
  secondaryColor: string;
  description: string;
  physicsRole: string;
  defaultWidth: number;
}

export const ELEMENT_DEFINITIONS: Record<SceneElementType, ElementTypeDefinition> = {
  ground: {
    type: 'ground',
    label: 'Ground',
    color: '#10b981', // Emerald green
    secondaryColor: '#059669',
    description: 'Solid terrain & walkable platforms',
    physicsRole: 'Static solid collider',
    defaultWidth: 10,
  },
  hazard: {
    type: 'hazard',
    label: 'Hazard',
    color: '#ef4444', // Crimson red
    secondaryColor: '#dc2626',
    description: 'Spikes & danger zones',
    physicsRole: 'Lethal hazard trigger',
    defaultWidth: 8,
  },
  trampoline: {
    type: 'trampoline',
    label: 'Trampoline',
    color: '#06b6d4', // Cyan
    secondaryColor: '#0891b2',
    description: 'High-bounce pads & springboards',
    physicsRole: 'High restitution bouncy surface',
    defaultWidth: 12,
  },
  coin: {
    type: 'coin',
    label: 'Coin',
    color: '#eab308', // Electric gold
    secondaryColor: '#ca8a04',
    description: 'Collectible reward items',
    physicsRole: 'Collectible trigger item',
    defaultWidth: 14,
  },
  goal: {
    type: 'goal',
    label: 'Goal',
    color: '#a855f7', // Portal purple
    secondaryColor: '#9333ea',
    description: 'Level destination & win portal',
    physicsRole: 'Victory zone trigger',
    defaultWidth: 16,
  },
};

/**
 * Normalized point in range [0, 1] relative to canvas dimensions
 */
export interface NormalizedPoint {
  x: number;
  y: number;
  pressure?: number;
}

export const NormalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  pressure: z.number().optional(),
});

/**
 * Normalized Axis-Aligned Bounding Box in range [0, 1]
 */
export interface BoundingBox {
  x: number;      // minX [0, 1]
  y: number;      // minY [0, 1]
  width: number;  // width [0, 1]
  height: number; // height [0, 1]
}

export const BoundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

/**
 * Deterministically extracted geometric features from a stroke
 */
export interface ExtractedSceneElement {
  strokeId: string;
  elementType: SceneElementType;
  bounds: BoundingBox;
  centroid: NormalizedPoint;
  length: number;
  pointCount: number;
  points: NormalizedPoint[];
}

export const ExtractedSceneElementSchema = z.object({
  strokeId: z.string(),
  elementType: SceneElementTypeSchema,
  bounds: BoundingBoxSchema,
  centroid: NormalizedPointSchema,
  length: z.number().min(0),
  pointCount: z.number().int().min(1),
  points: z.array(NormalizedPointSchema),
});

/**
 * A discrete drawn stroke containing normalized coordinates and semantic attributes
 */
export interface SketchStroke {
  id: string;
  elementType: SceneElementType;
  color: string;
  width: number; // width in canvas logical pixels
  points: NormalizedPoint[];
  timestamp: number;
  order?: number;
}

export const SketchStrokeSchema = z.object({
  id: z.string(),
  elementType: SceneElementTypeSchema,
  color: z.string(),
  width: z.number().positive(),
  points: z.array(NormalizedPointSchema),
  timestamp: z.number(),
  order: z.number().optional(),
});

/**
 * Complete structured sketch document for level serialization
 */
export interface SketchDocument {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  coordinateConvention: 'normalized-unit';
  strokes: SketchStroke[];
  extractedElements?: ExtractedSceneElement[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: '1.0';
}

export const SketchDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  canvasWidth: z.number().positive(),
  canvasHeight: z.number().positive(),
  coordinateConvention: z.literal('normalized-unit').default('normalized-unit'),
  strokes: z.array(SketchStrokeSchema),
  extractedElements: z.array(ExtractedSceneElementSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.literal('1.0'),
});

/**
 * Active interactive drawing tools
 */
export type CanvasTool = 'brush' | 'eraser' | 'select';

/**
 * Real-time deterministic statistics computed from active strokes
 */
export interface SceneSummary {
  totalStrokes: number;
  totalPoints: number;
  elementCounts: Record<SceneElementType, number>;
  hasGround: boolean;
  hasGoal: boolean;
  hasHazards: boolean;
  hasCoins: boolean;
  hasTrampolines: boolean;
  estimatedMemoryBytes: number;
  extractedElementCount?: number;
}

/**
 * Image preprocessing options for future AI ingestion
 */
export interface PreprocessOptions {
  backgroundColor?: 'white' | 'transparent' | string;
  maxDimension?: number;
}
