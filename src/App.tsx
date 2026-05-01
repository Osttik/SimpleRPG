import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MainMenu } from './features/menu/components/MainMenu';
import PlayShell from './PlayShell';
import { useLobbyConnectionController } from './features/lobby/controllers/useLobbyConnectionController';
import { createFrontendLogger } from './services/logger';

const _logger = createFrontendLogger('app');

function App() {
  const location = useLocation();
  useLobbyConnectionController();

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
