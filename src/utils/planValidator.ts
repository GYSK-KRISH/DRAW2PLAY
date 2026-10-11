import {
  type GameDesignPlan,
  GameDesignPlanSchema,
  ALLOWLISTED_MECHANIC_IDS,
  type GameTemplateId,
} from '../types/plan.js';

export class PlanValidationError extends Error {
  public readonly errors: string[];

  constructor(errors: string[]) {
    super(`Plan validation failed with ${errors.length} error(s):\n- ${errors.join('\n- ')}`);
    this.name = 'PlanValidationError';
    this.errors = errors;
  }
}

/**
 * Checks for prohibited code execution injection patterns in plan strings.
 * Disallows eval, script tags, dynamically generated module imports, etc.
 */
const FORBIDDEN_CODE_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /\beval\s*\(/gi,
  /\bFunction\s*\(/gi,
  /\bsetTimeout\s*\(\s*["'`]/gi,
  /\bsetInterval\s*\(\s*["'`]/gi,
  /\bimport\s*\(/gi,
  /\brequire\s*\(/gi,
  /__proto__/gi,
  /constructor\s*\[\s*["']prototype/gi,
];

export function sanitizePlanStrings(obj: unknown, errors: string[], path = ''): void {
  if (typeof obj === 'string') {
    for (const pattern of FORBIDDEN_CODE_PATTERNS) {
      if (pattern.test(obj)) {
        errors.push(`Security violation at "${path}": executable code or script injection pattern detected`);
        break;
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, idx) => sanitizePlanStrings(item, errors, `${path}[${idx}]`));
  } else if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      sanitizePlanStrings(value, errors, path ? `${path}.${key}` : key);
    }
  }
}

/**
 * Deep check for non-finite numbers (NaN, Infinity, -Infinity)
 */
export function checkFiniteNumbers(obj: unknown, errors: string[], path = ''): void {
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) {
      errors.push(`Non-finite number found at "${path}": ${obj}`);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, idx) => checkFiniteNumbers(item, errors, `${path}[${idx}]`));
  } else if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      checkFiniteNumbers(value, errors, path ? `${path}.${key}` : key);
    }
  }
}

/**
 * Strictly validates a GameDesignPlan against engine invariants and security constraints.
 */
export function validateGamePlan(raw: unknown): {
  success: boolean;
  plan?: GameDesignPlan;
  errors: string[];
} {
  const errors: string[] = [];

  // 1. Zod schema structural validation
  const parseResult = GameDesignPlanSchema.safeParse(raw);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push(`${issue.path.join('.') || 'root'}: ${issue.message}`);
    }
    return { success: false, errors };
  }

  const plan = parseResult.data;

  // 2. Finite numbers validation
  checkFiniteNumbers(plan, errors, 'plan');

  // 3. Security code injection scanning
  sanitizePlanStrings(plan, errors, 'plan');

  const { width: worldW, height: worldH } = plan.world;

  // 4. World bounds and coordinate constraints
  // Player Spawn
  if (plan.player.spawn.x < 0 || plan.player.spawn.x > worldW) {
    errors.push(`Player spawn X (${plan.player.spawn.x}) is outside world width [0, ${worldW}]`);
  }
  if (plan.player.spawn.y < 0 || plan.player.spawn.y > worldH) {
    errors.push(`Player spawn Y (${plan.player.spawn.y}) is outside world height [0, ${worldH}]`);
  }

  // Goal
  if (plan.objectives.goal.x < 0 || plan.objectives.goal.x + plan.objectives.goal.width > worldW) {
    errors.push(`Goal X position [${plan.objectives.goal.x}, ${plan.objectives.goal.x + plan.objectives.goal.width}] exceeds world width [0, ${worldW}]`);
  }
  if (plan.objectives.goal.y < 0 || plan.objectives.goal.y + plan.objectives.goal.height > worldH) {
    errors.push(`Goal Y position [${plan.objectives.goal.y}, ${plan.objectives.goal.y + plan.objectives.goal.height}] exceeds world height [0, ${worldH}]`);
  }

  // Platforms
  for (const p of plan.terrain.platforms) {
    if (p.x < 0 || p.x + p.width > worldW) {
      errors.push(`Platform "${p.id}" horizontal span [${p.x}, ${p.x + p.width}] exceeds world width [0, ${worldW}]`);
    }
    if (p.y < 0 || p.y + p.height > worldH) {
      errors.push(`Platform "${p.id}" vertical span [${p.y}, ${p.y + p.height}] exceeds world height [0, ${worldH}]`);
    }
  }

  // Walls
  for (const w of plan.terrain.walls) {
    if (w.x < 0 || w.x + w.width > worldW) {
      errors.push(`Wall "${w.id}" horizontal span [${w.x}, ${w.x + w.width}] exceeds world width [0, ${worldW}]`);
    }
    if (w.y < 0 || w.y + w.height > worldH) {
      errors.push(`Wall "${w.id}" vertical span [${w.y}, ${w.y + w.height}] exceeds world height [0, ${worldH}]`);
    }
  }

  // Hazards
  for (const h of plan.terrain.hazards) {
    if (h.x < 0 || h.x + h.width > worldW) {
      errors.push(`Hazard "${h.id}" horizontal span [${h.x}, ${h.x + h.width}] exceeds world width [0, ${worldW}]`);
    }
    if (h.y < 0 || h.y + h.height > worldH) {
      errors.push(`Hazard "${h.id}" vertical span [${h.y}, ${h.y + h.height}] exceeds world height [0, ${worldH}]`);
    }
  }

  // Enemies
  for (const e of plan.entities.enemies) {
    if (e.x < 0 || e.x > worldW) {
      errors.push(`Enemy "${e.id}" X (${e.x}) is outside world width [0, ${worldW}]`);
    }
    if (e.y < 0 || e.y > worldH) {
      errors.push(`Enemy "${e.id}" Y (${e.y}) is outside world height [0, ${worldH}]`);
    }
  }

  // Collectibles
  for (const c of plan.entities.collectibles) {
    if (c.x < 0 || c.x > worldW) {
      errors.push(`Collectible "${c.id}" X (${c.x}) is outside world width [0, ${worldW}]`);
    }
    if (c.y < 0 || c.y > worldH) {
      errors.push(`Collectible "${c.id}" Y (${c.y}) is outside world height [0, ${worldH}]`);
    }
  }

  // 5. Unique Entity IDs
  const seenIds = new Set<string>();
  const entityCollections: [string, { id: string }[]][] = [
    ['platforms', plan.terrain.platforms],
    ['walls', plan.terrain.walls],
    ['hazards', plan.terrain.hazards],
    ['enemies', plan.entities.enemies],
    ['collectibles', plan.entities.collectibles],
    ['interactives', plan.entities.interactives],
    ['checkpoints', plan.objectives.checkpoints],
  ];

  for (const [colName, list] of entityCollections) {
    for (const item of list) {
      if (seenIds.has(item.id)) {
        errors.push(`Duplicate entity ID detected in ${colName}: "${item.id}"`);
      }
      seenIds.add(item.id);
    }
  }

  if (seenIds.has(plan.objectives.goal.id)) {
    errors.push(`Goal ID "${plan.objectives.goal.id}" conflicts with existing entity ID`);
  }
  seenIds.add(plan.objectives.goal.id);

  // 6. Entity Reference Integrity
  // Primary objective targetRef
  if (plan.objectives.primary.targetRef && !seenIds.has(plan.objectives.primary.targetRef)) {
    errors.push(
      `Primary objective references non-existent target ID "${plan.objectives.primary.targetRef}"`
    );
  }

  // Interactives targetRef
  for (const inter of plan.entities.interactives) {
    if (inter.targetRef && !seenIds.has(inter.targetRef)) {
      errors.push(
        `Interactive "${inter.id}" references non-existent target ID "${inter.targetRef}"`
      );
    }
  }

  // 7. Mechanic Allowlist Governance
  for (const mech of plan.mechanics.allowedMechanics) {
    if (!ALLOWLISTED_MECHANIC_IDS.includes(mech)) {
      errors.push(`Mechanic "${mech}" is not on the supported runtime allowlist`);
    }
  }

  return {
    success: errors.length === 0,
    plan: errors.length === 0 ? plan : undefined,
    errors,
  };
}

