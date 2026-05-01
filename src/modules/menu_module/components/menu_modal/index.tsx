import { useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { CoreOverlay } from "../../../../components/overlay";
import { useMenuActions, selectIsMenuOpen } from "../../../../store/slices/menu.slice";
import { lobbyActions, selectCurrentLobby, selectLobbyState, selectSessionPhase } from "../../../../store/slices/lobby.slice";
import { lobbyClient } from "@/api/realtime/lobby-client";
import { store } from "../../../../store";

type LangCode = 'UA' | 'EN' | 'PL';

const labels: Record<LangCode, any> = {
  UA: { cont: "Продовжити", quit: "Вийти", conf: "Повернутись до меню?" },
  EN: { cont: "Continue", quit: "Quit", conf: "Back to main menu?" },
  PL: { cont: "Kontynuuj", quit: "Wyjdź", conf: "Powrócić do menu?" }
};

export const MenuModal = () => {
  const isMenuOpen = selectIsMenuOpen();
  const { setMenuState } = useMenuActions();
  const navigate = useNavigate();
  const lang = (localStorage.getItem('lang') as LangCode) || 'UA';
  const currentLobby = selectCurrentLobby();
  const lobbyState = selectLobbyState();
  const sessionPhase = selectSessionPhase();

  useEffect(() => {
    if (sessionPhase !== 'Playing' && sessionPhase !== 'Paused') {
      return;
    }

    const nextPhase = isMenuOpen ? 'Paused' : 'Playing';
    if (sessionPhase !== nextPhase) {
      store.dispatch(lobbyActions.setSessionPhase(nextPhase));
    }
  }, [isMenuOpen, sessionPhase]);

  return (
    <CoreOverlay 
      visible={isMenuOpen}
      setVisible={setMenuState}
      content={(
        <div className="flex flex-col gap-8 p-16 items-center bg-transparent border-none shadow-none">
          {currentLobby?.isHost ? (
            <button
              onClick={() => lobbyClient.saveGame(currentLobby.loadedSave?.displayName || `${currentLobby.name} Save`)}
              className="rpg-btn text-4xl font-bold uppercase medieval-font cursor-pointer leading-tight"
            >
              {lobbyState.isSaving ? 'Saving...' : 'Save Game'}
            </button>
          ) : null}
          <button onClick={() => setMenuState(false)} 
            className="rpg-btn text-5xl font-bold uppercase medieval-font cursor-pointer leading-tight">
            {labels[lang].cont}
          </button>
          
          <button onClick={() => { if (window.confirm(labels[lang].conf)) { lobbyClient.leaveLobby(); setMenuState(false); navigate('/'); } }} 
            className="text-red-900 text-4xl font-bold uppercase medieval-font hover:text-red-600 hover:scale-105 transition-all cursor-pointer"
            style={{ textShadow: '2px 2px 6px #000' }}>
            {labels[lang].quit}
          </button>
        </div>
      )}
    />
  );
}
