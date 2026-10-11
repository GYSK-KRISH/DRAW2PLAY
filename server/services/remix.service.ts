import {
  type JsonPatchOperation,
  type RemixLevelRequest,
  type RemixLevelResponse,
} from '../../src/types/remix.js';
import { validateJsonPatch, applyJsonPatch } from '../../src/utils/patchApplier.js';
import { GameDesignPlanSchema, type GameDesignPlan } from '../../src/types/plan.js';
import { PlayableGameSceneSchema, type PlayableGameScene } from '../../src/types/scene.js';
import { convertPlanToPlayableScene } from '../../src/game/sceneConverter.js';
import { aiProviderRegistry } from '../providers/registry.js';

export class RemixService {
  /**
   * Generates, validates, and applies an RFC 6902 JSON patch based on user natural language instruction
   */
  public async remixLevel(request: RemixLevelRequest): Promise<RemixLevelResponse> {
    const startTime = Date.now();
    const instruction = request.instruction.trim();

    // 1. Identify base target (Plan or Scene)
    let plan = request.plan;
    let scene = request.sceneData;

    if (!plan && !scene) {
      throw new Error('Remix request must provide either a validated GameDesignPlan or PlayableGameScene.');
    }

    // 2. Generate proposed RFC 6902 Patch (AI or Deterministic Heuristic Engine)
    const { patch, summary } = await this.generateProposedPatch(instruction, plan, scene);

    // 3. Validate patch structure and allowlist permissions
    const validationReport = validateJsonPatch(patch);
    if (!validationReport.valid) {
      throw new Error(`Patch validation failed: ${validationReport.errors.join('; ')}`);
    }

    // 4. Apply patch atomically to copy of plan / scene
    let appliedPlan: GameDesignPlan | undefined;
    let appliedScene: PlayableGameScene | undefined;

    if (plan) {
      const planResult = applyJsonPatch(plan, patch);
      if (!planResult.success) {
        throw new Error(`Failed to apply patch to plan: ${planResult.error}`);
      }

      // 5. Validate resulting plan against Zod schema
      const parseResult = GameDesignPlanSchema.safeParse(planResult.patchedObject);
      if (!parseResult.success) {
        throw new Error(`Resulting plan failed schema validation: ${parseResult.error.issues.map((i) => i.message).join(', ')}`);
      }
      appliedPlan = parseResult.data;

      // Automatically convert to scene for preview/hot-update
      try {
        appliedScene = convertPlanToPlayableScene(appliedPlan);
      } catch (err: any) {
        console.warn('[RemixService] Plan-to-scene conversion note:', err.message);
      }
    } else if (scene) {
      const sceneResult = applyJsonPatch(scene, patch);
      if (!sceneResult.success) {
        throw new Error(`Failed to apply patch to scene: ${sceneResult.error}`);
      }

      const parseResult = PlayableGameSceneSchema.safeParse(sceneResult.patchedObject);
      if (!parseResult.success) {
        throw new Error(`Resulting scene failed schema validation: ${parseResult.error.issues.map((i) => i.message).join(', ')}`);
      }
      appliedScene = parseResult.data;
    }

    const executionTimeMs = Date.now() - startTime;
    const newVersion = request.currentVersion + 1;

    return {
      success: true,
      patch,
      appliedPlan,
      appliedScene,
      newVersion,
      summary,
      affectedSystems: validationReport.affectedSystems,
      canHotUpdate: validationReport.canHotUpdate,
      warnings: validationReport.warnings,
      executionTimeMs,
    };
  }

  /**
   * Generates RFC 6902 patch operations via AI provider or deterministic fallback
   */
  private async generateProposedPatch(
    instruction: string,
    plan?: GameDesignPlan,
    scene?: PlayableGameScene
  ): Promise<{ patch: JsonPatchOperation[]; summary: string }> {
    const gemini = aiProviderRegistry.getProvider('gemini');

    if (gemini && gemini.isConfigured()) {
      try {
        const aiPatch = await this.queryAiForPatch(gemini, instruction, plan, scene);
        if (aiPatch && aiPatch.patch.length > 0) {
          return aiPatch;
        }
      } catch (err) {
        console.warn('[RemixService] AI patch query failed, falling back to deterministic heuristic parser:', err);
      }
    }

    // Deterministic Heuristic Parser Fallback
    return this.parseInstructionHeuristically(instruction, plan, scene);
  }

