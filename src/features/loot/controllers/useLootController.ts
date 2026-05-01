import { createGameplayRealtimeAdapter } from '@/api/realtime/gameplay-worker-adapter';
import type { InventoryItem, InventoryMeta } from '@/api/realtime/dtos';
import { KeyEnum } from '@/defines/key.enum';
import { setSelectedInteractionTarget } from '@/features/interactions/state/interactions-state';
import { gameState } from '@/modules/game_module/game_state';
import { publishGameStateUpdate, useGameStateSubscription } from '@/modules/game_module/game_state_subscriptions';
import { keyboardService } from '@/services/keyboard.service';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildLootTransferRequest,
  canPlaceInInventory,
  EMPTY_LOOT_TRANSFER_STATE,
  getSelectedLootItem,
  normalizeLootSelection,
  type LootContainer,
  type LootTransferState,
  type SelectedLootItemRef,
} from '../loot-view-model';

const gameplayRealtime = createGameplayRealtimeAdapter(() => gameState.socketWorker);

export interface LootControllerState {
  isOpen: boolean;
  chestInventory: InventoryItem[];
  playerInventory: InventoryItem[];
  chestMeta: InventoryMeta;
  playerMeta: InventoryMeta;
  selected: SelectedLootItemRef;
  selectedItem: InventoryItem | null;
  transferState: LootTransferState;
  setOverlayVisible: (visible: boolean) => void;
  selectItem: (source: LootContainer, item: InventoryItem | null) => void;
  transferItem: (source: LootContainer, item: InventoryItem) => void;
  canExchangeItem: (source: LootContainer, item: InventoryItem) => boolean;
  closeLoot: () => void;
}

export function useLootController(): LootControllerState {
  const lootVersion = useGameStateSubscription('loot');
  const [selected, setSelected] = useState<SelectedLootItemRef>(null);
  const [transferState, setTransferState] = useState<LootTransferState>(EMPTY_LOOT_TRANSFER_STATE);
  const isOpen = !!gameState.lootingTargetId;
  const chestInventory = useMemo(() => [...(gameState.chestInventory ?? [])], [lootVersion]);
  const playerInventory = useMemo(() => [...(gameState.playerInventory ?? [])], [lootVersion]);
  const chestMeta: InventoryMeta = gameState.chestInventoryMeta;
  const playerMeta: InventoryMeta = gameState.playerInventoryMeta;

  useEffect(() => {
    setSelected((current) => normalizeLootSelection(current, chestInventory, playerInventory));
  }, [chestInventory, playerInventory]);

  useEffect(() => {
    if (transferState.status !== 'pending' || !transferState.source || !transferState.itemId) return;
    const sourceInventory = transferState.source === 'chest' ? chestInventory : playerInventory;
    if (!sourceInventory.some((item) => item.id === transferState.itemId)) {
      setTransferState(EMPTY_LOOT_TRANSFER_STATE);
    }
  }, [chestInventory, playerInventory, transferState]);

  const selectedItem = useMemo(
    () => getSelectedLootItem(selected, chestInventory, playerInventory),
    [selected, chestInventory, playerInventory],
  );

  const closeLoot = useCallback(() => {
    gameState.lootingTargetId = null;
    setSelectedInteractionTarget(gameState.focusedId);
    setSelected(null);
    setTransferState(EMPTY_LOOT_TRANSFER_STATE);
    publishGameStateUpdate('loot');
  }, []);

  const setOverlayVisible = useCallback((visible: boolean) => {
    if (!visible) {
      closeLoot();
      return;
    }
  }, [closeLoot]);

  const selectItem = useCallback((source: LootContainer, item: InventoryItem | null) => {
    setSelected(item ? { source, itemId: item.id } : null);
    setTransferState(EMPTY_LOOT_TRANSFER_STATE);
  }, []);

  const canExchangeItem = useCallback((source: LootContainer, item: InventoryItem) => (
    canPlaceInInventory(item, source === 'player' ? chestMeta : playerMeta)
  ), [chestMeta, playerMeta]);

  const transferItem = useCallback((source: LootContainer, item: InventoryItem) => {
    const result = buildLootTransferRequest({
      source,
      item,
      targetId: gameState.lootingTargetId,
      chestInventory,
      playerInventory,
      chestMeta,
      playerMeta,
    });

    if (!result.ok) {
      setTransferState({ status: 'blocked', source, itemId: item.id, reason: result.reason });
      return;
    }

    const posted = gameplayRealtime.transferItem(
      result.request.targetId,
      result.request.fromContainer,
      result.request.toContainer,
      result.request.itemIndex,
    );

    setTransferState({
      status: posted ? 'pending' : 'unavailable',
      source,
      itemId: item.id,
      reason: posted ? null : 'worker-unavailable',
    });
  }, [chestInventory, playerInventory, chestMeta, playerMeta]);

  useEffect(() => {
    const dropSub = keyboardService.subscribeToKeyDown([KeyEnum.r, KeyEnum.R], () => {
      if (!isOpen || !selected || selected.source !== 'player') return;
      const itemIndex = playerInventory.findIndex((item) => item.id === selected.itemId);
      if (itemIndex < 0) return;
      gameplayRealtime.dropItem(itemIndex, Number(gameState.lootingTargetId || 0));
    });

    return () => dropSub.dispose();
  }, [isOpen, playerInventory, selected]);

  return {
    isOpen,
    chestInventory,
    playerInventory,
    chestMeta,
    playerMeta,
    selected,
    selectedItem,
    transferState,
    setOverlayVisible,
    selectItem,
    transferItem,
    canExchangeItem,
    closeLoot,
  };
}
