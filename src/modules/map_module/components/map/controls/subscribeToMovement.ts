import { keyboardService } from "@/services/keyboard.service";
import { controlsContext } from ".";
import { MouseKeyEnum } from "@/defines/key.enum";
import { gameState } from "@/modules/game_module/game_state";

export const subscribeToMovement = () => {
  return [...keyboardService.subscribeToKey(
    Object.keys(controlsContext.keyValue),
    (e) => {
      if (e.repeat) return; // browser key-repeat fires extra keydowns; skip them to prevent drift
      const val = controlsContext.keyValue[e.key];
      controlsContext.isMousePressed = false;
      controlsContext.targetMousePosition = null;

      if (!val) return;
      controlsContext.pressedKeys.x += val.x ?? 0;
      controlsContext.pressedKeys.y += val.y ?? 0;
    },
    (e) => {
      const val = controlsContext.keyValue[e.key];

      if (!val) return;
      controlsContext.pressedKeys.x -= val.x ?? 0;
      controlsContext.pressedKeys.y -= val.y ?? 0;
    }),
  ...keyboardService.subscribeToMouse(MouseKeyEnum.MouseRight,
    () => {
      controlsContext.isMousePressed = true;
    }, () => {
      controlsContext.isMousePressed = false;
      controlsContext.targetMousePosition = null; // stop on release, not continue to release point
    })
  ];
}