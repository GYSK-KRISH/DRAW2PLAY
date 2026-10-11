import {
  type PublicGalleryItem,
  type GalleryFilterQuery,
  type PublishLevelRequest,
} from '../types/gallery.js';
import type { ReplayData } from '../types/replay.js';

const CREATOR_TOKENS_STORAGE_KEY = 'draw2play_my_creator_tokens_v1';

function getStoredTokens(): Record<string, string> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(CREATOR_TOKENS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    }
  } catch {
    // Ignore fallback
  }
  return {};
}

function saveStoredToken(levelId: string, token: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const tokens = getStoredTokens();
      tokens[levelId] = token;
      window.localStorage.setItem(CREATOR_TOKENS_STORAGE_KEY, JSON.stringify(tokens));
    }
  } catch {
    // Ignore fallback
  }
}

function removeStoredToken(levelId: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const tokens = getStoredTokens();
      delete tokens[levelId];
      window.localStorage.setItem(CREATOR_TOKENS_STORAGE_KEY, JSON.stringify(tokens));
    }
  } catch {
    // Ignore fallback
  }
}

export class GalleryService {
  private apiBase = '/api/gallery';

  public async fetchLevels(
    query: Partial<GalleryFilterQuery> = {}
  ): Promise<{ success: boolean; items: PublicGalleryItem[]; total: number; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (query.search) params.set('search', query.search);
      if (query.templateId && query.templateId !== 'all') params.set('templateId', query.templateId);
      if (query.sortBy) params.set('sortBy', query.sortBy);
      if (query.hasGhostOnly) params.set('hasGhostOnly', 'true');
      if (query.limit) params.set('limit', query.limit.toString());
      if (query.offset) params.set('offset', query.offset.toString());

      const url = `${this.apiBase}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch gallery`);
      }
      const data = await res.json();
      return {
        success: true,
        items: data.items || [],
        total: data.total || 0,
      };
    } catch (err: any) {
      console.warn('[GalleryService] Network error fetching gallery:', err.message);
      return {
        success: false,
        items: [],
        total: 0,
        error: err.message,
      };
    }
  }

  public async fetchLevelById(id: string): Promise<PublicGalleryItem | null> {
    try {
      const res = await fetch(`${this.apiBase}/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.item || null;
    } catch (err) {
      console.warn('[GalleryService] Failed to load level details:', err);
      return null;
    }
  }

  public async publish(
    req: PublishLevelRequest
  ): Promise<{ success: boolean; item?: PublicGalleryItem; error?: string }> {
    try {
      // Check if we have an existing creator token for this level
      const existingToken = req.existingId ? getStoredTokens()[req.existingId] : undefined;
      const payload: PublishLevelRequest = {
        ...req,
        creatorToken: req.creatorToken || existingToken,
      };

      const res = await fetch(`${this.apiBase}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to publish level' };
      }

      if (data.item?.id && data.creatorToken) {
        saveStoredToken(data.item.id, data.creatorToken);
      }

      return { success: true, item: data.item };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async unpublish(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const token = getStoredTokens()[id];
      if (!token) {
        return { success: false, error: 'Cannot unpublish: You are not recorded as the creator on this device.' };
      }

      const res = await fetch(`${this.apiBase}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': token,
        },
        body: JSON.stringify({ creatorToken: token }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to unpublish' };
      }

      removeStoredToken(id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public isOwnedByMe(id: string): boolean {
    return Boolean(getStoredTokens()[id]);
  }

  public async recordPlay(id: string): Promise<void> {
    try {
      await fetch(`${this.apiBase}/${encodeURIComponent(id)}/play`, { method: 'POST' });
    } catch {
      // Silently ignore play count errors
    }
  }

  public async submitGhostReplay(id: string, replay: ReplayData): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiBase}/${encodeURIComponent(id)}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replay),
      });
      const data = await res.json();
      return Boolean(data.success && data.newBestTime);
    } catch {
      return false;
    }
  }
}

export const galleryService = new GalleryService();
