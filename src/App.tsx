import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MainMenu } from './modules/menu_module/components/main_menu';
import PlayShell from './PlayShell';
import { lobbyClient } from './api/realtime/lobby-client';
import { createFrontendLogger } from './services/logger';

const _logger = createFrontendLogger('app');

function App() {
  const location = useLocation();

  useEffect(() => {
    _logger.log('connecting lobby control client');
    lobbyClient.connect();
    return () => {
      _logger.log('disconnecting lobby control client');
      lobbyClient.disconnect();
    };
  }, []);

  useEffect(() => {
    _logger.log('route changed', { pathname: location.pathname, search: location.search });
  }, [location.pathname, location.search]);

  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/play" element={<PlayShell />} />
      <Route path="/game" element={<Navigate to="/play" replace />} />
    </Routes>
  );
}

export default App;
