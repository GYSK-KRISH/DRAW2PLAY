import assert from 'node:assert';
import { z } from 'zod';
import {
  inspectImageSignatureAndDimensions,
  ImageValidationError,
} from '../server/services/upload.service.js';
import {
  GeminiProvider,
  GoogleGenAIClientLike,
} from '../server/providers/gemini.provider.js';
import {
  AiProviderError,
} from '../server/providers/types.js';
import {
  generateHeuristicReferenceAnalysis,
} from '../server/services/referenceAnalysis.service.js';
import {
  ReferenceAnalysisSchema,
} from '../src/types/reference.js';
import {
  AnalysisLifecycleManager,
} from '../src/services/analysisLifecycle.js';
import type { LoadedImageMedia } from '../src/utils/mediaExtractor.js';

console.log('🧪 Starting Draw2Play AI Stage 1 Reference Image Analysis Reliability Test Suite...\n');

// Sample valid 1x1 base64 PNG
const VALID_1X1_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const VALID_1X1_PNG_BUFFER = Buffer.from(VALID_1X1_PNG_BASE64, 'base64');
const VALID_PNG_DATA_URL = `data:image/png;base64,${VALID_1X1_PNG_BASE64}`;

// Sample valid reference analysis mock for structured schemas
const mockValidAnalysisData = {
  schemaVersion: '2.0',
  category: '2d-platformer',
  recommendedPipeline: 'phaser-2d',
  cameraPerspective: 'side-scrolling-2d',
  visualStyle: 'Pixel Art Retro',
  colorPalette: ['#1e1e2f', '#00ffcc', '#ff007f'],
  keyElements: ['player', 'ground', 'coin'],
  visibleObjects: ['blue runner sprite', 'brick platform', 'golden collectible'],
  terrainLayout: 'Flat horizontal brick platforms with small elevation gaps',
  suggestedRoles: {
    player: 'Blue Runner',
    obstacles: ['Spikes'],
    collectibles: ['Golden Coin'],
    goals: ['Exit Flag'],
  },
  inferredMechanics: [
    {
      name: 'Jump & Run',
      confidence: 0.95,
      description: 'Player moves horizontally and jumps across gaps',
      observationalEvidence: ['Visible platform gaps', 'Side view perspective'],
      supportingObservations: ['Visible platform gaps'],
    },
  ],
  uncertaintiesAndWarnings: ['Single image reference; timing not confirmed'],
  gameplayLoopSummary: 'Navigate across platforms, gather collectibles, reach the flag.',
  suggestedTheme: 'Retro Arcade Cyberpunk',
  technicalConstraints: ['Gravity standard arcade physics', 'Tile collision enabled'],
  analysisConfidenceTier: 'high',
  provenance: 'gemini-vision',
  analyzedAt: new Date().toISOString(),
  frameCount: 1,
};

// ---------------------------------------------------------------------------
// TEST 1: Valid image intake (PNG, JPEG, WebP)
// ---------------------------------------------------------------------------
console.log('▶ Test 1: Valid image intake & format validation');
{
  const pngMeta = inspectImageSignatureAndDimensions(VALID_1X1_PNG_BUFFER);
  assert.strictEqual(pngMeta.mimeType, 'image/png');
  assert.strictEqual(pngMeta.width, 1);
  assert.strictEqual(pngMeta.height, 1);
  assert.ok(pngMeta.sizeBytes > 0);

  // JPEG Header
  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const jpegMeta = inspectImageSignatureAndDimensions(fakeJpeg);
  assert.strictEqual(jpegMeta.mimeType, 'image/jpeg');

  // WebP Header
  const fakeWebp = Buffer.from([
    0x52, 0x49, 0x46, 0x46,
    0x20, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20,
  ]);
  const webpMeta = inspectImageSignatureAndDimensions(fakeWebp);
  assert.strictEqual(webpMeta.mimeType, 'image/webp');

  console.log('  ✓ Supported formats (PNG, JPEG, WebP) correctly verified and decoded');
}

