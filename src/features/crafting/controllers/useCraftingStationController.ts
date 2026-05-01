import { createGameplayRealtimeAdapter } from '@/api/realtime/gameplay-worker-adapter';
import type { CraftingSlot, CraftingStation, InventoryItem } from '@/api/realtime/dtos';
import { gameState } from '@/modules/game_module/game_state';
import { useGameStateSubscription } from '@/modules/game_module/game_state_subscriptions';
import { selectIsCraftingOpen, useUIActions } from '@/store/slices/ui.slice';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EMPTY_CRAFTING_ACTION_STATE,
  getCraftingWorkpiece,
  getNumericStationId,
  getPreviewSlot,
  normalizeCraftingInventoryIndex,
  selectDefaultInsertSlot,
  selectDefaultPreviewSlot,
  validateInsertRequest,
  type CraftingActionState,
  type CraftingWorkpiece,
} from '../crafting-view-model';

const gameplayRealtime = createGameplayRealtimeAdapter(() => gameState.socketWorker);
const FIXED_POINT_ONE = 65536;

export interface CraftingFormState {
  selectedInventoryIndex: number;
  selectedInsertSlot: string;
  selectedPreviewSlot: string;
  mold: number;
  moldWidth: number;
  moldLength: number;
  thicknessUnits: number;
  bendZone: number;
  bendDisplacement: number;
  forgeIntensity: number;
  chipX: number;
  chipY: number;
  chipWidth: number;
  chipHeight: number;
  sharpenSide: number;
  sharpenAmount: number;
}

export interface CraftingFormActions {
  setSelectedInventoryIndex: (value: number) => void;
  setSelectedInsertSlot: (value: string) => void;
  setSelectedPreviewSlot: (value: string) => void;
  setMold: (value: number) => void;
  setMoldWidth: (value: number) => void;
  setMoldLength: (value: number) => void;
  setThicknessUnits: (value: number) => void;
  setBendZone: (value: number) => void;
  setBendDisplacement: (value: number) => void;
  setForgeIntensity: (value: number) => void;
  setChipX: (value: number) => void;
  setChipY: (value: number) => void;
  setChipWidth: (value: number) => void;
  setChipHeight: (value: number) => void;
  setSharpenSide: (value: number) => void;
  setSharpenAmount: (value: number) => void;
}

export interface CraftingControllerState {
  isOpen: boolean;
  station: CraftingStation;
  inventory: InventoryItem[];
  insertSlotOptions: CraftingSlot[];
  previewSlot: CraftingSlot | null;
  previewItem: InventoryItem | null;
  previewWorkpiece: CraftingWorkpiece | null;
  actionState: CraftingActionState;
  form: CraftingFormState;
  formActions: CraftingFormActions;
  setOverlayVisible: (visible: boolean) => void;
  refreshStation: () => void;
  refreshCraftingInventory: () => void;
  insertSelectedItem: () => void;
  removeStationItem: (slotId: string) => void;
  startHeating: () => void;
  collectOutput: () => void;
  castWorkpiece: () => void;
  bendWorkpiece: () => void;
  forgeWorkpiece: () => void;
  chipWorkpiece: () => void;
  sharpenWorkpiece: () => void;
  joinWorkpieces: () => void;
}

