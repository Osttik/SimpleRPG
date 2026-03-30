import { KeyEnum, KeyEnumValue } from "@/defines/key.enum";

interface IControlsContext {
  keyValue: Partial<Record<KeyEnumValue, { x?: number, y?: number }>>;
  isMousePressed: boolean;
  targetMousePosition: { x: number, y: number } | null;
  pressedKeys: { x: number, y: number };
}

const keyValue: Partial<Record<KeyEnumValue, { x?: number, y?: number }>> = {
  [KeyEnum.a]: { x: -1 }, [KeyEnum.A]: { x: -1 },
  [KeyEnum.d]: { x: 1 }, [KeyEnum.D]: { x: 1 },
  [KeyEnum.s]: { y: 1 }, [KeyEnum.S]: { y: 1 },
  [KeyEnum.w]: { y: -1 }, [KeyEnum.W]: { y: -1 },
}

export const controlsContext: IControlsContext = {
  isMousePressed: false,
  targetMousePosition: null,
  pressedKeys: { x: 0, y: 0 },
  keyValue,
}

export const getRelativePositions = (canvas: HTMLCanvasElement | null | undefined, clientX: number, clientY: number) => {
  if (!canvas) return [0, 0];
  const rect = canvas.getBoundingClientRect();
  const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
  const canvasY = (clientY - rect.top) * (canvas.height / rect.height);
  return [canvasX, canvasY];
}
