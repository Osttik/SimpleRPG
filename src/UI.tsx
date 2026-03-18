import { PrimeIcons } from "primereact/api";
import { CoreButton } from "./components/button";
import { GameInternalState } from "./components/game_internal_state";
import { MenuModal } from "./modules/menu_module";
import { useMenuActions, useMenuSelections } from "./store/slices/menu.slice";

export const UIComponent = () => {
  const { setMenuState } = useMenuActions();
  const { isMenuOpen } = useMenuSelections();

  return (
    <div className="absolute w-screen h-screen overflow-hidden pointer-events-none z-50 flex flex-col relative">
      <GameInternalState className="absolute pointer-events-auto" />
      <div className="flex flex-row w-full gap-1 flex justify-between pointer-events-auto">
        <div className="flex-1 flex flex-row justify-start">

        </div>
        <div className="flex-1 flex flex-row justify-center">

        </div>
        <div className="flex-1 flex flex-row justify-end">
          <CoreButton
            icon={PrimeIcons.BARS}
            onClick={() => setMenuState(!isMenuOpen)}
            className="p-button-rounded p-button-text bg-white/10 border border-white/20 backdrop-blur-sm hover:bg-white/20 transition-all shadow-lg"
            aria-label="Menu"
          />
        </div>
      </div>
      <div className="flex-1">

      </div>
      <MenuModal />
    </div>
  );
}