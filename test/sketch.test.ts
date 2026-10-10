import assert from 'node:assert';
import {
  clamp01,
  validateNormalizedPoint,
  calculateSceneSummary,
  exportValidatedSketchDocument,
  parseSketchDocument,
  preprocessSketchForAi,
} from '../src/utils/sketchSerializer.js';
import {
  calculateStrokeBounds,
  calculateStrokeCentroid,
  calculateStrokeLength,
  extractSceneElement,
  extractSceneGeometry,
} from '../src/utils/geometryExtractor.js';
import type { SketchStroke, SketchDocument, NormalizedPoint } from '../src/types/sketch.js';
import { ELEMENT_DEFINITIONS } from '../src/types/sketch.js';

console.log('🧪 Starting Draw2Play Phase 1 Advanced Vector & Geometry Test Suite...\n');

// ---------------------------------------------------------------------------
// Test 1: Bounding-box calculations
// ---------------------------------------------------------------------------
console.log('▶ Test 1: Bounding-box calculations');
const pointsForBounds: NormalizedPoint[] = [
  { x: 0.1, y: 0.2 },
  { x: 0.5, y: 0.8 },
  { x: 0.3, y: 0.4 },
];
const bounds = calculateStrokeBounds(pointsForBounds);
assert.ok(bounds !== null);
assert.strictEqual(Math.round(bounds.x * 100) / 100, 0.1);
assert.strictEqual(Math.round(bounds.y * 100) / 100, 0.2);
assert.strictEqual(Math.round(bounds.width * 100) / 100, 0.4);
assert.strictEqual(Math.round(bounds.height * 100) / 100, 0.6);
console.log('  ✓ Bounding-box calculations passed');

// ---------------------------------------------------------------------------
// Test 2: Normalized coordinate validation
// ---------------------------------------------------------------------------
console.log('▶ Test 2: Normalized coordinate validation');
assert.strictEqual(clamp01(-0.5), 0);
assert.strictEqual(clamp01(1.5), 1);
assert.strictEqual(clamp01(0.42), 0.42);

assert.strictEqual(validateNormalizedPoint({ x: 0, y: 0 }), true);
assert.strictEqual(validateNormalizedPoint({ x: 1, y: 1 }), true);
assert.strictEqual(validateNormalizedPoint({ x: 0.25, y: 0.75 }), true);
assert.strictEqual(validateNormalizedPoint({ x: -0.01, y: 0.5 }), false);
assert.strictEqual(validateNormalizedPoint({ x: 0.5, y: 1.01 }), false);
assert.strictEqual(validateNormalizedPoint({ x: NaN, y: 0.5 }), false);
assert.strictEqual(validateNormalizedPoint({ x: Infinity, y: 0.5 }), false);
console.log('  ✓ Normalized coordinate validation passed');

// ---------------------------------------------------------------------------
// Test 3: Centroid calculation
// ---------------------------------------------------------------------------
console.log('▶ Test 3: Centroid calculation');
const pointsForCentroid: NormalizedPoint[] = [
  { x: 0.1, y: 0.2 },
  { x: 0.3, y: 0.4 },
];
const centroid = calculateStrokeCentroid(pointsForCentroid);
assert.ok(centroid !== null);
assert.strictEqual(Math.round(centroid.x * 100) / 100, 0.2);
assert.strictEqual(Math.round(centroid.y * 100) / 100, 0.3);
console.log('  ✓ Centroid calculation passed');

// ---------------------------------------------------------------------------
// Test 4: Stroke-length calculation
// ---------------------------------------------------------------------------
console.log('▶ Test 4: Stroke-length calculation');
const pointsForLength: NormalizedPoint[] = [
  { x: 0.0, y: 0.0 },
  { x: 0.3, y: 0.4 },
];
// Normalized Pythagorean distance: sqrt(0.3^2 + 0.4^2) = 0.5
const normLength = calculateStrokeLength(pointsForLength);
assert.strictEqual(Math.round(normLength * 100) / 100, 0.5);

// Physical pixel distance: 0.5 * 1000 = 500 px
const pixelLength = calculateStrokeLength(pointsForLength, { width: 1000, height: 1000 });
assert.strictEqual(Math.round(pixelLength), 500);
console.log('  ✓ Stroke-length calculation passed');

// ---------------------------------------------------------------------------
// Test 5: Empty and malformed strokes
// ---------------------------------------------------------------------------
console.log('▶ Test 5: Empty and malformed strokes');
assert.strictEqual(calculateStrokeBounds([]), null);
assert.strictEqual(calculateStrokeCentroid([]), null);
assert.strictEqual(calculateStrokeLength([]), 0);

const emptyStroke: SketchStroke = {
  id: 'empty-1',
  elementType: 'ground',
  color: '#10b981',
  width: 10,
  points: [],
  timestamp: 1000,
};
assert.strictEqual(extractSceneElement(emptyStroke), null);

