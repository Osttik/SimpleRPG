import { CoreOverlay } from "@/components/overlay";
import { gameService } from "@/services/game.service";
import { selectIsInventoryOpen, useUIActions } from "@/store/slices/ui.slice";
import { useEffect } from "react";

export const InventoryComponent = () => {
  const isInventoryOpen = selectIsInventoryOpen();
  const { openInventory } = useUIActions();

  useEffect(() => {
    const sub = gameService.subscribeToConnection();

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