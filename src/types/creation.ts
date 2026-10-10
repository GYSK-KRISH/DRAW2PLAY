import { z } from 'zod';
import { SketchDocumentSchema } from './sketch.js';
import { PlayableGameSceneSchema, SceneProvenanceSourceSchema } from './scene.js';

/**
 * Saved creation schema for browser local persistence
 */
export const SavedCreationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).default('Untitled Level'),
  createdAt: z.string(),
  updatedAt: z.string(),
  document: SketchDocumentSchema,
  playableScene: PlayableGameSceneSchema.optional(),
  thumbnailDataUrl: z.string().optional(),
  provenance: SceneProvenanceSourceSchema.default('local-vector'),
  schemaVersion: z.literal('1.0').default('1.0'),
  tags: z.array(z.string()).default([]),
});

export type SavedCreation = z.infer<typeof SavedCreationSchema>;

export const CreationsListSchema = z.array(SavedCreationSchema);
