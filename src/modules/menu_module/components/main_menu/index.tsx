import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenuActions } from '../../../../store/slices/menu.slice';
import bgImage from '../../../../assets/Start_Menu.png';
import mainMusic from '../../../../assets/Main.m4a';
import loadingSfx from '../../../../assets/loading.mp3';

type LangCode = 'UA' | 'EN' | 'PL';

const i18n: Record<LangCode, any> = {
  UA: { start: "Підключитись", sets: "Налаштування", exit: "Вийти", load: "Завантаження...", mus: "Музика", back: "Назад", lang: "Мова" },
  EN: { start: "Connect", sets: "Settings", exit: "Leave", load: "Loading...", mus: "Music", back: "Back", lang: "Language" },
  PL: { start: "Połącz", sets: "Ustawienia", exit: "Wyjdź", load: "Ładowanie...", mus: "Muzyka", back: "Wróć", lang: "Język" }
};

export const MainMenu = () => {
  const navigate = useNavigate();
  const { setMenuState } = useMenuActions();
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'main' | 'music' | 'lang'>('main');
  const [lang, setLang] = useState<LangCode>(() => (localStorage.getItem('lang') as LangCode) || 'UA');
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('game_music_volume')) || 50);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    localStorage.setItem('game_music_volume', v.toString());
    if (audioRef.current) audioRef.current.volume = v / 100;
  };

  const handleStart = () => {
    setIsLoading(true);
    if (loadRef.current) {
      loadRef.current.volume = volume / 100;
      loadRef.current.play();
    }
    setTimeout(() => {
      setMenuState(false);
      navigate('/game');
    }, 8000); 
  };

  const particles = Array.from({ length: 40 }).map((_, i) => (
    <div key={i} className="spark-particle" style={{
      left: `${Math.random() * 100}%`,
      width: `${Math.random() * 4 + 1}px`,
      height: `${Math.random() * 4 + 1}px`,
      animationDuration: `${Math.random() * 4 + 4}s`,
      animationDelay: `${Math.random() * 5}s`
    }} />
  ));

  return (
    <div className="w-screen h-screen relative select-none overflow-hidden bg-black flex items-center justify-center">
      <audio ref={audioRef} src={mainMusic} loop />
      <audio ref={loadRef} src={loadingSfx} />
      <div className="absolute inset-0 pointer-events-none z-20">{particles}</div>

      {isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-[9999]">
          <div className="hourglassBackground scale-[1.1]">
            <div className="hourglassContainer">
              <div className="hourglassGlassTop" />
              <div className="hourglassGlass" />
              <div className="hourglassSandStream" />
              <div className="hourglassSand" />
            </div>
          </div>
          <h2 className="text-[#d4af37] text-4xl medieval-font animate-pulse mt-10 uppercase tracking-[0.2em]">{i18n[lang].load}</h2>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 w-full h-full bg-cover bg-center animate-slow-zoom" style={{ backgroundImage: `url(${bgImage})` }} />
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"></div>

          <div className="relative z-10 flex flex-col items-center justify-center">
            {!showSettings ? (
              <div className="flex flex-col items-center gap-6">
                <button onClick={handleStart} className="rpg-btn text-5xl font-bold uppercase medieval-font cursor-pointer">
                  {i18n[lang].start}
                </button>
                <button onClick={() => { setShowSettings(true); setSettingsTab('main'); }} className="rpg-btn text-4xl font-bold uppercase medieval-font cursor-pointer">
                  {i18n[lang].sets}
                </button>
                <button onClick={() => window.close()} className="rpg-btn text-4xl font-bold uppercase medieval-font opacity-60 cursor-pointer">
                  {i18n[lang].exit}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 p-10 min-w-[450px] border border-[#d4af37]/30 rounded-[30px] bg-black/75 backdrop-blur-2xl shadow-2xl animate-fade-in">
                <h2 className="text-[#d4af37] text-4xl medieval-font uppercase border-b border-[#d4af37]/40 pb-3 w-full text-center tracking-widest">{i18n[lang].sets}</h2>
                
                {settingsTab === 'main' && (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <button onClick={() => setSettingsTab('music')} className="rpg-btn text-3xl uppercase medieval-font">{i18n[lang].mus}</button>
                    <button onClick={() => setSettingsTab('lang')} className="rpg-btn text-3xl uppercase medieval-font">{i18n[lang].lang}</button>
                    <button onClick={() => setShowSettings(false)} className="rpg-btn text-2xl opacity-70 uppercase medieval-font mt-2">{i18n[lang].back}</button>
                  </div>
                )}

                {settingsTab === 'music' && (
                  <div className="flex flex-col items-center gap-5 w-full">
                    <label className="text-[#d4af37] text-2xl medieval-font uppercase">{i18n[lang].mus}: {volume}%</label>
                    <input type="range" min="0" max="100" value={volume} onChange={handleSliderChange} className="custom-slider" />
                    <button onClick={() => setSettingsTab('main')} className="rpg-btn text-2xl uppercase medieval-font mt-2">{i18n[lang].back}</button>
                  </div>
                )}

                {settingsTab === 'lang' && (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <button onClick={() => { setLang('UA'); localStorage.setItem('lang', 'UA'); }} className={`text-2xl medieval-font uppercase ${lang === 'UA' ? 'text-white' : 'text-[#d4af37]/50'}`}>Українська</button>
                    <button onClick={() => { setLang('EN'); localStorage.setItem('lang', 'EN'); }} className={`text-2xl medieval-font uppercase ${lang === 'EN' ? 'text-white' : 'text-[#d4af37]/50'}`}>English</button>
                    <button onClick={() => { setLang('PL'); localStorage.setItem('lang', 'PL'); }} className={`text-2xl medieval-font uppercase ${lang === 'PL' ? 'text-white' : 'text-[#d4af37]/50'}`}>Polski</button>
                    <button onClick={() => setSettingsTab('main')} className="rpg-btn text-2xl uppercase medieval-font mt-2">{i18n[lang].back}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};