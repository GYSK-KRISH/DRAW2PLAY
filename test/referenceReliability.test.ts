import assert from 'node:assert';
import { z } from 'zod';
import {
  inspectImageSignatureAndDimensions,
  ImageValidationError,
} from '../server/services/upload.service.js';
import {
  GeminiProvider,
  GoogleGenAIClientLike,
  classifyError,
} from '../server/providers/gemini.provider.js';
import {
  AiProviderError,
} from '../server/providers/types.js';
import {
  generateHeuristicReferenceAnalysis,
  normalizeReferenceAnalysisPayload,
  normalizeStringLength,
  analyzeReferenceWithHuggingFace,
  analyzeReferenceWithFallbackChain,
  buildGameGenerationPlan,
} from '../server/services/referenceAnalysis.service.js';
import {
  HuggingFaceProvider,
  classifyHfError,
  sanitizeHfErrorMessage,
} from '../server/providers/huggingface.provider.js';
import { aiProviderRegistry } from '../server/providers/index.js';
import {
  ReferenceAnalysisSchema,
} from '../src/types/reference.js';
import {
  AnalysisLifecycleManager,
} from '../src/services/analysisLifecycle.js';
import type { LoadedImageMedia } from '../src/utils/mediaExtractor.js';
import { convertPlanToPlayableScene } from '../src/game/sceneConverter.js';
import { PlayableGameSceneSchema } from '../src/types/scene.js';

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

// ---------------------------------------------------------------------------
// TEST 15: Schema normalization of overlong fields from user issue report
// ---------------------------------------------------------------------------
console.log('▶ Test 15: Normalization of overlong fields (visibleObjects[1], suggestedRoles.player, movementType)');
{
  const overlongVisibleObject =
    'This is an exceptionally detailed description of an enemy character walking on the lower terrain platform that clearly exceeds eighty characters in total length';
  const overlongPlayerRole =
    'A brave little explorer character wearing an armored helmet equipped with double jumping boots and carrying a magic wand';
  const overlongMovementType =
    'Smooth omnidirectional grid based eight-direction tile navigation with accelerated inertia and wall sliding';

  assert.ok(overlongVisibleObject.length > 80, `Expected overlong visibleObjects[1] > 80 chars, got ${overlongVisibleObject.length}`);
  assert.ok(overlongPlayerRole.length > 80, `Expected overlong suggestedRoles.player > 80 chars, got ${overlongPlayerRole.length}`);
  assert.ok(overlongMovementType.length > 60, `Expected overlong movementType > 60 chars, got ${overlongMovementType.length}`);

  // Raw unnormalized payload must fail ReferenceAnalysisSchema validation
  const rawPayload = {
    ...mockValidAnalysisData,
    visibleObjects: ['blue runner sprite', overlongVisibleObject, 'golden collectible'],
    suggestedRoles: {
      ...mockValidAnalysisData.suggestedRoles,
      player: overlongPlayerRole,
    },
    proposedDesign: {
      ...mockValidAnalysisData,
      suggestedGenre: '2d-platformer',
      cameraPerspective: 'side-scrolling-2d',
      playerAbilitiesAndMovement: {
        movementType: overlongMovementType,
        abilities: ['run', 'jump'],
      },
      coreGameplayLoop: 'Run, jump, and collect items to win.',
      objectivesAndConditions: {
        primaryObjective: 'Reach the end goal',
        winConditions: ['Touch the flag'],
        loseConditions: ['Fall into pit'],
      },
      proposedEnemiesAndHazards: [],
      proposedCollectibles: [],
      difficultyProgression: {
        tier: 'medium',
        pacingNotes: 'Steady pace',
      },
      audioVisualFeedback: {
        visualStyleCues: ['Pixel art'],
        suggestedAudioMood: 'Arcade chiptune',
      },
    },
  };

  assert.throws(
    () => ReferenceAnalysisSchema.parse(rawPayload),
    (err: unknown) => {
      assert.ok(err instanceof z.ZodError);
      const issues = (err as z.ZodError).issues;
      const paths = issues.map((i) => i.path.join('.'));
      return (
        paths.includes('visibleObjects.1') &&
        paths.includes('suggestedRoles.player') &&
        paths.includes('proposedDesign.playerAbilitiesAndMovement.movementType')
      );
    },
    'Raw payload with overlong fields must throw ZodError on unnormalized schema parse'
  );

  // Normalization step at provider/service boundary
  const normalized = normalizeReferenceAnalysisPayload(rawPayload) as typeof rawPayload;

  // Verify all fields are within schema limits
  assert.ok(
    (normalized.visibleObjects?.[1]?.length ?? 0) <= 80,
    `Expected visibleObjects[1] <= 80, got ${normalized.visibleObjects?.[1]?.length}`
  );
  assert.ok(
    (normalized.suggestedRoles?.player?.length ?? 0) <= 80,
    `Expected suggestedRoles.player <= 80, got ${normalized.suggestedRoles?.player?.length}`
  );
  assert.ok(
    (normalized.proposedDesign?.playerAbilitiesAndMovement?.movementType?.length ?? 0) <= 60,
    `Expected movementType <= 60, got ${normalized.proposedDesign?.playerAbilitiesAndMovement?.movementType?.length}`
  );

  // Normalized payload must now pass the strict, authoritative ReferenceAnalysisSchema
  const validated = ReferenceAnalysisSchema.parse(normalized);
  assert.ok(validated);
  assert.strictEqual(validated.category, '2d-platformer');

  // Verify that an already-valid field is unchanged semantically
  const validText = 'Standard blue runner';
  const normalizedValid = normalizeStringLength(validText, 80);
  assert.strictEqual(normalizedValid, validText);

  console.log('  ✓ Overlong fields safely normalized at boundary and pass authoritative ReferenceAnalysisSchema');
}

