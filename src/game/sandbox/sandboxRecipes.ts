import type {
  CraftingRecipe,
  SandboxInventory,
  SandboxItemId,
} from '../../types/sandbox.js';
import {
  SANDBOX_ITEM_CATALOGUE,
  isValidSandboxItem,
} from '../../types/sandbox.js';
import { MAX_INVENTORY_STACK } from './sandboxInventory.js';

/**
 * Deterministic Crafting Recipes Catalogue
 */
export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'recipe-wood-to-planks',
    name: 'Wooden Planks',
    description: 'Process rough timber logs into versatile wooden planks for carpentry.',
    category: 'basic',
    inputs: [{ itemId: 'wood', count: 1 }],
    output: { itemId: 'wood_planks', count: 4 },
    requiresWorkbench: false,
  },
  {
    id: 'recipe-planks-to-sticks',
    name: 'Crafting Sticks',
    description: 'Whittle wooden planks into slender sticks for torches and tools.',
    category: 'materials' as any,
    inputs: [{ itemId: 'wood_planks', count: 2 }],
    output: { itemId: 'stick', count: 4 },
    requiresWorkbench: false,
  },
  {
    id: 'recipe-workbench',
    name: 'Workbench',
    description: 'Construct an artisan crafting station for building and advanced tools.',
    category: 'utility',
    inputs: [
      { itemId: 'wood_planks', count: 4 },
      { itemId: 'stick', count: 2 },
    ],
    output: { itemId: 'workbench', count: 1 },
    requiresWorkbench: false,
  },
  {
    id: 'recipe-torch-coal',
    name: 'Torches (Coal)',
    description: 'Fasten high-energy coal onto sticks to craft 4 illuminating torches.',
    category: 'utility',
    inputs: [
      { itemId: 'stick', count: 1 },
      { itemId: 'coal', count: 1 },
    ],
    output: { itemId: 'torch', count: 4 },
    requiresWorkbench: false,
  },
  {
    id: 'recipe-torch-wood',
    name: 'Torches (Wood Ember)',
    description: 'Craft emergency torches using raw wood logs when coal is unavailable.',
    category: 'utility',
    inputs: [
      { itemId: 'stick', count: 1 },
      { itemId: 'wood', count: 1 },
    ],
    output: { itemId: 'torch', count: 2 },
    requiresWorkbench: false,
  },
  {
    id: 'recipe-stone-bricks',
    name: 'Stone Bricks',
    description: 'Chisel coarse stone boulders into reinforced masonry bricks.',
    category: 'building',
    inputs: [{ itemId: 'stone', count: 4 }],
    output: { itemId: 'stone_brick', count: 4 },
    requiresWorkbench: false,
  },
  {
    id: 'recipe-sand-to-glass',
    name: 'Glass Block',
    description: 'Smelt silica sand using coal combustion into clean, transparent glass.',
    category: 'building',
    inputs: [
      { itemId: 'sand', count: 2 },
      { itemId: 'coal', count: 1 },
    ],
    output: { itemId: 'glass', count: 2 },
    requiresWorkbench: false,
  },
  {
    id: 'recipe-turf-propagation',
    name: 'Grass Turf Propagation',
    description: 'Seed wild greenery across barren soil to propagate fertile grass blocks.',
    category: 'basic',
    inputs: [
      { itemId: 'dirt', count: 2 },
      { itemId: 'grass', count: 1 },
    ],
    output: { itemId: 'grass', count: 3 },
    requiresWorkbench: false,
  },
];

/**
 * Finds a recipe by unique recipe ID
 */
export function getRecipeById(recipeId: string): CraftingRecipe | undefined {
  return CRAFTING_RECIPES.find((r) => r.id === recipeId);
}

/**
 * Checks whether the inventory has sufficient materials to craft the given recipe
 */
export function canCraftRecipe(
  inventory: SandboxInventory,
  recipeOrId: string | CraftingRecipe
): {
  canCraft: boolean;
  recipe?: CraftingRecipe;
  missingIngredients: { itemId: SandboxItemId; needed: number; available: number }[];
  reason?: string;
} {
  const recipe = typeof recipeOrId === 'string' ? getRecipeById(recipeOrId) : recipeOrId;
  if (!recipe) {
    return {
      canCraft: false,
      missingIngredients: [],
      reason: `Unknown recipe: "${recipeOrId}"`,
    };
  }

  const missing: { itemId: SandboxItemId; needed: number; available: number }[] = [];

  for (const input of recipe.inputs) {
    const current = inventory.items[input.itemId] ?? 0;
    if (current < input.count) {
      missing.push({
        itemId: input.itemId,
        needed: input.count,
        available: current,
      });
    }
  }

  if (missing.length > 0) {
    const details = missing
      .map((m) => {
        const name = SANDBOX_ITEM_CATALOGUE[m.itemId]?.displayName ?? m.itemId;
        return `${name} (${m.available}/${m.needed})`;
      })
      .join(', ');
    return {
      canCraft: false,
      recipe,
      missingIngredients: missing,
      reason: `Insufficient materials: ${details}`,
    };
  }

  // Check output stack overflow
  const currentOutput = inventory.items[recipe.output.itemId] ?? 0;
  if (currentOutput + recipe.output.count > MAX_INVENTORY_STACK) {
    return {
      canCraft: false,
      recipe,
      missingIngredients: [],
      reason: `Output stack for ${SANDBOX_ITEM_CATALOGUE[recipe.output.itemId]?.displayName ?? recipe.output.itemId} would exceed max (${MAX_INVENTORY_STACK}).`,
    };
  }

  return {
    canCraft: true,
    recipe,
    missingIngredients: [],
  };
}

