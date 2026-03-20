import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenuActions } from '../../../../store/slices/menu.slice';
import bgImage from '../../../../assets/Start_Menu.png';

export const MainMenu = () => {
  const navigate = useNavigate();
  const { setMenuState } = useMenuActions();
  const [isLoading, setIsLoading] = useState(false);
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
          playerRef.current = new (window as any).YT.Player('yt-player-main', {
            videoId: '_yh410lA9yI',
            playerVars: { autoplay: 1, loop: 1, playlist: '_yh410lA9yI', controls: 0 },
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

  const handleConnect = () => {
    setIsLoading(true);
    setTimeout(() => {
      setMenuState(false);
      navigate('/game');
    }, 3000); 
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-black z-[9999]">
        <div className="hourglassBackground">
          <div className="hourglassContainer">
            <div className="hourglassGlassTop"></div>
            <div className="hourglassGlass"></div>
            <div className="hourglassSandStream"></div>
            <div className="hourglassSand"></div>
          </div>
        </div>
        <h2 className="text-[#e8dcb8] text-2xl font-serif tracking-[0.3em] mt-10 animate-pulse uppercase">
          Loading World...
        </h2>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative select-none overflow-hidden bg-black">
      <div id="yt-player-main" className="hidden"></div>

      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] z-0"></div>

      <div className="absolute top-10 right-10 z-20 flex items-center gap-4 bg-black/60 px-8 py-4 rounded-[40px] shadow-[0_0_20px_rgba(212,175,55,0.4)] backdrop-blur-md border border-[#c1874b]">
        <span className="text-[#d4af37] font-serif text-2xl uppercase tracking-widest mr-2" style={{ textShadow: "2px 2px 4px black" }}>Music</span>
        <button onClick={() => changeVolume(-10)} className="text-[#f3e5ab] text-5xl hover:scale-125 hover:text-white active:scale-90 transition-all drop-shadow-lg leading-none pb-2">-</button>
        <span className="text-[#f3e5ab] font-bold text-3xl w-16 text-center leading-none" style={{ textShadow: "2px 2px 4px black" }}>{volume}%</span>
        <button onClick={() => changeVolume(10)} className="text-[#f3e5ab] text-5xl hover:scale-125 hover:text-white active:scale-90 transition-all drop-shadow-lg leading-none pb-1">+</button>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-20 w-full max-w-[900px]">
        <h1 
          className="text-[60px] font-black uppercase tracking-widest text-[#d4af37]" 
          style={{ 
            fontFamily: "'Almendra', serif",
            textShadow: "4px 4px 10px rgba(0,0,0,0.9), 0px 0px 20px rgba(212,175,55,0.6)" 
          }}
        >
          Main Menu
        </h1>

        <div className="flex flex-col gap-16 w-[400px]">
          <button 
            onClick={handleConnect}
            className="group w-full py-12 rounded-[100px] bg-gradient-to-b from-[#8b5a2b] to-[#4a2e15] shadow-[0_0_40px_rgba(139,90,43,0.6),inset_0_10px_20px_rgba(255,255,255,0.2)] transition-all duration-500 hover:scale-110 hover:shadow-[0_0_100px_rgba(212,175,55,1),inset_0_10px_30px_rgba(255,255,255,0.6)] hover:brightness-125 active:scale-95 active:shadow-[inset_0_20px_40px_rgba(0,0,0,0.9)]"
          >
            <span 
              className="text-[#f3e5ab] font-bold uppercase tracking-[0.2em] text-5xl transition-all duration-500 group-hover:text-white" 
              style={{ fontFamily: "'Almendra', serif", textShadow: "3px 3px 8px black, 0 0 20px rgba(255,255,255,0.5)" }}
            >
              Connect
            </span>
          </button>

          <button 
            onClick={() => window.close()}
            className="group w-full py-12 rounded-[100px] bg-gradient-to-b from-[#8b5a2b] to-[#4a2e15] shadow-[0_0_40px_rgba(139,90,43,0.6),inset_0_10px_20px_rgba(255,255,255,0.2)] transition-all duration-500 hover:scale-110 hover:shadow-[0_0_100px_rgba(212,175,55,1),inset_0_10px_30px_rgba(255,255,255,0.6)] hover:brightness-125 active:scale-95 active:shadow-[inset_0_20px_40px_rgba(0,0,0,0.9)]"
          >
            <span 
              className="text-[#f3e5ab] font-bold uppercase tracking-[0.2em] text-5xl transition-all duration-500 group-hover:text-white" 
              style={{ fontFamily: "'Almendra', serif", textShadow: "3px 3px 8px black, 0 0 20px rgba(255,255,255,0.5)" }}
            >
              Leave Game
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};