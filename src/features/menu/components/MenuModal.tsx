import { CoreOverlay } from '@/components/overlay';
import { useAppTranslation } from '@/i18n';
import { useGameplayMenuController } from '../controllers/useGameplayMenuController';

export const MenuModal = () => {
  const { t } = useAppTranslation();
  const {
    isMenuOpen,
    setMenuState,
    currentLobby,
    isSaving,
    closeMenu,
    saveGame,
    leaveToMainMenu,
  } = useGameplayMenuController();

  const confirmLeave = () => {
    if (window.confirm(t('menu.confirmBackToMain'))) {
      leaveToMainMenu();
    }
  };

  return (
    <CoreOverlay
      visible={isMenuOpen}
      setVisible={setMenuState}
      title={t('menu.title')}
      closeLabel={t('common.close')}
      content={(
        <div className="flex flex-col gap-8 p-16 items-center bg-transparent border-none shadow-none">
          {currentLobby?.isHost ? (
            <button
              onClick={saveGame}
              className="rpg-btn text-4xl font-bold uppercase medieval-font cursor-pointer leading-tight"
            >
              {isSaving ? t('menu.actions.saving') : t('menu.actions.saveGame')}
            </button>
          ) : null}
          <button
            onClick={closeMenu}
            className="rpg-btn text-5xl font-bold uppercase medieval-font cursor-pointer leading-tight"
          >
            {t('menu.actions.continue')}
          </button>

          <button
            onClick={confirmLeave}
            className="text-red-900 text-4xl font-bold uppercase medieval-font hover:text-red-600 hover:scale-105 transition-all cursor-pointer"
            style={{ textShadow: '2px 2px 6px #000' }}
          >
            {t('menu.actions.quit')}
          </button>
        </div>
      )}
    />
  );
};