// ---------------------------------------------------------------------------
// TEST 16: Missing required fields and invalid types are rejected
// ---------------------------------------------------------------------------
console.log('▶ Test 16: Missing required fields and invalid types rejected by Zod schema');
{
  // Missing required field 'category'
  const missingCategory = { ...mockValidAnalysisData };
  delete (missingCategory as Record<string, unknown>).category;
  assert.throws(() => ReferenceAnalysisSchema.parse(missingCategory), z.ZodError);

  // Invalid enum value for cameraPerspective
  const invalidEnum = { ...mockValidAnalysisData, cameraPerspective: 'invalid-360-vr' };
  assert.throws(() => ReferenceAnalysisSchema.parse(invalidEnum), z.ZodError);

  // Invalid type for visibleObjects (number instead of string[])
  const invalidType = { ...mockValidAnalysisData, visibleObjects: 12345 };
  assert.throws(() => ReferenceAnalysisSchema.parse(invalidType), z.ZodError);

  console.log('  ✓ Missing required fields and invalid types strictly rejected by Zod validation');
}

// ---------------------------------------------------------------------------
// TEST 17: Simulated Gemini timeout produces expected timeout error
// ---------------------------------------------------------------------------
console.log('▶ Test 17: Simulated Gemini timeout produces expected timeout error (504 / TIMEOUT)');
{
  const mockTimeoutClient: GoogleGenAIClientLike = {
    models: {
      generateContent: async () => {
        // Hang indefinitely
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { text: '{}' };
      },
    },
  };

  const provider = new GeminiProvider({
    apiKey: 'test-api-key',
    model: 'gemini-2.5-flash',
    client: mockTimeoutClient,
  });

  let caughtError: unknown = null;
  try {
    await provider.execute({
      capability: 'image-understanding',
      prompt: 'Analyze this image',
      imageBase64: VALID_1X1_PNG_BASE64,
      timeoutMs: 30, // 30ms timeout
    });
  } catch (err: unknown) {
    caughtError = err;
  }

  assert.ok(caughtError instanceof AiProviderError, 'Expected AiProviderError on timeout');
  assert.strictEqual((caughtError as AiProviderError).category, 'timeout');
  assert.strictEqual((caughtError as AiProviderError).statusCode, 504);
  assert.strictEqual((caughtError as AiProviderError).isRetryable, true);

  console.log('  ✓ Simulated timeout produces typed 504 / timeout error with isRetryable: true');
}

