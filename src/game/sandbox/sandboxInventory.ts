import type {
  SandboxInventory,
  SandboxItemId,
  PlaceableBlockType,
  CraftableItemDefinition,
} from '../../types/sandbox.js';
import {
  HOTBAR_BLOCK_ORDER,
  DEFAULT_SANDBOX_INVENTORY,
  CRAFTABLE_ITEMS_CATALOGUE,
  isValidCraftableItem,
  isItemPlaceable,
} from '../../types/sandbox.js';

/**
 * Creates a fresh starter inventory
 */
export function createDefaultInventory(): SandboxInventory {
  return {
    items: { ...DEFAULT_SANDBOX_INVENTORY.items },
    selectedSlot: 0,
    hotbar: [...DEFAULT_SANDBOX_INVENTORY.hotbar],
  };
}

/**
 * Adds an item to the inventory safely
 */
export function addInventoryItem(
  inventory: SandboxInventory,
  type: SandboxItemId,
  count = 1
): SandboxInventory {
  const safeCount = Math.max(1, Math.floor(count));
  const current = inventory.items[type] ?? 0;
  return {
    ...inventory,
    items: {
      ...inventory.items,
      [type]: current + safeCount,
    },
  };
}

/**
 * Checks if the inventory contains at least `count` of the given item
 */
export function hasInventoryItem(
  inventory: SandboxInventory,
  type: SandboxItemId,
  count = 1
): boolean {
  const current = inventory.items[type] ?? 0;
  return current >= Math.max(1, count);
}

/**
 * Consumes an item from the inventory. Returns updated inventory if successful,
 * or failure if insufficient items (never allows count to become negative).
 */
export function consumeInventoryItem(
  inventory: SandboxInventory,
  type: SandboxItemId,
  count = 1
): { success: boolean; inventory: SandboxInventory; reason?: string } {
  const needed = Math.max(1, Math.floor(count));
  const current = inventory.items[type] ?? 0;

  if (current < needed) {
    const name = CRAFTABLE_ITEMS_CATALOGUE[type]?.displayName ?? type;
    return {
      success: false,
      inventory,
      reason: `Out of ${name}! You need at least ${needed}.`,
    };
  }

  return {
    success: true,
    inventory: {
      ...inventory,
      items: {
        ...inventory.items,
        [type]: current - needed,
      },
    },
  };
}

/**
 * Sets the active hotbar slot (bounded 0..3)
 */
export function setSelectedSlot(
  inventory: SandboxInventory,
  slotIndex: number
): SandboxInventory {
  const hotbarList = inventory.hotbar || HOTBAR_BLOCK_ORDER;
  const clamped = Math.max(0, Math.min(hotbarList.length - 1, Math.floor(slotIndex)));
  return {
    ...inventory,
    selectedSlot: clamped,
  };
}

/**
 * Assigns a placeable block item to a specific hotbar slot
 */
export function setHotbarSlot(
  inventory: SandboxInventory,
  slotIndex: number,
  itemType: PlaceableBlockType
): SandboxInventory {
  if (!isItemPlaceable(itemType)) return inventory;
  const hotbar = [...(inventory.hotbar || HOTBAR_BLOCK_ORDER)];
  const clamped = Math.max(0, Math.min(hotbar.length - 1, Math.floor(slotIndex)));
  hotbar[clamped] = itemType;
  return {
    ...inventory,
    hotbar,
  };
}

/**
 * Returns the block type for the currently selected hotbar slot
 */
export function getSelectedBlockType(inventory: SandboxInventory): PlaceableBlockType {
  const hotbarList = inventory.hotbar || HOTBAR_BLOCK_ORDER;
  const slot = Math.max(0, Math.min(hotbarList.length - 1, inventory.selectedSlot));
  return hotbarList[slot] ?? 'grass';
}

/**
 * Gets the current count for a given item in inventory
 */
export function getInventoryCount(
  inventory: SandboxInventory,
  type: SandboxItemId
): number {
  return inventory.items[type] ?? 0;
}

/**
 * Maximum quantity allowed per stack in sandbox inventory
 */
export const MAX_INVENTORY_STACK = 999;

/**
 * Awards exactly one validated craftable item to the player's sandbox inventory.
 * Strictly validates against the central catalogue before mutating inventory.
 */
export function awardCraftedItem(
  inventory: SandboxInventory,
  itemId: unknown
): {
  success: boolean;
  inventory: SandboxInventory;
  item?: CraftableItemDefinition;
  reason?: string;
} {
  if (!isValidCraftableItem(itemId)) {
    return {
      success: false,
      inventory,
      reason: `Cannot craft item "${String(itemId)}": Not in the sandbox craftable catalogue.`,
    };
  }

  const currentCount = inventory.items[itemId] ?? 0;
  if (currentCount >= MAX_INVENTORY_STACK) {
    return {
      success: false,
      inventory,
      reason: `Inventory slot for ${CRAFTABLE_ITEMS_CATALOGUE[itemId].displayName} is full (max ${MAX_INVENTORY_STACK}).`,
    };
  }

  const updatedInventory = addInventoryItem(inventory, itemId, 1);
  return {
    success: true,
    inventory: updatedInventory,
    item: CRAFTABLE_ITEMS_CATALOGUE[itemId],
  };
}
