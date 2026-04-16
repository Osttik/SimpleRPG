import { useEffect } from 'react';
import { LobbyBrowserScreen } from './modules/menu_module/components/lobby_browser';
import GameScene from './GameScene';
import {
  lobbyActions,
  selectCurrentLobby,
  selectGameplayMemberToken,
  selectSessionPhase,
} from './store/slices/lobby.slice';
import { store } from './store';

function LoadingWorldView() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(180,83,9,0.3),_rgba(12,10,9,1)_58%),linear-gradient(160deg,_rgba(8,7,6,1),_rgba(23,17,10,1))] text-amber-50">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
        <div className="text-xs uppercase tracking-[0.4em] text-amber-200/50">Session Phase</div>
        <div className="medieval-font text-4xl uppercase tracking-[0.16em] text-amber-50">Loading World</div>
        <div className="max-w-xl text-center text-sm leading-6 text-amber-100/70">
          Attaching the gameplay socket and world renderer without leaving the active play session.
        </div>
      </div>
    </div>
  );
}

export default function PlayShell() {
  const sessionPhase = selectSessionPhase();
  const currentLobby = selectCurrentLobby();
  const gameplayMemberToken = selectGameplayMemberToken();

  useEffect(() => {
    if (sessionPhase === 'Ended') {
      const timer = window.setTimeout(() => {
        store.dispatch(lobbyActions.setSessionPhase('Lobby'));
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [sessionPhase]);

  const canRenderGame = Boolean(currentLobby && gameplayMemberToken);
  if ((sessionPhase === 'LoadingWorld' || sessionPhase === 'Playing' || sessionPhase === 'Paused') && canRenderGame) {
    return (
      <div className="relative h-screen w-screen">
        <GameScene
          memberToken={gameplayMemberToken!}
          onReady={() => {
            if (store.getState().lobby.sessionPhase === 'LoadingWorld') {
              store.dispatch(lobbyActions.setSessionPhase('Playing'));
            }
          }}
        />
        {sessionPhase === 'LoadingWorld' ? (
          <div className="pointer-events-none absolute inset-0 z-[120] bg-black/60 backdrop-blur-[2px]">
            <LoadingWorldView />
          </div>
        ) : null}
      </div>
    );
  }

  return <LobbyBrowserScreen />;
}