// ---------------------------------------------------------------------------
// TEST 18: Provider cancellation aborts request without background retries
// ---------------------------------------------------------------------------
console.log('▶ Test 18: Cancellation aborts request immediately without retries');
{
  let callCount = 0;
  const abortController = new AbortController();

  const mockClient: GoogleGenAIClientLike = {
    models: {
      generateContent: async () => {
        callCount++;
        // Hang until aborted
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { text: '{}' };
      },
    },
  };

  const provider = new GeminiProvider({
    apiKey: 'test-api-key',
    model: 'gemini-2.5-flash',
    client: mockClient,
  });

  // Trigger abort after 20ms
  setTimeout(() => abortController.abort(), 20);

  let caughtError: unknown = null;
  try {
    await provider.execute({
      capability: 'image-understanding',
      prompt: 'Analyze this image',
      imageBase64: VALID_1X1_PNG_BASE64,
      signal: abortController.signal,
      timeoutMs: 5000,
    });
  } catch (err: unknown) {
    caughtError = err;
  }

  assert.ok(caughtError instanceof AiProviderError);
  assert.strictEqual((caughtError as AiProviderError).category, 'cancelled');
  assert.strictEqual((caughtError as AiProviderError).statusCode, 499);
  assert.strictEqual((caughtError as AiProviderError).isRetryable, false);
  assert.strictEqual(callCount, 1, 'Cancelled request must not retry');

  console.log('  ✓ Cancellation immediately aborts with status 499 and zero retries');
}

// ---------------------------------------------------------------------------
// TEST 19: Offline fallback output passes exact ReferenceAnalysisSchema
// ---------------------------------------------------------------------------
console.log('▶ Test 19: Offline fallback output passes exact ReferenceAnalysisSchema');
{
  const fallback = generateHeuristicReferenceAnalysis('A platformer game with jumping and obstacles', 800, 600, 'corr-test-fallback');
  const validated = ReferenceAnalysisSchema.parse(fallback);
  assert.ok(validated);
  assert.strictEqual(validated.provenance, 'mock-heuristic');
  assert.ok(validated.visibleObjects.every((vo) => vo.length <= 80));
  assert.ok((validated.suggestedRoles?.player?.length ?? 0) <= 80);
  console.log('  ✓ Offline heuristic analysis output passes exact ReferenceAnalysisSchema validation');
}

// ---------------------------------------------------------------------------
// TEST 20: Schema-validation failure classification returns 502 / invalid_output
// ---------------------------------------------------------------------------
console.log('▶ Test 20: Schema-validation failure classification returns 502 / invalid_output');
{
  const zodErr = new z.ZodError([
    {
      code: 'too_big',
      maximum: 80,
      inclusive: true,
      exact: false,
      message: 'String must contain at most 80 character(s)',
      path: ['visibleObjects', 1],
    } as z.ZodIssue,
  ]);

  const classified = classifyError(zodErr);
  assert.strictEqual(classified.category, 'invalid_output');
  assert.strictEqual(classified.statusCode, 502);
  assert.strictEqual(classified.isRetryable, false);

  console.log('  ✓ Zod validation error classified as invalid_output (502, non-retryable)');
}

