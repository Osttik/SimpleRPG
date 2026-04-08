import { KeyEnum } from '@/defines/key.enum';
import { gameState } from '@/modules/game_module/game_state';
import { keyboardService } from '@/services/keyboard.service';
import { interactionsState } from '@/store';
import { useEffect, useState } from 'react';
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

    const selectedId = interactions.selectedTargetId;
    if (selectedId) {
      const idx = interactions.targets.findIndex(t => t.targetId === selectedId);
      if (idx >= 0) {
        setTargetIndex(idx);
      }
    } else {
      setTargetIndex(prev => (prev >= targetsCount ? 0 : prev));
    }

    if (targetsCount > 1) {
      setMode('target');
      setInteractionIndex(0);
    } else {
      setMode('interaction');
      setTargetIndex(0);
    }
  }, [interactions.targets, interactions.selectedTargetId]);

  const selectedTarget = interactions.targets[targetIndex] ?? null;
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
    if (selectedInteraction.interactionId === 'loot') {
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
      keySub.dispose();
      backSub.dispose();
      window.removeEventListener('wheel', handleScroll);
    };
  }, [mode, selectedTarget, selectedInteraction, interactions.targets]);

  if (interactions.targets.length === 0) return <></>;

  const options = mode === 'target'
    ? interactions.targets.map((t) => ({ id: t.targetId, name: t.nameKey }))
    : (selectedTarget?.interactions ?? []).map((o) => ({ id: o.interactionId, name: o.nameKey }));
  const activeIndex = mode === 'target' ? targetIndex : interactionIndex;

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
