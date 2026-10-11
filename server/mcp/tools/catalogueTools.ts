import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  SANDBOX_ITEM_IDS,
  SANDBOX_ITEM_CATALOGUE,
} from '../../../src/types/sandbox.js';
import {
  CRAFTING_RECIPES,
  getRecipeById,
  canCraftRecipe,
  calculateMaxCraftable,
  getRecipesForCategory,
} from '../../../src/game/sandbox/sandboxRecipes.js';
import {
  ListSandboxItemsArgsSchema,
  ListCraftingRecipesArgsSchema,
  CheckCraftingRecipeArgsSchema,
} from '../schemas/mcpTools.schema.js';
import { sandboxSessionManager } from '../services/sandboxSession.service.js';

export function registerCatalogueTools(server: McpServer): void {
  // 1. list_sandbox_items
  server.tool(
    'list_sandbox_items',
    'Returns the complete catalogue of items available in the Draw2Play sandbox with placeable flags, stack limits, and descriptions.',
    ListSandboxItemsArgsSchema,
    async ({ category }) => {
      let ids = [...SANDBOX_ITEM_IDS];
      if (category && category !== 'all') {
        ids = ids.filter((id) => SANDBOX_ITEM_CATALOGUE[id]?.category === category);
      }

      const items = ids.map((id) => {
        const item = SANDBOX_ITEM_CATALOGUE[id];
        return {
          id: item.id,
          displayName: item.displayName,
          category: item.category,
          isPlaceable: item.isPlaceable,
          isMinable: item.isMinable,
          maxStack: item.maxStack,
          colorHex: item.colorHex,
          icon: item.icon,
          description: item.description,
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                totalItems: items.length,
                categoryFilter: category ?? 'all',
                items,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 2. list_crafting_recipes
  server.tool(
    'list_crafting_recipes',
    'Lists supported deterministic crafting recipes including inputs, outputs, and whether each recipe can be crafted right now.',
    ListCraftingRecipesArgsSchema,
    async ({ category }) => {
      let recipeList = [...CRAFTING_RECIPES];
      if (category && category !== 'all') {
        recipeList = getRecipesForCategory(category as any);
      }

      const session = sandboxSessionManager.getSession();

      const recipes = recipeList.map((recipe) => {
        const isCraftable = session ? canCraftRecipe(session.inventory, recipe.id).canCraft : undefined;
        const maxCraftable = session ? calculateMaxCraftable(session.inventory, recipe.id) : undefined;

        return {
          id: recipe.id,
          name: recipe.name,
          category: recipe.category,
          description: recipe.description,
          inputs: recipe.inputs.map((inp) => ({
            itemId: inp.itemId,
            displayName: SANDBOX_ITEM_CATALOGUE[inp.itemId]?.displayName ?? inp.itemId,
            count: inp.count,
          })),
          output: {
            itemId: recipe.output.itemId,
            displayName: SANDBOX_ITEM_CATALOGUE[recipe.output.itemId]?.displayName ?? recipe.output.itemId,
            count: recipe.output.count,
          },
          ...(session ? { isCraftable, maxCraftable } : {}),
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                totalRecipes: recipes.length,
                categoryFilter: category ?? 'all',
                hasActiveSession: !!session,
                recipes,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 3. check_crafting_recipe
  server.tool(
    'check_crafting_recipe',
    'Validates whether a recipe can be crafted without mutating inventory. Returns missing ingredients, required counts, and potential stack overflows.',
    CheckCraftingRecipeArgsSchema,
    async ({ recipeId, batches = 1, sessionId }) => {
      const recipe = getRecipeById(recipeId);
      if (!recipe) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                found: false,
                recipeId,
                error: `Unknown recipe ID: "${recipeId}". Use list_crafting_recipes to see valid recipe IDs.`,
              }),
            },
          ],
        };
      }

      const session = sandboxSessionManager.getSession(sessionId);
      if (!session) {
        // Return base requirements when no live session is connected
        const totalRequired = recipe.inputs.map((inp) => ({
          itemId: inp.itemId,
          displayName: SANDBOX_ITEM_CATALOGUE[inp.itemId]?.displayName ?? inp.itemId,
          needed: inp.count * batches,
          available: 0,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  recipeId: recipe.id,
                  recipeName: recipe.name,
                  batches,
                  canCraft: false,
                  hasActiveSession: false,
                  note: 'No active sandbox session connected. Showing required recipe ingredients.',
                  expectedOutput: {
                    itemId: recipe.output.itemId,
                    displayName: SANDBOX_ITEM_CATALOGUE[recipe.output.itemId]?.displayName ?? recipe.output.itemId,
                    count: recipe.output.count * batches,
                    totalCount: recipe.output.count * batches,
                  },
                  requiredIngredients: totalRequired,
                  reason: 'No active sandbox session connected.',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const check = canCraftRecipe(session.inventory, recipe.id);
      const maxPossible = calculateMaxCraftable(session.inventory, recipe.id);

      const ingredientStatus = recipe.inputs.map((inp) => {
        const needed = inp.count * batches;
        const available = session.inventory.items[inp.itemId] ?? 0;
        return {
          itemId: inp.itemId,
          displayName: SANDBOX_ITEM_CATALOGUE[inp.itemId]?.displayName ?? inp.itemId,
          needed,
          available,
          hasEnough: available >= needed,
        };
      });

      const canCraftRequested = ingredientStatus.every((i) => i.hasEnough);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                recipeId: recipe.id,
                recipeName: recipe.name,
                batches,
                canCraft: canCraftRequested,
                maxCraftableBatches: maxPossible,
                ingredients: ingredientStatus,
                expectedOutput: {
                  itemId: recipe.output.itemId,
                  displayName: SANDBOX_ITEM_CATALOGUE[recipe.output.itemId]?.displayName ?? recipe.output.itemId,
                  count: recipe.output.count * batches,
                  totalCount: recipe.output.count * batches,
                },
                reason: canCraftRequested
                  ? 'All ingredients present and ready to craft.'
                  : check.reason ?? 'Insufficient materials in inventory.',
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
