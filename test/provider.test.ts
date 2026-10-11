import assert from 'node:assert';
import { z } from 'zod';
import {
  AiProviderRegistry,
  aiProviderRegistry,
} from '../server/providers/registry.js';
import {
  GeminiProvider,
  GoogleGenAIClientLike,
  DEFAULT_GEMINI_TIMEOUT_MS,
} from '../server/providers/gemini.provider.js';
import {
  AiProviderError,
  AiProvider,
} from '../server/providers/types.js';
import {
  analyzeReferenceWithGemini,
  analyzeMultipleFramesWithGemini,
  generateHeuristicReferenceAnalysis,
} from '../server/services/referenceAnalysis.service.js';
import {
  transformLevelWithGemini,
  analyzeCharacterWithGemini,
  analyzeLevelWithGemini,
} from '../server/services/gemini.service.js';
import type { PlayableGameScene } from '../src/types/scene.js';

console.log('🧪 Starting Draw2Play AI Phase 7.1 AI Provider & Gemini Adapter Test Suite...\n');

// ---------------------------------------------------------------------------
// TEST 1: Provider contract & capability definition
// ---------------------------------------------------------------------------
console.log('▶ Test 1: Provider contract and capability definition');
const testGemini = new GeminiProvider({ apiKey: 'test-key-mock', model: 'gemini-3.8-flash' });
assert.strictEqual(testGemini.id, 'gemini');
assert.strictEqual(testGemini.displayName, 'Google Gemini');
assert.strictEqual(testGemini.defaultModel, 'gemini-3.8-flash');
assert.ok(testGemini.capabilities.has('text-generation'));
assert.ok(testGemini.capabilities.has('image-understanding'));
assert.ok(testGemini.capabilities.has('multi-image-analysis'));
assert.strictEqual(DEFAULT_GEMINI_TIMEOUT_MS, 18_000);
console.log('  ✓ GeminiProvider contract and capabilities verified');

// ---------------------------------------------------------------------------
// TEST 2: Registry registration and lookup
// ---------------------------------------------------------------------------
console.log('▶ Test 2: Registry registration and lookup');
const registry = new AiProviderRegistry();
registry.registerProvider(testGemini);

const found = registry.getProvider('gemini');
assert.ok(found);
assert.strictEqual(found.id, 'gemini');

const required = registry.requireProvider('gemini');
assert.strictEqual(required.id, 'gemini');

const defaultProv = registry.getDefaultProvider();
assert.strictEqual(defaultProv.id, 'gemini');

const all = registry.getAllProviders();
assert.strictEqual(all.length, 1);
assert.strictEqual(all[0].id, 'gemini');
console.log('  ✓ Registry registration, lookup, and defaults passed');

// ---------------------------------------------------------------------------
// TEST 3: Duplicate provider ID rejection
// ---------------------------------------------------------------------------
console.log('▶ Test 3: Duplicate provider registration rejection');
assert.throws(
  () => registry.registerProvider(testGemini),
  /already registered/,
  'Registry must reject duplicate provider IDs'
);
console.log('  ✓ Duplicate provider ID rejected cleanly');

// ---------------------------------------------------------------------------
// TEST 4: Unsupported capabilities handling
// ---------------------------------------------------------------------------
console.log('▶ Test 4: Unsupported capability handling');
// Mock provider that only supports text generation
const textOnlyProvider: AiProvider = {
  id: 'mock',
  displayName: 'Text Only Mock',
  defaultModel: 'mock-v1',
  capabilities: new Set(['text-generation']),
  isConfigured: () => true,
  getStatus: async () => ({
    providerId: 'mock',
    displayName: 'Text Only Mock',
    isConfigured: true,
    status: 'configured',
    capabilities: ['text-generation'],
    model: 'mock-v1',
  }),
  execute: async (req) => {
    if (req.capability !== 'text-generation') {
      throw new AiProviderError({
        providerId: 'mock',
        category: 'unsupported_capability',
        message: `Capability "${req.capability}" not supported`,
        statusCode: 400,
      });
    }
    return {
      data: req as unknown as any,
      rawText: 'ok',
      metadata: { providerId: 'mock', model: 'mock-v1', durationMs: 5, success: true },
    };
  },
};

const customReg = new AiProviderRegistry();
customReg.registerProvider(textOnlyProvider);

