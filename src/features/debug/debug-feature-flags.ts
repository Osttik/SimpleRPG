export interface DebugFeatureFlags {
  combatPanelEnabled: boolean;
  worldLayerPanelEnabled: boolean;
  worldLayerOverlayEnabled: boolean;
  anyEnabled: boolean;
}

interface DebugFeatureEnv {
  readonly DEV?: boolean;
  readonly VITE_DEBUG_COMBAT_RIG?: string;
  readonly VITE_DEBUG_COMBAT_UI?: string;
  readonly VITE_DEBUG_WORLD_LAYERS?: string;
}

export function getDebugFeatureFlags(env: DebugFeatureEnv = import.meta.env): DebugFeatureFlags {
  const isDev = Boolean(env.DEV);
  const combatPanelEnabled = isDev && (
    env.VITE_DEBUG_COMBAT_UI === '1' ||
    env.VITE_DEBUG_COMBAT_RIG === '1'
  );
  const worldLayersEnabled = isDev && env.VITE_DEBUG_WORLD_LAYERS === '1';

  return {
    combatPanelEnabled,
    worldLayerPanelEnabled: worldLayersEnabled,
    worldLayerOverlayEnabled: worldLayersEnabled,
    anyEnabled: combatPanelEnabled || worldLayersEnabled,
  };
}
