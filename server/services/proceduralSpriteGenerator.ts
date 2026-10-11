import { rgbaToPngDataUrl } from '../utils/pngEncoder.js';
import type { AssetRole } from '../../src/types/plan.js';

interface ColorRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Converts a hex color string to RGBA */
function hexToRgba(hex: string, alpha = 255): ColorRgba {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) {
    return { r: 56, g: 189, b: 248, a: alpha }; // fallback cyan
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
    a: alpha,
  };
}

/** Minimal software rasterizer canvas buffer */
class PixelCanvas {
  public readonly width: number;
  public readonly height: number;
  public readonly buffer: Buffer;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.buffer = Buffer.alloc(width * height * 4); // 0-initialized = transparent black
  }

  public setPixel(x: number, y: number, color: ColorRgba): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (Math.floor(y) * this.width + Math.floor(x)) * 4;
    // Simple Alpha blending
    const srcA = color.a / 255;
    if (srcA >= 0.99) {
      this.buffer[idx] = color.r;
      this.buffer[idx + 1] = color.g;
      this.buffer[idx + 2] = color.b;
      this.buffer[idx + 3] = color.a;
    } else {
      const dstA = this.buffer[idx + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA > 0) {
        this.buffer[idx] = Math.round((color.r * srcA + this.buffer[idx] * dstA * (1 - srcA)) / outA);
        this.buffer[idx + 1] = Math.round((color.g * srcA + this.buffer[idx + 1] * dstA * (1 - srcA)) / outA);
        this.buffer[idx + 2] = Math.round((color.b * srcA + this.buffer[idx + 2] * dstA * (1 - srcA)) / outA);
        this.buffer[idx + 3] = Math.round(outA * 255);
      }
    }
  }

  public fillRect(x: number, y: number, w: number, h: number, color: ColorRgba): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.floor(x + w));
    const y1 = Math.min(this.height, Math.floor(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        this.setPixel(px, py, color);
      }
    }
  }

  public fillCircle(cx: number, cy: number, radius: number, color: ColorRgba): void {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(this.width, Math.ceil(cx + radius));
    const y1 = Math.min(this.height, Math.ceil(cy + radius));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy <= r2) {
          this.setPixel(px, py, color);
        }
      }
    }
  }

  public strokeCircle(cx: number, cy: number, radius: number, color: ColorRgba, thickness = 1): void {
    const rOuter = radius + thickness / 2;
    const rInner = Math.max(0, radius - thickness / 2);
    const r2Out = rOuter * rOuter;
    const r2In = rInner * rInner;
    const x0 = Math.max(0, Math.floor(cx - rOuter));
    const y0 = Math.max(0, Math.floor(cy - rOuter));
    const x1 = Math.min(this.width, Math.ceil(cx + rOuter));
    const y1 = Math.min(this.height, Math.ceil(cy + rOuter));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const d2 = (px - cx) ** 2 + (py - cy) ** 2;
        if (d2 <= r2Out && d2 >= r2In) {
          this.setPixel(px, py, color);
        }
      }
    }
  }

  public toDataUrl(): string {
    return rgbaToPngDataUrl(this.width, this.height, this.buffer);
  }
}

/**
 * Generates an original, thematic procedural pixel-art sprite with transparent background.
 */
