import crypto from 'node:crypto';
import { ReferenceInput, ReferenceInputSchema } from '../../src/types/reference.js';

export interface ImageMetadata {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
}

export interface StoredReferenceAsset {
  input: ReferenceInput;
  buffer: Buffer;
}

/**
 * Sniff magic bytes to verify true file signature, rejecting deceptive extensions or MIME types.
 */
export function inspectImageSignatureAndDimensions(buffer: Buffer): ImageMetadata {
  if (buffer.length < 12) {
    throw new Error('Image payload is too small or truncated to be a valid image file');
  }

  // 1. Check PNG Signature: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if (isPng) {
    if (buffer.length < 24) {
      throw new Error('Malformed PNG: truncated IHDR header');
    }
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return {
      mimeType: 'image/png',
      width,
      height,
      sizeBytes: buffer.length,
    };
  }

  // 2. Check JPEG Signature: FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg) {
    let offset = 2;
    let width = 0;
    let height = 0;

    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // Baseline / Progressive SOF markers (SOF0 = 0xC0, SOF1 = 0xC1, SOF2 = 0xC2)
      if (marker >= 0xc0 && marker <= 0xc3) {
        height = buffer.readUInt16BE(offset + 5);
        width = buffer.readUInt16BE(offset + 7);
        break;
      }
      // Skip variable length marker segment
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
      } else {
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }

    if (width === 0 || height === 0) {
      // Fallback safe estimate if non-standard EXIF layout
      width = 800;
      height = 600;
    }

    return {
      mimeType: 'image/jpeg',
      width,
      height,
      sizeBytes: buffer.length,
    };
  }

  // 3. Check WebP Signature: 'RIFF' at 0..3 and 'WEBP' at 8..11
  const isRiff =
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  const isWebp =
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

  if (isRiff && isWebp) {
    let width = 800;
    let height = 600;

    // Check VP8, VP8L, VP8X chunk identifiers
    const formatTag = buffer.toString('ascii', 12, 16);
    if (formatTag === 'VP8 ' && buffer.length >= 30) {
      width = (buffer.readUInt16LE(26) & 0x3fff) || 800;
      height = (buffer.readUInt16LE(28) & 0x3fff) || 600;
    } else if (formatTag === 'VP8L' && buffer.length >= 25) {
      const b1 = buffer[21];
      const b2 = buffer[22];
      const b3 = buffer[23];
      const b4 = buffer[24];
      width = (1 + (((b2 & 0x3f) << 8) | b1)) || 800;
      height = (1 + (((b4 & 0xf) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))) || 600;
    } else if (formatTag === 'VP8X' && buffer.length >= 30) {
      width = 1 + buffer.readUIntLE(24, 3);
      height = 1 + buffer.readUIntLE(27, 3);
    }

    return {
      mimeType: 'image/webp',
      width,
      height,
      sizeBytes: buffer.length,
    };
  }

  throw new Error(
    'Unsupported or corrupted image format. Only verified PNG, JPEG, or WebP files with valid file signatures are accepted.'
  );
}

/**
 * Sanitize untrusted client filename, preventing path traversal and non-printable characters.
 */
export function sanitizeFilename(filename?: string, defaultPrefix = 'reference-upload'): string {
  if (!filename || typeof filename !== 'string') {
    return `${defaultPrefix}-${Date.now()}.png`;
  }

  // Remove directory separators and path traversal
  const base = filename.replace(/^.*[\\/]/, '');
  // Keep only alphanumeric, dots, underscores, dashes
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  const trimmed = clean.slice(0, 80) || defaultPrefix;

  // Ensure reasonable extension exists
  if (!/\.(png|jpe?g|webp)$/i.test(trimmed)) {
    return `${trimmed}.png`;
  }
  return trimmed;
}

/**
 * Storage Abstraction for Reference Uploads (In-Memory with safe bounds)
 */
export interface IReferenceStorageService {
  storeReference(
    buffer: Buffer,
    filename?: string,
    type?: 'image' | 'video-frame' | 'sketch',
    userDescription?: string
  ): Promise<ReferenceInput>;
  getReference(id: string): StoredReferenceAsset | undefined;
  deleteReference(id: string): boolean;
  count(): number;
}

class MemoryReferenceStorageService implements IReferenceStorageService {
  private assets = new Map<string, StoredReferenceAsset>();
  private maxItems = 100;

  async storeReference(
    buffer: Buffer,
    filename?: string,
    type: 'image' | 'video-frame' | 'sketch' = 'image',
    userDescription?: string
  ): Promise<ReferenceInput> {
    const meta = inspectImageSignatureAndDimensions(buffer);

    // Dimension bounds check
    if (meta.width > 4096 || meta.height > 4096) {
      throw new Error(`Image dimensions (${meta.width}x${meta.height}) exceed maximum allowed limit of 4096x4096px.`);
    }

    // Size limit check (10MB)
    const MAX_BYTES = 10 * 1024 * 1024;
    if (meta.sizeBytes > MAX_BYTES) {
      throw new Error(`File size (${(meta.sizeBytes / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit.`);
    }

    const safeId = `ref-${crypto.randomUUID().slice(0, 12)}`;
    const safeName = sanitizeFilename(filename, `ref-${type}`);

    // LRU eviction if cache grows
    if (this.assets.size >= this.maxItems) {
      const oldestKey = this.assets.keys().next().value;
      if (oldestKey) {
        this.assets.delete(oldestKey);
      }
    }

    const referenceInput: ReferenceInput = ReferenceInputSchema.parse({
      id: safeId,
      type,
      displayName: safeName,
      mimeType: meta.mimeType,
      fileSizeBytes: meta.sizeBytes,
      dimensions: {
        width: meta.width,
        height: meta.height,
      },
      createdAt: new Date().toISOString(),
      status: 'pending',
      userDescription: userDescription?.slice(0, 500),
    });

    this.assets.set(safeId, {
      input: referenceInput,
      buffer,
    });

    return referenceInput;
  }

  getReference(id: string): StoredReferenceAsset | undefined {
    return this.assets.get(id);
  }

  deleteReference(id: string): boolean {
    return this.assets.delete(id);
  }

  count(): number {
    return this.assets.size;
  }
}

export const referenceStorageService: IReferenceStorageService = new MemoryReferenceStorageService();