assert.throws(
  () => customReg.getProviderForCapability('image-understanding', 'mock'),
  (err: unknown) => {
    return (
      err instanceof AiProviderError &&
      err.category === 'unsupported_capability' &&
      err.message.includes('image-understanding')
    );
  },
  'Must throw typed unsupported_capability error'
);
console.log('  ✓ Unsupported capability throws typed AiProviderError');

// ---------------------------------------------------------------------------
// TEST 5: Missing API key handling
// ---------------------------------------------------------------------------
console.log('▶ Test 5: Missing API key handling');
const unconfiguredProvider = new GeminiProvider({ apiKey: undefined, client: undefined });
assert.strictEqual(unconfiguredProvider.isConfigured(), false);

const unconfStatus = await unconfiguredProvider.getStatus();
assert.strictEqual(unconfStatus.isConfigured, false);
assert.strictEqual(unconfStatus.status, 'unconfigured');

await assert.rejects(
  async () => {
    await unconfiguredProvider.execute({
      capability: 'text-generation',
      prompt: 'Hello',
    });
  },
  (err: unknown) => {
    return (
      err instanceof AiProviderError &&
      err.category === 'auth_error' &&
      err.message.includes('GEMINI_API_KEY is not configured')
    );
  },
  'Executing unconfigured provider must throw typed auth_error'
);
console.log('  ✓ Unconfigured provider safely identified and execution blocked');

// ---------------------------------------------------------------------------
// TEST 6: Successful mocked Gemini execution
// ---------------------------------------------------------------------------
console.log('▶ Test 6: Successful mocked Gemini execution');
const mockSuccessClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async () => ({
      text: JSON.stringify({
        levelName: 'Cosmic Cavern',
        difficulty: 'medium',
        coins: 10,
      }),
    }),
  },
};

const mockProvider = new GeminiProvider({ client: mockSuccessClient });
const TestSchema = z.object({
  levelName: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  coins: z.number().int(),
});

const response = await mockProvider.execute({
  capability: 'image-understanding',
  prompt: 'Analyze level sketch',
  imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  schema: TestSchema,
});

assert.strictEqual(response.metadata.success, true);
assert.strictEqual(response.metadata.providerId, 'gemini');
assert.ok(response.metadata.durationMs >= 0);
assert.strictEqual(response.data.levelName, 'Cosmic Cavern');
assert.strictEqual(response.data.coins, 10);
console.log('  ✓ Mocked execution succeeded with validated structured output and metadata');

// ---------------------------------------------------------------------------
// TEST 7: Invalid structured output handling
// ---------------------------------------------------------------------------
console.log('▶ Test 7: Invalid structured output handling');
const mockBadJsonClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async () => ({
      text: 'Sorry, I cannot produce JSON for this request.',
    }),
  },
};

const badJsonProvider = new GeminiProvider({ client: mockBadJsonClient });
await assert.rejects(
  async () => {
    await badJsonProvider.execute({
      capability: 'text-generation',
      prompt: 'Generate level',
      schema: TestSchema,
    });
  },
  (err: unknown) => {
    return err instanceof AiProviderError && err.category === 'invalid_output';
  },
  'Must throw invalid_output error on non-JSON response'
);

const mockSchemaMismatchClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async () => ({
      text: JSON.stringify({
        levelName: 'Test',
        difficulty: 'extreme_impossible', // invalid enum
        coins: 'lots', // invalid type
      }),
    }),
  },
};
const schemaMismatchProvider = new GeminiProvider({ client: mockSchemaMismatchClient });
await assert.rejects(
  async () => {
    await schemaMismatchProvider.execute({
      capability: 'text-generation',
      prompt: 'Generate level',
      schema: TestSchema,
    });
  },
  (err: unknown) => {
    return err instanceof AiProviderError && err.category === 'invalid_output';
  },
  'Must throw invalid_output error on schema mismatch'
);
console.log('  ✓ Invalid JSON and schema mismatch correctly classified as invalid_output');

// ---------------------------------------------------------------------------
// TEST 8: Timeout handling
// ---------------------------------------------------------------------------
console.log('▶ Test 8: Timeout handling');
const mockHangingClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { text: '{}' };
    },
  },
};

const timeoutProvider = new GeminiProvider({ client: mockHangingClient });
await assert.rejects(
  async () => {
    await timeoutProvider.execute({
      capability: 'text-generation',
      prompt: 'Fast check',
      timeoutMs: 40, // 40ms timeout vs 300ms delay
    });
  },
  (err: unknown) => {
    return err instanceof AiProviderError && err.category === 'timeout' && err.isRetryable === true;
  },
  'Must classify timed out execution as timeout with isRetryable = true'
);
console.log('  ✓ Execution timeout caught and classified as retryable timeout error');

