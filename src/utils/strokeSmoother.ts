import type { NormalizedPoint, SketchStroke } from '../types/sketch.js';

export interface StrokeRenderOptions {
  canvasWidth: number;
  canvasHeight: number;
  smoothingMethod?: 'midpoint-quadratic' | 'catmull-rom';
  tension?: number; // 0 (straight lines) to 1 (full curve), default 0.5
}

/**
 * Render a single stroke with smooth curvature on a 2D canvas context.
 * IMPORTANT: Only the rendered visual path is smoothed. The original
 * stroke points are never mutated and remain preserved for geometry extraction.
 */
export function renderSmoothedStroke(
  ctx: CanvasRenderingContext2D,
  stroke: SketchStroke,
  options: StrokeRenderOptions
): void {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return;

  const {
    canvasWidth: w,
    canvasHeight: h,
    smoothingMethod = 'midpoint-quadratic',
    tension = 0.5,
  } = options;

  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // CASE 1: Single point (tap / dot)
  if (pts.length === 1) {
    const p = pts[0];
    const px = p.x * w;
    const py = p.y * h;
    const radius = Math.max(1, stroke.width / 2);

    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // CASE 2: Two points (single line segment)
  if (pts.length === 2) {
    const p0 = pts[0];
    const p1 = pts[1];

    ctx.beginPath();
    ctx.moveTo(p0.x * w, p0.y * h);
    ctx.lineTo(p1.x * w, p1.y * h);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // CASE 3: Three points (single quadratic curve)
  if (pts.length === 3) {
    const p0 = pts[0];
    const p1 = pts[1];
    const p2 = pts[2];

    ctx.beginPath();
    ctx.moveTo(p0.x * w, p0.y * h);
    // Draw through midpoint to avoid overshooting
    const midX = (p1.x * w + p2.x * w) / 2;
    const midY = (p1.y * h + p2.y * h) / 2;
    ctx.quadraticCurveTo(p1.x * w, p1.y * h, midX, midY);
    ctx.lineTo(p2.x * w, p2.y * h);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // CASE 4: Four or more points
  if (smoothingMethod === 'catmull-rom') {
    renderCatmullRomStroke(ctx, pts, w, h, tension);
  } else {
    renderMidpointQuadraticStroke(ctx, pts, w, h);
  }

  ctx.restore();
}

/**
 * Midpoint Quadratic Curve Smoothing
 * Connects midpoints of adjacent segments with quadratic curves using sampled points as control vertices.
 * Mathematically stays strictly within the convex hull of sampled points, preventing any corner overshoot.
 */
function renderMidpointQuadraticStroke(
  ctx: CanvasRenderingContext2D,
  pts: NormalizedPoint[],
  w: number,
  h: number
): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x * w, pts[0].y * h);

  // Line to initial midpoint
  const firstMidX = ((pts[0].x + pts[1].x) / 2) * w;
  const firstMidY = ((pts[0].y + pts[1].y) / 2) * h;
  ctx.lineTo(firstMidX, firstMidY);

  // Quadratic curves through midpoints
  for (let i = 1; i < pts.length - 1; i++) {
    const current = pts[i];
    const next = pts[i + 1];
    const midX = ((current.x + next.x) / 2) * w;
    const midY = ((current.y + next.y) / 2) * h;
    ctx.quadraticCurveTo(current.x * w, current.y * h, midX, midY);
  }

  // Line to final point
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x * w, last.y * h);
  ctx.stroke();
}

/**
 * Catmull-Rom Spline to Cubic Bézier conversion with overshoot damping
 */
function renderCatmullRomStroke(
  ctx: CanvasRenderingContext2D,
  pts: NormalizedPoint[],
  w: number,
  h: number,
  tension: number
): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x * w, pts[0].y * h);

  const t = Math.max(0.1, Math.min(1.0, tension));
  const factor = (1 - t) / 2;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 >= pts.length ? pts.length - 1 : i + 2];

    const cp1x = (p1.x + (p2.x - p0.x) * factor) * w;
    const cp1y = (p1.y + (p2.y - p0.y) * factor) * h;
    const cp2x = (p2.x - (p3.x - p1.x) * factor) * w;
    const cp2y = (p2.y - (p3.y - p1.y) * factor) * h;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x * w, p2.y * h);
  }

  ctx.stroke();
}
