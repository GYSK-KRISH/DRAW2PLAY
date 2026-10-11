import { z } from 'zod';
import {
  PLACEABLE_BLOCK_TYPES,
} from '../../../src/types/sandbox.js';
import {
  DEFAULT_SANDBOX_COLS,
  DEFAULT_SANDBOX_ROWS,
} from '../../../src/game/sandbox/sandboxWorld.js';

/**
 * Strict tool input schemas for Draw2Play AI MCP Server
 */

export const GetSandboxStatusArgsSchema = {
  sessionId: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe('Optional ID of the target sandbox session. Defaults to active session.'),
};

export const ListSandboxItemsArgsSchema = {
  category: z
    .enum(['all', 'block', 'material', 'tool', 'placeable', 'crafted'])
    .optional()
    .default('all')
    .describe('Filter catalogue items by category. Defaults to "all".'),
};

export const ListCraftingRecipesArgsSchema = {
  category: z
    .enum(['all', 'basic', 'building', 'tools', 'utility'])
    .optional()
    .default('all')
    .describe('Filter recipes by category. Defaults to "all".'),
};

export const CheckCraftingRecipeArgsSchema = {
  recipeId: z
    .string()
    .min(1)
    .max(100)
    .describe('Unique recipe identifier to check (e.g. "recipe-wood-to-planks", "recipe-torch-coal").'),
  batches: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(1)
    .describe('Number of recipe craft batches to validate. Strict upper bound of 100.'),
  sessionId: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe('Optional ID of target sandbox session for inventory verification.'),
};

export const CraftItemArgsSchema = {
  recipeId: z
    .string()
    .min(1)
    .max(100)
    .describe('Unique identifier of the recipe to execute.'),
  batches: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(1)
    .describe('Number of craft batches to produce (1-100).'),
  idempotencyKey: z
    .string()
    .min(1)
    .max(128)
    .optional()
    .describe('Optional unique request key to guard against duplicate craft executions upon retries.'),
  sessionId: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe('Optional session identifier.'),
};

export const MineBlockArgsSchema = {
  col: z
    .number()
    .int()
    .min(0)
    .max(DEFAULT_SANDBOX_COLS - 1)
    .describe(`Column coordinate of the target block (0 to ${DEFAULT_SANDBOX_COLS - 1}).`),
  row: z
    .number()
    .int()
    .min(0)
    .max(DEFAULT_SANDBOX_ROWS - 1)
    .describe(`Row coordinate of the target block (0 to ${DEFAULT_SANDBOX_ROWS - 1}).`),
  idempotencyKey: z
    .string()
    .min(1)
    .max(128)
    .optional()
    .describe('Optional unique request key to prevent duplicate mining rewards on retries.'),
  sessionId: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe('Optional session identifier.'),
};

export const PlaceBlockArgsSchema = {
  col: z
    .number()
    .int()
    .min(0)
    .max(DEFAULT_SANDBOX_COLS - 1)
    .describe(`Column coordinate where the block should be placed (0 to ${DEFAULT_SANDBOX_COLS - 1}).`),
  row: z
    .number()
    .int()
    .min(0)
    .max(DEFAULT_SANDBOX_ROWS - 1)
    .describe(`Row coordinate where the block should be placed (0 to ${DEFAULT_SANDBOX_ROWS - 1}).`),
  blockType: z
    .enum(PLACEABLE_BLOCK_TYPES)
    .describe('Must be a valid catalogue-defined placeable block type (e.g. "dirt", "wood_planks", "torch").'),
  idempotencyKey: z
    .string()
    .min(1)
    .max(128)
    .optional()
    .describe('Optional unique request key to prevent duplicate placements on retries.'),
  sessionId: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe('Optional session identifier.'),
};

export const GetSaveStatusArgsSchema = {
  sessionId: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe('Optional session identifier to inspect save status.'),
};
