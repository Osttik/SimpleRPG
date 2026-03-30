import { CoreOverlay } from "@/components/overlay";
import { KeyEnum } from "@/defines/key.enum";
import { gameState } from "@/modules/game_module/game_state";
import { keyboardService } from "@/services/keyboard.service";
import { selectIsInventoryOpen, useUIActions } from "@/store/slices/ui.slice";
import { useEffect } from "react";

export const InventoryComponent = () => {
  const isInventoryOpen = selectIsInventoryOpen();
  const { openInventory } = useUIActions();

  useEffect(() => {
    const sub = keyboardService.subscribeToKeyDown(KeyEnum.i, () => {
      if (gameState.lootingTargetId) {
        gameState.lootingTargetId = null;
        gameState.chestInventory = [];
        gameState.playerInventory = [];
        window.dispatchEvent(new Event('gameStateUpdate'));
      }
      openInventory(!isInventoryOpen);
    });

    return () => {
      sub.dispose();
    }
  }, [openInventory, isInventoryOpen]);

  return (
    <CoreOverlay
      visible={isInventoryOpen}
      setVisible={openInventory}
      maximized
      content={(
        <div>
          Contentes
        </div>
      )}
    />
  );
}