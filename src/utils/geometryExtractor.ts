import type {
  NormalizedPoint,
  BoundingBox,
  ExtractedSceneElement,
  SketchStroke,
} from '../types/sketch.js';

/**
 * Clamp a number to [0, 1] range for normalized coordinates
 */
export function clamp01(val: number): number {
  if (isNaN(val)) return 0;
  return Math.max(0, Math.min(1, val));
}

/**
 * Validate that a point is defined with numeric finite values within [0, 1]
 */
export function isValidPoint(pt: unknown): pt is NormalizedPoint {
  if (!pt || typeof pt !== 'object') return false;
  const p = pt as NormalizedPoint;
  return (
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    !isNaN(p.x) &&
    !isNaN(p.y) &&
    isFinite(p.x) &&
    isFinite(p.y) &&
    p.x >= 0 &&
    p.x <= 1 &&
    p.y >= 0 &&
    p.y <= 1
  );
}

/**
 * Filter out invalid, NaN, or out-of-bounds points from a point sequence
 */
export function filterValidPoints(points: NormalizedPoint[]): NormalizedPoint[] {
  if (!Array.isArray(points)) return [];
  return points.filter(isValidPoint);
}

/**
 * Compute the Axis-Aligned Bounding Box (AABB) in normalized [0, 1] coordinates
 * Ignores empty or malformed strokes safely.
 */
export function calculateStrokeBounds(points: NormalizedPoint[]): BoundingBox | null {
  const valid = filterValidPoints(points);
  if (valid.length === 0) return null;

  let minX = valid[0].x;
  let maxX = valid[0].x;
  let minY = valid[0].y;
  let maxY = valid[0].y;

  for (let i = 1; i < valid.length; i++) {
    const pt = valid[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const clampedMinX = clamp01(minX);
  const clampedMaxX = clamp01(maxX);
  const clampedMinY = clamp01(minY);
  const clampedMaxY = clamp01(maxY);

  return {
    x: clampedMinX,
    y: clampedMinY,
    width: Math.max(0, clampedMaxX - clampedMinX),
    height: Math.max(0, clampedMaxY - clampedMinY),
  };
}

/**
 * Calculate the arithmetic centroid (center of mass) of stroke points in normalized [0, 1]
 */
export function calculateStrokeCentroid(points: NormalizedPoint[]): NormalizedPoint | null {
  const valid = filterValidPoints(points);
  if (valid.length === 0) return null;

  let sumX = 0;
  let sumY = 0;

  for (const pt of valid) {
    sumX += pt.x;
    sumY += pt.y;
  }

  return {
    x: clamp01(sumX / valid.length),
    y: clamp01(sumY / valid.length),
  };
}

/**
 * Calculate the cumulative Euclidean arc length of a stroke sequence.
 * If pixelDimensions is supplied, converts normalized length to physical pixels.
 */
export function calculateStrokeLength(
  points: NormalizedPoint[],
  pixelDimensions?: { width: number; height: number }
): number {
  const valid = filterValidPoints(points);
  if (valid.length < 2) return 0;

  let totalLength = 0;
  const w = pixelDimensions?.width ?? 1;
  const h = pixelDimensions?.height ?? 1;

  for (let i = 1; i < valid.length; i++) {
    const p0 = valid[i - 1];
    const p1 = valid[i];
    const dx = (p1.x - p0.x) * w;
    const dy = (p1.y - p0.y) * h;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }

  return totalLength;
}

/**
 * Preprocess a single stroke into a clean geometric scene element.
 * Safely ignores empty or malformed strokes.
 */
export function extractSceneElement(stroke: SketchStroke): ExtractedSceneElement | null {
  if (!stroke || !stroke.points || stroke.points.length === 0) {
    return null;
  }

  const validPoints = filterValidPoints(stroke.points);
  if (validPoints.length === 0) {
    return null;
  }

  const bounds = calculateStrokeBounds(validPoints);
  const centroid = calculateStrokeCentroid(validPoints);
  if (!bounds || !centroid) {
    return null;
  }

  const length = calculateStrokeLength(validPoints);

  return {
    strokeId: stroke.id,
    elementType: stroke.elementType,
    bounds,
    centroid,
    length,
    pointCount: validPoints.length,
    points: validPoints,
  };
}

/**
 * Deterministically preprocess all strokes into structured geometric scene elements.
 * Filters out invalid or zero-length strokes safely.
 */
export function extractSceneGeometry(strokes: SketchStroke[]): ExtractedSceneElement[] {
  if (!Array.isArray(strokes) || strokes.length === 0) {
    return [];
  }

  const elements: ExtractedSceneElement[] = [];

  for (const stroke of strokes) {
    const element = extractSceneElement(stroke);
    if (element) {
      elements.push(element);
    }
  }

  return elements;
}

/**
 * Calculate the union bounding box across all extracted scene elements
 */
export function calculateSceneBounds(elements: ExtractedSceneElement[]): BoundingBox | null {
  if (!elements || elements.length === 0) return null;

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;

  for (const el of elements) {
    const b = el.bounds;
    if (b.x < minX) minX = b.x;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y < minY) minY = b.y;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }

  return {
    x: clamp01(minX),
    y: clamp01(minY),
    width: Math.max(0, clamp01(maxX) - clamp01(minX)),
    height: Math.max(0, clamp01(maxY) - clamp01(minY)),
  };
}
