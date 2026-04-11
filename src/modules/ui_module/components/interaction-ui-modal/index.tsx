import { KeyEnum } from '@/defines/key.enum';
import { gameState } from '@/modules/game_module/game_state';
import { keyboardService } from '@/services/keyboard.service';
import { interactionsState } from '@/store';
import { useEffect, useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';

type MenuMode = 'target' | 'interaction';

export const InteractionUIModal = () => {
  const interactions = useSnapshot(interactionsState);
  const [mode, setMode] = useState<MenuMode>('target');
  const [targetIndex, setTargetIndex] = useState(0);
  const [interactionIndex, setInteractionIndex] = useState(0);

  useEffect(() => {
    const targetsCount = interactions.targets.length;
    if (targetsCount === 0) {
      setMode('target');
      setTargetIndex(0);
      setInteractionIndex(0);
      return;
    }

    setTargetIndex(prev => {
      const currentTargetId = interactions.targets[prev]?.targetId;
      if (currentTargetId) {
        const preservedIndex = interactions.targets.findIndex(t => t.targetId === currentTargetId);
        if (preservedIndex >= 0) return preservedIndex;
      }

      const selectedId = interactions.selectedTargetId;
      if (selectedId) {
        const selectedIndex = interactions.targets.findIndex(t => t.targetId === selectedId);
        if (selectedIndex >= 0) return selectedIndex;
      }

      return 0;
    });

    setMode(prev => {
      if (targetsCount <= 1) return 'interaction';
      return prev;
    });
  }, [interactions.targets, interactions.selectedTargetId]);

  const selectedTarget = interactions.targets[targetIndex] ?? null;

  useEffect(() => {
    const optionsCount = selectedTarget?.interactions.length ?? 0;
    if (optionsCount <= 0) {
      setInteractionIndex(0);
      return;
    }

    setInteractionIndex(prev => (prev >= optionsCount ? 0 : prev));
  }, [selectedTarget]);

  const selectedInteraction = selectedTarget?.interactions[interactionIndex] ?? null;

  const moveIndex = (delta: number) => {
    if (mode === 'target') {
      if (interactions.targets.length <= 1) return;
      setTargetIndex(prev => (prev + delta + interactions.targets.length) % interactions.targets.length);
      setInteractionIndex(0);
      return;
    }

    const optionsCount = selectedTarget?.interactions.length ?? 0;
    if (optionsCount <= 1) return;
    setInteractionIndex(prev => (prev + delta + optionsCount) % optionsCount);
  };

  const triggerInteraction = () => {
    if (!gameState.socketWorker || !selectedTarget || !selectedInteraction) return;
    if (selectedInteraction.interactionId === 'loot' || selectedInteraction.interactionId === 'pickup') {
      gameState.socketWorker.postMessage({
        type: 'interact',
        targetId: Number(selectedTarget.targetId),
      });
    }
  };

  const activateCurrent = () => {
    if (!selectedTarget) return;
    if (mode === 'target' && selectedTarget.interactions.length > 0) {
      setMode('interaction');
      setInteractionIndex(0);
      return;
    }
    triggerInteraction();
  };

  useEffect(() => {
    const handleScroll = (e: WheelEvent) => {
      moveIndex(e.deltaY > 0 ? 1 : -1);
    };

    const moveUpSub = keyboardService.subscribeToKeyDown(KeyEnum.ArrowUp, (e) => {
      if (e.repeat) return;
      e.preventDefault();
      moveIndex(-1);
    });
    const moveDownSub = keyboardService.subscribeToKeyDown(KeyEnum.ArrowDown, (e) => {
      if (e.repeat) return;
      e.preventDefault();
      moveIndex(1);
    });
    const keySub = keyboardService.subscribeToKeyDown([KeyEnum.e, KeyEnum.E], () => {
      activateCurrent();
    });
    const backSub = keyboardService.subscribeToKeyDown([KeyEnum.q, KeyEnum.Q], () => {
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
  }, [mode, selectedTarget, selectedInteraction, interactions.targets]);

  const options = useMemo(() => (mode === 'target'
    ? interactions.targets.map((t) => ({ id: t.targetId, name: t.nameKey }))
    : (selectedTarget?.interactions ?? []).map((o) => ({ id: o.interactionId, name: o.nameKey }))), [mode, interactions.targets, selectedTarget]);
  const activeIndex = mode === 'target' ? targetIndex : interactionIndex;

  if (interactions.targets.length === 0) return <></>;

  const getVisibleItems = () => {
    const len = options.length;
    if (len === 0) return [];
    if (len === 1) return [{ option: options[0], type: 'active' as const, index: 0 }];
    if (len === 2) {
      const other = (activeIndex + 1) % 2;
      return [
        { option: options[activeIndex], type: 'active' as const, index: activeIndex },
        { option: options[other], type: 'side' as const, index: other },
      ];
    }

    const prev = (activeIndex - 1 + len) % len;
    const next = (activeIndex + 1) % len;
    return [
      { option: options[prev], type: 'side' as const, index: prev },
      { option: options[activeIndex], type: 'active' as const, index: activeIndex },
      { option: options[next], type: 'side' as const, index: next },
    ];
  };

  return (
    <div className="carousel-wrapper">
      <div className="menu-mode-label">{mode === 'target' ? 'Select Target' : 'Select Interaction'}</div>
      {getVisibleItems().map((item, i) => (
        <button
          key={`${item.option.id}-${i}`}
          type="button"
          className={`menu-item ${item.type}`}
          onClick={() => {
            if (mode === 'target') {
              setTargetIndex(item.index);
              setMode('interaction');
              setInteractionIndex(0);
            } else {
              setInteractionIndex(item.index);
              triggerInteraction();
            }
          }}
        >
          {item.option.name}
        </button>
      ))}
      <div className="menu-hint">Wheel: switch | E: confirm | Q: back</div>
    </div>
  );
};
