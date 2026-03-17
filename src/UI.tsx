import { PrimeIcons } from "primereact/api";
import { CoreButton } from "./components/button";
import { GameInternalState } from "./components/game_internal_state";
import { MenuModal } from "./modules/menu_module";
import { useMenuActions, useMenuSelections } from "./store/slices/menu.slice";
import { gameCoreService } from "./services/import-modules/game-core.service";

export const UIComponent = () => {
  const { setMenuState } = useMenuActions();
  const { isMenuOpen } = useMenuSelections();
  console.log(gameCoreService)
  return (
    <div className="absolute w-screen h-screen overflow-hidden z-[1000] flex flex-col relative">
      <GameInternalState className="absolute" />
      <div className="flex flex-row w-full gap-1 flex justify-between">
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