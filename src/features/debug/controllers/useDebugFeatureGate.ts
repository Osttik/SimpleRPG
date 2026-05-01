import { useMemo } from 'react';
import { getDebugFeatureFlags, type DebugFeatureFlags } from '../debug-feature-flags';

export function useDebugFeatureGate(): DebugFeatureFlags {
  return useMemo(() => getDebugFeatureFlags(), []);
}
