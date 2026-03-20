import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenuActions } from '../../../../store/slices/menu.slice';
import bgImage from '../../../../assets/Start_Menu.png';

export const MainMenu = () => {
  const navigate = useNavigate();
  const { setMenuState } = useMenuActions();
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
            playerVars: { autoplay: 1, loop: 1, playlist: '_yh410lA9yI', controls: 0, showinfo: 0, modestbranding: 1 },
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

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center relative select-none overflow-hidden bg-black">
      
      <div className="fixed top-0 left-0 w-[1px] h-[1px] opacity-0 pointer-events-none z-[-9999] overflow-hidden">
        <div id="yt-player-main"></div>
      </div>

      {isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-[9999]">
          <div className="hourglassBackground">
            <div className="hourglassContainer">
              <div className="hourglassGlassTop"></div>
              <div className="hourglassGlass"></div>
              <div className="hourglassSandStream"></div>
              <div className="hourglassSand"></div>
            </div>
          </div>
          <h2 
            className="text-[#d4af37] text-5xl tracking-[0.3em] mt-16 animate-pulse uppercase font-black"
            style={{ fontFamily: "'Almendra', serif", textShadow: "4px 4px 10px black, 0 0 20px rgba(212,175,55,0.8)" }}
          >
            Loading World...
          </h2>
        </div>
      ) : (
        <>
          <div
            className="absolute inset-0 w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0"></div>

          <div className="relative z-10 flex flex-col items-center gap-16 w-full max-w-[900px]">
            <h1 
              className="text-[80px] font-black uppercase tracking-widest text-[#d4af37]" 
              style={{ 
                fontFamily: "'Almendra', serif",
                textShadow: "4px 4px 10px rgba(0,0,0,0.9), 0px 0px 30px rgba(212,175,55,0.7)" 
              }}
            >
              Main Menu
            </h1>

            {!showSettings ? (
              <div className="flex flex-col gap-8 w-[350px]">
                <button 
                  onClick={handleConnect}
                  className="group w-full py-12 rounded-[60px] bg-gradient-to-b from-[#8b5a2b] to-[#4a2e15] shadow-[0_0_40px_rgba(139,90,43,0.6),inset_0_10px_20px_rgba(255,255,255,0.2)] transition-all duration-500 hover:scale-105 hover:shadow-[0_0_80px_rgba(212,175,55,1),inset_0_10px_30px_rgba(255,255,255,0.6)] hover:brightness-125 active:scale-95 active:shadow-[inset_0_20px_40px_rgba(0,0,0,0.9)] flex items-center justify-center"
                >
                  <span 
                    className="text-[#f3e5ab] font-bold uppercase tracking-[0.2em] text-5xl transition-all duration-500 group-hover:text-white" 
                    style={{ fontFamily: "'Almendra', serif", textShadow: "3px 3px 8px black, 0 0 15px rgba(255,255,255,0.5)" }}
                  >
                    Connect
                  </span>
                </button>

                <button 
                  onClick={() => setShowSettings(true)}
                  className="group w-full py-8 rounded-[60px] bg-gradient-to-b from-[#6b4226] to-[#3e2312] shadow-[0_0_30px_rgba(107,66,38,0.6),inset_0_5px_15px_rgba(255,255,255,0.1)] transition-all duration-500 hover:scale-105 hover:shadow-[0_0_60px_rgba(212,175,55,0.8),inset_0_5px_20px_rgba(255,255,255,0.4)] hover:brightness-125 active:scale-95 active:shadow-[inset_0_15px_30px_rgba(0,0,0,0.9)] flex items-center justify-center border-2 border-[#8b5a2b]/50"
                >
                  <span 
                    className="text-[#e8dcb8] font-bold uppercase tracking-[0.15em] text-3xl transition-all duration-500 group-hover:text-white" 
                    style={{ fontFamily: "'Almendra', serif", textShadow: "2px 2px 6px black" }}
                  >
                    Settings
                  </span>
                </button>

                <button 
                  onClick={() => window.close()}
                  className="group w-full py-12 rounded-[60px] bg-gradient-to-b from-[#8b5a2b] to-[#4a2e15] shadow-[0_0_40px_rgba(139,90,43,0.6),inset_0_10px_20px_rgba(255,255,255,0.2)] transition-all duration-500 hover:scale-105 hover:shadow-[0_0_80px_rgba(212,175,55,1),inset_0_10px_30px_rgba(255,255,255,0.6)] hover:brightness-125 active:scale-95 active:shadow-[inset_0_20px_40px_rgba(0,0,0,0.9)] flex items-center justify-center"
                >
                  <span 
                    className="text-[#f3e5ab] font-bold uppercase tracking-[0.2em] text-5xl transition-all duration-500 group-hover:text-white" 
                    style={{ fontFamily: "'Almendra', serif", textShadow: "3px 3px 8px black, 0 0 15px rgba(255,255,255,0.5)" }}
                  >
                    Leave
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-12 w-[400px] bg-black/60 p-10 rounded-[60px] border-4 border-[#8b5a2b] shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_0_30px_rgba(139,90,43,0.3)] backdrop-blur-md">
                <h2 
                  className="text-[#d4af37] text-4xl font-black uppercase tracking-widest text-center" 
                  style={{ fontFamily: "'Almendra', serif", textShadow: "2px 2px 5px black" }}
                >
                  Music Volume
                </h2>

                <div className="flex items-center justify-center gap-8 w-full">
                  <button 
                    onClick={() => changeVolume(-10)} 
                    className="w-16 h-16 rounded-full bg-gradient-to-b from-[#8b5a2b] to-[#4a2e15] text-[#f3e5ab] text-5xl flex items-center justify-center shadow-[0_0_20px_rgba(139,90,43,0.5)] hover:scale-110 hover:text-white hover:shadow-[0_0_30px_rgba(212,175,55,0.8)] active:scale-95 transition-all pb-2"
                  >
                    -
                  </button>
                  <span 
                    className="text-[#f3e5ab] font-bold text-5xl w-24 text-center" 
                    style={{ fontFamily: "'Almendra', serif", textShadow: "3px 3px 6px black" }}
                  >
                    {volume}%
                  </span>
                  <button 
                    onClick={() => changeVolume(10)} 
                    className="w-16 h-16 rounded-full bg-gradient-to-b from-[#8b5a2b] to-[#4a2e15] text-[#f3e5ab] text-5xl flex items-center justify-center shadow-[0_0_20px_rgba(139,90,43,0.5)] hover:scale-110 hover:text-white hover:shadow-[0_0_30px_rgba(212,175,55,0.8)] active:scale-95 transition-all pb-1"
                  >
                    +
                  </button>
                </div>

                <button 
                  onClick={() => setShowSettings(false)}
                  className="group w-full mt-4 py-8 rounded-[60px] bg-gradient-to-b from-[#8b5a2b] to-[#4a2e15] shadow-[0_0_30px_rgba(139,90,43,0.6),inset_0_5px_15px_rgba(255,255,255,0.2)] transition-all duration-500 hover:scale-105 hover:shadow-[0_0_60px_rgba(212,175,55,1),inset_0_10px_20px_rgba(255,255,255,0.6)] hover:brightness-125 active:scale-95 active:shadow-[inset_0_15px_30px_rgba(0,0,0,0.9)] flex items-center justify-center"
                >
                  <span 
                    className="text-[#f3e5ab] font-bold uppercase tracking-[0.2em] text-3xl transition-all duration-500 group-hover:text-white" 
                    style={{ fontFamily: "'Almendra', serif", textShadow: "3px 3px 6px black, 0 0 10px rgba(255,255,255,0.5)" }}
                  >
                    Back
                  </span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};