export function useCraftingStationController(): CraftingControllerState {
  const isOpen = selectIsCraftingOpen();
  const { openCrafting } = useUIActions();
  const craftingVersion = useGameStateSubscription('crafting');
  const [selectedInventoryIndex, setSelectedInventoryIndex] = useState(0);
  const [selectedInsertSlot, setSelectedInsertSlot] = useState('');
  const [selectedPreviewSlot, setSelectedPreviewSlot] = useState('');
  const [mold, setMold] = useState(0);
  const [moldWidth, setMoldWidth] = useState(4);
  const [moldLength, setMoldLength] = useState(10);
  const [thicknessUnits, setThicknessUnits] = useState(3);
  const [bendZone, setBendZone] = useState(0);
  const [bendDisplacement, setBendDisplacement] = useState(1);
  const [forgeIntensity, setForgeIntensity] = useState(2);
  const [chipX, setChipX] = useState(0);
  const [chipY, setChipY] = useState(0);
  const [chipWidth, setChipWidth] = useState(1);
  const [chipHeight, setChipHeight] = useState(1);
  const [sharpenSide, setSharpenSide] = useState(0);
  const [sharpenAmount, setSharpenAmount] = useState(8);
  const [actionState, setActionState] = useState<CraftingActionState>(EMPTY_CRAFTING_ACTION_STATE);

  const inventory = useMemo(() => [...gameState.craftingInventory], [craftingVersion]);
  const station = useMemo<CraftingStation>(() => ({
    ...gameState.craftingStation,
    slots: [...gameState.craftingStation.slots],
    insertedItems: [...gameState.craftingStation.insertedItems],
    moldSlots: [...gameState.craftingStation.moldSlots],
    warnings: [...gameState.craftingStation.warnings],
    craftingInventory: inventory,
    craftingInventoryMeta: gameState.craftingInventoryMeta,
  }), [craftingVersion, inventory]);

  const stationId = getNumericStationId(station.stationId);
  const insertSlotOptions = useMemo(
    () => station.slots.filter((slot) => slot.role !== 'output'),
    [station.slots],
  );
  const previewSlot = useMemo(
    () => getPreviewSlot(station.slots, selectedPreviewSlot),
    [selectedPreviewSlot, station.slots],
  );
  const previewItem = previewSlot?.item ?? null;
  const previewWorkpiece = useMemo(() => getCraftingWorkpiece(previewItem), [previewItem]);

  useEffect(() => {
    const normalizedIndex = normalizeCraftingInventoryIndex(selectedInventoryIndex, inventory);
    if (normalizedIndex !== selectedInventoryIndex) {
      setSelectedInventoryIndex(normalizedIndex);
    }
  }, [inventory, selectedInventoryIndex]);

  useEffect(() => {
    const nextInsertSlot = selectDefaultInsertSlot(selectedInsertSlot, station.slots);
    if (nextInsertSlot !== selectedInsertSlot) {
      setSelectedInsertSlot(nextInsertSlot);
    }

    const nextPreviewSlot = selectDefaultPreviewSlot(selectedPreviewSlot, station.slots);
    if (nextPreviewSlot !== selectedPreviewSlot) {
      setSelectedPreviewSlot(nextPreviewSlot);
    }
  }, [selectedInsertSlot, selectedPreviewSlot, station.slots]);

  const refreshStation = useCallback(() => {
    if (stationId == null) return;
    gameplayRealtime.requestStationState(stationId);
  }, [stationId]);

  const refreshCraftingInventory = useCallback(() => {
    gameplayRealtime.requestCraftingInventory();
    refreshStation();
  }, [refreshStation]);

  useEffect(() => {
    if (!isOpen || stationId == null || !station.heatingActive) {
      return;
    }

    const interval = window.setInterval(refreshStation, 500);
    return () => window.clearInterval(interval);
  }, [isOpen, refreshStation, station.heatingActive, stationId]);

  const runStationAction = useCallback((action: (resolvedStationId: number) => boolean) => {
    if (stationId == null) {
      setActionState({ status: 'missing-station' });
      return;
    }
    setActionState({ status: action(stationId) ? 'pending' : 'worker-unavailable' });
  }, [stationId]);

  const insertSelectedItem = useCallback(() => {
    const result = validateInsertRequest({
      stationId: station.stationId,
      itemIndex: selectedInventoryIndex,
      inventory,
      slotId: selectedInsertSlot,
    });

    if (!result.ok) {
      setActionState({ status: result.status });
      return;
    }

    const posted = gameplayRealtime.insertStationItem(
      result.request.stationId,
      result.request.itemIndex,
      result.request.slotId,
    );
    setActionState({ status: posted ? 'pending' : 'worker-unavailable' });
  }, [inventory, selectedInsertSlot, selectedInventoryIndex, station.stationId]);

  const removeStationItem = useCallback((slotId: string) => {
    if (!slotId) {
      setActionState({ status: 'missing-slot' });
      return;
    }
    runStationAction((resolvedStationId) => gameplayRealtime.removeStationItem(resolvedStationId, slotId));
  }, [runStationAction]);

  const startHeating = useCallback(() => {
    runStationAction((resolvedStationId) => gameplayRealtime.startHeating(resolvedStationId));
  }, [runStationAction]);

  const collectOutput = useCallback(() => {
    runStationAction((resolvedStationId) => gameplayRealtime.collectSmeltResult(resolvedStationId, 'output'));
  }, [runStationAction]);

  const castWorkpiece = useCallback(() => {
    runStationAction((resolvedStationId) => gameplayRealtime.castWorkpiece(
      resolvedStationId,
      mold,
      moldWidth,
      moldLength,
      thicknessUnits * FIXED_POINT_ONE,
    ));
  }, [mold, moldLength, moldWidth, runStationAction, thicknessUnits]);

  const bendWorkpiece = useCallback(() => {
    runStationAction((resolvedStationId) => gameplayRealtime.bendWorkpiece(resolvedStationId, bendZone, bendDisplacement));
  }, [bendDisplacement, bendZone, runStationAction]);

  const forgeWorkpiece = useCallback(() => {
    runStationAction((resolvedStationId) => gameplayRealtime.forgeWorkpiece(resolvedStationId, bendZone, forgeIntensity));
  }, [bendZone, forgeIntensity, runStationAction]);

  const chipWorkpiece = useCallback(() => {
    runStationAction((resolvedStationId) => gameplayRealtime.chipWorkpiece(resolvedStationId, chipX, chipY, chipWidth, chipHeight));
  }, [chipHeight, chipWidth, chipX, chipY, runStationAction]);

  const sharpenWorkpiece = useCallback(() => {
    runStationAction((resolvedStationId) => gameplayRealtime.sharpenWorkpiece(resolvedStationId, sharpenSide, sharpenAmount));
  }, [runStationAction, sharpenAmount, sharpenSide]);

  const joinWorkpieces = useCallback(() => {
    runStationAction((resolvedStationId) => gameplayRealtime.joinWorkpieces(resolvedStationId));
  }, [runStationAction]);

  const form = useMemo<CraftingFormState>(() => ({
    selectedInventoryIndex,
    selectedInsertSlot,
    selectedPreviewSlot,
    mold,
    moldWidth,
    moldLength,
    thicknessUnits,
    bendZone,
    bendDisplacement,
    forgeIntensity,
    chipX,
    chipY,
    chipWidth,
    chipHeight,
    sharpenSide,
    sharpenAmount,
  }), [
    bendDisplacement,
    bendZone,
    chipHeight,
    chipWidth,
    chipX,
    chipY,
    forgeIntensity,
    mold,
    moldLength,
    moldWidth,
    selectedInsertSlot,
    selectedInventoryIndex,
    selectedPreviewSlot,
    sharpenAmount,
    sharpenSide,
    thicknessUnits,
  ]);

  const formActions = useMemo<CraftingFormActions>(() => ({
    setSelectedInventoryIndex,
    setSelectedInsertSlot,
    setSelectedPreviewSlot,
    setMold,
    setMoldWidth,
    setMoldLength,
    setThicknessUnits,
    setBendZone,
    setBendDisplacement,
    setForgeIntensity,
    setChipX,
    setChipY,
    setChipWidth,
    setChipHeight,
    setSharpenSide,
    setSharpenAmount,
  }), []);

  return {
    isOpen,
    station,
    inventory,
    insertSlotOptions,
    previewSlot,
    previewItem,
    previewWorkpiece,
    actionState,
    form,
    formActions,
    setOverlayVisible: openCrafting,
    refreshStation,
    refreshCraftingInventory,
    insertSelectedItem,
    removeStationItem,
    startHeating,
    collectOutput,
    castWorkpiece,
    bendWorkpiece,
    forgeWorkpiece,
    chipWorkpiece,
    sharpenWorkpiece,
    joinWorkpieces,
  };
}
