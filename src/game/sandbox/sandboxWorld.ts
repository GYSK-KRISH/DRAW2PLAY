import type {
  SandboxTileType,
  PlaceableBlockType,
  SandboxWorldData,
} from '../../types/sandbox.js';
import { isTileSolid } from '../../types/sandbox.js';

export const DEFAULT_SANDBOX_COLS = 64;
export const DEFAULT_SANDBOX_ROWS = 36;
export const DEFAULT_SANDBOX_TILE_SIZE = 32;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Checks if two axis-aligned bounding boxes intersect
 */
export function rectanglesIntersect(r1: Rect, r2: Rect): boolean {
  return !(
    r1.x + r1.width <= r2.x ||
    r2.x + r2.width <= r1.x ||
    r1.y + r1.height <= r2.y ||
    r2.y + r2.height <= r1.y
  );
}

/**
 * Generates a bounded, procedural 2D sandbox terrain with rolling hills and trees
 */
export function generateDefaultSandboxWorld(
  cols = DEFAULT_SANDBOX_COLS,
  rows = DEFAULT_SANDBOX_ROWS,
  tileSize = DEFAULT_SANDBOX_TILE_SIZE
): SandboxWorldData {
  const tiles: SandboxTileType[][] = [];

  // 1. Initialize grid with air
  for (let r = 0; r < rows; r++) {
    tiles.push(new Array<SandboxTileType>(cols).fill('air'));
  }

  // 2. Generate layered terrain (Air -> Grass -> Dirt -> Stone)
  const surfaceBaseRow = Math.floor(rows * 0.52); // ~row 18
  const surfaceHeights: number[] = [];

  for (let c = 0; c < cols; c++) {
    // Gentle rolling hills formula
    const elevationOffset = Math.round(
      Math.sin(c / 5) * 1.5 + Math.cos(c / 9) * 1.0
    );
    const surfaceRow = Math.max(8, Math.min(rows - 8, surfaceBaseRow + elevationOffset));
    surfaceHeights.push(surfaceRow);

    for (let r = 0; r < rows; r++) {
      if (r < surfaceRow) {
        tiles[r][c] = 'air';
      } else if (r === surfaceRow) {
        tiles[r][c] = 'grass';
      } else if (r <= surfaceRow + 4) {
        tiles[r][c] = 'dirt';
      } else {
        tiles[r][c] = 'stone';
      }
    }
  }

  // 3. Plant natural trees on safe surface points
  const treeCols = [8, 20, 35, 48, 58];
  for (const c of treeCols) {
    if (c >= 2 && c < cols - 2) {
      const groundRow = surfaceHeights[c];
      // Trunk (3 wood blocks high)
      for (let offset = 1; offset <= 3; offset++) {
        const trunkRow = groundRow - offset;
        if (trunkRow >= 0) {
          tiles[trunkRow][c] = 'wood';
        }
      }
      // Canopy (wood branches)
      const topRow = groundRow - 4;
      if (topRow >= 0) {
        tiles[topRow][c] = 'wood';
        if (c > 0) tiles[topRow][c - 1] = 'wood';
        if (c < cols - 1) tiles[topRow][c + 1] = 'wood';
      }
    }
  }

  // 4. Safe player spawn point above surface
  const spawnCol = 12;
  const spawnRow = Math.max(2, surfaceHeights[spawnCol] - 2);
  const spawnPoint = {
    x: spawnCol * tileSize + tileSize / 2,
    y: spawnRow * tileSize,
  };

  return {
    cols,
    rows,
    tileSize,
    tiles,
    spawnPoint,
  };
}

/**
 * Checks if grid coordinates are within the world bounds
 */
export function isValidCoordinate(
  world: SandboxWorldData,
  col: number,
  row: number
): boolean {
  return col >= 0 && col < world.cols && row >= 0 && row < world.rows;
}

/**
 * Safely gets tile at coordinate, returning 'air' if out-of-bounds
 */
export function getTile(
  world: SandboxWorldData,
  col: number,
  row: number
): SandboxTileType {
  if (!isValidCoordinate(world, col, row)) {
    return 'air';
  }
  return world.tiles[row][col];
}

/**
 * Safely sets tile at coordinate, returning true if successful
 */
export function setTile(
  world: SandboxWorldData,
  col: number,
  row: number,
  tileType: SandboxTileType
): boolean {
  if (!isValidCoordinate(world, col, row)) {
    return false;
  }
  world.tiles[row][col] = tileType;
  return true;
}

/**
 * Checks whether a block can be legally placed at (col, row)
 */
export function canPlaceBlock(
  world: SandboxWorldData,
  col: number,
  row: number,
  playerBounds?: Rect
): { allowed: boolean; reason?: string } {
  if (!isValidCoordinate(world, col, row)) {
    return { allowed: false, reason: 'Target location is outside world boundaries.' };
  }

  const existing = world.tiles[row][col];
  if (existing !== 'air') {
    return { allowed: false, reason: 'A block already occupies this space.' };
  }

  if (playerBounds) {
    const tileRect: Rect = {
      x: col * world.tileSize,
      y: row * world.tileSize,
      width: world.tileSize,
      height: world.tileSize,
    };

    if (rectanglesIntersect(tileRect, playerBounds)) {
      return { allowed: false, reason: 'Cannot place a block inside the player!' };
    }
  }

  return { allowed: true };
}

/**
 * Mines a block at (col, row), converting it to air and returning the mined tile type
 */
export function mineBlock(
  world: SandboxWorldData,
  col: number,
  row: number
): { minedTile: PlaceableBlockType } | null {
  if (!isValidCoordinate(world, col, row)) {
    return null;
  }

  const current = world.tiles[row][col];
  if (!isTileSolid(current) || current === 'air') {
    return null;
  }

  world.tiles[row][col] = 'air';
  return { minedTile: current as PlaceableBlockType };
}

/**
 * Places a block at (col, row) after validating constraints
 */
export function placeBlock(
  world: SandboxWorldData,
  col: number,
  row: number,
  tileType: PlaceableBlockType,
  playerBounds?: Rect
): { success: boolean; reason?: string } {
  const check = canPlaceBlock(world, col, row, playerBounds);
  if (!check.allowed) {
    return { success: false, reason: check.reason };
  }

  setTile(world, col, row, tileType);
  return { success: true };
}
