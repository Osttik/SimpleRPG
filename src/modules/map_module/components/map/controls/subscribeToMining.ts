import { KeyEnum } from "@/defines/key.enum";
import { gameState } from "@/modules/game_module/game_state";
import { keyboardService } from "@/services/keyboard.service";
import { areControlsDisabled, getWorldMousePosition } from ".";

const TILE_SIZE = 40;

export const subscribeToMining = (socketWorker: Worker) => {
  return [keyboardService.subscribeToKeyDown([KeyEnum.f, KeyEnum.F], (e) => {
    if (areControlsDisabled() || e.repeat) return;
    if (!gameState.myId) return;

    const canvas = gameState.canvasRef?.current;
    if (!canvas) return;

    const { x, y } = getWorldMousePosition(canvas, gameState.mousePosition.x, gameState.mousePosition.y);
    socketWorker.postMessage({
      type: 'mine_tile',
      tileX: Math.floor(x / TILE_SIZE),
      tileY: Math.floor(y / TILE_SIZE),
    });
  })];
};
