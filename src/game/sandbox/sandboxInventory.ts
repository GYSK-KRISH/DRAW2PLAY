import type {
  SandboxInventory,
  PlaceableBlockType,
} from '../../types/sandbox.js';
import {
  HOTBAR_BLOCK_ORDER,
  DEFAULT_SANDBOX_INVENTORY,
} from '../../types/sandbox.js';

/**
 * Creates a fresh starter inventory
 */
export function createDefaultInventory(): SandboxInventory {
  return {
    items: { ...DEFAULT_SANDBOX_INVENTORY.items },
    selectedSlot: 0,
  };
}

/**
 * Adds an item to the inventory safely
 */
export function addInventoryItem(
  inventory: SandboxInventory,
  type: PlaceableBlockType,
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
  type: PlaceableBlockType,
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
  type: PlaceableBlockType,
  count = 1
): { success: boolean; inventory: SandboxInventory; reason?: string } {
  const needed = Math.max(1, Math.floor(count));
  const current = inventory.items[type] ?? 0;

  if (current < needed) {
    return {
      success: false,
      inventory,
      reason: `Out of ${type}! You need at least ${needed}.`,
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
  const clamped = Math.max(0, Math.min(HOTBAR_BLOCK_ORDER.length - 1, Math.floor(slotIndex)));
  return {
    ...inventory,
    selectedSlot: clamped,
  };
}

/**
 * Returns the block type for the currently selected hotbar slot
 */
export function getSelectedBlockType(inventory: SandboxInventory): PlaceableBlockType {
  const slot = Math.max(0, Math.min(HOTBAR_BLOCK_ORDER.length - 1, inventory.selectedSlot));
  return HOTBAR_BLOCK_ORDER[slot];
}
