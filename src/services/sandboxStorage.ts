import type { SandboxSaveData } from '../types/sandbox.js';
import { SandboxSaveDataSchema } from '../types/sandbox.js';

export const SANDBOX_STORAGE_KEY = 'draw2play_sandbox_save_v1';
export const SANDBOX_CORRUPTED_BACKUP_KEY = 'draw2play_sandbox_save_corrupted_backup';

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
 * Sanitizes and bounds checks loaded save data to protect against out-of-bounds coordinates
 * or invalid items without destroying valid world state.
 */
export function sanitizeLoadedSave(save: SandboxSaveData): SandboxSaveData {
  const sanitized = { ...save };
  const worldWidth = sanitized.world.cols * sanitized.world.tileSize;
  const worldHeight = sanitized.world.rows * sanitized.world.tileSize;

  // 1. Clamp player coordinates if corrupted or out-of-bounds
  let { x, y } = sanitized.player;
  if (typeof x !== 'number' || isNaN(x)) {
    x = 496;
  } else {
    x = Math.max(32, Math.min(worldWidth - 32, x));
  }
  if (typeof y !== 'number' || isNaN(y)) {
    y = 464;
  } else {
    y = Math.max(32, Math.min(worldHeight - 32, y));
  }
  sanitized.player = {
    ...sanitized.player,
    x,
    y,
  };

  // 2. Sanitize inventory stack limits
  const cleanItems: Record<string, number> = {};
  for (const [key, val] of Object.entries(sanitized.player.inventory.items)) {
    if (typeof val === 'number' && !isNaN(val)) {
      cleanItems[key] = Math.max(0, Math.min(999, Math.floor(val)));
    }
  }
  sanitized.player.inventory.items = cleanItems;

  return sanitized;
}

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
        return sanitizeLoadedSave(directParse.data);
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
    return migrated.success ? sanitizeLoadedSave(migrated.data) : null;
  } catch {
    return null;
  }
}

export interface SandboxSaveStatus {
  hasSave: boolean;
  isValid: boolean;
  isCorrupted: boolean;
  hasQuarantinedBackup: boolean;
  errorMessage?: string;
  saveData?: SandboxSaveData;
}

/**
 * Returns detailed save status and diagnostics without altering storage
 */
export function getSandboxSaveStatus(): SandboxSaveStatus {
  const raw = getStorageItem(SANDBOX_STORAGE_KEY);
  const backup = getStorageItem(SANDBOX_CORRUPTED_BACKUP_KEY);

  if (!raw) {
    return {
      hasSave: false,
      isValid: false,
      isCorrupted: false,
      hasQuarantinedBackup: !!backup,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const parsedValid = SandboxSaveDataSchema.safeParse(parsed);
    if (parsedValid.success) {
      return {
        hasSave: true,
        isValid: true,
        isCorrupted: false,
        hasQuarantinedBackup: !!backup,
        saveData: sanitizeLoadedSave(parsedValid.data),
      };
    }

    const migrated = migrateSandboxSave(parsed);
    if (migrated) {
      return {
        hasSave: true,
        isValid: true,
        isCorrupted: false,
        hasQuarantinedBackup: !!backup,
        saveData: migrated,
      };
    }

    return {
      hasSave: true,
      isValid: false,
      isCorrupted: true,
      hasQuarantinedBackup: !!backup,
      errorMessage: 'Save data contains invalid schema structures.',
    };
  } catch {
    return {
      hasSave: true,
      isValid: false,
      isCorrupted: true,
      hasQuarantinedBackup: !!backup,
      errorMessage: 'Save data contains unparseable JSON.',
    };
  }
}

/**
 * Loads and validates saved sandbox world state.
 * If data is corrupted, preserves a quarantine backup rather than destroying user data silently.
 */
export function loadSandbox(): SandboxSaveData | null {
  const raw = getStorageItem(SANDBOX_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const result = SandboxSaveDataSchema.safeParse(parsed);
    if (result.success) {
      return sanitizeLoadedSave(result.data);
    }

    // Try migration for legacy saves
    const migrated = migrateSandboxSave(parsed);
    if (migrated) {
      saveSandbox(migrated);
      return migrated;
    }

    // Corrupted schema: quarantine original data before returning null
    setStorageItem(SANDBOX_CORRUPTED_BACKUP_KEY, raw);
    console.warn('[SandboxStorage] Corrupted sandbox save detected. Quarantined backup preserved.', result.error.format());
    return null;
  } catch (err) {
    // Malformed JSON: quarantine original data before returning null
    setStorageItem(SANDBOX_CORRUPTED_BACKUP_KEY, raw);
    console.warn('[SandboxStorage] Failed to parse sandbox save JSON. Quarantined backup preserved.', err);
    return null;
  }
}

export const loadSandboxGame = loadSandbox;

/**
 * Validates arbitrary data against SandboxSaveDataSchema. Returns parsed data or null.
 */
export function validateSandboxSaveData(data: unknown): SandboxSaveData | null {
  const result = SandboxSaveDataSchema.safeParse(data);
  return result.success ? sanitizeLoadedSave(result.data) : null;
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
  removeStorageItem(SANDBOX_CORRUPTED_BACKUP_KEY);
  memoryFallbackStore = {};
}

/**
 * Retrieves quarantined backup content if present
 */
export function getQuarantinedBackup(): string | null {
  return getStorageItem(SANDBOX_CORRUPTED_BACKUP_KEY);
}

/**
 * Inject raw string into storage for corrupted data testing
 */
export function setStorageRawForTesting(key: string, value: string): void {
  setStorageItem(key, value);
}

/**
 * Reset memory fallback for testing isolation
 */
export function clearMemoryFallbackForTesting(): void {
  memoryFallbackStore = {};
}
