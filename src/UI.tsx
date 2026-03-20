import { useState, useEffect, useRef } from 'react';
import { PrimeIcons } from "primereact/api";
import { CoreButton } from "./components/button";
import { GameInternalState } from "./components/game_internal_state";
import { MenuModal } from "./modules/menu_module/components/menu_modal"; 
import { selectIsMenuOpen, useMenuActions } from "./store/slices/menu.slice";
import { InventoryComponent } from './modules/ui_module/components/inventory';

export const UIComponent = () => {
  const { setMenuState } = useMenuActions();
  const isMenuOpen = selectIsMenuOpen();
  const [volume, setVolume] = useState(50);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    const initYT = () => {
      if (!document.getElementById('yt-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-api-script';
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }

      const interval = setInterval(() => {
        if ((window as any).YT && (window as any).YT.Player) {
          clearInterval(interval);
          playerRef.current = new (window as any).YT.Player('yt-player-game', {
            videoId: '4WIMyqBG9gs',
            playerVars: { autoplay: 1, loop: 1, playlist: '4WIMyqBG9gs', controls: 0 },
            events: {
              onReady: (e: any) => { 
                e.target.setVolume(50); 
                e.target.playVideo(); 
              }
            }
          });
        }
      }, 100);
    };

    initYT();

    return () => {
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
    };
  }, []);

  const changeVolume = (amount: number) => {
    setVolume((prev) => {
      let newVol = prev + amount;
      if (newVol > 100) newVol = 100;
      if (newVol < 0) newVol = 0;
      if (playerRef.current?.setVolume) {
        playerRef.current.setVolume(newVol);
      }
      return newVol;
    });
  };

  return (
    <div className="absolute w-screen h-screen overflow-hidden pointer-events-none z-50 flex flex-col p-4">
      <div id="yt-player-game" className="hidden"></div>
      
      <GameInternalState className="absolute pointer-events-auto" />
      
      <div className="flex flex-row w-full justify-between pointer-events-auto">
        <div className="flex-1"></div>
        <div className="flex-1"></div>
        <div className="flex-1 flex justify-end gap-6 items-center">
          
          <div className="flex items-center gap-4 bg-black/60 px-5 py-2 border border-[#c1874b] rounded-[30px] backdrop-blur-md shadow-[0_0_15px_rgba(212,175,55,0.3)]">
            <button onClick={() => changeVolume(-10)} className="text-[#d4af37] text-3xl hover:scale-125 hover:text-white transition-all active:scale-95 drop-shadow-md pb-1">-</button>
            <span className="text-[#f3e5ab] font-bold text-xl font-serif w-12 text-center" style={{ textShadow: "1px 1px 2px black" }}>{volume}%</span>
            <button onClick={() => changeVolume(10)} className="text-[#d4af37] text-3xl hover:scale-125 hover:text-white transition-all active:scale-95 drop-shadow-md">+</button>
          </div>

          <CoreButton
            icon={PrimeIcons.BARS}
            onClick={() => setMenuState(!isMenuOpen)}
            className="p-button-rounded p-button-text bg-black/60 border border-[#c1874b] backdrop-blur-md hover:bg-black/80 hover:border-[#d4af37] hover:scale-110 transition-all shadow-[0_0_15px_rgba(212,175,55,0.3)] text-[#d4af37] w-14 h-14"
            aria-label="Menu"
          />
        </div>
      </div>
      <div className="flex-1"></div>
      <InventoryComponent />
      <MenuModal />
    </div>
  );
}