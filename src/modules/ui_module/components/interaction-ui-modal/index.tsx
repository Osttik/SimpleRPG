import { KeyEnum } from "@/defines/key.enum";
import { keyboardService } from "@/services/keyboard.service";
import { interactionsState } from "@/store";
import { useCallback, useEffect, useState } from "react";
import { useSnapshot } from "valtio";

export const InteractionUIModal = () => {
  const interactions = useSnapshot(interactionsState);
  const [index, setIndex] = useState(0);

  const handleScroll = useCallback((e: WheelEvent) => {
    if (e.deltaY > 0) {
      setIndex((prev) => (prev + 1) % interactions.options.length);
    } else {
      setIndex((prev) => (prev - 1 + interactions.options.length) % interactions.options.length);
    }
  }, []);

  useEffect(() => {
    keyboardService.subscribeToKeyDown([KeyEnum.e, KeyEnum.E], () => {

    });

    window.addEventListener('wheel', handleScroll);

    return () => {
      window.removeEventListener('wheel', handleScroll);
    };
  }, [handleScroll]);

  if (interactions.options.length === 0) return <></>;

  const getVisibleItems = () => {
    const len = interactions.options.length;
    if (len === 0) return [];

    if (len === 1) {
      return [{ option: interactions.options[0], type: 'active' }];
    }

    const prev = (index - 1 + len) % len;
    const current = index;
    const next = (index + 1) % len;

    return [
      { option: interactions.options[prev], type: 'side' },
      { option: interactions.options[current], type: 'active' },
      { option: interactions.options[next], type: 'side' }
    ];
  };

  return (
    <div className="carousel-wrapper">
      {getVisibleItems().map((item, i) => (
        <div key={`${item.option.nameKey}-${i}`} className={`menu-item ${item.type}`}>
          {item.option.nameKey}
        </div>
      ))}
    </div>
  );
};