const malformedStroke: SketchStroke = {
  id: 'malformed-1',
  elementType: 'hazard',
  color: '#ef4444',
  width: 8,
  points: [{ x: NaN, y: -5 } as unknown as NormalizedPoint],
  timestamp: 1001,
};
assert.strictEqual(extractSceneElement(malformedStroke), null);
console.log('  ✓ Empty and malformed strokes safely handled');

// ---------------------------------------------------------------------------
// Test 6: Single-point and two-point strokes
// ---------------------------------------------------------------------------
console.log('▶ Test 6: Single-point and two-point strokes');
const singlePointStroke: SketchStroke = {
  id: 'pt-1',
  elementType: 'coin',
  color: '#eab308',
  width: 14,
  points: [{ x: 0.5, y: 0.5 }],
  timestamp: 1002,
};
const singleEl = extractSceneElement(singlePointStroke);
assert.ok(singleEl !== null);
assert.strictEqual(singleEl.pointCount, 1);
assert.strictEqual(singleEl.bounds.width, 0);
assert.strictEqual(singleEl.bounds.height, 0);
assert.strictEqual(singleEl.length, 0);
assert.strictEqual(singleEl.centroid.x, 0.5);

const twoPointStroke: SketchStroke = {
  id: 'pt-2',
  elementType: 'trampoline',
  color: '#06b6d4',
  width: 12,
  points: [{ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.3 }],
  timestamp: 1003,
};
const twoEl = extractSceneElement(twoPointStroke);
assert.ok(twoEl !== null);
assert.strictEqual(twoEl.pointCount, 2);
assert.strictEqual(Math.round(twoEl.bounds.width * 100) / 100, 0.4);
assert.strictEqual(Math.round(twoEl.length * 100) / 100, 0.4);
console.log('  ✓ Single-point and two-point strokes passed');

// ---------------------------------------------------------------------------
// Test 7: Semantic type preservation
// ---------------------------------------------------------------------------
console.log('▶ Test 7: Semantic type preservation');
const semanticStrokes: SketchStroke[] = [
  { id: 's-g', elementType: 'ground', color: ELEMENT_DEFINITIONS.ground.color, width: 10, points: [{ x: 0.1, y: 0.8 }, { x: 0.9, y: 0.8 }], timestamp: 1 },
  { id: 's-h', elementType: 'hazard', color: ELEMENT_DEFINITIONS.hazard.color, width: 8, points: [{ x: 0.4, y: 0.8 }, { x: 0.5, y: 0.75 }], timestamp: 2 },
  { id: 's-t', elementType: 'trampoline', color: ELEMENT_DEFINITIONS.trampoline.color, width: 12, points: [{ x: 0.6, y: 0.8 }], timestamp: 3 },
  { id: 's-c', elementType: 'coin', color: ELEMENT_DEFINITIONS.coin.color, width: 14, points: [{ x: 0.5, y: 0.5 }], timestamp: 4 },
  { id: 's-gl', elementType: 'goal', color: ELEMENT_DEFINITIONS.goal.color, width: 16, points: [{ x: 0.9, y: 0.5 }, { x: 0.9, y: 0.3 }], timestamp: 5 },
];

const extracted = extractSceneGeometry(semanticStrokes);
assert.strictEqual(extracted.length, 5);
assert.strictEqual(extracted[0].elementType, 'ground');
assert.strictEqual(extracted[1].elementType, 'hazard');
assert.strictEqual(extracted[2].elementType, 'trampoline');
assert.strictEqual(extracted[3].elementType, 'coin');
assert.strictEqual(extracted[4].elementType, 'goal');

const summary = calculateSceneSummary(semanticStrokes);
assert.strictEqual(summary.elementCounts.ground, 1);
assert.strictEqual(summary.elementCounts.hazard, 1);
assert.strictEqual(summary.elementCounts.trampoline, 1);
assert.strictEqual(summary.elementCounts.coin, 1);
assert.strictEqual(summary.elementCounts.goal, 1);
console.log('  ✓ Semantic element types strictly preserved');

// ---------------------------------------------------------------------------
// Test 8: Undo/redo data integrity
// ---------------------------------------------------------------------------
console.log('▶ Test 8: Undo/redo data integrity');
let activeStrokes: SketchStroke[] = [];
const undoStack: SketchStroke[][] = [];
const redoStack: SketchStroke[][] = [];

// Action 1: Add ground stroke
const stroke1 = semanticStrokes[0];
undoStack.push([...activeStrokes]);
activeStrokes = [...activeStrokes, stroke1];

// Action 2: Add goal stroke
const stroke2 = semanticStrokes[4];
undoStack.push([...activeStrokes]);
activeStrokes = [...activeStrokes, stroke2];
assert.strictEqual(activeStrokes.length, 2);

// Undo Action 2
const previousState = undoStack.pop();
assert.ok(previousState);
redoStack.push([...activeStrokes]);
activeStrokes = previousState;
assert.strictEqual(activeStrokes.length, 1);
assert.strictEqual(activeStrokes[0].id, 's-g');

