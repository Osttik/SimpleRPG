import { useEffect, useRef } from 'react';
import { PrimeIcons } from "primereact/api";
import { CoreButton } from "./components/button";
import { GameInternalState } from "./components/game_internal_state";
import { MenuModal } from "./modules/menu_module/components/menu_modal";
import { selectIsMenuOpen, useMenuActions } from "./store/slices/menu.slice";
import gameMusicFile from './assets/Game.m4a';
import { InventoryComponent } from './modules/ui_module/components/inventory';
import { LootUI } from './modules/ui_module/components/loot_ui';
import { InteractionUIModal } from './modules/ui_module/components/interaction-ui-modal';

export const UIComponent = () => {
  const { setMenuState } = useMenuActions();
  const isMenuOpen = selectIsMenuOpen();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const savedVol = Number(localStorage.getItem('game_music_volume')) || 50;
    if (audioRef.current) {
      audioRef.current.volume = savedVol / 100;
      audioRef.current.play().catch(() => { });
    }
  }, []);

  return (
    <div className="absolute w-screen h-screen overflow-hidden pointer-events-none z-50 flex flex-col p-10 bg-transparent">
      <audio ref={audioRef} src={gameMusicFile} loop />
      <div className='flex flex-row gap-2 w-full'>
        <div className='flex flex-row gap-2 flex-1 justify-start'>
          <GameInternalState className="absolute pointer-events-auto" />
        </div>
        <div className='flex flex-row gap-2 flex-1 justify-center'>
        </div>
        <div className="flex flex-row gap-2 flex-1 justify-end pointer-events-auto">
          <CoreButton
            icon={PrimeIcons.BARS}
            onClick={() => setMenuState(!isMenuOpen)}
            className="bg-black/60 border-2 border-[#d4af37]/40 text-[#d4af37] w-16 h-16 rounded-xl hover:scale-110 transition-all shadow-xl"
          />
        </div>
      </div>
      <div className="flex-1">WHere?</div>
      <div className='flex flex-row gap-2 w-full'>
        <div className='flex flex-row gap-2 flex-1 justify-start'>

        </div>
        <div className='flex flex-row gap-2 flex-1 justify-center'>
          <InteractionUIModal />
        </div>
        <div className="flex flex-row gap-2 flex-1 justify-end">
          
        </div>
      </div>
      <InventoryComponent />
      <LootUI />
      <MenuModal />
    </div>
  );
}