// ---------------------------------------------------------------------------
// TEST 2: Unsupported image format rejection
// ---------------------------------------------------------------------------
console.log('▶ Test 2: Unsupported image format rejection (GIF, BMP, plain text)');
{
  const gifBuffer = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00');
  assert.throws(
    () => inspectImageSignatureAndDimensions(gifBuffer),
    (err: unknown) => {
      assert.ok(err instanceof ImageValidationError);
      assert.strictEqual(err.code, 'IMAGE_UNSUPPORTED_FORMAT');
      assert.ok(err.message.includes('GIF is not supported'));
      return true;
    }
  );

  const bmpBuffer = Buffer.from('BM\x36\x00\x00\x00\x00\x00\x00\x00');
  assert.throws(
    () => inspectImageSignatureAndDimensions(bmpBuffer),
    (err: unknown) => {
      assert.ok(err instanceof ImageValidationError);
      assert.strictEqual(err.code, 'IMAGE_UNSUPPORTED_FORMAT');
      assert.ok(err.message.includes('BMP is not supported'));
      return true;
    }
  );

  const textBuffer = Buffer.from('Hello world this is not an image');
  assert.throws(
    () => inspectImageSignatureAndDimensions(textBuffer),
    (err: unknown) => {
      assert.ok(err instanceof ImageValidationError);
      assert.strictEqual(err.code, 'IMAGE_UNSUPPORTED_FORMAT');
      return true;
    }
  );
  console.log('  ✓ Unsupported image formats (GIF, BMP, plain text) rejected with IMAGE_UNSUPPORTED_FORMAT');
}

// ---------------------------------------------------------------------------
// TEST 3: Corrupted image rejection
// ---------------------------------------------------------------------------
console.log('▶ Test 3: Corrupted & empty image rejection');
{
  // Empty buffer
  assert.throws(
    () => inspectImageSignatureAndDimensions(Buffer.alloc(0)),
    (err: unknown) => {
      assert.ok(err instanceof ImageValidationError);
      assert.strictEqual(err.code, 'IMAGE_EMPTY');
      return true;
    }
  );

  // Truncated buffer (less than signature requirement)
  assert.throws(
    () => inspectImageSignatureAndDimensions(Buffer.from([0x89, 0x50])),
    (err: unknown) => {
      assert.ok(err instanceof ImageValidationError);
      assert.strictEqual(err.code, 'IMAGE_CORRUPTED');
      return true;
    }
  );

  // Truncated PNG header (signature present but no IHDR chunk)
  const truncatedPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.throws(
    () => inspectImageSignatureAndDimensions(truncatedPng),
    (err: unknown) => {
      assert.ok(err instanceof ImageValidationError);
      assert.strictEqual(err.code, 'IMAGE_CORRUPTED');
      return true;
    }
  );
  console.log('  ✓ Empty and corrupted images rejected with IMAGE_EMPTY and IMAGE_CORRUPTED');
}

// ---------------------------------------------------------------------------
// TEST 4: Oversized upload rejection
// ---------------------------------------------------------------------------
console.log('▶ Test 4: Oversized upload rejection (> 10MB)');
{
  const oversizeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
  assert.throws(
    () => inspectImageSignatureAndDimensions(oversizeBuffer),
    (err: unknown) => {
      assert.ok(err instanceof ImageValidationError);
      assert.strictEqual(err.code, 'IMAGE_TOO_LARGE');
      return true;
    }
  );
  console.log('  ✓ Oversized uploads (> 10MB) immediately rejected with IMAGE_TOO_LARGE');
}