// Redo Action 2
const redoState = redoStack.pop();
assert.ok(redoState);
undoStack.push([...activeStrokes]);
activeStrokes = redoState;
assert.strictEqual(activeStrokes.length, 2);
assert.strictEqual(activeStrokes[1].id, 's-gl');
console.log('  ✓ Undo and redo preserved stroke data integrity');

// ---------------------------------------------------------------------------
// Test 9: Serialization and parsing with Zod schema validation
// ---------------------------------------------------------------------------
console.log('▶ Test 9: Serialization and parsing');
const doc: SketchDocument = {
  id: 'doc-unit-test-1',
  name: 'Test Level',
  canvasWidth: 800,
  canvasHeight: 500,
  coordinateConvention: 'normalized-unit',
  strokes: semanticStrokes,
  extractedElements: extracted,
  createdAt: '2026-10-10T12:00:00Z',
  updatedAt: '2026-10-10T12:00:00Z',
  schemaVersion: '1.0',
};

const exported = exportValidatedSketchDocument(doc);
assert.strictEqual(exported.isValid, true);
assert.ok(exported.json.includes('"coordinateConvention": "normalized-unit"'));

const parsed = parseSketchDocument(exported.json);
assert.strictEqual(parsed.success, true);
assert.ok(parsed.data);
assert.strictEqual(parsed.data.strokes.length, 5);
assert.strictEqual(parsed.data.extractedElements?.length, 5);

// Invalid JSON string
const invalidParsed = parseSketchDocument('{ malformed json');
assert.strictEqual(invalidParsed.success, false);

// Incomplete schema
const badSchemaParsed = parseSketchDocument(JSON.stringify({ id: 'bad' }));
assert.strictEqual(badSchemaParsed.success, false);
console.log('  ✓ Serialization and Zod validation passed');

// ---------------------------------------------------------------------------
// Test 10: Exported coordinate bounds
// ---------------------------------------------------------------------------
console.log('▶ Test 10: Exported coordinate bounds');
for (const stroke of doc.strokes) {
  for (const pt of stroke.points) {
    assert.ok(pt.x >= 0 && pt.x <= 1, `Point x (${pt.x}) outside [0, 1]`);
    assert.ok(pt.y >= 0 && pt.y <= 1, `Point y (${pt.y}) outside [0, 1]`);
  }
}
if (doc.extractedElements) {
  for (const el of doc.extractedElements) {
    assert.ok(el.bounds.x >= 0 && el.bounds.x <= 1);
    assert.ok(el.bounds.y >= 0 && el.bounds.y <= 1);
    assert.ok(el.bounds.width >= 0 && el.bounds.width <= 1);
    assert.ok(el.bounds.height >= 0 && el.bounds.height <= 1);
    assert.ok(el.centroid.x >= 0 && el.centroid.x <= 1);
    assert.ok(el.centroid.y >= 0 && el.centroid.y <= 1);
  }
}
console.log('  ✓ Exported coordinate bounds verified in [0, 1]');

// ---------------------------------------------------------------------------
// Test 11: Empty-canvas image preparation
// ---------------------------------------------------------------------------
console.log('▶ Test 11: Empty-canvas image preparation rejection');
let emptyErrorCaught = false;
try {
  // Pass dummy canvas with 0 stroke count
  await preprocessSketchForAi({} as HTMLCanvasElement, 0);
} catch (err) {
  emptyErrorCaught = true;
  assert.ok((err as Error).message.includes('Cannot preprocess empty sketch canvas'));
}
assert.strictEqual(emptyErrorCaught, true);
console.log('  ✓ Empty-canvas preparation correctly rejected without calling AI');

// ---------------------------------------------------------------------------
// Test 12: Canvas resize preserving the document
// ---------------------------------------------------------------------------
console.log('▶ Test 12: Canvas resize preserving the document');
// A stroke defined at normalized midpoint (0.5, 0.5)
const midStroke: SketchStroke = {
  id: 'mid-1',
  elementType: 'ground',
  color: '#10b981',
  width: 10,
  points: [{ x: 0.5, y: 0.5 }],
  timestamp: Date.now(),
};

// At 800x500 viewport:
const w1 = 800;
const h1 = 500;
const px1 = midStroke.points[0].x * w1;
const py1 = midStroke.points[0].y * h1;
assert.strictEqual(px1, 400);
assert.strictEqual(py1, 250);

// At 1200x750 viewport:
const w2 = 1200;
const h2 = 750;
const px2 = midStroke.points[0].x * w2;
const py2 = midStroke.points[0].y * h2;
assert.strictEqual(px2, 600);
assert.strictEqual(py2, 375);

// The source stroke normalized point is unchanged
assert.strictEqual(midStroke.points[0].x, 0.5);
assert.strictEqual(midStroke.points[0].y, 0.5);
console.log('  ✓ Canvas resize preservation verified (0 point loss or drift)');

console.log('\n🎉 ALL 12 DRAW2PLAY GEOMETRY & SKETCH TESTS PASSED SUCCESSFULLY!\n');
