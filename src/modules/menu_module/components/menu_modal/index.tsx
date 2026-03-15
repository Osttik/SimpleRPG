import { CoreButton } from "../../../../components/button";
import { CoreOverlay } from "../../../../components/overlay";
import { useMenuActions, useMenuSelections } from "../../../../store/slices/menu.slice";

export const MenuModal = () => {
  const { isMenuOpen } = useMenuSelections();
  const { setMenuState } = useMenuActions();

  return (
    <CoreOverlay 
      visible={isMenuOpen}
      setVisible={setMenuState}
      content={(
        <div>
          <CoreButton label="Continue"/>
          <CoreButton label="Quit"/>
        </div>
      )}
    />
  );
}
