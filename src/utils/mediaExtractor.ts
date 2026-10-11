/**
 * Media Extractor Utilities
 * Handles client-side video frame capture and image file reading without external binaries.
 */

export interface ExtractedFrame {
  dataUrl: string;
  width: number;
  height: number;
  timestampSeconds: number;
  videoDurationSeconds: number;
}

export interface LoadedImageMedia {
  dataUrl: string; // Analysis payload (resized preserving aspect ratio only if > 2048px)
  originalDataUrl: string; // Pristine original image preserved for preview and reanalysis
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  fileSizeBytes: number;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  fileName: string;
  wasResized: boolean;
}

const SUPPORTED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_ANALYSIS_DIMENSION = 2048; // Max width/height sent to AI; above this safe downscale occurs

/**
 * Reads an image File into a data URL, enforces validation and decoding checks,
 * and preserves the original image while safely resizing if necessary.
 */
export async function loadImageFile(file: File): Promise<LoadedImageMedia> {
  // 1. Empty file validation
  if (!file || file.size === 0) {
    throw new Error('Image file is empty (0 bytes).');
  }

  // 2. File size validation before expensive decoding
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(`Image file size (${sizeMb}MB) exceeds the maximum allowed limit of 10MB.`);
  }

  // 3. Supported image format check
  let detectedMime = file.type;
  if (!detectedMime) {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.png')) detectedMime = 'image/png';
    else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) detectedMime = 'image/jpeg';
    else if (lowerName.endsWith('.webp')) detectedMime = 'image/webp';
  }

  if (!SUPPORTED_MIME_TYPES.has(detectedMime)) {
    throw new Error(
      `Unsupported image format "${file.type || file.name}". Only PNG, JPEG, and WebP images are supported.`
    );
  }

  const mimeType = detectedMime as 'image/png' | 'image/jpeg' | 'image/webp';

  // 4. Real image decoding check using FileReader + Image element
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read image file data.'));
    };

    reader.onload = () => {
      const originalDataUrl = reader.result as string;
      const img = new Image();

      img.onload = () => {
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;

        if (!naturalWidth || !naturalHeight || naturalWidth <= 0 || naturalHeight <= 0) {
          reject(new Error('Image decoding failed: image has invalid dimensions (0x0).'));
          return;
        }

        // 5. Safe resizing ONLY when necessary (> 2048px), preserving aspect ratio
        if (naturalWidth <= MAX_ANALYSIS_DIMENSION && naturalHeight <= MAX_ANALYSIS_DIMENSION) {
          resolve({
            dataUrl: originalDataUrl,
            originalDataUrl,
            width: naturalWidth,
            height: naturalHeight,
            originalWidth: naturalWidth,
            originalHeight: naturalHeight,
            fileSizeBytes: file.size,
            mimeType,
            fileName: file.name,
            wasResized: false,
          });
          return;
        }

        // Compute aspect-ratio preserved dimensions
        const scale = Math.min(
          MAX_ANALYSIS_DIMENSION / naturalWidth,
          MAX_ANALYSIS_DIMENSION / naturalHeight
        );
        const targetWidth = Math.round(naturalWidth * scale);
        const targetHeight = Math.round(naturalHeight * scale);

        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            // Fallback to original if offscreen context creation fails
            resolve({
              dataUrl: originalDataUrl,
              originalDataUrl,
              width: naturalWidth,
              height: naturalHeight,
              originalWidth: naturalWidth,
              originalHeight: naturalHeight,
              fileSizeBytes: file.size,
              mimeType,
              fileName: file.name,
              wasResized: false,
            });
            return;
          }

          // Clear rect ensures transparency in PNG/WebP is preserved
          ctx.clearRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          const analysisDataUrl = canvas.toDataURL(mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png');

          resolve({
            dataUrl: analysisDataUrl,
            originalDataUrl,
            width: targetWidth,
            height: targetHeight,
            originalWidth: naturalWidth,
            originalHeight: naturalHeight,
            fileSizeBytes: file.size,
            mimeType,
            fileName: file.name,
            wasResized: true,
          });
        } catch {
          // If canvas operations fail, resolve with original
          resolve({
            dataUrl: originalDataUrl,
            originalDataUrl,
            width: naturalWidth,
            height: naturalHeight,
            originalWidth: naturalWidth,
            originalHeight: naturalHeight,
            fileSizeBytes: file.size,
            mimeType,
            fileName: file.name,
            wasResized: false,
          });
        }
      };

      img.onerror = () => {
        reject(new Error('Image data is corrupted or cannot be decoded into valid pixels.'));
      };

      img.src = originalDataUrl;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Extracts a single frame from a video File at the requested time position.
 */
export async function extractVideoFrame(
  file: File,
  targetTimeSeconds = 0.5
): Promise<ExtractedFrame> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.remove();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video file for frame extraction.'));
    };

    video.onloadedmetadata = () => {
      // Clamp target time to video duration
      const seekTime = Math.min(Math.max(0, targetTimeSeconds), Math.max(0, video.duration - 0.1));
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const width = video.videoWidth || 800;
        const height = video.videoHeight || 600;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Failed to acquire 2D canvas context for frame capture.'));
          return;
        }

        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');

        const result: ExtractedFrame = {
          dataUrl,
          width,
          height,
          timestampSeconds: video.currentTime,
          videoDurationSeconds: video.duration || 0,
        };

        cleanup();
        resolve(result);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.src = objectUrl;
  });
}
