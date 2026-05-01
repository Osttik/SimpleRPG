import { createGameplayRealtimeAdapter } from '@/api/realtime/gameplay-worker-adapter';
import { isOverlayOpen } from '@/components/overlay';
import { KeyEnum } from '@/defines/key.enum';
import { gameState } from '@/modules/game_module/game_state';
import { keyboardService } from '@/services/keyboard.service';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';
import {
  buildCarouselOptions,
  clampInteractionIndex,
  getVisibleCarouselItems,
  isTriggerableInteraction,
  moveCarouselIndex,
  resolveMenuMode,
  resolveSelectedTargetIndex,
  type InteractionMenuMode,
  type VisibleInteractionCarouselItem,
} from '../interaction-carousel-view-model';
import { interactionsState } from '../state/interactions-state';

const gameplayRealtime = createGameplayRealtimeAdapter(() => gameState.socketWorker);

export interface InteractionControllerState {
  isVisible: boolean;
  mode: InteractionMenuMode;
  visibleItems: VisibleInteractionCarouselItem[];
  selectItem: (index: number) => void;
}

export function useInteractionController(): InteractionControllerState {
  const interactions = useSnapshot(interactionsState);
  const [mode, setMode] = useState<InteractionMenuMode>('target');
  const [targetIndex, setTargetIndex] = useState(0);
  const [interactionIndex, setInteractionIndex] = useState(0);

  useEffect(() => {
    if (interactions.targets.length === 0) {
      setMode('target');
      setTargetIndex(0);
      setInteractionIndex(0);
      return;
    }

    setTargetIndex((currentIndex) => (
      resolveSelectedTargetIndex(
        interactions.targets,
        currentIndex,
        interactions.selectedTargetId,
      )
    ));

    setMode((currentMode) => resolveMenuMode(currentMode, interactions.targets.length));
  }, [interactions.targets, interactions.selectedTargetId]);

  const selectedTarget = interactions.targets[targetIndex] ?? null;

  useEffect(() => {
    setInteractionIndex((currentIndex) => (
      clampInteractionIndex(currentIndex, selectedTarget?.interactions.length ?? 0)
    ));
  }, [selectedTarget]);

  const triggerInteraction = useCallback((optionIndex = interactionIndex) => {
    const interaction = selectedTarget?.interactions[optionIndex] ?? null;
    if (!selectedTarget || !isTriggerableInteraction(interaction)) return;
    gameplayRealtime.interactWithTarget(selectedTarget.targetId);
  }, [interactionIndex, selectedTarget]);

  const activateCurrent = useCallback(() => {
    if (!selectedTarget) return;

    if (mode === 'target' && selectedTarget.interactions.length > 0) {
      setMode('interaction');
      setInteractionIndex(0);
      return;
    }

    triggerInteraction();
  }, [mode, selectedTarget, triggerInteraction]);

  const moveIndex = useCallback((delta: number) => {
    if (mode === 'target') {
      setTargetIndex((currentIndex) => (
        moveCarouselIndex(currentIndex, delta, interactions.targets.length)
      ));
      setInteractionIndex(0);
      return;
    }

    setInteractionIndex((currentIndex) => (
      moveCarouselIndex(currentIndex, delta, selectedTarget?.interactions.length ?? 0)
    ));
  }, [mode, interactions.targets.length, selectedTarget]);

  const selectItem = useCallback((index: number) => {
    if (mode === 'target') {
      setTargetIndex(index);
      setMode('interaction');
      setInteractionIndex(0);
      return;
    }

    setInteractionIndex(index);
    triggerInteraction(index);
  }, [mode, triggerInteraction]);

  useEffect(() => {
    const handleScroll = (event: WheelEvent) => {
      if (isOverlayOpen()) return;
      moveIndex(event.deltaY > 0 ? 1 : -1);
    };

    const moveUpSub = keyboardService.subscribeToKeyDown(KeyEnum.ArrowUp, (event) => {
      if (isOverlayOpen()) return;
      if (event.repeat) return;
      event.preventDefault();
      moveIndex(-1);
    });
    const moveDownSub = keyboardService.subscribeToKeyDown(KeyEnum.ArrowDown, (event) => {
      if (isOverlayOpen()) return;
      if (event.repeat) return;
      event.preventDefault();
      moveIndex(1);
    });
    const keySub = keyboardService.subscribeToKeyDown([KeyEnum.e, KeyEnum.E], () => {
      if (isOverlayOpen()) return;
      activateCurrent();
    });
    const backSub = keyboardService.subscribeToKeyDown([KeyEnum.q, KeyEnum.Q], () => {
      if (isOverlayOpen()) return;
      if (mode === 'interaction' && interactions.targets.length > 1) {
        setMode('target');
      }
    });

    window.addEventListener('wheel', handleScroll, { passive: true });
    return () => {
      moveUpSub.dispose();
      moveDownSub.dispose();
      keySub.dispose();
      backSub.dispose();
      window.removeEventListener('wheel', handleScroll);
    };
  }, [activateCurrent, interactions.targets.length, mode, moveIndex]);

  const options = useMemo(() => (
    buildCarouselOptions(mode, interactions.targets, selectedTarget)
  ), [mode, interactions.targets, selectedTarget]);

  const activeIndex = mode === 'target' ? targetIndex : interactionIndex;
  const visibleItems = useMemo(() => (
    getVisibleCarouselItems(options, activeIndex)
  ), [options, activeIndex]);

  return {
    isVisible: interactions.targets.length > 0,
    mode,
    visibleItems,
    selectItem,
  };
}
