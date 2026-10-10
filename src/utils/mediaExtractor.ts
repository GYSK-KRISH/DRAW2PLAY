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
  dataUrl: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  mimeType: string;
  fileName: string;
}

/**
 * Reads an image File into a data URL and computes its natural pixel dimensions.
 */
export async function loadImageFile(file: File): Promise<LoadedImageMedia> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read image file.'));
    };

    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();

      img.onload = () => {
        resolve({
          dataUrl,
          width: img.naturalWidth || 800,
          height: img.naturalHeight || 600,
          fileSizeBytes: file.size,
          mimeType: file.type || 'image/png',
          fileName: file.name,
        });
      };

      img.onerror = () => {
        reject(new Error('Image data is corrupted or cannot be decoded.'));
      };

      img.src = dataUrl;
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
