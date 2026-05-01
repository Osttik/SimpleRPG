import { useMemo } from 'react';
import {
  gameState,
  type AnimationMetricsView,
  type CombatEventView,
  type CombatPartStateView,
} from '@/modules/game_module/game_state';
import {
  getGameStateRenderMetrics,
  useGameStateSubscription,
  type GameStateTopic,
  type GameStateTopicMetrics,
} from '@/modules/game_module/game_state_subscriptions';
import { useDebugFeatureGate } from './useDebugFeatureGate';

interface UseCombatDebugControllerOptions {
  enabled?: boolean;
}

export interface CombatDebugControllerState {
  enabled: boolean;
  myParts?: Record<number, CombatPartStateView>;
  focusedParts?: Record<number, CombatPartStateView>;
  recentEvents: CombatEventView[];
  metrics?: AnimationMetricsView;
  uiRenderMetrics: Record<GameStateTopic, GameStateTopicMetrics> | null;
}

export function useCombatDebugController(
  options: UseCombatDebugControllerOptions = {},
): CombatDebugControllerState {
  const featureFlags = useDebugFeatureGate();
  const enabled = options.enabled ?? featureFlags.combatPanelEnabled;
  const topics = enabled ? (['combat', 'animationMetrics'] as const) : ([] as const);
  const combatVersion = useGameStateSubscription(topics);

  return useMemo(() => {
    if (!enabled) {
      return {
        enabled: false,
        recentEvents: [],
        uiRenderMetrics: null,
      };
    }

    return {
      enabled: true,
      myParts: gameState.myId ? gameState.combatBodies[gameState.myId] : undefined,
      focusedParts: gameState.focusedId ? gameState.combatBodies[gameState.focusedId] : undefined,
      recentEvents: gameState.combatEventLog.slice(-6).reverse(),
      metrics: gameState.animationMetrics,
      uiRenderMetrics: getGameStateRenderMetrics(),
    };
  }, [combatVersion, enabled]);
}
