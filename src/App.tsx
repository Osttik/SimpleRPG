import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MainMenu } from './modules/menu_module/components/main_menu';
import { LobbyBrowserScreen } from './modules/menu_module/components/lobby_browser';
import GameScene from './GameScene';
import { lobbyClient } from './services/lobby-client';

function App() {
  useEffect(() => {
    lobbyClient.connect();
    return () => lobbyClient.disconnect();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/play" element={<LobbyBrowserScreen />} />
      <Route path="/game" element={<GameScene />} />
    </Routes>
  );
}

export default App;
