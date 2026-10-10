/**
 * Semantic Element Types for Draw2Play levels
 */
export type SceneElementType = 'ground' | 'hazard' | 'trampoline' | 'coin' | 'goal';

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
}

/**
 * Complete structured sketch document for level serialization
 */
export interface SketchDocument {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  strokes: SketchStroke[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: '1.0';
}

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
}