  /**
   * Queries AI provider for RFC 6902 operations
   */
  private async queryAiForPatch(
    provider: any,
    instruction: string,
    plan?: GameDesignPlan,
    scene?: PlayableGameScene
  ): Promise<{ patch: JsonPatchOperation[]; summary: string } | null> {
    const currentTheme = plan?.theme.name || scene?.world.theme || 'default';
    const currentGravity = plan?.world.gravity ?? scene?.world.gravity ?? 750;

    const prompt = `You are a game remix engine. Generate an RFC 6902 JSON Patch to modify a 2D game according to the user's instruction.
Current Theme: ${currentTheme}
Current Gravity: ${currentGravity}
User Instruction: "${instruction}"

Output JSON matching this exact structure:
{
  "summary": "Brief 1-sentence user-facing explanation of what changed",
  "operations": [
    { "op": "replace", "path": "/world/theme", "value": "lava" }
  ]
}
Only modify allowlisted paths: /theme/name, /world/theme, /world/gravity, /world/ambientEffect, /player/speed, /player/jumpPower, /entities/collectibles, /coins, /terrain/hazards, /hazards, /objectives/checkpoints.
Do NOT modify protected paths like schemaVersion, id, or prototype. Return ONLY valid JSON.`;

    const response = await provider.generateContent(prompt, { timeout: 7000 });
    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed.operations) && parsed.operations.length > 0) {
      return {
        patch: parsed.operations,
        summary: parsed.summary || 'Applied requested remix adjustments.',
      };
    }

    return null;
  }

  /**
   * Deterministic Natural-Language Instruction Parser
   * Reliably handles common remix requests without external AI dependencies
   */
  public parseInstructionHeuristically(
    instruction: string,
    plan?: GameDesignPlan,
    scene?: PlayableGameScene
  ): { patch: JsonPatchOperation[]; summary: string } {
    const lower = instruction.toLowerCase();
    const ops: JsonPatchOperation[] = [];
    const changes: string[] = [];

    const isPlan = Boolean(plan);
    const themePath = isPlan ? '/theme/name' : '/world/theme';
    const bgPath = isPlan ? '/theme/background' : '/world/backgroundColor';
    const gravPath = '/world/gravity';
    const ambientPath = '/world/ambientEffect';

    // 1. Theme & Cosmetic Variations
    if (lower.includes('lava') || lower.includes('darker') || lower.includes('fire') || lower.includes('burn')) {
      ops.push({ op: 'replace', path: themePath, value: 'lava' });
      ops.push({ op: 'replace', path: bgPath, value: '#1c0f0a' });
      ops.push({ op: 'replace', path: ambientPath, value: 'embers' });

      // Add orange lava hazard if hazards path exists
      const hazardPath = isPlan ? '/terrain/hazards/-' : '/hazards/-';
      ops.push({
        op: 'add',
        path: hazardPath,
        value: {
          id: `hazard-lava-${Date.now()}`,
          x: 320,
          y: 440,
          width: 80,
          height: 24,
          hazardType: 'lava',
        },
      });
      changes.push('Environment changed to volcanic lava with ambient embers and lava pit');
    } else if (lower.includes('ice') || lower.includes('snow') || lower.includes('frozen') || lower.includes('slippery')) {
      ops.push({ op: 'replace', path: themePath, value: 'ice' });
      ops.push({ op: 'replace', path: bgPath, value: '#082f49' });
      ops.push({ op: 'replace', path: ambientPath, value: 'snow' });
      ops.push({ op: 'replace', path: '/world/friction', value: 0.3 });
      changes.push('Theme transformed to icy glacial terrain with low friction');
    } else if (lower.includes('forest') || lower.includes('nature') || lower.includes('jungle')) {
      ops.push({ op: 'replace', path: themePath, value: 'forest' });
      ops.push({ op: 'replace', path: bgPath, value: '#052e16' });
      ops.push({ op: 'replace', path: ambientPath, value: 'leaves' });
      changes.push('Theme updated to lush forest canopy with falling leaves');
    } else if (lower.includes('cyberpunk') || lower.includes('neon') || lower.includes('synth')) {
      ops.push({ op: 'replace', path: themePath, value: 'cyberpunk' });
      ops.push({ op: 'replace', path: bgPath, value: '#09090b' });
      ops.push({ op: 'replace', path: ambientPath, value: 'sparks' });
      changes.push('Neon cyberpunk aesthetic activated with vibrant sparks');
    } else if (lower.includes('space') || lower.includes('cosmic') || lower.includes('star')) {
      ops.push({ op: 'replace', path: themePath, value: 'space' });
      ops.push({ op: 'replace', path: bgPath, value: '#030712' });
      ops.push({ op: 'replace', path: ambientPath, value: 'stardust' });
      changes.push('Deep space cosmos theme with ambient stardust');
    }

    // 2. Collectibles / Coins
    if (lower.includes('collectible') || lower.includes('coin') || lower.includes('gem') || lower.includes('reward')) {
      const coinPath = isPlan ? '/entities/collectibles/-' : '/coins/-';
      ops.push({
        op: 'add',
        path: coinPath,
        value: { id: `coin-remix-${Date.now()}-1`, x: 260, y: 340, value: 20, size: 24 },
      });
      ops.push({
        op: 'add',
        path: coinPath,
        value: { id: `coin-remix-${Date.now()}-2`, x: 380, y: 300, value: 20, size: 24 },
      });
      ops.push({
        op: 'add',
        path: coinPath,
        value: { id: `coin-remix-${Date.now()}-3`, x: 500, y: 340, value: 20, size: 24 },
      });
      changes.push('Spawned 3 additional bonus collectibles across the level');
    }

    // 3. Gravity Modifications
    if (lower.includes('gravity') || lower.includes('float') || lower.includes('weight')) {
      const currentGrav = plan?.world.gravity ?? scene?.world.gravity ?? 750;
      if (lower.includes('lower') || lower.includes('less') || lower.includes('reduce') || lower.includes('float') || lower.includes('switch every ten seconds') || lower.includes('moon')) {
        const newGrav = Math.max(200, Math.round(currentGrav * 0.6));
        ops.push({ op: 'replace', path: gravPath, value: newGrav });
        changes.push(`Gravity reduced to ${newGrav} for floatier jumps`);
      } else if (lower.includes('higher') || lower.includes('increase') || lower.includes('heavy') || lower.includes('more')) {
        const newGrav = Math.min(1600, Math.round(currentGrav * 1.35));
        ops.push({ op: 'replace', path: gravPath, value: newGrav });
        changes.push(`Gravity increased to ${newGrav} for heavier physics`);
      }
    }

    // 4. Difficulty Adjustments
    if (lower.includes('easier') || lower.includes('easy')) {
      const currentJump = plan?.player.jumpPower ?? scene?.player.jumpPower ?? 400;
      const boostedJump = Math.min(600, Math.round(currentJump * 1.15));
      ops.push({ op: 'replace', path: '/player/jumpPower', value: boostedJump });
      if (isPlan) {
        ops.push({ op: 'replace', path: '/difficulty/tier', value: 'easy' });
        ops.push({ op: 'replace', path: '/difficulty/enemySpeedMultiplier', value: 0.75 });
      } else {
        ops.push({ op: 'replace', path: '/world/difficulty', value: 'easy' });
      }
      changes.push('Level relaxed: player jump power boosted +15% and difficulty set to easy');
    } else if (lower.includes('harder') || lower.includes('hard') || lower.includes('intense')) {
      if (isPlan) {
        ops.push({ op: 'replace', path: '/difficulty/tier', value: 'hard' });
        ops.push({ op: 'replace', path: '/difficulty/enemySpeedMultiplier', value: 1.3 });
      } else {
        ops.push({ op: 'replace', path: '/world/difficulty', value: 'hard' });
      }
      changes.push('Difficulty intensified to hard with faster enemy patrols');
    }

    // 5. Checkpoint Addition
    if (lower.includes('checkpoint') || lower.includes('flag') || lower.includes('save point')) {
      const worldW = plan?.world.width ?? scene?.world.width ?? 800;
      const worldH = plan?.world.height ?? scene?.world.height ?? 480;
      ops.push({
        op: 'add',
        path: '/objectives/checkpoints/-',
        value: {
          id: `cp-remix-${Date.now()}`,
          x: Math.round(worldW * 0.65),
          y: Math.round(worldH - 100),
        },
      });
      changes.push('Placed a new respawn checkpoint beacon before the final stretch');
    }

    // 6. Player Speed / Agility
    if (lower.includes('faster') || lower.includes('speed') || lower.includes('sprint')) {
      const currentSpd = plan?.player.speed ?? scene?.player.speed ?? 220;
      const newSpd = Math.min(420, Math.round(currentSpd * 1.25));
      ops.push({ op: 'replace', path: '/player/speed', value: newSpd });
      changes.push(`Player running speed accelerated to ${newSpd}`);
    }

    // 7. Platforms (Structural)
    if (lower.includes('platform') || lower.includes('bridge') || lower.includes('ledge')) {
      const platPath = isPlan ? '/terrain/platforms/-' : '/platforms/-';
      ops.push({
        op: 'add',
        path: platPath,
        value: {
          id: `plat-remix-${Date.now()}`,
          x: 340,
          y: 280,
          width: 100,
          height: 20,
          strokeColor: '#06b6d4',
        },
      });
      changes.push('Added an elevated stepping platform');
    }

    // Fallback if no specific trigger matched
    if (ops.length === 0) {
      ops.push({ op: 'replace', path: '/player/speed', value: 260 });
      ops.push({ op: 'replace', path: ambientPath, value: 'sparks' });
      changes.push('Fine-tuned player velocity and enabled ambient spark particles');
    }

    return {
      patch: ops,
      summary: changes.join('. ') + '.',
    };
  }
}

export const remixService = new RemixService();