// ---------------------------------------------------------------------------
// TEST 9: Authentication and rate-limit error mapping
// ---------------------------------------------------------------------------
console.log('▶ Test 9: Authentication and rate-limit error mapping');
const mockAuthErrClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async () => {
      throw new Error('API_KEY_INVALID: User not authenticated');
    },
  },
};
const authErrProvider = new GeminiProvider({ client: mockAuthErrClient });
await assert.rejects(
  async () => {
    await authErrProvider.execute({
      capability: 'text-generation',
      prompt: 'Test auth',
    });
  },
  (err: unknown) => {
    return err instanceof AiProviderError && err.category === 'auth_error' && err.isRetryable === false;
  },
  'Must map auth errors to auth_error'
);

const mockRateLimitClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async () => {
      throw new Error('RESOURCE_EXHAUSTED: Rate limit exceeded (429)');
    },
  },
};
const rateLimitProvider = new GeminiProvider({ client: mockRateLimitClient });
await assert.rejects(
  async () => {
    await rateLimitProvider.execute({
      capability: 'text-generation',
      prompt: 'Test rate limit',
    });
  },
  (err: unknown) => {
    return err instanceof AiProviderError && err.category === 'rate_limit' && err.isRetryable === true;
  },
  'Must map 429 quota exhaustion to rate_limit with isRetryable=true'
);
console.log('  ✓ Auth and rate-limit errors mapped accurately');

// ---------------------------------------------------------------------------
// TEST 10: Accurate provenance on success and failure
// ---------------------------------------------------------------------------
console.log('▶ Test 10: Accurate provenance on success and failure');
const heuristicResult = generateHeuristicReferenceAnalysis('Pixel art platformer level');
assert.strictEqual(heuristicResult.provenance, 'mock-heuristic');
assert.strictEqual(heuristicResult.frameCount, 1);
assert.ok(heuristicResult.uncertaintiesAndWarnings.some((w) => w.includes('mock-heuristic') || w.includes('offline') || w.includes('keyword heuristics')));
console.log('  ✓ Heuristic fallback strictly produces mock-heuristic provenance');

// ---------------------------------------------------------------------------
// TEST 11: Reference analysis compatibility with provider adapter
// ---------------------------------------------------------------------------
console.log('▶ Test 11: Reference analysis compatibility with provider adapter');
const mockReferenceClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async () => ({
      text: JSON.stringify({
        schemaVersion: '2.0',
        category: '2d-platformer',
        cameraPerspective: 'side-scrolling-2d',
        visualStyle: 'Hand-drawn Ink Doodle',
        colorPalette: ['#10b981', '#ef4444'],
        visibleObjects: ['platform line', 'hazard spike'],
        terrainLayout: 'Two horizontal platforms with gap',
        suggestedRoles: {
          player: 'Green hero dot',
          obstacles: ['Red spike hazard'],
          collectibles: [],
          goals: ['Purple exit'],
        },
        inferredMechanics: [
          {
            name: 'Jump Gap',
            description: 'Hypothesis: Player must jump over the pit to land on right platform.',
            confidence: 0.85,
            observationalEvidence: ['Visible empty space between two platforms'],
            supportingObservations: ['Gap in platform terrain'],
          },
        ],
        uncertaintiesAndWarnings: ['Single frame does not reveal player physics speed'],
        recommendedPipeline: 'phaser-2d',
      }),
    }),
  },
};

// Temporarily register mock provider in global registry
const originalGemini = aiProviderRegistry.getProvider('gemini')!;
aiProviderRegistry.clearForTesting();
aiProviderRegistry.registerProvider(new GeminiProvider({ client: mockReferenceClient }));

try {
  const analysis = await analyzeReferenceWithGemini(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'Platformer game'
  );
  assert.strictEqual(analysis.schemaVersion, '2.0');
  assert.strictEqual(analysis.provenance, 'gemini-vision');
  assert.strictEqual(analysis.category, '2d-platformer');
  assert.strictEqual(analysis.inferredMechanics[0].observationalEvidence.length, 1);
  assert.strictEqual(analysis.frameCount, 1);
  console.log('  ✓ analyzeReferenceWithGemini functions seamlessly through Gemini provider');
} finally {
  aiProviderRegistry.clearForTesting();
  aiProviderRegistry.registerProvider(originalGemini);
}

