import assert from 'node:assert';
import {
  clamp01,
  validateNormalizedPoint,
  calculateSceneSummary,
  exportSketchToJson,
} from '../src/utils/sketchSerializer.js';
import type { SketchStroke, SketchDocument } from '../src/types/sketch.js';
import { ELEMENT_DEFINITIONS } from '../src/types/sketch.js';

console.log('🧪 Starting Draw2Play Phase 2 Sketch Canvas Test Suite...\n');

// Test 1: Normalized coordinate clamping and validation
console.log('▶ Test 1: Coordinate normalization & clamping');
assert.strictEqual(clamp01(-0.5), 0);
assert.strictEqual(clamp01(1.5), 1);
assert.strictEqual(clamp01(0.42), 0.42);

assert.strictEqual(validateNormalizedPoint({ x: 0.25, y: 0.75 }), true);
assert.strictEqual(validateNormalizedPoint({ x: -0.1, y: 0.5 }), false);
assert.strictEqual(validateNormalizedPoint({ x: 0.5, y: 1.1 }), false);
console.log('  ✓ Normalization logic passed');

// Test 2: Semantic Element Definitions
console.log('▶ Test 2: Element definitions structure');
assert.ok(ELEMENT_DEFINITIONS.ground.color.startsWith('#'));
assert.ok(ELEMENT_DEFINITIONS.hazard.color.startsWith('#'));
assert.ok(ELEMENT_DEFINITIONS.trampoline.color.startsWith('#'));
assert.ok(ELEMENT_DEFINITIONS.coin.color.startsWith('#'));
assert.ok(ELEMENT_DEFINITIONS.goal.color.startsWith('#'));
assert.strictEqual(ELEMENT_DEFINITIONS.ground.label, 'Ground');
assert.strictEqual(ELEMENT_DEFINITIONS.hazard.label, 'Hazard');
assert.strictEqual(ELEMENT_DEFINITIONS.trampoline.label, 'Trampoline');
assert.strictEqual(ELEMENT_DEFINITIONS.coin.label, 'Coin');
assert.strictEqual(ELEMENT_DEFINITIONS.goal.label, 'Goal');
console.log('  ✓ Semantic element definitions passed');

// Test 3: Scene Summary Calculation
console.log('▶ Test 3: Deterministic scene summary calculation');
const sampleStrokes: SketchStroke[] = [
  {
    id: 's1',
    elementType: 'ground',
    color: '#10b981',
    width: 10,
    timestamp: 1000,
    points: [{ x: 0.1, y: 0.8 }, { x: 0.5, y: 0.8 }, { x: 0.9, y: 0.8 }],
  },
  {
    id: 's2',
    elementType: 'hazard',
    color: '#ef4444',
    width: 8,
    timestamp: 1001,
    points: [{ x: 0.3, y: 0.8 }, { x: 0.35, y: 0.75 }],
  },
  {
    id: 's3',
    elementType: 'trampoline',
    color: '#06b6d4',
    width: 12,
    timestamp: 1002,
    points: [{ x: 0.6, y: 0.8 }],
  },
  {
    id: 's4',
    elementType: 'coin',
    color: '#eab308',
    width: 14,
    timestamp: 1003,
    points: [{ x: 0.5, y: 0.5 }],
  },
  {
    id: 's5',
    elementType: 'goal',
    color: '#a855f7',
    width: 16,
    timestamp: 1004,
    points: [{ x: 0.9, y: 0.4 }, { x: 0.9, y: 0.2 }],
  },
];

const summary = calculateSceneSummary(sampleStrokes);
assert.strictEqual(summary.totalStrokes, 5);
assert.strictEqual(summary.totalPoints, 9);
assert.strictEqual(summary.elementCounts.ground, 1);
assert.strictEqual(summary.elementCounts.hazard, 1);
assert.strictEqual(summary.elementCounts.trampoline, 1);
assert.strictEqual(summary.elementCounts.coin, 1);
assert.strictEqual(summary.elementCounts.goal, 1);
assert.strictEqual(summary.hasGround, true);
assert.strictEqual(summary.hasGoal, true);
assert.strictEqual(summary.hasHazards, true);
console.log('  ✓ Deterministic scene summary passed');

// Test 4: Empty Scene Summary
console.log('▶ Test 4: Empty scene summary');
const emptySummary = calculateSceneSummary([]);
assert.strictEqual(emptySummary.totalStrokes, 0);
assert.strictEqual(emptySummary.totalPoints, 0);
assert.strictEqual(emptySummary.hasGround, false);
assert.strictEqual(emptySummary.hasGoal, false);
console.log('  ✓ Empty scene summary passed');

// Test 5: Structured JSON document export
console.log('▶ Test 5: Structured JSON export');
const sampleDoc: SketchDocument = {
  id: 'doc-test-123',
  name: 'Test Level',
  canvasWidth: 800,
  canvasHeight: 500,
  strokes: sampleStrokes,
  createdAt: '2026-10-10T12:00:00Z',
  updatedAt: '2026-10-10T12:00:00Z',
  schemaVersion: '1.0',
};

const jsonStr = exportSketchToJson(sampleDoc);
const parsedDoc = JSON.parse(jsonStr) as SketchDocument;
assert.strictEqual(parsedDoc.id, 'doc-test-123');
assert.strictEqual(parsedDoc.strokes.length, 5);
assert.strictEqual(parsedDoc.canvasWidth, 800);
assert.strictEqual(parsedDoc.schemaVersion, '1.0');
console.log('  ✓ Structured JSON export passed');

console.log('\n🎉 ALL 5 SKETCH TESTS PASSED SUCCESSFULLY!');
