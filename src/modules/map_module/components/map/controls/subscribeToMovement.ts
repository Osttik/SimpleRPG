import { keyboardService } from "@/services/keyboard.service";
import { areControlsDisabled, controlsContext } from ".";
import { MouseKeyEnum } from "@/defines/key.enum";
import { gameState } from "@/modules/game_module/game_state";
import { getWorldMousePosition } from ".";

export const subscribeToMovement = () => {
  return [...keyboardService.subscribeToKey(
    Object.keys(controlsContext.keyValue),
    (e) => {
      if (areControlsDisabled()) {
        return;
      }
      if (e.repeat) return; // browser key-repeat fires extra keydowns; skip them to prevent drift
      const val = controlsContext.keyValue[e.key];
      controlsContext.isMousePressed = false;
      controlsContext.targetMousePosition = null;

      if (!val) return;
      controlsContext.pressedKeys.x += val.x ?? 0;
      controlsContext.pressedKeys.y += val.y ?? 0;
    },
    (e) => {
      if (areControlsDisabled()) {
        return;
      }
      const val = controlsContext.keyValue[e.key];

      if (!val) return;
      controlsContext.pressedKeys.x -= val.x ?? 0;
      controlsContext.pressedKeys.y -= val.y ?? 0;
    }),
  ...keyboardService.subscribeToMouse(MouseKeyEnum.MouseRight,
    () => {
      if (areControlsDisabled()) {
        return;
      }
      controlsContext.isMousePressed = true;
      controlsContext.targetMousePosition = getWorldMousePosition(
        gameState.canvasRef?.current,
        gameState.mousePosition.x,
        gameState.mousePosition.y,
      );
    }, () => {
      controlsContext.isMousePressed = false;
    })
  ];
}
