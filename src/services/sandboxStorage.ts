import type { SandboxSaveData } from '../types/sandbox.js';
import { SandboxSaveDataSchema } from '../types/sandbox.js';

const SANDBOX_STORAGE_KEY = 'draw2play_sandbox_save_v1';

let memoryFallbackStore: Record<string, string> = {};

function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryFallbackStore[key] || null;
  } catch {
    return memoryFallbackStore[key] || null;
  }
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    memoryFallbackStore[key] = value;
  } catch (err: unknown) {
    memoryFallbackStore[key] = value;
    if (err instanceof Error && err.name === 'QuotaExceededError') {
      throw new Error('Browser storage is full. Please free up space.');
    }
  }
}

function removeStorageItem(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    delete memoryFallbackStore[key];
  } catch {
    delete memoryFallbackStore[key];
  }
}

/**
 * Saves sandbox world and player state with strict schema validation
 */
/**
 * Saves sandbox world and player state with strict schema validation
 */
export function saveSandbox(data: SandboxSaveData): boolean {
  try {
    const validated = SandboxSaveDataSchema.parse(data);
    setStorageItem(SANDBOX_STORAGE_KEY, JSON.stringify(validated));
    return true;
  } catch (err) {
    console.warn('[SandboxStorage] Failed to save sandbox data:', err);
    return false;
  }
}

export const saveSandboxGame = saveSandbox;

/**
 * Safely migrates legacy v1.0 sandbox save data to current format.
 * Preserves all original world tiles, player coordinates, and inventory counts.
 */
export function migrateSandboxSave(raw: unknown): SandboxSaveData | null {
  if (!raw || typeof raw !== 'object') return null;

  try {
    const data = { ...(raw as Record<string, any>) };

    // If it is already v2.0 and valid, return parsed directly
    if (data.schemaVersion === '2.0') {
      const directParse = SandboxSaveDataSchema.safeParse(data);
      if (directParse.success) {
        return directParse.data;
      }
    }

    // Handle legacy v1.0 structure
    if (data.player && typeof data.player === 'object') {
      const playerObj = { ...data.player };
      if (playerObj.inventory && typeof playerObj.inventory === 'object') {
        const invObj = { ...playerObj.inventory };
        if (!Array.isArray(invObj.hotbar)) {
          invObj.hotbar = ['grass', 'dirt', 'stone', 'wood'];
        }
        playerObj.inventory = invObj;
      }
      data.player = playerObj;
    }

    if (!data.schemaVersion || data.schemaVersion === '1.0') {
      data.schemaVersion = '2.0';
    }

    const migrated = SandboxSaveDataSchema.safeParse(data);
    return migrated.success ? migrated.data : null;
  } catch {
    return null;
  }
}

/**
 * Loads and validates saved sandbox world state. Returns null if missing or corrupted.
 */
export function loadSandbox(): SandboxSaveData | null {
  const raw = getStorageItem(SANDBOX_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const result = SandboxSaveDataSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }

    // Try migration for legacy saves
    const migrated = migrateSandboxSave(parsed);
    if (migrated) {
      saveSandbox(migrated);
      return migrated;
    }

    console.warn('[SandboxStorage] Corrupted sandbox save detected:', result.error.format());
    return null;
  } catch (err) {
    console.warn('[SandboxStorage] Failed to parse sandbox save JSON:', err);
    return null;
  }
}

export const loadSandboxGame = loadSandbox;

/**
 * Validates arbitrary data against SandboxSaveDataSchema. Returns parsed data or null.
 */
export function validateSandboxSaveData(data: unknown): SandboxSaveData | null {
  const result = SandboxSaveDataSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Checks if a valid sandbox save exists
 */
export function hasSandboxSave(): boolean {
  return loadSandbox() !== null;
}

/**
 * Clears the saved sandbox world
 */
export function clearSandboxSave(): void {
  removeStorageItem(SANDBOX_STORAGE_KEY);
}

export function clearSandboxGameForTest(): void {
  removeStorageItem(SANDBOX_STORAGE_KEY);
  memoryFallbackStore = {};
}

/**
 * Reset memory fallback for testing isolation
 */
export function clearMemoryFallbackForTesting(): void {
  memoryFallbackStore = {};
}
