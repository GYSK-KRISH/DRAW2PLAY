import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerStatusTools } from './tools/statusTools.js';
import { registerCatalogueTools } from './tools/catalogueTools.js';
import { registerMutationTools } from './tools/mutationTools.js';

export interface McpServerConfig {
  name?: string;
  version?: string;
}

/**
 * Creates and configures the Draw2Play AI McpServer instance
 */
export function createDraw2PlayMcpServer(config: McpServerConfig = {}): McpServer {
  const server = new McpServer({
    name: config.name ?? 'draw2play-mcp-server',
    version: config.version ?? '1.0.0',
  });

  // Register all categorized tools
  registerStatusTools(server);
  registerCatalogueTools(server);
  registerMutationTools(server);

  return server;
}
