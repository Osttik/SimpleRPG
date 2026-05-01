import { createGameplayRealtimeAdapter } from '@/api/realtime/gameplay-worker-adapter';
import type { InventoryItem, InventoryMeta } from '@/api/realtime/dtos';
import { KeyEnum } from '@/defines/key.enum';
import { gameState } from '@/modules/game_module/game_state';
import { publishGameStateUpdate, useGameStateSubscription } from '@/modules/game_module/game_state_subscriptions';
import { keyboardService } from '@/services/keyboard.service';
import { selectIsInventoryOpen, useUIActions } from '@/store/slices/ui.slice';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildInventoryActionRequest,
  EMPTY_INVENTORY_ACTION_STATE,
  filterInventoryItems,
  getSelectedInventoryItem,
  INVENTORY_TABS,
  normalizeInventorySelection,
  type InventoryAction,
  type InventoryActionState,
  type InventoryTab,
} from '../inventory-view-model';

const gameplayRealtime = createGameplayRealtimeAdapter(() => gameState.socketWorker);

export interface InventoryControllerState {
  isOpen: boolean;
  items: InventoryItem[];
  visibleItems: InventoryItem[];
  meta: InventoryMeta;
  tabs: InventoryTab[];
  activeTab: InventoryTab;
  selectedItemId: string | null;
  selectedItem: InventoryItem | null;
  actionState: InventoryActionState;
  setOverlayVisible: (visible: boolean) => void;
  setActiveTab: (tab: InventoryTab) => void;
  selectItem: (item: InventoryItem | null) => void;
  toggleEquip: (item: InventoryItem) => void;
  dropSelectedItem: () => void;
  closeInventory: () => void;
}

export function useInventoryController(): InventoryControllerState {
  const isOpen = selectIsInventoryOpen();
  const { openInventory } = useUIActions();
  const inventoryVersion = useGameStateSubscription('inventory');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InventoryTab>('all');
  const [actionState, setActionState] = useState<InventoryActionState>(EMPTY_INVENTORY_ACTION_STATE);

  const items = useMemo(() => [...(gameState.playerInventory ?? [])], [inventoryVersion]);
  const meta = gameState.playerInventoryMeta;
  const visibleItems = useMemo(() => filterInventoryItems(items, activeTab), [items, activeTab]);
  const selectedItem = useMemo(() => getSelectedInventoryItem(items, selectedItemId), [items, selectedItemId]);

  const closeLootIfOpen = useCallback(() => {
    if (!gameState.lootingTargetId) return;
    gameState.lootingTargetId = null;
    gameState.chestInventory = [];
    gameState.playerInventory = [];
    publishGameStateUpdate(['inventory', 'loot']);
  }, []);

  const requestInventoryIfOpening = useCallback((visible: boolean) => {
    if (visible) {
      gameplayRealtime.requestPlayerInventory();
    }
  }, []);

  const setOverlayVisible = useCallback((visible: boolean) => {
    requestInventoryIfOpening(visible);
    openInventory(visible);
  }, [openInventory, requestInventoryIfOpening]);

  const closeInventory = useCallback(() => {
    openInventory(false);
  }, [openInventory]);

  useEffect(() => {
    const normalized = normalizeInventorySelection(items, selectedItemId);
    if (normalized !== selectedItemId) {
      setSelectedItemId(normalized);
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    if (actionState.status !== 'pending' || !actionState.itemId) return;
    if (!items.some((item) => item.id === actionState.itemId)) {
      setActionState(EMPTY_INVENTORY_ACTION_STATE);
    }
  }, [items, actionState]);

  const runInventoryAction = useCallback((action: InventoryAction, itemId: string | null) => {
    const result = buildInventoryActionRequest(items, itemId);
    if (!result.ok) {
      setActionState({ status: result.status, action, itemId });
      return;
    }

    const posted = action === 'drop'
      ? gameplayRealtime.dropItem(result.request.itemIndex)
      : gameplayRealtime.equipItem(result.request.itemIndex);

    setActionState({
      status: posted ? 'pending' : 'unavailable',
      action,
      itemId,
    });
  }, [items]);

  const selectItem = useCallback((item: InventoryItem | null) => {
    setSelectedItemId(item?.id ?? null);
    setActionState(EMPTY_INVENTORY_ACTION_STATE);
  }, []);

  const toggleEquip = useCallback((item: InventoryItem) => {
    runInventoryAction('equip', item.id);
  }, [runInventoryAction]);

  const dropSelectedItem = useCallback(() => {
    runInventoryAction('drop', selectedItemId);
  }, [runInventoryAction, selectedItemId]);

  useEffect(() => {
    const sub = keyboardService.subscribeToKeyDown([KeyEnum.i, KeyEnum.I], () => {
      const nextState = !isOpen;
      closeLootIfOpen();
      requestInventoryIfOpening(nextState);
      openInventory(nextState);
    });

    return () => {
      sub.dispose();
    };
  }, [closeLootIfOpen, isOpen, openInventory, requestInventoryIfOpening]);

  useEffect(() => {
    const dropSub = keyboardService.subscribeToKeyDown([KeyEnum.r, KeyEnum.R], () => {
      if (!isOpen) return;
      dropSelectedItem();
    });

    return () => dropSub.dispose();
  }, [dropSelectedItem, isOpen]);

  return {
    isOpen,
    items,
    visibleItems,
    meta,
    tabs: INVENTORY_TABS,
    activeTab,
    selectedItemId,
    selectedItem,
    actionState,
    setOverlayVisible,
    setActiveTab,
    selectItem,
    toggleEquip,
    dropSelectedItem,
    closeInventory,
  };
}

