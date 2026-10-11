import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createDraw2PlayMcpServer } from './server.js';

/**
 * Draw2Play AI MCP Server entry point (Stdio Transport)
 */
async function main(): Promise<void> {
  const server = createDraw2PlayMcpServer({
    name: 'draw2play-mcp-server',
    version: '1.0.0',
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Draw2Play MCP] Stdio server connected and listening for tools requests.');
}

main().catch((err) => {
  console.error('[Draw2Play MCP] Fatal initialization error:', err);
  process.exit(1);
});
