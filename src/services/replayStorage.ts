import {
  type ReplayData,
  ReplayDataSchema,
} from '../types/replay.js';

const STORAGE_KEY = 'draw2play_my_replays_v1';

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
  } catch {
    memoryFallbackStore[key] = value;
  }
}

/**
 * Stage 8: Local Replay Storage Service
 * Persists personal best ghost runs and recorded replays with schema validation.
 */
export function getAllSavedReplays(): ReplayData[] {
  const raw = getStorageItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const validReplays: ReplayData[] = [];
    for (const item of parsed) {
      try {
        const validated = ReplayDataSchema.parse(item);
        validReplays.push(validated);
      } catch (err) {
        console.warn('[ReplayStorage] Skipped corrupted replay record:', err);
      }
    }
    return validReplays;
  } catch (err) {
    console.warn('[ReplayStorage] Failed to parse replays from storage:', err);
    return [];
  }
}

export function getBestReplayForLevel(levelId: string): ReplayData | null {
  const all = getAllSavedReplays();
  const matching = all.filter((r) => r.levelId === levelId && r.summary.completed);
  if (matching.length === 0) {
    // Return any non-completed run if no completed run exists
    return all.find((r) => r.levelId === levelId) || null;
  }

  // Sort by shortest duration (fastest win)
  matching.sort((a, b) => a.summary.durationMs - b.summary.durationMs);
  return matching[0];
}

export function saveReplay(replay: ReplayData): boolean {
  try {
    const validated = ReplayDataSchema.parse(replay);
    const existing = getAllSavedReplays();

    // Check if this level already has a recorded run
    const existingIdx = existing.findIndex((r) => r.replayId === validated.replayId);
    if (existingIdx >= 0) {
      existing[existingIdx] = validated;
    } else {
      existing.unshift(validated);
    }

    // Limit stored replays to 50 max to prevent exceeding localStorage limits
    const pruned = existing.slice(0, 50);
    setStorageItem(STORAGE_KEY, JSON.stringify(pruned));
    return true;
  } catch (err) {
    console.error('[ReplayStorage] Failed to save replay:', err);
    return false;
  }
}

export function deleteReplay(replayId: string): boolean {
  try {
    const existing = getAllSavedReplays();
    const filtered = existing.filter((r) => r.replayId !== replayId);
    setStorageItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}

export function clearAllReplaysForTest(): void {
  memoryFallbackStore = {};
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore in Node environment
  }
}
