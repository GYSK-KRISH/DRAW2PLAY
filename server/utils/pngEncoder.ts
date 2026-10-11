import zlib from 'node:zlib';

/** PNG file signature */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Precomputed CRC32 table */
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

/** Computes CRC-32 checksum */
function computeCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Formats a PNG chunk: [length (4B)] [type (4B)] [data (NB)] [crc (4B)] */
function createPngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcData = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(computeCrc32(crcData), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * Encodes raw RGBA buffer into a valid, standard PNG Buffer.
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @param rgbaBuffer Raw pixels buffer of size (width * height * 4) [R, G, B, A]
 */
export function encodeRgbaToPng(width: number, height: number, rgbaBuffer: Buffer): Buffer {
  // 1. IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // Default compression
  ihdr[11] = 0; // Default filter
  ihdr[12] = 0; // No interlace
  const ihdrChunk = createPngChunk('IHDR', ihdr);

  // 2. IDAT scanlines (filter byte 0 at start of each scanline)
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  let srcOffset = 0;
  let dstOffset = 0;

  for (let y = 0; y < height; y++) {
    scanlines[dstOffset++] = 0; // Filter: None
    rgbaBuffer.copy(scanlines, dstOffset, srcOffset, srcOffset + width * 4);
    dstOffset += width * 4;
    srcOffset += width * 4;
  }

  const compressedData = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = createPngChunk('IDAT', compressedData);

  // 3. IEND chunk
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([PNG_SIGNATURE, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Converts RGBA pixels to a standard Data URL (data:image/png;base64,...)
 */
export function rgbaToPngDataUrl(width: number, height: number, rgbaBuffer: Buffer): string {
  const pngBuffer = encodeRgbaToPng(width, height, rgbaBuffer);
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}
