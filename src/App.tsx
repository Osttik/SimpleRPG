import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MainMenu } from './modules/menu_module/components/main_menu';
import PlayShell from './PlayShell';
import { lobbyClient } from './services/lobby-client';

function App() {
  useEffect(() => {
    lobbyClient.connect();
    return () => lobbyClient.disconnect();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/play" element={<PlayShell />} />
      <Route path="/game" element={<Navigate to="/play" replace />} />
    </Routes>
  );
}

export default App;
