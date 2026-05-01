import { useEffect, useMemo } from 'react';
import { SUPPORTED_LOCALES } from '@/i18n';
import bgImage from '@/assets/Start_Menu.png';
import mainMusic from '@/assets/Main.m4a';
import loadingSfx from '@/assets/loading.mp3';
import { useMainMenuController } from '../controllers/useMainMenuController';

const LANGUAGE_OPTIONS = SUPPORTED_LOCALES;

function SparkParticles() {
  const particles = useMemo(() => Array.from({ length: 40 }).map((_, index) => ({
    key: index,
    left: `${Math.random() * 100}%`,
    width: `${Math.random() * 4 + 1}px`,
    height: `${Math.random() * 4 + 1}px`,
    animationDuration: `${Math.random() * 4 + 4}s`,
    animationDelay: `${Math.random() * 5}s`,
  })), []);

  return (
    <div className="absolute inset-0 pointer-events-none z-20" aria-hidden="true">
      {particles.map(({ key, ...style }) => (
        <div key={key} className="spark-particle" style={style} />
      ))}
    </div>
  );
}

export const MainMenu = () => {
  const {
    t,
    language,
    audioRef,
    loadRef,
    isLoading,
    showSettings,
    settingsTab,
    volume,
    setShowSettings,
    setSettingsTab,
    handleSliderChange,
    handleLanguageChange,
    handleStart,
  } = useMainMenuController();

  useEffect(() => {
    if (!showSettings) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (settingsTab === 'main') {
        setShowSettings(false);
        return;
      }
      setSettingsTab('main');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsTab, setSettingsTab, setShowSettings, showSettings]);

  return (
    <div className="w-screen h-screen relative select-none overflow-hidden bg-black flex items-center justify-center">
      <audio ref={audioRef} src={mainMusic} loop />
      <audio ref={loadRef} src={loadingSfx} />
      <SparkParticles />

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
          <h2 className="text-[#d4af37] text-4xl medieval-font animate-pulse mt-10 uppercase tracking-[0.2em]">{t('menu.loadingLobbies')}</h2>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 w-full h-full bg-cover bg-center animate-slow-zoom" style={{ backgroundImage: `url(${bgImage})` }} aria-hidden="true" />
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" aria-hidden="true"></div>

          <div className="relative z-10 flex flex-col items-center justify-center">
            {!showSettings ? (
              <div className="flex flex-col items-center gap-6">
                <button type="button" onClick={handleStart} className="rpg-btn text-5xl font-bold uppercase medieval-font cursor-pointer">
                  {t('menu.actions.play')}
                </button>
                <button type="button" onClick={() => { setShowSettings(true); setSettingsTab('main'); }} className="rpg-btn text-4xl font-bold uppercase medieval-font cursor-pointer">
                  {t('common.settings')}
                </button>
                <button type="button" onClick={() => window.close()} className="rpg-btn text-4xl font-bold uppercase medieval-font opacity-60 cursor-pointer">
                  {t('menu.actions.exit')}
                </button>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-6 p-10 min-w-[450px] border border-[#d4af37]/30 rounded-[30px] bg-black/75 backdrop-blur-2xl shadow-2xl animate-fade-in"
                role="dialog"
                aria-modal="true"
                aria-labelledby="main-menu-settings-title"
              >
                <h2 id="main-menu-settings-title" className="text-[#d4af37] text-4xl medieval-font uppercase border-b border-[#d4af37]/40 pb-3 w-full text-center tracking-widest">{t('common.settings')}</h2>

                {settingsTab === 'main' && (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <button type="button" onClick={() => setSettingsTab('music')} className="rpg-btn text-3xl uppercase medieval-font">{t('common.music')}</button>
                    <button type="button" onClick={() => setSettingsTab('lang')} className="rpg-btn text-3xl uppercase medieval-font">{t('common.language')}</button>
                    <button type="button" onClick={() => setShowSettings(false)} className="rpg-btn text-2xl opacity-70 uppercase medieval-font mt-2">{t('common.back')}</button>
                  </div>
                )}

                {settingsTab === 'music' && (
                  <div className="flex flex-col items-center gap-5 w-full">
                    <label className="text-[#d4af37] text-2xl medieval-font uppercase">{t('settings.musicVolume', { volume })}</label>
                    <input type="range" min="0" max="100" value={volume} onChange={handleSliderChange} className="custom-slider" />
                    <button type="button" onClick={() => setSettingsTab('main')} className="rpg-btn text-2xl uppercase medieval-font mt-2">{t('common.back')}</button>
                  </div>
                )}

                {settingsTab === 'lang' && (
                  <div className="flex flex-col items-center gap-4 w-full">
                    {LANGUAGE_OPTIONS.map((locale) => (
                      <button
                        key={locale}
                        type="button"
                        aria-pressed={language === locale}
                        onClick={() => handleLanguageChange(locale)}
                        className={`text-2xl medieval-font uppercase ${language === locale ? 'text-white' : 'text-[#d4af37]/50'}`}
                      >
                        {t(`settings.languageNames.${locale}`)}
                      </button>
                    ))}
                    <button type="button" onClick={() => setSettingsTab('main')} className="rpg-btn text-2xl uppercase medieval-font mt-2">{t('common.back')}</button>
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
