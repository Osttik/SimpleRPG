import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppTranslation, type SupportedLocale } from '@/i18n';
import { useMenuActions } from '@/store/slices/menu.slice';

type SettingsTab = 'main' | 'music' | 'lang';

export function useMainMenuController() {
  const navigate = useNavigate();
  const { setMenuState } = useMenuActions();
  const translation = useAppTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('main');
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('game_music_volume')) || 50);
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const handleSliderChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    localStorage.setItem('game_music_volume', nextVolume.toString());
    if (audioRef.current) audioRef.current.volume = nextVolume / 100;
  }, []);

  const handleLanguageChange = useCallback((locale: SupportedLocale) => {
    void translation.changeLanguage(locale);
  }, [translation]);

  const handleStart = useCallback(() => {
    setIsLoading(true);
    if (loadRef.current) {
      loadRef.current.volume = volume / 100;
      void loadRef.current.play();
    }
    window.setTimeout(() => {
      setMenuState(false);
      navigate('/play');
    }, 900);
  }, [navigate, setMenuState, volume]);

  return {
    ...translation,
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
  };
}
