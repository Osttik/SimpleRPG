import { CoreOverlay } from "@/components/overlay";
import { KeyEnum } from "@/defines/key.enum";
import { keyboardService } from "@/services/keyboard.service";
import { selectIsInventoryOpen, useUIActions } from "@/store/slices/ui.slice";
import { useEffect } from "react";

export const InventoryComponent = () => {
  const isInventoryOpen = selectIsInventoryOpen();
  const { openInventory } = useUIActions();

  useEffect(() => {
    const sub = keyboardService.subscribeToKeyDown(KeyEnum.i, () => {
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