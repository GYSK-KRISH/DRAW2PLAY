import type { PlayableGameScene } from '../types/scene.js';
import type { TransformationOperation } from '../types/transformation.js';

export interface LocalRuleParseResult {
  isSupported: boolean;
  operations: TransformationOperation[];
  explanation: string;
  warnings: string[];
}

/**
 * Deterministic natural-language parser for level transformation requests.
 * Extracts themes, physics, difficulties, coins, and hazard modifications without needing external AI.
 */
export function interpretInstructionLocally(
  instruction: string,
  _currentScene?: PlayableGameScene
): LocalRuleParseResult {
  const text = instruction.toLowerCase().trim();
  const operations: TransformationOperation[] = [];
  const explanations: string[] = [];
  const warnings: string[] = [];

  let matchedAny = false;

  // 1. Theme checks
  if (/\b(ice|icy|glacier|snow|frozen|frost|slippery|arctic)\b/.test(text)) {
    matchedAny = true;
    operations.push({ type: 'set_theme', theme: 'ice' });
    operations.push({ type: 'adjust_physics', friction: 0.12 });
    operations.push({ type: 'set_environment_effects', effect: 'snow' });
    explanations.push('Applied Ice theme with low-friction sliding physics and falling snow');
  } else if (/\b(lava|volcano|magma|fire|inferno|burn|flame)\b/.test(text)) {
    matchedAny = true;
    operations.push({ type: 'set_theme', theme: 'lava' });
    operations.push({ type: 'set_environment_effects', effect: 'embers' });
    operations.push({ type: 'add_hazards', count: 2, hazardType: 'lava' });
    explanations.push('Applied Lava theme with glowing embers and molten hazards');
  } else if (/\b(space|moon|cosmic|galaxy|zero-g|floaty|astronaut|stars)\b/.test(text)) {
    matchedAny = true;
    operations.push({ type: 'set_theme', theme: 'space' });
    operations.push({ type: 'adjust_physics', gravity: 380 });
    operations.push({ type: 'adjust_player_jump', multiplier: 1.25 });
    operations.push({ type: 'set_environment_effects', effect: 'stardust' });
    explanations.push('Applied Space theme with floaty lunar gravity (380) and stardust particles');
  } else if (/\b(forest|nature|jungle|trees|woodland|garden)\b/.test(text)) {
    matchedAny = true;
    operations.push({ type: 'set_theme', theme: 'forest' });
    operations.push({ type: 'set_environment_effects', effect: 'leaves' });
    explanations.push('Applied Forest theme with earthy moss platforms and falling leaves');
  } else if (/\b(cyberpunk|sci-fi|scifi|neon|synthwave|future|matrix|cyber)\b/.test(text)) {
    matchedAny = true;
    operations.push({ type: 'set_theme', theme: 'cyberpunk' });
    operations.push({ type: 'adjust_player_speed', multiplier: 1.2 });
    operations.push({ type: 'set_environment_effects', effect: 'sparks' });
    explanations.push('Applied Cyberpunk theme with neon platforms, speed boost, and sparks');
  }

  // 2. Difficulty checks
  if (/\b(easy|beginner|simple|casual|relaxing|kindergarten)\b/.test(text)) {
    matchedAny = true;
    operations.push({ type: 'set_difficulty', difficulty: 'easy' });
    explanations.push('Adjusted to Easy difficulty (reduced hazards, boosted jump clearance, bonus coins)');
  } else if (/\b(hard|harder|difficult|nightmare|expert|challenge|challenging|extreme)\b/.test(text)) {
    matchedAny = true;
    operations.push({ type: 'set_difficulty', difficulty: 'hard' });
    explanations.push('Increased to Hard difficulty (additional hazards, faster tempo)');
  }

  // 3. Coin quantity checks
  if (/\b(coin|coins|treasure|bounty|rich|gold)\b/.test(text)) {
    matchedAny = true;
    // Extract count if user specified e.g. "add 5 coins", "10 coins"
    let coinCount = 5;
    const numMatch = text.match(/\b(\d+)\s*coins?\b/);
    if (numMatch) {
      coinCount = Math.max(1, Math.min(20, parseInt(numMatch[1], 10)));
    } else if (/\bfive\b/.test(text)) {
      coinCount = 5;
    } else if (/\bthree\b/.test(text)) {
      coinCount = 3;
    } else if (/\bten\b/.test(text)) {
      coinCount = 10;
    }

    operations.push({ type: 'add_coins', count: coinCount });
    explanations.push(`Added ${coinCount} bonus coins across platforms`);
  }

  // 4. Hazard quantity checks (if not already handled by lava)
  if (/\b(spikes|more hazards|add hazards|dangerous|deadly)\b/.test(text) && !operations.some(op => op.type === 'add_hazards')) {
    matchedAny = true;
    operations.push({ type: 'add_hazards', count: 3, hazardType: 'spike' });
    explanations.push('Placed 3 additional spike hazards along platforms');
  }

  // 5. Jump height modifications
  if (/\b(jump higher|super jump|high jump|mega jump|bounce higher)\b/.test(text)) {
    matchedAny = true;
    operations.push({ type: 'adjust_player_jump', multiplier: 1.35 });
    explanations.push('Boosted player jump power by +35%');
  } else if (/\b(jump lower|weaker jump|smaller jump)\b/.test(text)) {
    matchedAny = true;
    operations.push({ type: 'adjust_player_jump', multiplier: 0.75 });
    explanations.push('Reduced player jump power by -25%');
  }

  // 6. Player speed modifications
  if (/\b(faster|run faster|speed up|super speed|sonic|high speed)\b/.test(text)) {
    matchedAny = true;
    operations.push({ type: 'adjust_player_speed', multiplier: 1.35 });
    explanations.push('Increased player movement speed by +35%');
  } else if (/\b(slower|slow down|half speed)\b/.test(text)) {
    matchedAny = true;
    operations.push({ type: 'adjust_player_speed', multiplier: 0.75 });
    explanations.push('Reduced player movement speed by -25%');
  }

  if (!matchedAny) {
    return {
      isSupported: false,
      operations: [],
      explanation: `Could not map instruction "${instruction}" to supported level operations.`,
      warnings: [
        'Try requesting themes (Ice, Lava, Space, Forest, Cyberpunk), difficulty presets (Easy, Hard), coin bonuses, or jump/speed tuning.',
      ],
    };
  }

  return {
    isSupported: true,
    operations,
    explanation: explanations.join('. ') + '.',
    warnings,
  };
}
