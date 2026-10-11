process.env.NODE_ENV = 'test';

import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { app, gracefulShutdown, startServer } from '../server/index.js';
import { ServerConfigSchema } from '../server/config.js';
import { getApiUrl } from '../src/services/api.js';

console.log('🧪 Starting Draw2Play Phase 11: Deployment, Production API & Release Engineering Test Suite...\n');

async function runPhase11Tests() {
  // Start an ephemeral HTTP server on a random free port (port 0)
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object', 'Server must be listening on an address');
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Test 1: Production Health Endpoint Smoke Test
    console.log('▶ Test 1: Production health endpoint returns 200 without credential leakage');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(healthRes.status, 200, 'Health endpoint must return 200 OK');
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'ok');
    assert.strictEqual(healthData.project, 'Draw2Play AI');
    assert.strictEqual(typeof healthData.geminiConfigured, 'boolean');
    assert.ok(Array.isArray(healthData.providers), 'Must list registered providers');

    // Confirm zero secrets leaked in payload
    const healthJsonStr = JSON.stringify(healthData);
    assert.ok(!healthJsonStr.includes('AIzaSy'), 'Must not leak live Google API key prefixes');
    assert.ok(!healthJsonStr.includes('apiKey'), 'Must not leak apiKey values');
    console.log('  ✓ Health endpoint verified: status ok, zero credentials leaked');

    // Test 2: Production Frontend Asset Serving & SPA Routing
    console.log('▶ Test 2: Production frontend asset serving and SPA catch-all');
    const distIndex = path.resolve(process.cwd(), 'dist/index.html');
    const hasDist = fs.existsSync(distIndex);

    if (hasDist) {
      // Root route should serve index.html
      const rootRes = await fetch(`${baseUrl}/`);
      assert.strictEqual(rootRes.status, 200);
      const rootType = rootRes.headers.get('content-type') || '';
      assert.ok(rootType.includes('text/html'), 'Root route must serve text/html in production');
      const rootHtml = await rootRes.text();
      assert.ok(rootHtml.includes('<!doctype html>') || rootHtml.includes('<html'), 'Must serve HTML doctype');

      // SPA client route (e.g. /sandbox) should fallback to index.html
      const spaRes = await fetch(`${baseUrl}/sandbox`);
      assert.strictEqual(spaRes.status, 200);
      const spaHtml = await spaRes.text();
      assert.ok(spaHtml.includes('<!doctype html>') || spaHtml.includes('<html'), 'SPA route must serve index.html');
      console.log('  ✓ Production static frontend and SPA fallback verified');
    } else {
      console.log('  ⚠ dist/ not found, verifying standalone API fallback');
      const rootRes = await fetch(`${baseUrl}/`);
      assert.strictEqual(rootRes.status, 200);
      const rootData = await rootRes.json();
      assert.strictEqual(rootData.name, 'Draw2Play AI Backend API');
    }

    // Test 3: Unknown API Endpoint Returns 404 JSON
    console.log('▶ Test 3: Unknown /api endpoints return 404 JSON error');
    const notFoundRes = await fetch(`${baseUrl}/api/nonexistent-endpoint-xyz`);
    assert.strictEqual(notFoundRes.status, 404, 'Must return 404 for unknown API routes');
    const notFoundData = await notFoundRes.json();
    assert.strictEqual(notFoundData.success, false);
    assert.ok(notFoundData.error?.includes('not found'), 'Must include helpful error description');
    console.log('  ✓ Unknown API routes cleanly isolated with 404 JSON');

    // Test 4: Environment Variable Schema & Port Validation
    console.log('▶ Test 4: Strict environment variable validation');
    const validConfig = ServerConfigSchema.safeParse({
      port: 3001,
      nodeEnv: 'production',
      geminiModel: 'gemini-3.8-flash',
    });
    assert.strictEqual(validConfig.success, true, 'Valid config must parse successfully');

    // Invalid port out-of-bounds (> 65535 or <= 0)
    const invalidPortHigh = ServerConfigSchema.safeParse({ port: 999999 });
    assert.strictEqual(invalidPortHigh.success, false, 'Port > 65535 must fail schema validation');

    const invalidPortLow = ServerConfigSchema.safeParse({ port: -10 });
    assert.strictEqual(invalidPortLow.success, false, 'Negative port must fail schema validation');

    // Invalid nodeEnv
    const invalidEnv = ServerConfigSchema.safeParse({ nodeEnv: 'unsupported-env' });
    assert.strictEqual(invalidEnv.success, false, 'Invalid nodeEnv must fail schema validation');
    console.log('  ✓ Server configuration schema bounds verified');

    // Test 5: Client API URL Resolution Helper
    console.log('▶ Test 5: Client API base URL resolver (single-service vs split-host)');
    assert.strictEqual(getApiUrl('/api/health'), '/api/health', 'Default relative URL must match');
    assert.strictEqual(getApiUrl('api/health'), '/api/health', 'Missing leading slash must be normalized');
    assert.strictEqual(getApiUrl('/api/ai/analyze-character'), '/api/ai/analyze-character');
    console.log('  ✓ Client API URL resolution verified');

    // Test 6: CORS Preflight and Header Handling
    console.log('▶ Test 6: CORS preflight and request acceptance');
    const corsRes = await fetch(`${baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert.ok(corsRes.status === 200 || corsRes.status === 204, 'CORS OPTIONS must succeed');
    console.log('  ✓ CORS preflight request handled properly');

    // Test 7: Deployment Files & Docker Specification Audit
    console.log('▶ Test 7: Dockerfile, .dockerignore, and compose.yaml specification audit');
    const dockerfilePath = path.resolve(process.cwd(), 'Dockerfile');
    const dockerignorePath = path.resolve(process.cwd(), '.dockerignore');
    const composePath = path.resolve(process.cwd(), 'compose.yaml');

    assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile must exist');
    assert.ok(fs.existsSync(dockerignorePath), '.dockerignore must exist');
    assert.ok(fs.existsSync(composePath), 'compose.yaml must exist');

    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8');
    assert.ok(dockerfileContent.includes('FROM node:22-alpine'), 'Must use Node 22 alpine image');
    assert.ok(dockerfileContent.includes('USER node'), 'Must specify non-root user');
    assert.ok(dockerfileContent.includes('HEALTHCHECK'), 'Must include container health check');
    assert.ok(dockerfileContent.includes('npm run build'), 'Must compile frontend assets in builder');

    const dockerignoreContent = fs.readFileSync(dockerignorePath, 'utf-8');
    assert.ok(dockerignoreContent.includes('.git'), '.dockerignore must exclude .git');
    assert.ok(dockerignoreContent.includes('.env'), '.dockerignore must exclude .env');
    assert.ok(dockerignoreContent.includes('node_modules'), '.dockerignore must exclude node_modules');

    const composeContent = fs.readFileSync(composePath, 'utf-8');
    assert.ok(composeContent.includes('PORT'), 'compose.yaml must configure PORT');
    assert.ok(composeContent.includes('healthcheck:'), 'compose.yaml must declare healthcheck');
    console.log('  ✓ Dockerfile, .dockerignore, and compose.yaml specifications verified');

    // Test 8: Graceful Server Shutdown Lifecycle
    console.log('▶ Test 8: Graceful server shutdown lifecycle');
    startServer(0);
    await gracefulShutdown('SIGTERM');
    console.log('  ✓ Graceful shutdown handled cleanly without process crash');

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('\n🎉 ALL 8 PHASE 11 DEPLOYMENT & RELEASE ENGINEERING TESTS PASSED!\n');
}

runPhase11Tests().catch((err) => {
  console.error('❌ Phase 11 Test Failed:', err);
  process.exit(1);
});