// ---------------------------------------------------------------------------
// TEST 12: Multi-frame analysis compatibility with provider adapter
// ---------------------------------------------------------------------------
console.log('▶ Test 12: Multi-frame analysis compatibility with provider adapter');
let frameCallCount = 0;
const mockMultiFrameClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async (params) => {
      frameCallCount++;
      const promptText = params.contents[0]?.parts[0]?.text || '';
      if (promptText.includes('analyzing frame')) {
        // Frame analysis
        return {
          text: JSON.stringify({
            frameIndex: 0,
            timestampSeconds: 1.0,
            visibleObjects: ['moving player avatar', 'coin particle'],
            terrainNotes: 'Flat ground',
            uniqueObservations: ['Player in mid-air jumping'],
          }),
        };
      }
      // Primary analysis
      return {
        text: JSON.stringify({
          schemaVersion: '2.0',
          category: '2d-platformer',
          cameraPerspective: 'side-scrolling-2d',
          visualStyle: 'Pixel Art Runner',
          colorPalette: ['#38bdf8', '#facc15'],
          visibleObjects: ['platform', 'coin'],
          terrainLayout: 'Linear run',
          suggestedRoles: {},
          inferredMechanics: [
            {
              name: 'Air Jump',
              description: 'Inference: Jumping mechanic active',
              confidence: 0.8,
              observationalEvidence: ['Player airborne with arched legs'],
              supportingObservations: ['Airborne pose'],
            },
          ],
          uncertaintiesAndWarnings: ['Sampled from short clip'],
          recommendedPipeline: 'phaser-2d',
        }),
      };
    },
  },
};

aiProviderRegistry.clearForTesting();
aiProviderRegistry.registerProvider(new GeminiProvider({ client: mockMultiFrameClient }));

try {
  const frames = [
    'data:image/png;base64,frame1',
    'data:image/png;base64,frame2',
    'data:image/png;base64,frame3',
  ];
  const multiAnalysis = await analyzeMultipleFramesWithGemini(frames, 'Runner video');
  assert.strictEqual(multiAnalysis.frameCount, 3);
  assert.ok(multiAnalysis.frameResults);
  assert.strictEqual(multiAnalysis.frameResults.length, 3);
  assert.strictEqual(multiAnalysis.provenance, 'gemini-vision');
  assert.ok(multiAnalysis.visibleObjects.includes('moving player avatar'));
  console.log(`  ✓ analyzeMultipleFramesWithGemini processed 3 frames via provider (${frameCallCount} calls total)`);
} finally {
  aiProviderRegistry.clearForTesting();
  aiProviderRegistry.registerProvider(originalGemini);
}

// ---------------------------------------------------------------------------
// TEST 13: Natural-language level transformation compatibility
// ---------------------------------------------------------------------------
console.log('▶ Test 13: Natural-language level transformation compatibility');
const mockTransformationClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async () => ({
      text: JSON.stringify({
        operations: [
          { type: 'set_theme', theme: 'ice' },
          { type: 'adjust_physics', friction: 0.12, gravity: 800 },
          { type: 'add_coins', count: 5 },
        ],
        explanation: 'Transformed level into a slippery ice landscape with bonus coins.',
        warnings: [],
      }),
    }),
  },
};

aiProviderRegistry.clearForTesting();
aiProviderRegistry.registerProvider(new GeminiProvider({ client: mockTransformationClient }));

const sampleScene: PlayableGameScene = {
  schemaVersion: '1.0',
  source: 'local-vector',
  movementModel: 'platformer',
  levelName: 'Grass Run',
  levelDescription: 'Basic test level',
  world: {
    width: 800,
    height: 480,
    gravity: 750,
    backgroundColor: '#070a13',
    theme: 'default',
    friction: 1.0,
    difficulty: 'normal',
    ambientEffect: 'none',
  },
  player: { spawnX: 50, spawnY: 400, speed: 200, jumpPower: 400, size: 32 },
  platforms: [{ id: 'p1', x: 0, y: 440, width: 800, height: 40, strokeColor: '#10b981' }],
  hazards: [],
  trampolines: [],
  coins: [],
  enemies: [],
  switches: [],
  doors: [],
  goal: { id: 'g1', x: 750, y: 400, width: 32, height: 40 },
  diagnostics: { warnings: [], assumptions: [], strokeCount: 1 },
};

