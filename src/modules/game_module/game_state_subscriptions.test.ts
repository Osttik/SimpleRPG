import { describe, expect, it } from 'vitest';
import {
  getGameStateRenderMetrics,
  getGameStateSubscriptionSnapshot,
  publishGameStateUpdate,
  subscribeGameState,
} from './game_state_subscriptions';

describe('game state subscriptions', () => {
  it('notifies only subscribers for the published topic', () => {
    let inventoryNotifications = 0;
    let lootNotifications = 0;
    const unsubscribeInventory = subscribeGameState('inventory', () => {
      inventoryNotifications += 1;
    });
    const unsubscribeLoot = subscribeGameState('loot', () => {
      lootNotifications += 1;
    });

    publishGameStateUpdate('loot');
    expect(inventoryNotifications).toBe(0);
    expect(lootNotifications).toBe(1);

    publishGameStateUpdate('inventory');
    expect(inventoryNotifications).toBe(1);
    expect(lootNotifications).toBe(1);

    unsubscribeInventory();
    unsubscribeLoot();
  });

  it('coalesces multi-topic publish batches for the same listener', () => {
    let notifications = 0;
    const unsubscribe = subscribeGameState(['inventory', 'loot'], () => {
      notifications += 1;
    });

    publishGameStateUpdate(['inventory', 'loot']);

    expect(notifications).toBe(1);
    unsubscribe();
  });

  it('exposes per-topic notification metrics for render bounds', () => {
    const before = getGameStateRenderMetrics();
    const unsubscribe = subscribeGameState('crafting', () => undefined);

    publishGameStateUpdate('crafting');

    const after = getGameStateRenderMetrics();
    expect(after.crafting.publishCount).toBe(before.crafting.publishCount + 1);
    expect(after.crafting.notificationCount).toBe(before.crafting.notificationCount + 1);
    expect(after.inventory.publishCount).toBe(before.inventory.publishCount);

    unsubscribe();
  });

  it('keeps snapshots stable when unrelated topics publish', () => {
    const before = getGameStateSubscriptionSnapshot('worldLayerDebug');

    publishGameStateUpdate('combat');

    expect(getGameStateSubscriptionSnapshot('worldLayerDebug')).toBe(before);
  });
});
