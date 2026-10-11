import type {
  SketchStroke,
  SketchDocument,
  SceneSummary,
  SceneElementType,
  NormalizedPoint,
  PreprocessOptions,
} from '../types/sketch.js';
import { SketchDocumentSchema } from '../types/sketch.js';
import { renderSmoothedStroke } from './strokeSmoother.js';
import {
  clamp01,
  isValidPoint,
  extractSceneGeometry,
} from './geometryExtractor.js';

export { clamp01 };

/**
 * Validates that a point has normalized coordinates between 0 and 1
 */
export function validateNormalizedPoint(point: NormalizedPoint): boolean {
  return isValidPoint(point);
}

/**
 * Render an array of strokes onto a 2D canvas context.
 * Scales normalized [0, 1] points to physical width/height using smooth curvature.
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
    smoothingMethod?: 'midpoint-quadratic' | 'catmull-rom';
  }
): void {
  const {
    backgroundColor = '#ffffff',
    clearBeforeRender = true,
    smoothingMethod = 'midpoint-quadratic',
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

    renderSmoothedStroke(ctx, stroke, {
      canvasWidth: width,
      canvasHeight: height,
      smoothingMethod,
    });
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

  // Calculate extracted geometric elements
  const extractedElements = extractSceneGeometry(strokes);

  // Rough estimation of serialized memory footprint in bytes
  const estimatedMemoryBytes = JSON.stringify(strokes).length * 2;

  const hasGround = counts.ground > 0;
  const hasGoal = counts.goal > 0;

  let readinessStatus: SceneSummary['readinessStatus'] = 'ready';
  let actionableGuidance = 'All level requirements satisfied! Ready for local physics or AI analysis.';

  if (strokes.length === 0) {
    readinessStatus = 'empty';
    actionableGuidance = 'Canvas is empty. Draw with any tool or upload a visual reference.';
  } else if (!hasGround && !hasGoal) {
    readinessStatus = 'missing-both';
    actionableGuidance = 'Missing ground and goal. Every level requires walkable terrain and a finish flag.';
  } else if (!hasGround) {
    readinessStatus = 'missing-ground';
    actionableGuidance = 'Missing ground platform. Select the Emerald Ground tool to draw walkable surfaces.';
  } else if (!hasGoal) {
    readinessStatus = 'missing-goal';
    actionableGuidance = 'Missing goal. Select the Purple Goal tool to place the finish victory line.';
  }

  return {
    totalStrokes: strokes.length,
    totalPoints,
    elementCounts: counts,
    hasGround,
    hasGoal,
    hasHazards: counts.hazard > 0,
    hasCoins: counts.coin > 0,
    hasTrampolines: counts.trampoline > 0,
    estimatedMemoryBytes,
    extractedElementCount: extractedElements.length,
    readinessStatus,
    actionableGuidance,
  };
}

/**
 * Export visible canvas as PNG data URL with configurable background (white or transparent)
 */
export function exportSketchToPng(
  canvas: HTMLCanvasElement,
  backgroundColor = '#ffffff'
): string {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const ctx = exportCanvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to create 2D context for PNG export.');
  }

  if (backgroundColor === 'transparent') {
    ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
  } else {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  }

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

      if (backgroundColor === 'transparent') {
        ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
      } else {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      }

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

/**
 * Validates and serializes a sketch document using strict Zod schema checking
 */
export function exportValidatedSketchDocument(document: SketchDocument): {
  json: string;
  isValid: boolean;
  errors?: string[];
  document: SketchDocument;
} {
  const result = SketchDocumentSchema.safeParse(document);

  if (!result.success) {
    const errorMessages = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    return {
      json: JSON.stringify(document, null, 2),
      isValid: false,
      errors: errorMessages,
      document,
    };
  }

  return {
    json: JSON.stringify(result.data, null, 2),
    isValid: true,
    document: result.data as SketchDocument,
  };
}

/**
 * Safely parse and validate an imported sketch document JSON string
 */
export function parseSketchDocument(jsonString: string): {
  success: boolean;
  data?: SketchDocument;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);
    const validated = SketchDocumentSchema.safeParse(parsed);

    if (!validated.success) {
      return {
        success: false,
        error: `Invalid SketchDocument format: ${validated.error.issues.map((i) => i.message).join(', ')}`,
      };
    }

    return {
      success: true,
      data: validated.data as SketchDocument,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'JSON parse failure',
    };
  }
}

/**
 * Preprocess a sketch canvas into an image Blob suitable for future AI ingestion
 * Throws a clear error if the canvas contains zero strokes.
 * Optionally downscales to maxDimension preserving aspect ratio.
 */
export async function preprocessSketchForAi(
  canvas: HTMLCanvasElement,
  strokeCount: number,
  options?: PreprocessOptions
): Promise<Blob> {
  if (strokeCount === 0) {
    throw new Error('Cannot preprocess empty sketch canvas: at least one stroke is required.');
  }

  const {
    backgroundColor = '#ffffff',
    maxDimension = 1024,
  } = options || {};

  // Compute scaled dimensions preserving aspect ratio
  let targetWidth = canvas.width;
  let targetHeight = canvas.height;

  if (targetWidth > maxDimension || targetHeight > maxDimension) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((targetHeight / targetWidth) * maxDimension);
      targetWidth = maxDimension;
    } else {
      targetWidth = Math.round((targetWidth / targetHeight) * maxDimension);
      targetHeight = maxDimension;
    }
  }

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = targetWidth;
  exportCanvas.height = targetHeight;
  const ctx = exportCanvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to create canvas 2D rendering context for AI preprocessing.');
  }

  if (backgroundColor === 'transparent') {
    ctx.clearRect(0, 0, targetWidth, targetHeight);
  } else {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  // Draw scaled
  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

  return new Promise((resolve, reject) => {
    exportCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob conversion failed.'));
        }
      },
      'image/png',
      1.0
    );
  });
}
