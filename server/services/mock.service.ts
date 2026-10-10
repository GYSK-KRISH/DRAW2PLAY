import { CharacterAnalysisOutput } from '../schemas/character.schema.js';

/**
 * Deterministic fallback service that calculates attributes from image characteristics
 * when GEMINI_API_KEY is not configured.
 */
export function generateMockCharacterAttributes(imageBase64: string): CharacterAnalysisOutput {
  const length = imageBase64.length;
  const archetypes = ['speedster', 'brawler', 'tank', 'mystic', 'balanced'] as const;
  const archetype = archetypes[length % archetypes.length];

  const presets: Record<typeof archetype, CharacterAnalysisOutput> = {
    speedster: {
      name: 'Dash Scribble',
      archetype: 'speedster',
      speed: 310,
      jumpPower: 420,
      gravity: 750,
      health: 80,
      colorPalette: ['#38bdf8', '#0284c7', '#facc15'],
      visualDescription: 'A streamlined sketch built for breakneck sprint speeds and lightning-fast hops.',
      detectedFeatures: ['streamlined contours', 'aerodynamic limbs', 'energetic stroke rhythm'],
    },
    brawler: {
      name: 'Spike Smasher',
      archetype: 'brawler',
      speed: 210,
      jumpPower: 380,
      gravity: 850,
      health: 120,
      colorPalette: ['#ef4444', '#b91c1c', '#18181b'],
      visualDescription: 'A jagged, aggressive warrior featuring sharp angles and punchy physics.',
      detectedFeatures: ['sharp spikes', 'punchy angular silhouette', 'heavy center of mass'],
    },
    tank: {
      name: 'Iron Blob',
      archetype: 'tank',
      speed: 150,
      jumpPower: 310,
      gravity: 950,
      health: 180,
      colorPalette: ['#10b981', '#047857', '#334155'],
      visualDescription: 'A sturdy, armored titan with substantial mass, resilient to hazards.',
      detectedFeatures: ['wide rounded body', 'dense center mass', 'thick protective perimeter'],
    },
    mystic: {
      name: 'Astral Doodle',
      archetype: 'mystic',
      speed: 230,
      jumpPower: 490,
      gravity: 580,
      health: 95,
      colorPalette: ['#a855f7', '#7c3aed', '#f43f5e'],
      visualDescription: 'A floaty, ethereal figure capable of gravity-defying leaps across tricky gaps.',
      detectedFeatures: ['ethereal halo', 'light floating density', 'star-shaped accents'],
    },
    balanced: {
      name: 'Doodle Knight',
      archetype: 'balanced',
      speed: 220,
      jumpPower: 380,
      gravity: 800,
      health: 100,
      colorPalette: ['#f59e0b', '#d97706', '#1e293b'],
      visualDescription: 'A versatile, all-round hero ready to tackle any platformer challenge.',
      detectedFeatures: ['proportional anatomy', 'clear ground footing', 'distinct head and torso'],
    },
  };

  return presets[archetype];
}
