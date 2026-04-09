import { isOverlayOpen } from "@/components/overlay";
import { MouseKeyEnum } from "@/defines/key.enum";
import { gameState } from "@/modules/game_module/game_state";
import { keyboardService } from "@/services/keyboard.service";
import { controlsContext, getRelativePositions } from ".";

export const subscribeToSelection = (socketWorker: Worker) => {
  return [keyboardService.subscribeToKeyDown(MouseKeyEnum.MouseLeft,
    () => {
      if (isOverlayOpen()) return;
      controlsContext.targetMousePosition = null;

      if (!gameState.myId) return;
      const canvas = gameState.canvasRef?.current;
      if (!canvas) return;

      const [x, y] = getRelativePositions(canvas, gameState.mousePosition.x, gameState.mousePosition.y);
      let hitChest = false;
      for (const [id, entity] of Object.entries(gameState.players)) {
        if (id === gameState.myId) continue;
        if (entity.type === 'chest') {
          const dx = x - entity.x;
          const dy = y - entity.y;
          if (dx * dx + dy * dy < 40 * 40) {
            socketWorker.postMessage({ type: 'interact' });
            hitChest = true;
            break;
          }
        }
      }
      if (hitChest) {
        controlsContext.isMousePressed = false;
      }
    }
  )];
}
