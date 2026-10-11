import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  type PublishedLevel,
  type PublicGalleryItem,
  type PublishLevelRequest,
  PublishedLevelSchema,
  GalleryFilterQuerySchema,
} from '../../src/types/gallery.js';
import type { ReplayData } from '../../src/types/replay.js';

/**
 * Stage 8: Server-Side Community Gallery Service
 * Manages published levels, creator tokens, search/filtering, and ghost replay submissions.
 */
export class CommunityGalleryService {
  private levels: Map<string, PublishedLevel> = new Map();
  private dataFilePath: string;

  constructor(customPath?: string) {
    this.dataFilePath = customPath || path.resolve(process.cwd(), 'server', 'data', 'published_levels.json');
    this.loadFromFile();
    this.seedDefaultLevelsIfEmpty();
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            try {
              const validated = PublishedLevelSchema.parse(item);
              this.levels.set(validated.id, validated);
            } catch (err) {
              console.warn('[GalleryService] Skipped invalid item from file:', err);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[GalleryService] Could not read levels file, using memory store:', err);
    }
  }

  private saveToFile(): void {
    try {
      const dir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.levels.values());
      fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[GalleryService] Could not persist to disk, continuing in-memory:', err);
    }
  }

  private seedDefaultLevelsIfEmpty(): void {
    if (this.levels.size > 0) return;

    // Seed 2 initial showcase community levels
    const sampleLevel1: PublishedLevel = {
      id: 'gallery-lvl-neon-peaks',
      title: 'Neon Lava Peaks',
      description: 'A thrilling high-gravity platformer with heated volcanic pits and floating crystal coins.',
      creatorName: 'PixelMaster',
      creatorToken: 'tok_showcase_sample_1_secret',
      templateId: 'physics-platformer',
      engineVersion: 'phaser-4.2.1',
      gamePlanSchemaVersion: '2.0',
      levelVersion: 1,
      publishedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      playCount: 42,
      likes: 18,
      bestScore: 280,
      bestDurationMs: 14200,
      hasGhostReplay: false,
      visibility: 'published',
      playableScene: {
        schemaVersion: '1.0',
        id: 'scene-neon-peaks',
        source: 'local-vector',
        levelName: 'Neon Lava Peaks',
        levelDescription: 'Leap across floating platforms above molten magma.',
        templateId: 'physics-platformer',
        movementModel: 'platformer',
        diagnostics: {
          warnings: [],
          assumptions: [],
          strokeCount: 8,
        },
        world: {
          width: 800,
          height: 600,
          gravity: 800,
          friction: 0.8,
          difficulty: 'normal',
          theme: 'lava',
          backgroundColor: '#1c0f0a',
          ambientEffect: 'embers',
        },
        player: {
          spawnX: 80,
          spawnY: 480,
          speed: 240,
          jumpPower: 450,
          size: 32,
        },
        platforms: [
          { id: 'p1', x: 200, y: 520, width: 240, height: 28 },
          { id: 'p2', x: 500, y: 440, width: 200, height: 28 },
          { id: 'p3', x: 280, y: 350, width: 160, height: 24 },
        ],
        hazards: [
          { id: 'h1', x: 380, y: 580, width: 120, height: 20, hazardType: 'lava' },
        ],
        coins: [
          { id: 'c1', x: 220, y: 470, value: 20, size: 24 },
          { id: 'c2', x: 520, y: 390, value: 20, size: 24 },
          { id: 'c3', x: 340, y: 300, value: 50, size: 28 },
        ],
        enemies: [],
        trampolines: [],
        switches: [],
        doors: [],
        goal: { id: 'g1', x: 680, y: 380, width: 36, height: 48 },
        objective: { type: 'reach_goal' },
        hudInstructions: 'Leap across volcanic pillars to the exit',
      },
    };

    this.levels.set(sampleLevel1.id, sampleLevel1);
    this.saveToFile();
  }

  /**
   * Search and filter published levels
   */
  public listPublished(rawQuery: z.input<typeof GalleryFilterQuerySchema> = {}): { items: PublicGalleryItem[]; total: number } {
    const query = GalleryFilterQuerySchema.parse(rawQuery);
    let all = Array.from(this.levels.values()).filter((l) => l.visibility === 'published');

    // Filter by template
    if (query.templateId && query.templateId !== 'all') {
      all = all.filter((l) => l.templateId === query.templateId);
    }

    // Filter by ghost availability
    if (query.hasGhostOnly) {
      all = all.filter((l) => l.hasGhostReplay);
    }

    // Search query filter (matches title, description, or creator)
    if (query.search && query.search.trim().length > 0) {
      const q = query.search.toLowerCase().trim();
      all = all.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.creatorName.toLowerCase().includes(q)
      );
    }

    // Sort order
    if (query.sortBy === 'newest') {
      all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    } else if (query.sortBy === 'popular') {
      all.sort((a, b) => b.playCount - a.playCount);
    } else if (query.sortBy === 'best_score') {
      all.sort((a, b) => (b.bestScore ?? 0) - (a.bestScore ?? 0));
    } else if (query.sortBy === 'fastest') {
      all.sort((a, b) => (a.bestDurationMs ?? 999999) - (b.bestDurationMs ?? 999999));
    }

    const total = all.length;
    const paginated = all.slice(query.offset, query.offset + query.limit);

    // Sanitize creatorToken before sending to public client
    const sanitized: PublicGalleryItem[] = paginated.map((item) => {
      const { creatorToken: _secret, ...publicFields } = item;
      return publicFields;
    });

    return { items: sanitized, total };
  }

  public getById(id: string): PublicGalleryItem | null {
    const item = this.levels.get(id);
    if (!item) return null;
    const { creatorToken: _secret, ...publicFields } = item;
    return publicFields;
  }

  /**
   * Publishes or updates a level with creator token authorization
   */
  public publish(
    req: PublishLevelRequest
  ): { success: boolean; item?: PublicGalleryItem; creatorToken?: string; error?: string } {
    try {
      const levelId = req.existingId || `pub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const existing = this.levels.get(levelId);

      // Verify creator token if updating existing level
      let creatorToken = req.creatorToken;
      if (existing) {
        if (!creatorToken || creatorToken !== existing.creatorToken) {
          return { success: false, error: 'Unauthorized: Invalid creator token for this level.' };
        }
      } else {
        creatorToken = creatorToken || `tok_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
      }

      const hasGhost = Boolean(req.replayData && req.replayData.frames.length > 0);

      const publishedLevel: PublishedLevel = {
        id: levelId,
        title: req.title.trim().slice(0, 80),
        description: req.description.trim().slice(0, 500),
        creatorName: req.creatorName.trim().slice(0, 40) || 'Anonymous Creator',
        creatorToken,
        templateId: (req.playableScene.templateId as any) || 'physics-platformer',
        engineVersion: 'phaser-4.2.1',
        gamePlanSchemaVersion: '2.0',
        levelVersion: existing ? existing.levelVersion + 1 : 1,
        publishedAt: existing ? existing.publishedAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        playCount: existing ? existing.playCount : 0,
        likes: existing ? existing.likes : 0,
        bestScore: req.replayData?.summary.finalScore ?? existing?.bestScore,
        bestDurationMs: req.replayData?.summary.durationMs ?? existing?.bestDurationMs,
        hasGhostReplay: hasGhost || Boolean(existing?.hasGhostReplay),
        bestReplay: req.replayData ?? existing?.bestReplay,
        playableScene: req.playableScene,
        thumbnailDataUrl: req.thumbnailDataUrl,
        visibility: req.visibility,
      };

      this.levels.set(levelId, publishedLevel);
      this.saveToFile();

      const { creatorToken: _secret, ...publicFields } = publishedLevel;
      return { success: true, item: publicFields, creatorToken };
    } catch (err: any) {
      return { success: false, error: `Publishing error: ${err.message}` };
    }
  }

  /**
   * Unpublish or delete a level with creator ownership verification
   */
  public unpublish(id: string, creatorToken: string): { success: boolean; error?: string } {
    const existing = this.levels.get(id);
    if (!existing) {
      return { success: false, error: 'Level not found.' };
    }

    if (existing.creatorToken !== creatorToken) {
      return { success: false, error: 'Unauthorized: Invalid creator token.' };
    }

    this.levels.delete(id);
    this.saveToFile();
    return { success: true };
  }

  public recordPlay(id: string): void {
    const existing = this.levels.get(id);
    if (existing) {
      existing.playCount++;
      this.saveToFile();
    }
  }

  public submitBestReplay(id: string, replay: ReplayData): boolean {
    const existing = this.levels.get(id);
    if (!existing) return false;

    // Check if new replay is a winning run and faster
    if (!replay.summary.completed) return false;

    const currentBestTime = existing.bestDurationMs ?? Infinity;
    if (replay.summary.durationMs <= currentBestTime) {
      existing.bestDurationMs = replay.summary.durationMs;
      existing.bestScore = Math.max(existing.bestScore ?? 0, replay.summary.finalScore);
      existing.bestReplay = replay;
      existing.hasGhostReplay = true;
      this.saveToFile();
      return true;
    }
    return false;
  }

  public clearForTest(): void {
    this.levels.clear();
  }
}

export const communityGalleryService = new CommunityGalleryService();
