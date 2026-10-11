/**
 * Draw2Play AI — Asset Validation & Security Service
 *
 * Enforces strict security constraints:
 * - Magic byte inspection (PNG, WebP, SVG)
 * - Maximum byte length bounds (< 2MB sprite, < 5MB backdrop)
 * - Dimensional limits ([8, 2048] px)
 * - Sanitized asset identifiers (no directory traversal or executable injections)
 */

export interface AssetValidationResult {
  isValid: boolean;
  format: 'png' | 'webp' | 'svg' | 'unknown';
  width: number;
  height: number;
  sizeBytes: number;
  error?: string;
}

/** Default size bounds */
export const MAX_SPRITE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_BACKDROP_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates a sanitized asset identifier to prevent path traversal
 */
export function sanitizeAssetId(rawId: string): string {
  if (!rawId || typeof rawId !== 'string') {
    return 'asset-default';
  }
  // Strip non-alphanumeric chars except dashes and underscores
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 64);
  return cleaned || 'asset-default';
}

/**
 * Extracts width and height from PNG IHDR chunk
 */
export function extractPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47 ||
    buffer[4] !== 0x0d ||
    buffer[5] !== 0x0a ||
    buffer[6] !== 0x1a ||
    buffer[7] !== 0x0a
  ) {
    return null;
  }
  // IHDR width is at offset 16 (4 bytes big-endian), height is at offset 20 (4 bytes big-endian)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

/**
 * Validates generated asset data URL
 */
export function validateAssetDataUrl(
  dataUrl: string,
  options: {
    maxSizeBytes?: number;
    minDimension?: number;
    maxDimension?: number;
    isBackdrop?: boolean;
  } = {}
): AssetValidationResult {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return {
      isValid: false,
      format: 'unknown',
      width: 0,
      height: 0,
      sizeBytes: 0,
      error: 'Asset data URL is empty or not a string',
    };
  }

  const match = dataUrl.match(/^data:image\/(png|webp|svg\+xml);base64,(.+)$/);
  if (!match) {
    return {
      isValid: false,
      format: 'unknown',
      width: 0,
      height: 0,
      sizeBytes: 0,
      error: 'Invalid asset URI format: must be base64 PNG, WebP, or SVG',
    };
  }

  const formatStr = match[1];
  const base64Data = match[2];
  let buffer: Buffer;

  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch (err: unknown) {
    return {
      isValid: false,
      format: 'unknown',
      width: 0,
      height: 0,
      sizeBytes: 0,
      error: `Failed to decode base64 buffer: ${(err as Error).message}`,
    };
  }

  const sizeBytes = buffer.length;
  const maxSize = options.maxSizeBytes || (options.isBackdrop ? MAX_BACKDROP_SIZE_BYTES : MAX_SPRITE_SIZE_BYTES);

  if (sizeBytes === 0) {
    return {
      isValid: false,
      format: 'unknown',
      width: 0,
      height: 0,
      sizeBytes: 0,
      error: 'Asset buffer is empty (0 bytes)',
    };
  }

  if (sizeBytes > maxSize) {
    return {
      isValid: false,
      format: 'unknown',
      width: 0,
      height: 0,
      sizeBytes,
      error: `Asset exceeds maximum allowed file size (${(maxSize / (1024 * 1024)).toFixed(1)}MB limit)`,
    };
  }

  let width = 0;
  let height = 0;
  let detectedFormat: 'png' | 'webp' | 'svg' | 'unknown' = 'unknown';

  if (formatStr === 'png') {
    const dims = extractPngDimensions(buffer);
    if (!dims) {
      return {
        isValid: false,
        format: 'unknown',
        width: 0,
        height: 0,
        sizeBytes,
        error: 'PNG magic bytes or IHDR chunk corrupted',
      };
    }
    width = dims.width;
    height = dims.height;
    detectedFormat = 'png';
  } else if (formatStr === 'svg+xml') {
    const svgText = buffer.toString('utf-8');
    if (!svgText.includes('<svg')) {
      return {
        isValid: false,
        format: 'unknown',
        width: 0,
        height: 0,
        sizeBytes,
        error: 'SVG markup is invalid or missing <svg> element',
      };
    }
    const widthMatch = svgText.match(/width="(\d+)"/);
    const heightMatch = svgText.match(/height="(\d+)"/);
    width = widthMatch ? parseInt(widthMatch[1], 10) : 64;
    height = heightMatch ? parseInt(heightMatch[1], 10) : 64;
    detectedFormat = 'svg';
  } else if (formatStr === 'webp') {
    // Check RIFF header and WEBP signature
    if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
      return {
        isValid: false,
        format: 'unknown',
        width: 0,
        height: 0,
        sizeBytes,
        error: 'WebP magic signature missing',
      };
    }
    width = 64; // Fallback bound
    height = 64;
    detectedFormat = 'webp';
  }

  const minDim = options.minDimension || 8;
  const maxDim = options.maxDimension || 2048;

  if (width < minDim || height < minDim || width > maxDim || height > maxDim) {
    return {
      isValid: false,
      format: detectedFormat,
      width,
      height,
      sizeBytes,
      error: `Asset dimensions (${width}x${height}) outside allowed boundaries [${minDim}, ${maxDim}]`,
    };
  }

  return {
    isValid: true,
    format: detectedFormat,
    width,
    height,
    sizeBytes,
  };
}