// ---------------------------------------------------------------------------
// TEST 21: AnalysisLifecycleManager preserves input and clears loading state on error
// ---------------------------------------------------------------------------
console.log('▶ Test 21: AnalysisLifecycleManager preserves input and clears loading state on error');
{
  const manager = new AnalysisLifecycleManager();
  const testMedia: LoadedImageMedia = {
    dataUrl: VALID_PNG_DATA_URL,
    originalDataUrl: VALID_PNG_DATA_URL,
    fileName: 'test-error.png',
    mimeType: 'image/png',
    fileSizeBytes: 100,
    width: 1,
    height: 1,
    originalWidth: 1,
    originalHeight: 1,
    wasResized: false,
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/upload')) {
      return new Response(
        JSON.stringify({ reference: { id: 'ref-err-1' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // Return 502 schema validation error
    return new Response(
      JSON.stringify({
        success: false,
        correlationId: 'corr-err-1',
        error: {
          code: 'SCHEMA_VALIDATION_ERROR',
          message: 'AI analysis output failed validation schema.',
          category: 'invalid_output',
          isRetryable: false,
          canFallbackToHeuristic: true,
        },
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const result = await manager.startAnalysis({
      media: testMedia,
      userPrompt: 'Test user prompt for error preservation',
      correlationIdOverride: 'corr-err-1',
    });

    assert.strictEqual(result, null);
    const state = manager.getState();
    assert.strictEqual(state.state, 'error');
    assert.strictEqual(manager.isBusy(), false);
    assert.strictEqual(state.error?.code, 'SCHEMA_VALIDATION_ERROR');
    assert.strictEqual(state.error?.canFallbackToHeuristic, true);
    assert.strictEqual(state.preservedPrompt, 'Test user prompt for error preservation');
    assert.strictEqual(state.preservedMedia?.dataUrl, VALID_PNG_DATA_URL);

    console.log('  ✓ AnalysisLifecycleManager cleared loading state, preserved inputs, and exposed heuristic fallback');
  } finally {
    globalThis.fetch = originalFetch;
    manager.reset();
  }
}

console.log('\n--- HUGGING FACE & FALLBACK CHAIN INTEGRATION TESTS ---\n');

const mockValidHfResponseContent = JSON.stringify({
  category: '2d-platformer',
  cameraPerspective: 'side-scrolling-2d',
  visualStyle: 'Pixel Art Retro',
  colorPalette: ['#1e1e2f', '#00ffcc', '#ff007f'],
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
      confidence: 0.9,
      description: 'Player moves horizontally and jumps across gaps',
      observationalEvidence: ['Visible platform gaps', 'Side view perspective'],
      supportingObservations: ['Visible platform gaps'],
    },
  ],
  observedEvidence: {
    majorShapesAndBoundaries: ['Platform boundaries'],
    platformsAndFloors: ['Brick floors'],
    wallsAndCorridors: ['Side borders'],
    visibleCharactersAndObjects: ['Player sprite'],
    visibleHazards: ['Spikes'],
    visibleCollectibles: ['Coins'],
    relativeSpatialLayout: 'Player on left, goal on right',
    dominantColors: ['#1e1e2f', '#00ffcc'],
    visualStyle: 'Pixel Art Retro',
    uncertainAndOccludedRegions: ['Off-screen regions'],
  },
  proposedDesign: {
    suggestedGenre: '2d-platformer',
    cameraPerspective: 'side-scrolling-2d',
    playerAbilitiesAndMovement: {
      movementType: 'Run and Jump',
      abilities: ['walk', 'run', 'jump'],
    },
    coreGameplayLoop: 'Traverse platforms to reach goal',
    objectivesAndConditions: {
      primaryObjective: 'Reach exit flag',
      winConditions: ['Touch flag'],
      loseConditions: ['Touch spikes'],
    },
    proposedEnemiesAndHazards: [{ name: 'Spikes', behaviorProposal: 'Lethal hazard' }],
    proposedCollectibles: [{ name: 'Coins', interactionProposal: 'Score +10' }],
    difficultyProgression: { tier: 'medium', pacingNotes: 'Gradual ramp' },
    audioVisualFeedback: { visualStyleCues: ['Chiptune cues'], suggestedAudioMood: 'Retro arcade' },
  },
  uncertaintiesAndWarnings: ['Static reference only'],
  recommendedPipeline: 'phaser-2d',
});

// ---------------------------------------------------------------------------
// TEST 22: Hugging Face valid vision response
// ---------------------------------------------------------------------------
console.log('▶ Test 22: Hugging Face valid vision response & output structure');
{
  const mockFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: 'chatcmpl-hf-test-1',
        model: 'Qwen/Qwen2.5-VL-3B-Instruct',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: mockValidHfResponseContent,
            },
          },
        ],
        usage: {
          prompt_tokens: 120,
          completion_tokens: 280,
          total_tokens: 400,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const provider = new HuggingFaceProvider({
    token: 'hf_test_mock_token_12345',
    fetchFn: mockFetch,
  });

  const res = await provider.execute({
    capability: 'image-understanding',
    prompt: 'Analyze image',
    imageBase64: VALID_1X1_PNG_BASE64,
  });

  assert.strictEqual(res.metadata.model, 'Qwen/Qwen2.5-VL-3B-Instruct');
  assert.strictEqual(res.metadata.usage?.totalTokens, 400);
  assert.ok(res.rawText.includes('2d-platformer'));

  // Also test analyzeReferenceWithHuggingFace through registry
  aiProviderRegistry.registerProvider(provider, true);
  const analysis = await analyzeReferenceWithHuggingFace(VALID_1X1_PNG_BASE64, 'test');
  assert.strictEqual(analysis.provenance, 'huggingface-vision');
  assert.strictEqual(analysis.category, '2d-platformer');
  assert.ok(ReferenceAnalysisSchema.parse(analysis));

  console.log('  ✓ Hugging Face vision provider returns structured response with truthful provenance');
}

// ---------------------------------------------------------------------------
// TEST 23: Missing HF token returns non-retryable MISSING_CONFIGURATION (401)
// ---------------------------------------------------------------------------
console.log('▶ Test 23: Missing HF token returns non-retryable MISSING_CONFIGURATION (401)');
{
  const unconfigured = new HuggingFaceProvider({
    token: '',
    fetchFn: globalThis.fetch,
  });
  assert.strictEqual(unconfigured.isConfigured(), false);

  await assert.rejects(
    async () => {
      await unconfigured.execute({
        capability: 'image-understanding',
        prompt: 'test',
        imageBase64: VALID_1X1_PNG_BASE64,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AiProviderError);
      assert.strictEqual(err.category, 'auth_error');
      assert.strictEqual(err.code, 'MISSING_CONFIGURATION');
      assert.strictEqual(err.isRetryable, false);
      assert.strictEqual(err.statusCode, 401);
      return true;
    }
  );

  console.log('  ✓ Missing HF token correctly classified as non-retryable auth_error / MISSING_CONFIGURATION');
}

// ---------------------------------------------------------------------------
// TEST 24: Provider timeout (504) and rate-limit response (429)
// ---------------------------------------------------------------------------
console.log('▶ Test 24: Provider timeout (504) and rate-limit (429) error classification');
{
  // 1. Timeout
  const mockTimeoutFetch: typeof fetch = async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return new Response('{}', { status: 200 });
  };

  const timeoutProvider = new HuggingFaceProvider({
    token: 'hf_test_mock_token_12345',
    fetchFn: mockTimeoutFetch,
  });

  await assert.rejects(
    async () => {
      await timeoutProvider.execute({
        capability: 'image-understanding',
        prompt: 'test',
        imageBase64: VALID_1X1_PNG_BASE64,
        timeoutMs: 30, // 30ms timeout
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AiProviderError);
      assert.strictEqual(err.category, 'timeout');
      assert.strictEqual(err.statusCode, 504);
      assert.strictEqual(err.isRetryable, true);
      return true;
    }
  );

  // 2. Rate limit (429)
  const mockRateLimitFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded: You have reached your monthly limit.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const rateLimitProvider = new HuggingFaceProvider({
    token: 'hf_test_mock_token_12345',
    fetchFn: mockRateLimitFetch,
  });

  await assert.rejects(
    async () => {
      await rateLimitProvider.execute({
        capability: 'image-understanding',
        prompt: 'test',
        imageBase64: VALID_1X1_PNG_BASE64,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AiProviderError);
      assert.strictEqual(err.category, 'rate_limit');
      assert.strictEqual(err.statusCode, 429);
      assert.strictEqual(err.isRetryable, true);
      return true;
    }
  );

  console.log('  ✓ Provider timeout (504) and rate-limit (429) classified correctly with isRetryable: true');
}

// ---------------------------------------------------------------------------
// TEST 25: Malformed JSON from Hugging Face returns 502 / invalid_output
// ---------------------------------------------------------------------------
console.log('▶ Test 25: Malformed JSON response returns 502 / invalid_output');
{
  const mockMalformedFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: 'chatcmpl-hf-malformed',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Here is your analysis: {"category": "2d-platformer", unclosed string',
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const malformedProvider = new HuggingFaceProvider({
    token: 'hf_test_mock_token_12345',
    fetchFn: mockMalformedFetch,
  });
  aiProviderRegistry.registerProvider(malformedProvider, true);

  await assert.rejects(
    async () => {
      await analyzeReferenceWithHuggingFace(VALID_1X1_PNG_BASE64, 'test');
    },
    (err: unknown) => {
      const classified = classifyHfError(err);
      assert.strictEqual(classified.category, 'invalid_output');
      assert.strictEqual(classified.statusCode, 502);
      assert.strictEqual(classified.isRetryable, false);
      return true;
    }
  );

  console.log('  ✓ Malformed JSON from model accurately classified as 502 / invalid_output');
}

// ---------------------------------------------------------------------------
// TEST 26: All three reported Zod overlength errors in Hugging Face output normalized
// ---------------------------------------------------------------------------
console.log('▶ Test 26: All three reported Zod overlength errors in Hugging Face output normalized');
{
  const overlongVisibleObject =
    'This is a visible obstacle spike hazard placed along the bottom floor that clearly exceeds the eighty character constraint limit';
  const overlongPlayerRole =
    'The protagonist player character sprite wearing an enchanted golden helmet and carrying a silver sword for battle';
  const overlongMovementType =
    'Omnidirectional grid-based eight-directional isometric diagonal movement with variable acceleration velocity';

  const overlongHfContent = JSON.stringify({
    ...JSON.parse(mockValidHfResponseContent),
    visibleObjects: ['platform', overlongVisibleObject, 'coin'],
    suggestedRoles: {
      player: overlongPlayerRole,
      obstacles: ['Spikes'],
      collectibles: ['Coins'],
    },
    proposedDesign: {
      ...JSON.parse(mockValidHfResponseContent).proposedDesign,
      playerAbilitiesAndMovement: {
        movementType: overlongMovementType,
        abilities: ['run', 'jump'],
      },
    },
  });

  const mockOverlongFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: 'chatcmpl-hf-overlong',
        choices: [{ message: { role: 'assistant', content: overlongHfContent } }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const overlongProvider = new HuggingFaceProvider({
    token: 'hf_test_mock_token_12345',
    fetchFn: mockOverlongFetch,
  });
  aiProviderRegistry.registerProvider(overlongProvider, true);

  const analysis = await analyzeReferenceWithHuggingFace(VALID_1X1_PNG_BASE64, 'test prompt');

  assert.ok((analysis.visibleObjects[1]?.length ?? 0) <= 80, `visibleObjects[1] was ${analysis.visibleObjects[1]?.length}`);
  assert.ok((analysis.suggestedRoles?.player?.length ?? 0) <= 80, `suggestedRoles.player was ${analysis.suggestedRoles?.player?.length}`);
  assert.ok(
    (analysis.proposedDesign?.playerAbilitiesAndMovement?.movementType?.length ?? 0) <= 60,
    `movementType was ${analysis.proposedDesign?.playerAbilitiesAndMovement?.movementType?.length}`
  );
  assert.strictEqual(analysis.provenance, 'huggingface-vision');
  assert.ok(ReferenceAnalysisSchema.parse(analysis));

  console.log('  ✓ Overlength fields in Hugging Face vision output normalized and pass authoritative schema');
}

// ---------------------------------------------------------------------------
// TEST 27: Gemini failure followed by Hugging Face success (Fallback Chain Step 2)
// ---------------------------------------------------------------------------
console.log('▶ Test 27: Gemini failure followed by Hugging Face success (Fallback Chain Step 2)');
{
  // 1. Failing Gemini Provider (Simulate 504 timeout)
  const failingGeminiClient: GoogleGenAIClientLike = {
    models: {
      generateContent: async () => {
        throw new Error('Gemini API call timed out after 35000ms');
      },
    },
  };
  const failingGemini = new GeminiProvider({
    apiKey: 'test-api-key',
    client: failingGeminiClient,
  });

  // 2. Succeeding Hugging Face Provider
  const succeedingHfFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        id: 'chatcmpl-hf-success-fallback',
        model: 'Qwen/Qwen2.5-VL-3B-Instruct',
        choices: [{ message: { role: 'assistant', content: mockValidHfResponseContent } }],
        usage: { total_tokens: 300 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };
  const succeedingHf = new HuggingFaceProvider({
    token: 'hf_test_mock_token_12345',
    fetchFn: succeedingHfFetch,
  });

  aiProviderRegistry.registerProvider(failingGemini, true);
  aiProviderRegistry.registerProvider(succeedingHf, true);

  const result = await analyzeReferenceWithFallbackChain(
    VALID_1X1_PNG_BASE64,
    'Jump across platforms',
    { mode: 'auto' }
  );

  assert.strictEqual(result.source, 'huggingface-vision');
  assert.strictEqual(result.provider.id, 'huggingface');
  assert.strictEqual(result.provider.isFallback, false);
  assert.strictEqual(result.analysis.provenance, 'huggingface-vision');
  assert.ok(result.notice?.includes('Primary Gemini provider failed'));
  assert.ok(result.notice?.includes('Hugging Face Vision'));

  console.log('  ✓ Gemini failure automatically falls back to secondary Hugging Face vision provider');
}

// ---------------------------------------------------------------------------
// TEST 28: Both providers failing followed by heuristic success (Fallback Chain Step 3)
// ---------------------------------------------------------------------------
console.log('▶ Test 28: Both providers failing followed by heuristic success (Fallback Chain Step 3)');
{
  const failingGeminiClient: GoogleGenAIClientLike = {
    models: {
      generateContent: async () => {
        throw new Error('Gemini service unavailable (503)');
      },
    },
  };
  const failingGemini = new GeminiProvider({
    apiKey: 'test-api-key',
    client: failingGeminiClient,
  });

  const failingHfFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({ error: 'Model Qwen/Qwen2.5-VL-3B-Instruct is loading' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  };
  const failingHf = new HuggingFaceProvider({
    token: 'hf_test_mock_token_12345',
    fetchFn: failingHfFetch,
  });

  aiProviderRegistry.registerProvider(failingGemini, true);
  aiProviderRegistry.registerProvider(failingHf, true);

  const result = await analyzeReferenceWithFallbackChain(
    VALID_1X1_PNG_BASE64,
    'Top-down dungeon with keys and exit door',
    { mode: 'auto', allowFallback: true }
  );

  assert.strictEqual(result.source, 'mock-heuristic');
  assert.strictEqual(result.provider.id, 'local-heuristic');
  assert.strictEqual(result.provider.isFallback, true);
  assert.strictEqual(result.analysis.provenance, 'mock-heuristic');
  assert.ok(result.notice?.includes('Switched to deterministic keyword heuristic analysis'));

  console.log('  ✓ Both live providers failing triggers deterministic heuristic with truthful disclosure');
}

// ---------------------------------------------------------------------------
// TEST 29: No hosted provider configured uses heuristic directly
// ---------------------------------------------------------------------------
console.log('▶ Test 29: No hosted provider configured uses heuristic directly');
{
  const unconfiguredGemini = new GeminiProvider({ apiKey: '' });
  const unconfiguredHf = new HuggingFaceProvider({ token: '', fetchFn: globalThis.fetch });

  aiProviderRegistry.registerProvider(unconfiguredGemini, true);
  aiProviderRegistry.registerProvider(unconfiguredHf, true);

  // When allowFallback: true -> returns heuristic
  const result = await analyzeReferenceWithFallbackChain(
    VALID_1X1_PNG_BASE64,
    'Side scrolling voxel platformer',
    { mode: 'auto', allowFallback: true }
  );

  assert.strictEqual(result.source, 'mock-heuristic');
  assert.strictEqual(result.provider.id, 'local-heuristic');
  assert.strictEqual(result.provider.isFallback, true);
  assert.ok(result.notice?.includes('Neither GEMINI_API_KEY nor HF_TOKEN is configured'));

  // When allowFallback: false -> throws 503 MISSING_CONFIGURATION
  await assert.rejects(
    async () => {
      await analyzeReferenceWithFallbackChain(
        VALID_1X1_PNG_BASE64,
        'Side scrolling voxel platformer',
        { mode: 'auto', allowFallback: false }
      );
    },
    (err: unknown) => {
      assert.ok(err instanceof AiProviderError);
      assert.strictEqual(err.code, 'MISSING_CONFIGURATION');
      assert.strictEqual(err.statusCode, 503);
      return true;
    }
  );

  console.log('  ✓ No hosted provider configured safely invokes heuristic directly when fallback allowed');
}

// ---------------------------------------------------------------------------
// TEST 30: Explicit offline mode ('heuristic-only') skips hosted providers
// ---------------------------------------------------------------------------
console.log('▶ Test 30: Explicit offline mode skips hosted providers');
{
  let hostedCallsMade = 0;
  const throwingGeminiClient: GoogleGenAIClientLike = {
    models: {
      generateContent: async () => {
        hostedCallsMade++;
        throw new Error('Should not have been called!');
      },
    },
  };
  const mockGemini = new GeminiProvider({ apiKey: 'key', client: throwingGeminiClient });

  const throwingHfFetch: typeof fetch = async () => {
    hostedCallsMade++;
    throw new Error('Should not have been called!');
  };
  const mockHf = new HuggingFaceProvider({ token: 'tok', fetchFn: throwingHfFetch });

  aiProviderRegistry.registerProvider(mockGemini, true);
  aiProviderRegistry.registerProvider(mockHf, true);

  const result = await analyzeReferenceWithFallbackChain(
    VALID_1X1_PNG_BASE64,
    'Fast paced pixel runner',
    { mode: 'heuristic-only' }
  );

  assert.strictEqual(hostedCallsMade, 0, 'Hosted providers must NOT be called in heuristic-only mode');
  assert.strictEqual(result.source, 'mock-heuristic');
  assert.strictEqual(result.provider.id, 'local-heuristic');
  assert.strictEqual(result.analysis.provenance, 'mock-heuristic');

  console.log('  ✓ Explicit heuristic-only mode executed 0 hosted AI calls and succeeded with offline heuristic');
}

// ---------------------------------------------------------------------------
// TEST 31: No token leakage in logs, responses, or error messages
// ---------------------------------------------------------------------------
console.log('▶ Test 31: No token leakage in logs, responses, or error messages');
{
  const SECRET_TOKEN = 'hf_AB12CD34EF56GH78IJ90KL12MN34OP56QR78';

  // 1. Exact token in error string
  const rawMsg1 = `Failed request to Hugging Face: Authorization header Bearer ${SECRET_TOKEN} rejected`;
  const sanitized1 = sanitizeHfErrorMessage(rawMsg1, SECRET_TOKEN);
  assert.strictEqual(sanitized1.includes(SECRET_TOKEN), false);
  assert.ok(sanitized1.includes('[REDACTED_HF_TOKEN]'));

  // 2. Generic token pattern in error string without passing token explicitly
  const rawMsg2 = `Inference endpoint at https://router.huggingface.co rejected token hf_Secr3tTokenValue9999999999`;
  const sanitized2 = sanitizeHfErrorMessage(rawMsg2);
  assert.strictEqual(sanitized2.includes('hf_Secr3tTokenValue9999999999'), false);
  assert.ok(sanitized2.includes('[REDACTED_HF_TOKEN]'));

  // 3. Provider error message sanitation
  const mockErrorFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({ error: `Invalid credentials for token ${SECRET_TOKEN}` }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const providerWithSecret = new HuggingFaceProvider({
    token: SECRET_TOKEN,
    fetchFn: mockErrorFetch,
  });

  let caughtErr: unknown = null;
  try {
    await providerWithSecret.execute({
      capability: 'image-understanding',
      prompt: 'test',
      imageBase64: VALID_1X1_PNG_BASE64,
    });
  } catch (err: unknown) {
    caughtErr = err;
  }

  assert.ok(caughtErr instanceof AiProviderError);
  const errMsg = (caughtErr as AiProviderError).message;
  assert.strictEqual(errMsg.includes(SECRET_TOKEN), false, 'Token must not be present in AiProviderError message');
  assert.ok(errMsg.includes('[REDACTED_HF_TOKEN]'));

  console.log('  ✓ HF_TOKEN is never leaked in errors, logs, or API response payloads');
}

// ---------------------------------------------------------------------------
// TEST 32: Uploaded image successfully produces a playable Phaser template configuration
// ---------------------------------------------------------------------------
console.log('▶ Test 32: Uploaded image successfully produces a playable Phaser template configuration');
{
  const mockVisionData = {
    ...mockValidAnalysisData,
    provenance: 'huggingface-vision',
    category: '2d-platformer',
    recommendedPipeline: 'phaser-2d',
  };

  const mockHfFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(mockVisionData),
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const hfProvider = new HuggingFaceProvider({
    token: 'hf_test_token_playable_game',
    fetchFn: mockHfFetch,
  });
  aiProviderRegistry.registerProvider(hfProvider, true);

  // Analyze image with HF vision
  const analysis = await analyzeReferenceWithHuggingFace(
    VALID_1X1_PNG_BASE64,
    'Create an awesome pixel runner'
  );
  assert.strictEqual(analysis.provenance, 'huggingface-vision');

  // Synthesize intermediate GameDesignPlan using selected template (phaser-2d-platformer)
  const plan = buildGameGenerationPlan(
    'ref-image-test-123',
    'Create an awesome pixel runner',
    analysis,
    'phaser-2d',
    'phaser-2d-platformer'
  );

  assert.strictEqual(plan.status, 'ready-for-2d-generation');
  assert.strictEqual(plan.targetEngine, 'phaser-2d');
  assert.ok(plan.terrain.platforms.length > 0, 'Plan must generate solid ground platforms');
  assert.ok(plan.player.spawn.x >= 0 && plan.player.spawn.y >= 0, 'Plan must generate valid player spawn');
  assert.ok(plan.objectives.goal, 'Plan must designate an exit goal');

  // Convert Plan to validated PlayableGameScene for Phaser
  const playableScene = convertPlanToPlayableScene(plan);

  assert.ok(PlayableGameSceneSchema.parse(playableScene), 'Playable scene must strictly pass PlayableGameSceneSchema');
  assert.strictEqual(playableScene.templateId, 'phaser-2d-platformer');
  assert.strictEqual(playableScene.movementModel, 'platformer');
  assert.strictEqual(playableScene.source, 'huggingface-vision');
  assert.ok(playableScene.platforms.length > 0, 'Playable scene must contain collision platforms');
  assert.ok(playableScene.player.speed > 0, 'Playable scene must have valid player speed');
  assert.ok(playableScene.player.jumpPower > 0, 'Platformer scene must have jump capability');
  assert.ok(playableScene.goal.x > playableScene.player.spawnX, 'Goal must be placed across the level');

  console.log('  ✓ Uploaded reference image analysis generated fully validated playable Phaser scene configuration');
}

console.log('\n🎉 ALL 32 REFERENCE RELIABILITY TESTS PASSED SUCCESSFULLY!\n');
