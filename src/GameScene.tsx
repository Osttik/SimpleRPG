import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapComponent } from './modules/map_module';
import { UIComponent } from './UI';
import { selectCurrentLobby, selectGameplayMemberToken } from './store/slices/lobby.slice';

function GameScene() {
  const navigate = useNavigate();
  const currentLobby = selectCurrentLobby();
  const gameplayMemberToken = selectGameplayMemberToken();

  useEffect(() => {
    if (!gameplayMemberToken || !currentLobby) {
      navigate('/play', { replace: true });
    }
  }, [currentLobby, gameplayMemberToken, navigate]);

  if (!gameplayMemberToken || !currentLobby) {
    return null;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-900">
      <MapComponent memberToken={gameplayMemberToken} />
      <UIComponent />
    </div>
  );
}

export default GameScene;
