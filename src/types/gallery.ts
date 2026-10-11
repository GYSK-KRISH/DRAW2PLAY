import { z } from 'zod';
import { GameTemplateIdSchema } from './plan.js';
import { PlayableGameSceneSchema } from './scene.js';
import { ReplayDataSchema } from './replay.js';

/**
 * Community Published Level Record
 */
export const PublishedLevelSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(80).trim(),
  description: z.string().max(500).trim().default(''),
  creatorName: z.string().min(1).max(40).trim().default('Anonymous Creator'),
  creatorToken: z.string().min(8).max(128), // Secret token generated on client for deletion authorization
  templateId: GameTemplateIdSchema,
  engineVersion: z.string().default('phaser-4.2.1'),
  gamePlanSchemaVersion: z.string().default('2.0'),
  levelVersion: z.number().int().positive().default(1),
  publishedAt: z.string(),
  updatedAt: z.string().optional(),
  playCount: z.number().int().nonnegative().default(0),
  likes: z.number().int().nonnegative().default(0),
  bestScore: z.number().int().nonnegative().optional(),
  bestDurationMs: z.number().nonnegative().optional(),
  hasGhostReplay: z.boolean().default(false),
  bestReplay: ReplayDataSchema.optional(),
  playableScene: PlayableGameSceneSchema,
  thumbnailDataUrl: z.string().optional(),
  visibility: z.enum(['published', 'unlisted', 'private']).default('published'),
});
export type PublishedLevel = z.infer<typeof PublishedLevelSchema>;

/**
 * Sanitized public view of published level (excludes creatorToken)
 */
export const PublicGalleryItemSchema = PublishedLevelSchema.omit({ creatorToken: true });
export type PublicGalleryItem = z.infer<typeof PublicGalleryItemSchema>;

/**
 * Filter and search query parameters for gallery discovery
 */
export const GalleryFilterQuerySchema = z.object({
  search: z.string().max(100).optional(),
  templateId: z.union([GameTemplateIdSchema, z.literal('all')]).optional().default('all'),
  sortBy: z.enum(['newest', 'popular', 'best_score', 'fastest']).default('newest'),
  hasGhostOnly: z.boolean().optional().default(false),
  limit: z.number().int().positive().max(100).default(30),
  offset: z.number().int().nonnegative().default(0),
});
export type GalleryFilterQuery = z.infer<typeof GalleryFilterQuerySchema>;

/**
 * Request payload when publishing a level to the community
 */
export const PublishLevelRequestSchema = z.object({
  title: z.string().min(1).max(80).trim(),
  description: z.string().max(500).trim().default(''),
  creatorName: z.string().min(1).max(40).trim().default('Anonymous Creator'),
  playableScene: PlayableGameSceneSchema,
  replayData: ReplayDataSchema.optional(),
  thumbnailDataUrl: z.string().optional(),
  visibility: z.enum(['published', 'unlisted', 'private']).default('published'),
  existingId: z.string().max(100).optional(),
  creatorToken: z.string().max(128).optional(),
});
export type PublishLevelRequest = z.infer<typeof PublishLevelRequestSchema>;

/**
 * Delete / Unpublish request payload
 */
export const UnpublishLevelRequestSchema = z.object({
  id: z.string().min(1).max(100),
  creatorToken: z.string().min(8).max(128),
});
export type UnpublishLevelRequest = z.infer<typeof UnpublishLevelRequestSchema>;
