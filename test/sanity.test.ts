import assert from 'node:assert';
import { CharacterAttributesSchema, AnalyzeCharacterRequestSchema } from '../src/types/game.js';
import { CharacterAnalysisOutputSchema } from '../server/schemas/character.schema.js';
import { generateMockCharacterAttributes } from '../server/services/mock.service.js';
import { serverConfig } from '../server/config.js';

console.log('🧪 Starting Draw2Play AI Phase 0 Sanity Test Suite...\n');

// Test 1: CharacterAttributesSchema Validation
console.log('▶ Test 1: CharacterAttributesSchema validates correctly');
const validCharacter = {
  name: 'Cyber Knight',
  archetype: 'speedster' as const,
  speed: 300,
  jumpPower: 450,
  gravity: 700,
  health: 100,
  colorPalette: ['#38bdf8', '#0f172a'],
  visualDescription: 'A speedy cybernetic sketch.',
  detectedFeatures: ['blade', 'helmet visor'],
};
const parsedChar = CharacterAttributesSchema.parse(validCharacter);
assert.strictEqual(parsedChar.name, 'Cyber Knight');
assert.strictEqual(parsedChar.speed, 300);
console.log('  ✓ CharacterAttributesSchema passed');

// Test 2: AnalyzeCharacterRequestSchema Validation
console.log('▶ Test 2: AnalyzeCharacterRequestSchema validation');
const validRequest = {
  imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
};
const parsedReq = AnalyzeCharacterRequestSchema.parse(validRequest);
assert.ok(parsedReq.imageBase64.length > 0);
console.log('  ✓ AnalyzeCharacterRequestSchema passed');

// Test 3: CharacterAnalysisOutputSchema from server
console.log('▶ Test 3: Server CharacterAnalysisOutputSchema validation');
const serverOutput = {
  name: 'Sparky',
  archetype: 'speedster' as const,
  speed: 280,
  jumpPower: 400,
  gravity: 750,
  health: 90,
  colorPalette: ['#facc15', '#000000'],
  visualDescription: 'Energetic lightning hero.',
  detectedFeatures: ['lightning bolt ears'],
};
const parsedServerOutput = CharacterAnalysisOutputSchema.parse(serverOutput);
assert.strictEqual(parsedServerOutput.archetype, 'speedster');
console.log('  ✓ CharacterAnalysisOutputSchema passed');

// Test 4: Mock Heuristic Service Generation
console.log('▶ Test 4: Mock heuristic service generation');
const dummyBase64 = 'data:image/png;base64,SAMPLE_IMAGE_DATA_12345';
const mockResult = generateMockCharacterAttributes(dummyBase64);
assert.ok(mockResult.name.length > 0);
assert.ok(mockResult.speed >= 100 && mockResult.speed <= 350);
assert.ok(mockResult.jumpPower >= 250 && mockResult.jumpPower <= 550);
console.log(`  ✓ Mock generated: ${mockResult.name} (${mockResult.archetype})`);

// Test 5: Server Config Validation
console.log('▶ Test 5: Server configuration values');
assert.ok(typeof serverConfig.port === 'number');
assert.strictEqual(serverConfig.geminiModel, 'gemini-3.8-flash');
console.log(`  ✓ Server Config verified on port ${serverConfig.port}, model: ${serverConfig.geminiModel}`);

console.log('\n🎉 ALL 5 SANITY TESTS PASSED SUCCESSFULLY!');
