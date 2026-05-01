import type { DebugFeatureFlags } from '../debug-feature-flags';
import { useDebugFeatureGate } from '../controllers/useDebugFeatureGate';
import { CombatDebugPanel } from './CombatDebugPanel';
import { WorldLayerDebugOverlay } from './WorldLayerDebugOverlay';
import { WorldLayerDebugPanel } from './WorldLayerDebugPanel';

interface DebugHudProps {
  flags?: DebugFeatureFlags;
}

export function DebugHud({ flags }: DebugHudProps) {
  const featureFlags = useDebugFeatureGate();
  const resolvedFlags = flags ?? featureFlags;

  if (!resolvedFlags.anyEnabled) {
    return null;
  }

  return (
    <>
      <WorldLayerDebugOverlay enabled={resolvedFlags.worldLayerOverlayEnabled} />
      <div className="absolute top-14 pointer-events-none">
        <CombatDebugPanel enabled={resolvedFlags.combatPanelEnabled} />
        <WorldLayerDebugPanel enabled={resolvedFlags.worldLayerPanelEnabled} />
      </div>
    </>
  );
}
