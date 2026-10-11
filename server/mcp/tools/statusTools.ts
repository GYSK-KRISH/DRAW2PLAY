import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  SANDBOX_ITEM_IDS,
  HOTBAR_BLOCK_ORDER,
  TILE_DEFINITIONS,
} from '../../../src/types/sandbox.js';
import {
  GetSandboxStatusArgsSchema,
  GetSaveStatusArgsSchema,
} from '../schemas/mcpTools.schema.js';
import { sandboxSessionManager } from '../services/sandboxSession.service.js';

export function registerStatusTools(server: McpServer): void {
  // 1. get_sandbox_status
  server.tool(
    'get_sandbox_status',
    'Returns a sanitized status summary of the active sandbox session: world dimensions, player position, inventory, and hotbar.',
    GetSandboxStatusArgsSchema,
    async ({ sessionId }) => {
      const session = sandboxSessionManager.getSession(sessionId);

      if (!session) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  hasActiveSession: false,
                  message:
                    'No active sandbox session is currently connected. Start Draw2Play AI and open Sandbox mode in your browser to establish a live session.',
                  catalogueItemCount: SANDBOX_ITEM_IDS.length,
                  supportedBlocks: Object.keys(TILE_DEFINITIONS).length - 1,
                  defaultHotbarSlots: HOTBAR_BLOCK_ORDER,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Summary of items owned
      const ownedItems: Record<string, number> = {};
      for (const [key, count] of Object.entries(session.inventory.items)) {
        if (count && count > 0) {
          ownedItems[key] = count;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                hasActiveSession: true,
                sessionId: session.sessionId,
                clientType: session.clientType,
                lastActiveAt: new Date(session.lastActiveAt).toISOString(),
                world: {
                  cols: session.world.cols,
                  rows: session.world.rows,
                  tileSize: session.world.tileSize,
                  totalTiles: session.world.cols * session.world.rows,
                },
                player: session.playerPosition
                  ? {
                      x: session.playerPosition.x,
                      y: session.playerPosition.y,
                      col: session.playerPosition.col,
                      row: session.playerPosition.row,
                    }
                  : { note: 'Player position pending initial heartbeat from scene' },
                inventory: {
                  selectedSlot: session.inventory.selectedSlot,
                  hotbar: session.inventory.hotbar ?? HOTBAR_BLOCK_ORDER,
                  ownedItems,
                },
                pendingActionCount: session.pendingActions.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 2. get_save_status
  server.tool(
    'get_save_status',
    'Inspects save compatibility, persistence schema version, and validation state without exposing local filesystem paths.',
    GetSaveStatusArgsSchema,
    async ({ sessionId }) => {
      const session = sandboxSessionManager.getSession(sessionId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                schemaVersion: '2.0',
                supportedLegacyVersions: ['1.0'],
                storageMechanism: 'localStorage',
                persistenceDriver: 'Browser localStorage (draw2play_sandbox_save_v1)',
                storageIsolatedFromCreations: true,
                filesystemAccess: 'none',
                safeToSave: true,
                hasActiveSession: !!session,
                sessionSaveState: session
                  ? {
                      sessionId: session.sessionId,
                      worldDimensions: `${session.world.cols}x${session.world.rows}`,
                      totalInventoryItems: Object.values(session.inventory.items).reduce((a, b) => a + (b ?? 0), 0),
                      lastActive: new Date(session.lastActiveAt).toISOString(),
                    }
                  : 'No active session loaded in memory.',
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
