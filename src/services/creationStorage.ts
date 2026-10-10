import {
  type SavedCreation,
  SavedCreationSchema,
} from '../types/creation.js';

const STORAGE_KEY = 'draw2play_my_creations_v1';

/**
 * In-memory fallback if localStorage is unavailable (e.g. SSR, restricted iframe, private mode)
 */
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
    // If QuotaExceededError or security error, save to memory and bubble informative error
    memoryFallbackStore[key] = value;
    if (err instanceof Error && err.name === 'QuotaExceededError') {
      throw new Error('Browser storage is full. Please delete older levels to free up space.');
    }
  }
}

/**
 * Safely retrieves all saved creations with schema validation and error isolation.
 * If one stored item is corrupted, it skips only that item without wiping the others.
 */
export function getAllCreations(): SavedCreation[] {
  const raw = getStorageItem(STORAGE_KEY);
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[CreationStorage] Malformed JSON in storage:', err);
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const validCreations: SavedCreation[] = [];

  for (const item of parsed) {
    // Migrate or normalize item if needed
    try {
      const validated = SavedCreationSchema.parse(item);
      validCreations.push(validated);
    } catch (validationErr) {
      console.warn('[CreationStorage] Skipped corrupted or obsolete creation record:', validationErr);
    }
  }

  // Sort by updatedAt descending (newest first)
  return validCreations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Retrieves a single creation by ID
 */
export function getCreationById(id: string): SavedCreation | null {
  const all = getAllCreations();
  return all.find((c) => c.id === id) || null;
}

export interface SaveCreationInput {
  id?: string;
  name: string;
  document: SavedCreation['document'];
  playableScene?: SavedCreation['playableScene'];
  thumbnailDataUrl?: string;
  provenance?: SavedCreation['provenance'];
  tags?: string[];
}

/**
 * Saves a creation (creates new if id is omitted or doesn't exist, updates if it exists)
 */
export function saveCreation(input: SaveCreationInput): SavedCreation {
  const all = getAllCreations();
  const now = new Date().toISOString();

  const id = input.id || `creation-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const existingIndex = all.findIndex((c) => c.id === id);

  const creationToSave: SavedCreation = {
    id,
    name: input.name.trim() || 'Untitled Level',
    createdAt: existingIndex >= 0 ? all[existingIndex].createdAt : now,
    updatedAt: now,
    document: {
      ...input.document,
      name: input.name.trim() || input.document.name || 'Untitled Level',
      updatedAt: now,
    },
    playableScene: input.playableScene !== undefined
      ? input.playableScene
      : (existingIndex >= 0 ? all[existingIndex].playableScene : undefined),
    thumbnailDataUrl: input.thumbnailDataUrl !== undefined
      ? input.thumbnailDataUrl
      : (existingIndex >= 0 ? all[existingIndex].thumbnailDataUrl : undefined),
    provenance: input.provenance || (existingIndex >= 0 ? all[existingIndex].provenance : 'local-vector'),
    schemaVersion: '1.0',
    tags: input.tags || (existingIndex >= 0 ? all[existingIndex].tags : []),
  };

  // Validate before committing
  const validated = SavedCreationSchema.parse(creationToSave);

  if (existingIndex >= 0) {
    all[existingIndex] = validated;
  } else {
    all.unshift(validated);
  }

  setStorageItem(STORAGE_KEY, JSON.stringify(all));
  return validated;
}

/**
 * Renames an existing creation
 */
export function renameCreation(id: string, newName: string): boolean {
  if (!newName.trim()) return false;
  const all = getAllCreations();
  const index = all.findIndex((c) => c.id === id);
  if (index === -1) return false;

  const now = new Date().toISOString();
  all[index].name = newName.trim();
  all[index].document.name = newName.trim();
  all[index].updatedAt = now;

  setStorageItem(STORAGE_KEY, JSON.stringify(all));
  return true;
}

/**
 * Duplicates an existing creation
 */
export function duplicateCreation(id: string): SavedCreation | null {
  const source = getCreationById(id);
  if (!source) return null;

  return saveCreation({
    name: `${source.name} (Copy)`,
    document: {
      ...source.document,
      id: `doc-${Date.now()}`,
    },
    playableScene: source.playableScene ? { ...source.playableScene } : undefined,
    thumbnailDataUrl: source.thumbnailDataUrl,
    provenance: source.provenance,
    tags: [...source.tags],
  });
}

/**
 * Deletes a creation by ID
 */
export function deleteCreation(id: string): boolean {
  const all = getAllCreations();
  const filtered = all.filter((c) => c.id !== id);
  if (filtered.length === all.length) return false;

  setStorageItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * Exports a creation as JSON string
 */
export function exportCreationJson(id: string): string {
  const creation = getCreationById(id);
  if (!creation) throw new Error(`Creation with ID "${id}" not found.`);
  return JSON.stringify(creation, null, 2);
}

/**
 * Clear all creations (primarily for testing or reset)
 */
export function clearAllCreationsForTest(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
  memoryFallbackStore = {};
}
