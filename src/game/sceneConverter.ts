import type { SketchDocument, SketchStroke } from '../types/sketch.js';
import type {
  PlayableGameScene,
  PlatformElement,
  HazardElement,
  TrampolineElement,
  CoinElement,
  GoalElement,
  SceneProvenanceSource,
} from '../types/scene.js';
import { PlayableGameSceneSchema } from '../types/scene.js';
import {
  calculateStrokeBounds,
  calculateStrokeCentroid,
} from '../utils/geometryExtractor.js';

export interface SceneConversionOptions {
  worldWidth?: number;
  worldHeight?: number;
  gravity?: number;
  source?: SceneProvenanceSource;
  levelName?: string;
  levelDescription?: string;
}

/**
 * Deterministically convert a normalized SketchDocument into a validated PlayableGameScene.
 * Ensures freehand strokes become realistic collision geometry without giant empty AABBs.
 */
export function convertSketchToPlayableScene(
  document: SketchDocument,
  options: SceneConversionOptions = {}
): PlayableGameScene {
  const worldWidth = options.worldWidth ?? 800;
  const worldHeight = options.worldHeight ?? 480;
  const gravity = options.gravity ?? 750;
  const source = options.source ?? 'local-vector';
  const levelName = options.levelName ?? document.name ?? 'Sketch Level 1';
  const levelDescription = options.levelDescription ?? 'A physics-based level generated directly from your sketch.';

  const warnings: string[] = [];
  const assumptions: string[] = [];

  const strokes = document.strokes || [];
  const strokesByType: Record<string, SketchStroke[]> = {
    ground: [],
    hazard: [],
    trampoline: [],
    coin: [],
    goal: [],
  };

  for (const s of strokes) {
    if (strokesByType[s.elementType]) {
      strokesByType[s.elementType].push(s);
    }
  }

  // -------------------------------------------------------------------------
  // 1. CONVERT GROUND STROKES TO SOLID PLATFORMS
  // -------------------------------------------------------------------------
  const platforms: PlatformElement[] = [];

  for (let sIdx = 0; sIdx < strokesByType.ground.length; sIdx++) {
    const stroke = strokesByType.ground[sIdx];
    const pts = stroke.points;
    if (!pts || pts.length === 0) continue;

    const thickness = Math.max(12, Math.min(32, stroke.width || 14));

    if (pts.length === 1) {
      // Single dot platform
      const px = pts[0].x * worldWidth;
      const py = pts[0].y * worldHeight;
      platforms.push({
        id: `plat-${stroke.id}-dot`,
        x: Math.round(px - thickness / 2),
        y: Math.round(py - thickness / 2),
        width: Math.round(thickness * 1.5),
        height: Math.round(thickness),
        strokeColor: stroke.color,
      });
    } else {
      // Multi-point stroke: segment adjacent points to avoid huge AABB box
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];

        const x1 = p1.x * worldWidth;
        const y1 = p1.y * worldHeight;
        const x2 = p2.x * worldWidth;
        const y2 = p2.y * worldHeight;

        const segMinX = Math.min(x1, x2);
        const segMaxX = Math.max(x1, x2);
        const segMinY = Math.min(y1, y2);
        const segMaxY = Math.max(y1, y2);

        const segWidth = Math.max(thickness, segMaxX - segMinX + thickness / 2);
        const segHeight = Math.max(thickness, segMaxY - segMinY + thickness);

        platforms.push({
          id: `plat-${stroke.id}-${i}`,
          x: Math.round(segMinX - thickness / 4),
          y: Math.round(segMinY - thickness / 2),
          width: Math.round(segWidth),
          height: Math.round(segHeight),
          strokeColor: stroke.color,
        });
      }
    }
  }

  // Safety floor check if no ground strokes were drawn
  if (platforms.length === 0) {
    warnings.push('No Ground strokes detected in sketch. Added a default safety floor platform.');
    assumptions.push('Synthesized bottom floor platform across entire world width.');
    platforms.push({
      id: 'plat-fallback-floor',
      x: 0,
      y: worldHeight - 32,
      width: worldWidth,
      height: 32,
      strokeColor: '#10b981',
    });
  }

  // -------------------------------------------------------------------------
  // 2. CONVERT HAZARD STROKES TO LETHAL SPIKE / HAZARD ZONES
  // -------------------------------------------------------------------------
  const hazards: HazardElement[] = [];

  for (let sIdx = 0; sIdx < strokesByType.hazard.length; sIdx++) {
    const stroke = strokesByType.hazard[sIdx];
    const bounds = calculateStrokeBounds(stroke.points);
    if (!bounds) continue;

    const hx = bounds.x * worldWidth;
    const hy = bounds.y * worldHeight;
    const hw = Math.max(20, bounds.width * worldWidth);
    const hh = Math.max(16, bounds.height * worldHeight);

    hazards.push({
      id: `hazard-${stroke.id}`,
      x: Math.round(hx),
      y: Math.round(hy),
      width: Math.round(hw),
      height: Math.round(hh),
      hazardType: 'spike',
    });
  }

  // -------------------------------------------------------------------------
  // 3. CONVERT TRAMPOLINE STROKES TO ELASTIC BOUNCE PADS
  // -------------------------------------------------------------------------
  const trampolines: TrampolineElement[] = [];

  for (let sIdx = 0; sIdx < strokesByType.trampoline.length; sIdx++) {
    const stroke = strokesByType.trampoline[sIdx];
    const bounds = calculateStrokeBounds(stroke.points);
    if (!bounds) continue;

    const tx = bounds.x * worldWidth;
    const ty = bounds.y * worldHeight;
    const tw = Math.max(30, bounds.width * worldWidth);
    const th = Math.max(12, bounds.height * worldHeight);

    trampolines.push({
      id: `tramp-${stroke.id}`,
      x: Math.round(tx),
      y: Math.round(ty),
      width: Math.round(tw),
      height: Math.round(th),
      bounceStrength: 620,
    });
  }

  // -------------------------------------------------------------------------
  // 4. CONVERT COIN STROKES TO COLLECTIBLE REWARDS
  // -------------------------------------------------------------------------
  const coins: CoinElement[] = [];

  for (let sIdx = 0; sIdx < strokesByType.coin.length; sIdx++) {
    const stroke = strokesByType.coin[sIdx];
    const centroid = calculateStrokeCentroid(stroke.points);
    if (!centroid) continue;

    const cx = centroid.x * worldWidth;
    const cy = centroid.y * worldHeight;

    coins.push({
      id: `coin-${stroke.id}`,
      x: Math.round(cx),
      y: Math.round(cy),
      size: 24,
      value: 10,
    });
  }

  // -------------------------------------------------------------------------
  // 5. CONVERT GOAL STROKE (OR PROVIDE DEFAULT GOAL)
  // -------------------------------------------------------------------------
  let goal: GoalElement;

  if (strokesByType.goal.length > 0) {
    const goalStroke = strokesByType.goal[0];
    const bounds = calculateStrokeBounds(goalStroke.points);
    if (bounds) {
      goal = {
        id: `goal-${goalStroke.id}`,
        x: Math.round(bounds.x * worldWidth),
        y: Math.round(bounds.y * worldHeight),
        width: Math.round(Math.max(32, bounds.width * worldWidth)),
        height: Math.round(Math.max(44, bounds.height * worldHeight)),
      };
    } else {
      goal = {
        id: 'goal-default',
        x: worldWidth - 64,
        y: worldHeight - 110,
        width: 36,
        height: 48,
      };
    }
  } else {
    warnings.push('No Goal flag detected in sketch. Placed an explicitly labeled default Goal portal at the right edge.');
    assumptions.push('Placed default finish flag at right border.');
    goal = {
      id: 'goal-default-flag',
      x: worldWidth - 70,
      y: worldHeight - 110,
      width: 36,
      height: 48,
    };
  }

  // -------------------------------------------------------------------------
  // 6. GENERATE SENSIBLE PLAYER SPAWN POSITION
  // -------------------------------------------------------------------------
  // Spawn player above the leftmost ground platform
  let spawnX = 60;
  let spawnY = worldHeight - 120;

  if (platforms.length > 0) {
    // Find platform closest to the left edge
    const sortedByX = [...platforms].sort((a, b) => a.x - b.x);
    const leftmost = sortedByX[0];
    spawnX = Math.max(30, Math.min(worldWidth - 100, leftmost.x + 20));
    spawnY = Math.max(40, leftmost.y - 48);
  }

  // -------------------------------------------------------------------------
  // 7. ASSEMBLE AND VALIDATE PLAYABLE SCENE CONTRACT
  // -------------------------------------------------------------------------
  const rawScene = {
    schemaVersion: '1.0' as const,
    source,
    levelName,
    levelDescription,
    world: {
      width: worldWidth,
      height: worldHeight,
      gravity,
      backgroundColor: '#070a13',
    },
    player: {
      spawnX,
      spawnY,
      speed: 220,
      jumpPower: 400,
      size: 36,
    },
    platforms,
    hazards,
    trampolines,
    coins,
    goal,
    diagnostics: {
      warnings,
      assumptions,
      strokeCount: strokes.length,
      aiConfidence: source === 'gemini-vision' ? 0.92 : undefined,
    },
  };

  // Strictly validate with Zod schema contract
  return PlayableGameSceneSchema.parse(rawScene);
}
