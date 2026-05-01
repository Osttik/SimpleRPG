import {
  gameState,
  type WorldLayerConnectorCandidateView,
  type WorldLayerLandingCandidateView,
} from "@/modules/game_module/game_state";
import { useGameStateSubscription } from "@/modules/game_module/game_state_subscriptions";

const ENABLED = import.meta.env.DEV && import.meta.env.VITE_DEBUG_WORLD_LAYERS === "1";

const CONNECTOR_TYPE_LABEL: Record<number, string> = {
  1: "Ladder",
  2: "Stairs",
  3: "Hatch",
  4: "Drop",
};

function summarizeConnector(candidate: WorldLayerConnectorCandidateView): string {
  const label = CONNECTOR_TYPE_LABEL[candidate.type] ?? `Type ${candidate.type}`;
  if (candidate.accepted) {
    return `${label} @ ${candidate.tileX},${candidate.tileY} -> Z${candidate.destinationZ}`;
  }
  return `${label} @ ${candidate.tileX},${candidate.tileY} ${candidate.rejectionReason || "rejected"}`;
}

function summarizeLanding(candidate: WorldLayerLandingCandidateView): string {
  if (candidate.accepted) return `Z${candidate.candidateZ} accepted`;
  if (!candidate.supportOk) return `Z${candidate.candidateZ} no support`;
  return `Z${candidate.candidateZ} blocked`;
}

export const WorldLayerDebugPanel = () => {
  if (!ENABLED) return null;

  return <WorldLayerDebugPanelContent />;
};

const WorldLayerDebugPanelContent = () => {
  useGameStateSubscription('worldLayerDebug');

  const debug = gameState.worldLayerDebug;
  const visible = gameState.visibleLayers ?? { min: -3, max: 3 };
  const currentZ = gameState.myId ? gameState.players[gameState.myId]?.z ?? debug?.resolvedZ ?? 0 : 0;
  const focusedZ = gameState.focusedId ? gameState.players[gameState.focusedId]?.z ?? null : null;
  const validation = gameState.worldLayerValidationIssues.slice(0, 4);

  return (
    <div className="pointer-events-none mt-3 w-[28rem] rounded-2xl border border-cyan-500/30 bg-slate-950/80 px-4 py-3 font-mono text-slate-100 shadow-2xl backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-300">World Layer Debug</div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300">
        <span>Authoritative Z</span><span className="text-right text-white">{currentZ}</span>
        <span>Focused Interactable Z</span><span className="text-right text-white">{focusedZ ?? "n/a"}</span>
        <span>Visible Layers</span><span className="text-right text-white">{visible.min}..{visible.max}</span>
        <span>Phase</span><span className="text-right text-white">{debug?.phase || "idle"}</span>
        <span>Reason</span><span className="text-right text-white">{debug?.reason || "n/a"}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">Footprint</div>
          <div className="space-y-1 text-[11px] text-slate-200">
            {(debug?.supportSamples ?? []).length === 0 ? (
              <div className="text-slate-500">No footprint samples.</div>
            ) : (debug?.supportSamples ?? []).slice(0, 6).map((sample, index) => (
              <div key={`${sample.tileX}-${sample.tileY}-${index}`}>
                {sample.tileX},{sample.tileY},Z{sample.z} T{sample.tileId} {sample.support ? "support" : "void"} {sample.blocked ? "blocked" : ""}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">Connectors</div>
          <div className="space-y-1 text-[11px] text-slate-200">
            {(debug?.connectorCandidates ?? []).length === 0 ? (
              <div className="text-slate-500">No connector candidates.</div>
            ) : (debug?.connectorCandidates ?? []).slice(0, 4).map((candidate, index) => (
              <div key={`${candidate.tileX}-${candidate.tileY}-${candidate.destinationZ}-${index}`}>
                {summarizeConnector(candidate)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">Fall Search</div>
        <div className="space-y-1 text-[11px] text-slate-200">
          {(debug?.landingCandidates ?? []).length === 0 ? (
            <div className="text-slate-500">No landing search this tick.</div>
          ) : (debug?.landingCandidates ?? []).slice(0, 6).map((candidate, index) => (
            <div key={`${candidate.candidateZ}-${index}`}>{summarizeLanding(candidate)}</div>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">Validation</div>
        <div className="space-y-1 text-[11px] text-slate-200">
          {validation.length === 0 ? (
            <div className="text-slate-500">No loaded-chunk validation issues.</div>
          ) : validation.map((issue, index) => (
            <div key={`${issue.code}-${issue.tileX}-${issue.tileY}-${issue.tileZ}-${index}`}>
              [{issue.code}] {issue.tileX},{issue.tileY},Z{issue.tileZ}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