// ---------------------------------------------------------------------------
// TEST 5: Missing API configuration
// ---------------------------------------------------------------------------
console.log('▶ Test 5: Missing API configuration error classification');
{
  const unconfiguredProvider = new GeminiProvider({ apiKey: '' });
  await assert.rejects(
    async () => {
      await unconfiguredProvider.execute({
        capability: 'text-generation',
        prompt: 'test',
        schema: z.object({ ok: z.boolean() }),
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AiProviderError);
      assert.ok(err.category === 'auth_error' || err.category === 'missing_configuration');
      assert.strictEqual(err.code, 'MISSING_CONFIGURATION');
      assert.strictEqual(err.isRetryable, false);
      return true;
    }
  );
  console.log('  ✓ Missing API configuration classified as non-retryable MISSING_CONFIGURATION');
}

// ---------------------------------------------------------------------------
// TEST 6: Provider success with structured metadata, correlation ID, and usage
// ---------------------------------------------------------------------------
console.log('▶ Test 6: Provider success with correlation ID & usage metadata');
{
  const mockSuccessClient: GoogleGenAIClientLike = {
    models: {
      generateContent: async () => ({
        text: JSON.stringify(mockValidAnalysisData),
        usageMetadata: {
          promptTokenCount: 150,
          candidatesTokenCount: 420,
          totalTokenCount: 570,
        },
      }),
    },
  };

  const provider = new GeminiProvider({ client: mockSuccessClient, apiKey: 'mock-key' });
  const result = await provider.execute({
    capability: 'image-understanding',
    prompt: 'Analyze reference image',
    imageBase64: VALID_PNG_DATA_URL,
    schema: ReferenceAnalysisSchema,
    correlationId: 'corr-test-6',
  });

  assert.strictEqual(result.metadata.success, true);
  assert.strictEqual(result.metadata.providerId, 'gemini');
  assert.strictEqual(result.metadata.correlationId, 'corr-test-6');
  assert.strictEqual(result.metadata.retryCount, 0);
  assert.ok(result.metadata.usage);
  assert.strictEqual(result.metadata.usage?.promptTokens, 150);
  assert.strictEqual(result.metadata.usage?.completionTokens, 420);
  assert.strictEqual(result.metadata.usage?.totalTokens, 570);
  assert.strictEqual(result.data.category, '2d-platformer');
  console.log('  ✓ Successful provider call returns normalized response with correlation ID and token usage');
}

// ---------------------------------------------------------------------------
// TEST 7: Provider timeout handling
// ---------------------------------------------------------------------------
console.log('▶ Test 7: Provider timeout handling (isRetryable: true)');
{
  const mockHangingClient: GoogleGenAIClientLike = {
    models: {
      generateContent: async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return { text: '{}' };
      },
    },
  };

  const timeoutProvider = new GeminiProvider({
    client: mockHangingClient,
    apiKey: 'mock-key',
    timeoutMs: 50,
  });

  await assert.rejects(
    async () => {
      await timeoutProvider.execute({
        capability: 'text-generation',
        prompt: 'Analyze image',
        schema: z.object({}),
        maxRetries: 0,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AiProviderError);
      assert.strictEqual(err.category, 'timeout');
      assert.strictEqual(err.isRetryable, true);
      assert.strictEqual(err.code, 'TIMEOUT');
      return true;
    }
  );
  console.log('  ✓ Provider timeout correctly classified with isRetryable: true');
}

// ---------------------------------------------------------------------------
// TEST 8: Transient network failure & bounded retries
// ---------------------------------------------------------------------------
console.log('▶ Test 8: Transient network failure & bounded retries');
{
  let callAttempts = 0;
  const mockNetworkFailClient: GoogleGenAIClientLike = {
    models: {
      generateContent: async () => {
        callAttempts++;
        if (callAttempts === 1) {
          throw new Error('fetch failed: ECONNRESET');
        }
        return {
          text: JSON.stringify({ status: 'recovered' }),
        };
      },
    },
  };

  const retryProvider = new GeminiProvider({
    client: mockNetworkFailClient,
    apiKey: 'mock-key',
  });

  const response = await retryProvider.execute({
    capability: 'text-generation',
    prompt: 'Network resilience test',
    schema: z.object({ status: z.string() }),
    maxRetries: 2,
  });

  assert.strictEqual(callAttempts, 2);
  assert.strictEqual(response.metadata.retryCount, 1);
  assert.strictEqual(response.data.status, 'recovered');

  // Exhausted network failure
  const mockPersistentFailClient: GoogleGenAIClientLike = {
    models: {
      generateContent: async () => {
        throw new Error('fetch failed: socket hang up');
      },
    },
  };
  const persistentFailProvider = new GeminiProvider({
    client: mockPersistentFailClient,
    apiKey: 'mock-key',
  });

  await assert.rejects(
    async () => {
      await persistentFailProvider.execute({
        capability: 'text-generation',
        prompt: 'Fail test',
        schema: z.object({}),
        maxRetries: 1,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AiProviderError);
      assert.strictEqual(err.category, 'network_error');
      assert.strictEqual(err.isRetryable, true);
      return true;
    }
  );
  console.log('  ✓ Transient network failure retried and succeeded; persistent failure halted boundedly');
}

// ---------------------------------------------------------------------------
// TEST 9: Permanent authentication failure
// ---------------------------------------------------------------------------
console.log('▶ Test 9: Permanent authentication failure (isRetryable: false, 0 retries)');
{
  let authAttempts = 0;
  const mockAuthFailClient: GoogleGenAIClientLike = {
    models: {
      generateContent: async () => {
        authAttempts++;
        throw new Error('API key not valid. Please pass a valid API key. [401]');
      },
    },
  };

  const authFailProvider = new GeminiProvider({
    client: mockAuthFailClient,
    apiKey: 'invalid-key',
  });

  await assert.rejects(
    async () => {
      await authFailProvider.execute({
        capability: 'text-generation',
        prompt: 'Auth test',
        schema: z.object({}),
        maxRetries: 3, // Request allows 3 retries, but auth error MUST NOT retry
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AiProviderError);
      assert.strictEqual(err.category, 'auth_error');
      assert.strictEqual(err.isRetryable, false);
      return true;
    }
  );
  // Must have halted immediately without retrying
  assert.strictEqual(authAttempts, 1);
  console.log('  ✓ Permanent authentication failure halts immediately without retrying (0 retries)');
}

// ---------------------------------------------------------------------------
// TEST 10: Quota exhaustion
// ---------------------------------------------------------------------------
console.log('▶ Test 10: Quota exhaustion classification (isRetryable: false)');
{
  const mockQuotaFailClient: GoogleGenAIClientLike = {
    models: {
      generateContent: async () => {
        throw new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric');
      },
    },
  };

  const quotaProvider = new GeminiProvider({
    client: mockQuotaFailClient,
    apiKey: 'mock-key',
  });

  await assert.rejects(
    async () => {
      await quotaProvider.execute({
        capability: 'text-generation',
        prompt: 'Quota test',
        schema: z.object({}),
        maxRetries: 2,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AiProviderError);
      assert.strictEqual(err.category, 'quota_exhausted');
      assert.strictEqual(err.isRetryable, false);
      return true;
    }
  );
  console.log('  ✓ Quota exhaustion correctly classified as non-retryable quota_exhausted');
}

// ---------------------------------------------------------------------------
// TEST 11: Malformed AI response handling
// ---------------------------------------------------------------------------
console.log('▶ Test 11: Malformed AI response handling');
{
  const mockGarbageClient: GoogleGenAIClientLike = {
    models: {
      generateContent: async () => ({
        text: 'I cannot answer this request in JSON.',
      }),
    },
  };

  const garbageProvider = new GeminiProvider({
    client: mockGarbageClient,
    apiKey: 'mock-key',
  });

  await assert.rejects(
    async () => {
      await garbageProvider.execute({
        capability: 'text-generation',
        prompt: 'Test prompt',
        schema: z.object({ key: z.string() }),
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AiProviderError);
      assert.strictEqual(err.category, 'invalid_output');
      assert.strictEqual(err.code, 'INVALID_RESPONSE');
      return true;
    }
  );
  console.log('  ✓ Non-JSON model output classified as invalid_output / INVALID_RESPONSE');
}

// ---------------------------------------------------------------------------
// TEST 12: Duplicate submission prevention
// ---------------------------------------------------------------------------
console.log('▶ Test 12: Duplicate submission prevention in AnalysisLifecycleManager');
{
  const manager = new AnalysisLifecycleManager();
  const testMedia: LoadedImageMedia = {
    dataUrl: VALID_PNG_DATA_URL,
    originalDataUrl: VALID_PNG_DATA_URL,
    fileName: 'test.png',
    mimeType: 'image/png',
    fileSizeBytes: 100,
    width: 1,
    height: 1,
    originalWidth: 1,
    originalHeight: 1,
    wasResized: false,
  };

  // Mock global fetch to control request duration
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  globalThis.fetch = async () => {
    fetchCallCount++;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return new Response(
      JSON.stringify({
        reference: { id: 'ref-dup-test', filename: 'test.png' },
        analysis: mockValidAnalysisData,
        source: 'gemini-vision',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    // Start first request
    const p1 = manager.startAnalysis({
      media: testMedia,
      userPrompt: 'First request',
    });

    // Attempt second request while first is in flight
    const p2Result = await manager.startAnalysis({
      media: testMedia,
      userPrompt: 'Duplicate request',
    });

    assert.strictEqual(p2Result, null);
    await p1;

    // Both calls must not duplicate fetch
    assert.ok(fetchCallCount <= 2, `fetch called ${fetchCallCount} times, duplicate was blocked`);
    console.log('  ✓ Duplicate submissions while active correctly rejected with null');
  } finally {
    globalThis.fetch = originalFetch;
    manager.reset();
  }
}

// ---------------------------------------------------------------------------
// TEST 13: Stale response arriving after newer request is discarded
// ---------------------------------------------------------------------------
console.log('▶ Test 13: Stale response arriving after newer request is discarded');
{
  const manager = new AnalysisLifecycleManager();
  const testMedia: LoadedImageMedia = {
    dataUrl: VALID_PNG_DATA_URL,
    originalDataUrl: VALID_PNG_DATA_URL,
    fileName: 'test.png',
    mimeType: 'image/png',
    fileSizeBytes: 100,
    width: 1,
    height: 1,
    originalWidth: 1,
    originalHeight: 1,
    wasResized: false,
  };

  const originalFetch = globalThis.fetch;
  let callIndex = 0;

  globalThis.fetch = async (url) => {
    callIndex++;
    const thisIndex = callIndex;
    const urlStr = String(url);

    if (urlStr.includes('/upload')) {
      return new Response(
        JSON.stringify({ reference: { id: `ref-${thisIndex}` } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delayed response for first request, fast for second request
    if (thisIndex <= 2) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return new Response(
        JSON.stringify({
          analysis: { ...mockValidAnalysisData, visualStyle: 'STALE_STYLE_1' },
          source: 'gemini-vision',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          analysis: { ...mockValidAnalysisData, visualStyle: 'FRESH_STYLE_2' },
          source: 'gemini-vision',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };

  try {
    // Launch request 1
    const p1 = manager.startAnalysis({
      media: testMedia,
      userPrompt: 'Request 1',
      correlationIdOverride: 'corr-stale-1',
    });

    // Immediately cancel or supercede with request 2
    manager.cancel();
    const p2 = manager.startAnalysis({
      media: testMedia,
      userPrompt: 'Request 2',
      correlationIdOverride: 'corr-fresh-2',
    });

    await Promise.all([p1, p2]);

    const state = manager.getState();
    assert.strictEqual(state.correlationId, 'corr-fresh-2');
    if (state.analysis) {
      assert.strictEqual(state.analysis.visualStyle, 'FRESH_STYLE_2');
      assert.notStrictEqual(state.analysis.visualStyle, 'STALE_STYLE_1');
    }
    console.log('  ✓ Stale request from previous correlation ID discarded without overwriting active state');
  } finally {
    globalThis.fetch = originalFetch;
    manager.reset();
  }
}

// ---------------------------------------------------------------------------
// TEST 14: Explicit fallback provenance integrity
// ---------------------------------------------------------------------------
console.log('▶ Test 14: Explicit fallback provenance integrity (mock-heuristic, never gemini-vision)');
{
  const heuristicResult = generateHeuristicReferenceAnalysis('Pixel platformer sketch', 1);

  // Must have provenance 'mock-heuristic'
  assert.strictEqual(heuristicResult.provenance, 'mock-heuristic');
  assert.notStrictEqual(heuristicResult.provenance, 'gemini-vision');

  // Must validate with ReferenceAnalysisSchema
  const parsed = ReferenceAnalysisSchema.parse(heuristicResult);
  assert.strictEqual(parsed.provenance, 'mock-heuristic');

  console.log(`  ✓ Heuristic analysis strictly marked with provenance='mock-heuristic' (never claims gemini-vision)`);
}

console.log('\n🎉 ALL 14 REFERENCE RELIABILITY TESTS PASSED SUCCESSFULLY!\n');
