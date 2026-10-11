import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CraftItemArgsSchema,
  MineBlockArgsSchema,
  PlaceBlockArgsSchema,
} from '../schemas/mcpTools.schema.js';
import { sandboxSessionManager } from '../services/sandboxSession.service.js';
import { SANDBOX_ITEM_CATALOGUE } from '../../../src/types/sandbox.js';

export function registerMutationTools(server: McpServer): void {
  // 1. craft_item
  server.tool(
    'craft_item',
    'Atomically crafts a recipe on the active sandbox session, deducting ingredients and granting output items.',
    CraftItemArgsSchema,
    async ({ recipeId, batches = 1, idempotencyKey, sessionId }) => {
      const result = sandboxSessionManager.executeCraft(
        sessionId,
        recipeId,
        batches,
        idempotencyKey
      );

      if (!result.success) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                recipeId,
                batches,
                error: result.reason ?? 'Failed to craft item.',
              }),
            },
          ],
        };
      }

      const outputDef = result.outputItem ? SANDBOX_ITEM_CATALOGUE[result.outputItem as keyof typeof SANDBOX_ITEM_CATALOGUE] : undefined;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                recipeId: result.recipeId,
                outputItem: result.outputItem,
                outputDisplayName: outputDef?.displayName ?? result.outputItem,
                craftedCount: result.craftedCount,
                batches,
                cached: result.cached ?? false,
                currentInventoryStock: result.inventory?.items[result.outputItem!] ?? 0,
                message: `Successfully crafted ${result.craftedCount}x ${outputDef?.displayName ?? result.outputItem}!`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 2. mine_block
  server.tool(
    'mine_block',
    'Mines a solid block at integer grid coordinates (col, row), converting it to air and collecting it into player inventory.',
    MineBlockArgsSchema,
    async ({ col, row, idempotencyKey, sessionId }) => {
      const result = sandboxSessionManager.executeMine(
        sessionId,
        col,
        row,
        idempotencyKey
      );

      if (!result.success) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                col,
                row,
                error: result.reason ?? 'Mining operation failed.',
              }),
            },
          ],
        };
      }

      const minedDef = result.minedTile ? SANDBOX_ITEM_CATALOGUE[result.minedTile as keyof typeof SANDBOX_ITEM_CATALOGUE] : undefined;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                col: result.col,
                row: result.row,
                minedTile: result.minedTile,
                minedDisplayName: minedDef?.displayName ?? result.minedTile,
                cached: result.cached ?? false,
                inventoryCount: result.inventory?.items[result.minedTile!] ?? 0,
                message: `Mined 1x ${minedDef?.displayName ?? result.minedTile} at col ${col}, row ${row}.`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 3. place_block
  server.tool(
    'place_block',
    'Places a catalogue-defined block at grid coordinates (col, row). Validates item placeability, reach, player collision, and inventory counts.',
    PlaceBlockArgsSchema,
    async ({ col, row, blockType, idempotencyKey, sessionId }) => {
      const result = sandboxSessionManager.executePlace(
        sessionId,
        col,
        row,
        blockType,
        idempotencyKey
      );

      if (!result.success) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                col,
                row,
                blockType,
                error: result.reason ?? 'Block placement failed.',
              }),
            },
          ],
        };
      }

      const blockDef = SANDBOX_ITEM_CATALOGUE[blockType];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                col: result.col,
                row: result.row,
                placedBlock: result.placedBlock,
                placedDisplayName: blockDef?.displayName ?? result.placedBlock,
                cached: result.cached ?? false,
                remainingInventoryCount: result.inventory?.items[blockType] ?? 0,
                message: `Placed 1x ${blockDef?.displayName ?? result.placedBlock} at col ${col}, row ${row}.`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