/**
 * Calculates the maximum number of times a recipe can be crafted with current inventory
 */
export function calculateMaxCraftable(inventory: SandboxInventory, recipeId: string): number {
  const recipe = getRecipeById(recipeId);
  if (!recipe) return 0;

  let maxCrafts = Infinity;

  for (const input of recipe.inputs) {
    const current = inventory.items[input.itemId] ?? 0;
    const canMake = Math.floor(current / input.count);
    if (canMake < maxCrafts) {
      maxCrafts = canMake;
    }
  }

  // Check output stack limit
  const currentOutput = inventory.items[recipe.output.itemId] ?? 0;
  const remainingSpace = Math.max(0, MAX_INVENTORY_STACK - currentOutput);
  const spaceLimit = Math.floor(remainingSpace / recipe.output.count);

  return Math.max(0, Math.min(maxCrafts, spaceLimit));
}

/**
 * Atomically crafts a recipe, deducting ingredients and awarding output.
 * If validation fails at any point, the original inventory is returned untouched.
 */
export function craftRecipe(
  inventory: SandboxInventory,
  recipeId: string,
  batches = 1
): {
  success: boolean;
  inventory: SandboxInventory;
  recipe?: CraftingRecipe;
  craftedCount?: number;
  reason?: string;
} {
  const recipe = getRecipeById(recipeId);
  if (!recipe) {
    return {
      success: false,
      inventory,
      craftedCount: 0,
      reason: `Unknown recipe ID: "${recipeId}"`,
    };
  }

  const safeBatches = Math.max(1, Math.floor(batches));

  // 1. Validate all inputs across all batches
  for (const input of recipe.inputs) {
    if (!isValidSandboxItem(input.itemId)) {
      return {
        success: false,
        inventory,
        recipe,
        craftedCount: 0,
        reason: `Invalid ingredient item ID: ${input.itemId}`,
      };
    }
    const needed = input.count * safeBatches;
    const current = inventory.items[input.itemId] ?? 0;
    if (current < needed) {
      const name = SANDBOX_ITEM_CATALOGUE[input.itemId]?.displayName ?? input.itemId;
      return {
        success: false,
        inventory,
        recipe,
        craftedCount: 0,
        reason: `Not enough ${name}! Need ${needed}, but only have ${current}.`,
      };
    }
  }

  // 2. Validate output stack limit
  const currentOutput = inventory.items[recipe.output.itemId] ?? 0;
  const totalAdded = recipe.output.count * safeBatches;
  if (currentOutput + totalAdded > MAX_INVENTORY_STACK) {
    const outName = SANDBOX_ITEM_CATALOGUE[recipe.output.itemId]?.displayName ?? recipe.output.itemId;
    return {
      success: false,
      inventory,
      recipe,
      craftedCount: 0,
      reason: `Cannot craft: ${outName} inventory stack would exceed max (${MAX_INVENTORY_STACK}).`,
    };
  }

  // 3. Perform atomic inventory mutation
  const updatedItems = { ...inventory.items };

  // Deduct ingredients safely
  for (const input of recipe.inputs) {
    const needed = input.count * safeBatches;
    const current = updatedItems[input.itemId] ?? 0;
    const remaining = Math.max(0, current - needed);
    updatedItems[input.itemId] = remaining;
  }

  // Award output items safely
  updatedItems[recipe.output.itemId] = currentOutput + totalAdded;

  return {
    success: true,
    inventory: {
      ...inventory,
      items: updatedItems,
    },
    recipe,
    craftedCount: totalAdded,
  };
}

/**
 * Returns all recipes annotated with craftability status for the player's current inventory
 */
export function getAvailableRecipes(inventory: SandboxInventory): {
  recipe: CraftingRecipe;
  canCraft: boolean;
  maxCraftable: number;
}[] {
  return CRAFTING_RECIPES.map((recipe) => {
    const max = calculateMaxCraftable(inventory, recipe.id);
    return {
      recipe,
      canCraft: max > 0,
      maxCraftable: max,
    };
  });
}

/**
 * Returns all recipes matching a specific category
 */
export function getRecipesForCategory(category: CraftingRecipe['category']): CraftingRecipe[] {
  return CRAFTING_RECIPES.filter((r) => r.category === category);
}
