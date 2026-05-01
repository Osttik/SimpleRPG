import { createGameplayRealtimeAdapter } from '@/api/realtime/gameplay-worker-adapter';
import type { InventoryItem, InventoryMeta } from '@/api/realtime/dtos';
import { KeyEnum } from '@/defines/key.enum';
import { gameState } from '@/modules/game_module/game_state';
import { keyboardService } from '@/services/keyboard.service';
import { interactionsState } from '@/store';
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
  const [isOpen, setIsOpen] = useState(false);
  const [chestInventory, setChestInventory] = useState<InventoryItem[]>([]);
  const [playerInventory, setPlayerInventory] = useState<InventoryItem[]>([]);
  const [chestMeta, setChestMeta] = useState<InventoryMeta>(gameState.chestInventoryMeta);
  const [playerMeta, setPlayerMeta] = useState<InventoryMeta>(gameState.playerInventoryMeta);
  const [selected, setSelected] = useState<SelectedLootItemRef>(null);
  const [transferState, setTransferState] = useState<LootTransferState>(EMPTY_LOOT_TRANSFER_STATE);

  useEffect(() => {
    const handleUpdate = () => {
      setIsOpen(!!gameState.lootingTargetId);
      setChestInventory([...(gameState.chestInventory ?? [])]);
      setPlayerInventory([...(gameState.playerInventory ?? [])]);
      setChestMeta(gameState.chestInventoryMeta);
      setPlayerMeta(gameState.playerInventoryMeta);
    };

    handleUpdate();
    window.addEventListener('gameStateUpdate', handleUpdate);
    return () => window.removeEventListener('gameStateUpdate', handleUpdate);
  }, []);

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
    interactionsState.selectedTargetId = gameState.focusedId ?? null;
    setSelected(null);
    setTransferState(EMPTY_LOOT_TRANSFER_STATE);
    setIsOpen(false);
    window.dispatchEvent(new Event('gameStateUpdate'));
  }, []);

  const setOverlayVisible = useCallback((visible: boolean) => {
    if (!visible) {
      closeLoot();
      return;
    }
    setIsOpen(true);
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
