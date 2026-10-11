import { Router, type Request, type Response } from 'express';
import {
  GalleryFilterQuerySchema,
  PublishLevelRequestSchema,
  UnpublishLevelRequestSchema,
} from '../../src/types/gallery.js';
import { ReplayDataSchema } from '../../src/types/replay.js';
import { communityGalleryService } from '../services/gallery.service.js';

export const galleryRouter = Router();

/**
 * GET /api/gallery
 * List and filter published community creations
 */
galleryRouter.get('/', (req: Request, res: Response) => {
  try {
    const rawQuery = {
      search: req.query.search as string | undefined,
      templateId: (req.query.templateId as any) || 'all',
      sortBy: (req.query.sortBy as any) || 'newest',
      hasGhostOnly: req.query.hasGhostOnly === 'true',
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 30,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const validatedQuery = GalleryFilterQuerySchema.parse(rawQuery);
    const result = communityGalleryService.listPublished(validatedQuery);

    res.json({
      success: true,
      items: result.items,
      total: result.total,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: `Invalid query parameters: ${err.message}`,
    });
  }
});

/**
 * GET /api/gallery/:id
 * Retrieve details for a single published level
 */
galleryRouter.get('/:id', (req: Request, res: Response) => {
  const item = communityGalleryService.getById(String(req.params.id));
  if (!item) {
    res.status(404).json({
      success: false,
      error: 'Published level not found.',
    });
    return;
  }

  res.json({
    success: true,
    item,
  });
});

/**
 * POST /api/gallery/publish
 * Publish a new or updated level to the community gallery
 */
galleryRouter.post('/publish', (req: Request, res: Response) => {
  try {
    const validatedBody = PublishLevelRequestSchema.parse(req.body);
    const result = communityGalleryService.publish(validatedBody);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.status(201).json({
      success: true,
      item: result.item,
      creatorToken: result.creatorToken,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: `Validation failed: ${err.message}`,
    });
  }
});

/**
 * DELETE /api/gallery/:id
 * Unpublish/delete a level using the creator secret token
 */
galleryRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const creatorToken = (req.headers['x-creator-token'] as string) || req.body?.creatorToken;
    const validatedBody = UnpublishLevelRequestSchema.parse({
      id: req.params.id,
      creatorToken,
    });

    const result = communityGalleryService.unpublish(validatedBody.id, validatedBody.creatorToken);
    if (!result.success) {
      res.status(403).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      message: 'Level unpublished successfully.',
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: `Invalid request: ${err.message}`,
    });
  }
});

/**
 * POST /api/gallery/:id/play
 * Increment level play counter
 */
galleryRouter.post('/:id/play', (req: Request, res: Response) => {
  communityGalleryService.recordPlay(String(req.params.id));
  res.json({ success: true });
});

/**
 * POST /api/gallery/:id/replay
 * Submit a new ghost replay for leaderboard/ghost playback
 */
galleryRouter.post('/:id/replay', (req: Request, res: Response) => {
  try {
    const validatedReplay = ReplayDataSchema.parse(req.body);
    const updated = communityGalleryService.submitBestReplay(String(req.params.id), validatedReplay);

    res.json({
      success: true,
      newBestTime: updated,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: `Invalid replay data: ${err.message}`,
    });
  }
});