export function generateProceduralSprite(
  role: AssetRole,
  options: {
    width?: number;
    height?: number;
    theme?: string;
    palette?: string[];
  } = {}
): { dataUrl: string; width: number; height: number; mimeType: string } {
  const _theme = options.theme || 'default';
  const palette = options.palette && options.palette.length > 0
    ? options.palette
    : ['#06b6d4', '#8b5cf6', '#22c55e', '#facc15', '#ef4444', '#0f172a'];

  const primaryCol = hexToRgba(palette[0] || '#06b6d4');
  const secondaryCol = hexToRgba(palette[1] || '#8b5cf6');
  const accentCol = hexToRgba(palette[2] || '#facc15');
  const darkCol = hexToRgba('#090d16');
  const whiteCol = hexToRgba('#ffffff');

  switch (role) {
    case 'player': {
      const w = options.width || 36;
      const h = options.height || 36;
      const canvas = new PixelCanvas(w, h);
      const cx = w / 2;
      const cy = h / 2;

      // 1. Shadow / Base
      canvas.fillCircle(cx, cy, 14, primaryCol);
      canvas.strokeCircle(cx, cy, 14, darkCol, 2);

      // 2. Visor / Headband
      canvas.fillRect(cx - 10, cy - 6, 20, 6, secondaryCol);

      // 3. Dual Eyes
      canvas.fillCircle(cx - 4, cy - 2, 3, whiteCol);
      canvas.fillCircle(cx + 4, cy - 2, 3, whiteCol);
      canvas.fillCircle(cx - 3, cy - 2, 1.5, darkCol);
      canvas.fillCircle(cx + 5, cy - 2, 1.5, darkCol);

      // 4. Accent crest / helmet shine
      canvas.fillRect(cx - 3, cy - 14, 6, 4, accentCol);
      canvas.fillCircle(cx - 5, cy - 8, 2, whiteCol);

      return { dataUrl: canvas.toDataUrl(), width: w, height: h, mimeType: 'image/png' };
    }

    case 'enemy': {
      const w = options.width || 32;
      const h = options.height || 32;
      const canvas = new PixelCanvas(w, h);
      const cx = w / 2;
      const cy = h / 2;
      const enemyCol = hexToRgba('#ef4444');
      const eyeCol = hexToRgba('#fef08a');

      // 1. Spiky drone body
      canvas.fillCircle(cx, cy, 13, enemyCol);
      canvas.strokeCircle(cx, cy, 13, darkCol, 2);

      // 2. Antennae / Horns
      canvas.fillRect(cx - 8, cy - 14, 3, 5, darkCol);
      canvas.fillRect(cx + 5, cy - 14, 3, 5, darkCol);

      // 3. Glowing menacing eyes
      canvas.fillRect(cx - 7, cy - 3, 5, 4, eyeCol);
      canvas.fillRect(cx + 2, cy - 3, 5, 4, eyeCol);
      canvas.fillRect(cx - 5, cy - 2, 2, 2, darkCol);
      canvas.fillRect(cx + 4, cy - 2, 2, 2, darkCol);

      // 4. Warning mouth / teeth
      canvas.fillRect(cx - 6, cy + 5, 12, 3, darkCol);
      canvas.fillRect(cx - 4, cy + 5, 2, 2, whiteCol);
      canvas.fillRect(cx + 2, cy + 5, 2, 2, whiteCol);

      return { dataUrl: canvas.toDataUrl(), width: w, height: h, mimeType: 'image/png' };
    }

    case 'collectible': {
      const w = options.width || 24;
      const h = options.height || 24;
      const canvas = new PixelCanvas(w, h);
      const cx = w / 2;
      const cy = h / 2;
      const goldCol = hexToRgba(palette[3] || '#facc15');
      const amberCol = hexToRgba('#b45309');

      // Faceted Gem / Diamond shape
      canvas.fillCircle(cx, cy, 9, goldCol);
      canvas.strokeCircle(cx, cy, 9, amberCol, 2);

      // Inner facet ring
      canvas.strokeCircle(cx, cy, 5, whiteCol, 1);
      // Sparkle glint
      canvas.fillRect(cx - 4, cy - 6, 3, 3, whiteCol);
      canvas.fillRect(cx + 2, cy + 2, 2, 2, whiteCol);

      return { dataUrl: canvas.toDataUrl(), width: w, height: h, mimeType: 'image/png' };
    }

    case 'hazard': {
      const w = options.width || 24;
      const h = options.height || 24;
      const canvas = new PixelCanvas(w, h);
      const hazardCol = hexToRgba('#dc2626');
      const tipCol = hexToRgba('#fbbf24');

      // Dual spikes
      for (let px = 0; px < 12; px++) {
        const spikeHeight = Math.floor(px * 1.8);
        canvas.fillRect(px, 24 - spikeHeight, 1, spikeHeight, hazardCol);
      }
      for (let px = 12; px < 24; px++) {
        const spikeHeight = Math.floor((24 - px) * 1.8);
        canvas.fillRect(px, 24 - spikeHeight, 1, spikeHeight, hazardCol);
      }

      // Hot tips
      canvas.fillRect(5, 6, 2, 4, tipCol);
      canvas.fillRect(17, 6, 2, 4, tipCol);

      // Base plate
      canvas.fillRect(0, 21, 24, 3, darkCol);

      return { dataUrl: canvas.toDataUrl(), width: w, height: h, mimeType: 'image/png' };
    }

    case 'goal': {
      const w = options.width || 36;
      const h = options.height || 48;
      const canvas = new PixelCanvas(w, h);
      const cx = w / 2;
      const cy = h / 2;
      const portalRing = hexToRgba(palette[1] || '#8b5cf6');
      const portalCore = hexToRgba(palette[0] || '#06b6d4');

      // Outer swirling aura
      canvas.fillCircle(cx, cy, 18, portalRing);
      canvas.strokeCircle(cx, cy, 18, whiteCol, 1.5);

      // Inner vortex core
      canvas.fillCircle(cx, cy, 10, portalCore);
      canvas.fillCircle(cx, cy, 4, whiteCol);

      // Swirling portal motes
      canvas.fillRect(cx - 14, cy - 10, 3, 3, accentCol);
      canvas.fillRect(cx + 10, cy + 8, 3, 3, accentCol);
      canvas.fillRect(cx - 8, cy + 12, 2, 2, whiteCol);

      return { dataUrl: canvas.toDataUrl(), width: w, height: h, mimeType: 'image/png' };
    }

    case 'platform': {
      const w = options.width || 64;
      const h = options.height || 32;
      const canvas = new PixelCanvas(w, h);
      const platFill = hexToRgba(palette[2] || '#15803d');
      const platRim = hexToRgba(palette[0] || '#22c55e');

      // Main stone/metal slab
      canvas.fillRect(0, 0, w, h, platFill);
      // Outer bevel border
      canvas.fillRect(0, 0, w, 2, platRim);
      canvas.fillRect(0, h - 2, w, 2, darkCol);
      canvas.fillRect(0, 0, 2, h, platRim);
      canvas.fillRect(w - 2, 0, 2, h, darkCol);

      // Inner brick mortar lines
      for (let x = 16; x < w; x += 16) {
        canvas.fillRect(x, 4, 1, h - 8, darkCol);
      }
      canvas.fillRect(4, 16, w - 8, 1, darkCol);

      return { dataUrl: canvas.toDataUrl(), width: w, height: h, mimeType: 'image/png' };
    }

    case 'background': {
      const w = options.width || 400;
      const h = options.height || 240;
      const canvas = new PixelCanvas(w, h);
      const bgTop = hexToRgba('#05070f');
      const bgBottom = hexToRgba('#111827');

      // Atmospheric vertical gradient
      for (let y = 0; y < h; y++) {
        const ratio = y / h;
        const r = Math.round(bgTop.r * (1 - ratio) + bgBottom.r * ratio);
        const g = Math.round(bgTop.g * (1 - ratio) + bgBottom.g * ratio);
        const b = Math.round(bgTop.b * (1 - ratio) + bgBottom.b * ratio);
        canvas.fillRect(0, y, w, 1, { r, g, b, a: 255 });
      }

      // Neon horizon grid lines
      const gridCol = hexToRgba(palette[0] || '#06b6d4', 60);
      for (let y = Math.floor(h * 0.6); y < h; y += 12) {
        canvas.fillRect(0, y, w, 1, gridCol);
      }
      for (let x = 0; x < w; x += 32) {
        canvas.fillRect(x, Math.floor(h * 0.6), 1, Math.floor(h * 0.4), gridCol);
      }

      // Distant stars / light motes
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97) % w;
        const sy = (i * 53) % Math.floor(h * 0.55);
        canvas.fillRect(sx, sy, 2, 2, { r: 255, g: 255, b: 255, a: 180 });
      }

      return { dataUrl: canvas.toDataUrl(), width: w, height: h, mimeType: 'image/png' };
    }
  }
}

/**
 * Returns just the data URL for a procedural sprite.
 */
export function generateProceduralSpriteDataUrl(
  role: AssetRole,
  width?: number,
  height?: number,
  theme?: string
): string {
  return generateProceduralSprite(role, { width, height, theme }).dataUrl;
}

/**
 * Generates procedural sprites in batch for a list of role specs.
 */
export function generateAllProceduralAssets(
  specs: Array<{ role: AssetRole; width?: number; height?: number }>,
  theme?: string
): Map<AssetRole, string> {
  const result = new Map<AssetRole, string>();
  for (const spec of specs) {
    result.set(spec.role, generateProceduralSpriteDataUrl(spec.role, spec.width, spec.height, theme));
  }
  return result;
}