/**
 * Asserts that a GameDesignPlan is valid, throwing PlanValidationError on failure.
 */
export function assertValidGamePlan(raw: unknown): GameDesignPlan {
  const result = validateGamePlan(raw);
  if (!result.success || !result.plan) {
    throw new PlanValidationError(result.errors);
  }
  return result.plan;
}

/**
 * Migrates a legacy v1.0 GameGenerationPlan or raw partial project into a validated v2.0 GameDesignPlan.
 * Preserves all design intent without loss of user selections.
 */
export function migrateGamePlan(raw: unknown): GameDesignPlan {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Cannot migrate invalid plan: input is not an object');
  }

  const legacy = raw as Record<string, unknown>;

  // Check if it's already a full v2.0 plan
  if (legacy.schemaVersion === '2.0' && legacy.terrain && legacy.player && legacy.objectives) {
    const validated = validateGamePlan(legacy);
    if (validated.success && validated.plan) {
      return validated.plan;
    }
  }

  const id = String(legacy.id || `plan-${Date.now().toString(36)}`);
  const generationId = String(legacy.generationId || `gen-${Date.now().toString(36)}`);
  const referenceId = String(legacy.referenceId || 'ref-migrated');
  const userPrompt = String(legacy.userPrompt || 'Generated game level');
  const category = (legacy.category as GameDesignPlan['category']) || '2d-platformer';
  const targetEngine = (legacy.targetEngine as GameDesignPlan['targetEngine']) || 'phaser-2d';
  const status = (legacy.status as GameDesignPlan['status']) || 'ready-for-2d-generation';
  const createdAt = String(legacy.createdAt || new Date().toISOString());

  // Determine template from category / targetEngine
  let templateId: GameTemplateId = 'phaser-2d-platformer';
  if (category === 'top-down-2d') {
    templateId = 'phaser-2d-topdown';
  } else if (category === 'puzzle') {
    templateId = 'phaser-2d-puzzle';
  } else if (category === 'voxel' || category === '3d-world' || targetEngine === 'future-3d-engine') {
    templateId = 'voxel-3d-deferred';
  }

  const cfg = (legacy.suggested2DConfig as Record<string, unknown>) || {};
  const themeName = (cfg.theme as GameDesignPlan['theme']['name']) || 'default';
  const playerSpeed = Number(cfg.playerSpeed) || 240;
  const playerJump = Number(cfg.playerJump) || 440;
  const gravity = Number(cfg.gravity) || (templateId === 'phaser-2d-topdown' ? 0 : 750);
  const platformCount = Math.max(3, Math.min(10, Number(cfg.platformCount) || 5));

  const worldWidth = 800;
  const worldHeight = 480;

  // Synthesize geometry
  const platforms: GameDesignPlan['terrain']['platforms'] = [
    {
      id: `${id}-base-floor`,
      x: 0,
      y: worldHeight - 36,
      width: worldWidth,
      height: 36,
      strokeColor: '#10b981',
      friction: 0.8,
    },
  ];

  const collectibles: GameDesignPlan['entities']['collectibles'] = [];
  const hazards: GameDesignPlan['terrain']['hazards'] = [];

  const spacingX = Math.round((worldWidth - 180) / platformCount);
  for (let i = 1; i <= platformCount; i++) {
    const px = Math.round(50 + (i - 1) * spacingX);
    const py = Math.round(worldHeight - 80 - ((i % 3) * 45));
    const pw = Math.round(90 + ((i % 2) * 30));

    platforms.push({
      id: `${id}-plat-${i}`,
      x: px,
      y: py,
      width: pw,
      height: 18,
      strokeColor: '#38bdf8',
    });

    collectibles.push({
      id: `${id}-coin-${i}`,
      name: `Coin ${i}`,
      type: 'coin',
      x: px + Math.round(pw / 2),
      y: py - 28,
      value: 10,
    });

    if (i === 2 || i === 4) {
      hazards.push({
        id: `${id}-hazard-${i}`,
        x: px + pw + 10,
        y: worldHeight - 52,
        width: 28,
        height: 16,
        hazardType: 'spike',
      });
    }
  }

  const goalId = `${id}-goal`;
  const migratedPlan: GameDesignPlan = {
    schemaVersion: '2.0',
    generationId,
    id,
    referenceId,
    title: `${category.toUpperCase()} Adventure`,
    description: userPrompt,
    sourceType: 'image-upload',
    provenance: 'mock-heuristic',
    provider: {
      id: 'local-migrator',
      model: 'legacy-schema-v1',
      isFallback: true,
    },
    templateId,
    targetEngine,
    category,
    userPrompt,
    theme: {
      name: themeName,
      palette: ['#38bdf8', '#22c55e', '#ef4444', '#facc15', '#a855f7'],
      background: '#070a13',
    },
    world: {
      width: worldWidth,
      height: worldHeight,
      gravity,
      coordinateSystem: 'screen-top-left-2d',
      friction: 0.8,
    },
    terrain: {
      platforms,
      walls: [],
      hazards,
    },
    player: {
      spawn: { x: 60, y: worldHeight - 110 },
      speed: playerSpeed,
      jumpPower: playerJump,
      size: 36,
      supportedAbilities: ['walk', 'run', 'jump'],
    },
    entities: {
      enemies: [],
      collectibles,
      interactives: [],
    },
    objectives: {
      primary: {
        type: 'reach_goal',
        targetRef: goalId,
      },
      winConditions: ['Reach the goal portal', 'Collect coins along the path'],
      loseConditions: ['Fall into hazards'],
      checkpoints: [],
      goal: {
        id: goalId,
        x: worldWidth - 75,
        y: worldHeight - 110,
        width: 36,
        height: 48,
      },
    },
    difficulty: {
      tier: 'medium',
      seed: 42,
      enemySpeedMultiplier: 1.0,
    },
    mechanics: {
      allowedMechanics:
        templateId === 'phaser-2d-topdown'
          ? ['topdown_4way_movement', 'coin_collection']
          : ['jump_and_run', 'hazard_evasion', 'coin_collection'],
      rejectedMechanics: [],
    },
    confidenceAndWarnings: {
      overallConfidence: 'medium',
      confidenceReasoning: 'Migrated from v1.0 plan with safe normalized bounds.',
      warnings: ['Migrated from legacy v1.0 plan contract.'],
      unsupportedFeatures: [],
    },
    status,
    createdAt,
    requestedFeatures: (legacy.requestedFeatures as string[]) || [],
    missingRequirements: (legacy.missingRequirements as string[]) || [],
    limitationsAndWarnings: (legacy.limitationsAndWarnings as string[]) || [],
    suggested2DConfig: {
      theme: themeName,
      playerSpeed,
      playerJump,
      gravity,
      platformCount,
      hazardTypes: ['spike'],
      collectibleTypes: ['coin'],
    },
  };

  return assertValidGamePlan(migratedPlan);
}
