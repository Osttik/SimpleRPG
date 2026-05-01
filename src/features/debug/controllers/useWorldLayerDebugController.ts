import { useMemo } from 'react';
import {
  gameState,
  type WorldLayerDebugView,
  type WorldLayerValidationIssueView,
} from '@/modules/game_module/game_state';
import { useGameStateSubscription } from '@/modules/game_module/game_state_subscriptions';
import { useDebugFeatureGate } from './useDebugFeatureGate';

interface UseWorldLayerDebugControllerOptions {
  enabled?: boolean;
}

export interface WorldLayerDebugControllerState {
  enabled: boolean;
  debug: WorldLayerDebugView | null | undefined;
  camera: { x: number; y: number };
  visibleLayers: { min: number; max: number };
  currentZ: number;
  focusedZ: number | null;
  validationIssues: WorldLayerValidationIssueView[];
}

export function useWorldLayerDebugController(
  options: UseWorldLayerDebugControllerOptions = {},
): WorldLayerDebugControllerState {
  const featureFlags = useDebugFeatureGate();
  const enabled = options.enabled ?? featureFlags.worldLayerPanelEnabled;
  const topics = enabled ? 'worldLayerDebug' : ([] as const);
  const debugVersion = useGameStateSubscription(topics);

  return useMemo(() => {
    if (!enabled) {
      return {
        enabled: false,
        debug: null,
        camera: { x: 0, y: 0 },
        visibleLayers: { min: -3, max: 3 },
        currentZ: 0,
        focusedZ: null,
        validationIssues: [],
      };
    }

    const debug = gameState.worldLayerDebug;
    const visibleLayers = gameState.visibleLayers ?? { min: -3, max: 3 };
    const currentZ = gameState.myId ? gameState.players[gameState.myId]?.z ?? debug?.resolvedZ ?? 0 : 0;
    const focusedZ = gameState.focusedId ? gameState.players[gameState.focusedId]?.z ?? null : null;

    return {
      enabled: true,
      debug,
      camera: gameState.camera,
      visibleLayers,
      currentZ,
      focusedZ,
      validationIssues: [...gameState.worldLayerValidationIssues],
    };
  }, [debugVersion, enabled]);
}