try {
  const transformResult = await transformLevelWithGemini(sampleScene, 'Make it icy with coins');
  assert.strictEqual(transformResult.operations.length, 3);
  assert.strictEqual(transformResult.operations[0].type, 'set_theme');
  assert.strictEqual((transformResult.operations[0] as any).theme, 'ice');
  assert.strictEqual(transformResult.explanation.includes('ice'), true);
  console.log('  ✓ transformLevelWithGemini operates cleanly through Gemini provider');
} finally {
  aiProviderRegistry.clearForTesting();
  aiProviderRegistry.registerProvider(originalGemini);
}

// ---------------------------------------------------------------------------
// TEST 14: Character and Level analysis service compatibility
// ---------------------------------------------------------------------------
console.log('▶ Test 14: Character and Level analysis service compatibility');
const mockCharLevelClient: GoogleGenAIClientLike = {
  models: {
    generateContent: async (params) => {
      const promptText = params.contents[0]?.parts[0]?.text || '';
      if (promptText.includes('character sketch')) {
        return {
          text: JSON.stringify({
            name: 'Blaze Fox',
            archetype: 'speedster',
            speed: 310,
            jumpPower: 480,
            gravity: 720,
            health: 90,
            colorPalette: ['#ef4444', '#f97316'],
            visualDescription: 'A swift fiery fox.',
            detectedFeatures: ['tail', 'ears'],
          }),
        };
      }
      return {
        text: JSON.stringify({
          levelName: 'Skyward Spires',
          levelDescription: 'Vertical climbing challenge',
          difficultyRating: 'hard',
          visualStyle: 'Neon Tower',
          playerTuning: { speed: 260, jumpPower: 520, gravity: 800 },
          recognizedElements: ['high platforms'],
          designFeedback: 'Challenging spacing between upper ledges',
        }),
      };
    },
  },
};

aiProviderRegistry.clearForTesting();
aiProviderRegistry.registerProvider(new GeminiProvider({ client: mockCharLevelClient }));

try {
  const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const char = await analyzeCharacterWithGemini(dummyBase64);
  assert.strictEqual(char.name, 'Blaze Fox');
  assert.strictEqual(char.archetype, 'speedster');

  const lvl = await analyzeLevelWithGemini(dummyBase64, '5 vector platforms');
  assert.strictEqual(lvl.levelName, 'Skyward Spires');
  assert.strictEqual(lvl.difficultyRating, 'hard');
  console.log('  ✓ analyzeCharacterWithGemini and analyzeLevelWithGemini work seamlessly via provider');
} finally {
  aiProviderRegistry.clearForTesting();
  aiProviderRegistry.registerProvider(originalGemini);
}

// ---------------------------------------------------------------------------
// TEST 15: Safe provider diagnostics and credential protection
// ---------------------------------------------------------------------------
console.log('▶ Test 15: Safe provider diagnostics and credential protection');
const secretKey = 'AIzaSyFakeSecretKeyThatMustNeverLeak12345';
const configuredProv = new GeminiProvider({
  apiKey: secretKey,
  model: 'gemini-3.8-flash',
  client: {
    models: {
      generateContent: async () => ({ text: 'OK' }),
    },
  },
});

const report = await configuredProv.getStatus(false);
const serialized = JSON.stringify(report);
assert.strictEqual(serialized.includes(secretKey), false);
assert.strictEqual(report.isConfigured, true);
assert.strictEqual(report.status, 'configured');
assert.strictEqual(report.providerId, 'gemini');

// Test probe
const probedReport = await configuredProv.getStatus(true);
assert.strictEqual(probedReport.status, 'available');
assert.strictEqual(JSON.stringify(probedReport).includes(secretKey), false);

// Test probe failure
const failingProbeProv = new GeminiProvider({
  apiKey: secretKey,
  client: {
    models: {
      generateContent: async () => {
        throw new Error(`API key ${secretKey} was rejected by server`);
      },
    },
  },
});
const failedProbeReport = await failingProbeProv.getStatus(true);
assert.strictEqual(failedProbeReport.status, 'unavailable');
assert.strictEqual(failedProbeReport.lastErrorCategory, 'auth_error');
assert.strictEqual(JSON.stringify(failedProbeReport).includes(secretKey), false);
console.log('  ✓ Provider diagnostics verified: zero credentials leaked, status transitions safe');

console.log('\n🎉 ALL 15 PHASE 7.1 PROVIDER & ADAPTER TESTS PASSED SUCCESSFULLY!');
