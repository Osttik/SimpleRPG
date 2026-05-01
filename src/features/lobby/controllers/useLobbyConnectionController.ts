import { useEffect } from 'react';
import { lobbyClient } from '@/api/realtime/lobby-client';
import { createFrontendLogger } from '@/services/logger';

const logger = createFrontendLogger('app');

export function useLobbyConnectionController() {
  useEffect(() => {
    logger.log('connecting lobby control client');
    lobbyClient.connect();
    return () => {
      logger.log('disconnecting lobby control client');
      lobbyClient.disconnect();
    };
  }, []);
}
