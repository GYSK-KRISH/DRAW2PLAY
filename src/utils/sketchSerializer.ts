import type {
  SketchStroke,
  SketchDocument,
  SceneSummary,
  SceneElementType,
  NormalizedPoint,
} from '../types/sketch.js';

/**
 * Clamp a number to [0, 1] range for normalized points
 */
export function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val));
}

/**
 * Validates that a point has normalized coordinates between 0 and 1
 */
export function validateNormalizedPoint(point: NormalizedPoint): boolean {
  return (
    typeof point.x === 'number' &&
    typeof point.y === 'number' &&
    !isNaN(point.x) &&
    !isNaN(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

/**
 * Render an array of strokes onto a 2D canvas context.
 * Scales normalized [0, 1] points to physical width/height.
 */
export function renderStrokesToCanvas(
  ctx: CanvasRenderingContext2D,
  strokes: SketchStroke[],
  width: number,
  height: number,
  options?: {
    backgroundColor?: string;
    clearBeforeRender?: boolean;
    scaleWidthWithCanvas?: boolean;
  }
): void {
  const {
    backgroundColor = '#ffffff',
    clearBeforeRender = true,
  } = options || {};

  if (clearBeforeRender) {
    if (backgroundColor === 'transparent') {
      ctx.clearRect(0, 0, width, height);
    } else {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }
  }

  for (const stroke of strokes) {
    if (!stroke.points || stroke.points.length === 0) continue;

    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pts = stroke.points;

    if (pts.length === 1) {
      // Single tap / dot
      const pt = pts[0];
      const px = pt.x * width;
      const py = pt.y * height;
      ctx.fillStyle = stroke.color;
      ctx.beginPath();
      ctx.arc(px, py, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Multi-point stroke with midpoint quadratic curve smoothing
      ctx.beginPath();
      ctx.moveTo(pts[0].x * width, pts[0].y * height);

      for (let i = 1; i < pts.length - 1; i++) {
        const xc = ((pts[i].x + pts[i + 1].x) / 2) * width;
        const yc = ((pts[i].y + pts[i + 1].y) / 2) * height;
        ctx.quadraticCurveTo(pts[i].x * width, pts[i].y * height, xc, yc);
      }

      // Final segment
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x * width, last.y * height);
      ctx.stroke();
    }

    ctx.restore();
  }
}

/**
 * Compute deterministic scene statistics directly from stroke data
 */
export function calculateSceneSummary(strokes: SketchStroke[]): SceneSummary {
  const counts: Record<SceneElementType, number> = {
    ground: 0,
    hazard: 0,
    trampoline: 0,
    coin: 0,
    goal: 0,
  };

  let totalPoints = 0;

  for (const s of strokes) {
    if (counts[s.elementType] !== undefined) {
      counts[s.elementType]++;
    }
    totalPoints += s.points?.length || 0;
  }

  // Rough estimation of serialized memory footprint in bytes
  const estimatedMemoryBytes = JSON.stringify(strokes).length * 2;

  return {
    totalStrokes: strokes.length,
    totalPoints,
    elementCounts: counts,
    hasGround: counts.ground > 0,
    hasGoal: counts.goal > 0,
    hasHazards: counts.hazard > 0,
    hasCoins: counts.coin > 0,
    hasTrampolines: counts.trampoline > 0,
    estimatedMemoryBytes,
  };
}

/**
 * Export visible canvas as PNG data URL with high-contrast background
 */
export function exportSketchToPng(
  canvas: HTMLCanvasElement,
  backgroundColor = '#ffffff'
): string {
  // If canvas has white background already, toDataURL is immediate
  // To guarantee predictable background for AI analysis:
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const ctx = exportCanvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to create 2D context for PNG export.');
  }

  // Fill solid background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  // Draw original canvas over background
  ctx.drawImage(canvas, 0, 0);

  return exportCanvas.toDataURL('image/png');
}

/**
 * Convert visible canvas into a standard image Blob for future AI backend ingestion
 */
export function exportSketchToBlob(
  canvas: HTMLCanvasElement,
  backgroundColor = '#ffffff'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to create canvas context for image Blob conversion.'));
        return;
      }

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      ctx.drawImage(canvas, 0, 0);

      exportCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob returned null.'));
          }
        },
        'image/png',
        1.0
      );
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Serialize complete sketch document to clean JSON
 */
export function exportSketchToJson(document: SketchDocument): string {
  return JSON.stringify(document, null, 2);
}
