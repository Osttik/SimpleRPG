import { gameState, type CombatEventView } from "@/modules/game_module/game_state";
import { getGameStateRenderMetrics, useGameStateSubscription } from "@/modules/game_module/game_state_subscriptions";
import { BodyPartLabelById } from "@/modules/game_module/animation/generated/combatRigContract";

const EVENT_LABELS: Record<number, string> = {
  0: 'Start',
  1: 'Hit',
  2: 'Blocked',
  3: 'Stop',
  4: 'Disabled',
};

const formatEvent = (event: CombatEventView) => {
  const bodyLabel = BodyPartLabelById[event.routedPartId] ?? BodyPartLabelById[event.partId] ?? `Part ${event.partId}`;
  return `${EVENT_LABELS[event.eventType] ?? 'Combat'} T${event.tick} A${event.attackerId} -> V${event.victimId} ${bodyLabel} ${event.damage.toFixed(1)}`;
};

export const CombatDebugPanel = () => {
  useGameStateSubscription(['combat', 'animationMetrics']);

  const myParts = gameState.myId ? gameState.combatBodies[gameState.myId] : undefined;
  const focusedParts = gameState.focusedId ? gameState.combatBodies[gameState.focusedId] : undefined;
  const recentEvents = gameState.combatEventLog.slice(-6).reverse();
  const metrics = gameState.animationMetrics;
  const uiRenderMetrics = getGameStateRenderMetrics();

  const renderPartList = (parts?: Record<number, { hp: number }>) => {
    if (!parts || Object.keys(parts).length === 0) {
      return <div className="text-[11px] text-slate-400">No combat part updates yet.</div>;
    }

    return Object.entries(parts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([partId, state]) => (
        <div key={partId} className="flex justify-between gap-3 text-[11px] text-slate-200">
          <span>{BodyPartLabelById[Number(partId)] ?? `Part ${partId}`}</span>
          <span>{state.hp.toFixed(1)}</span>
        </div>
      ));
  };

  return (
    <div className="pointer-events-none w-[22rem] rounded-2xl border border-amber-500/30 bg-black/65 px-4 py-3 font-mono text-slate-100 shadow-2xl backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Combat Debug</div>
      <div className="mt-2 text-[11px] leading-5 text-slate-300">
        Attacks: <span className="text-white">J/K/L/U/O</span> | Hold block: <span className="text-white">B</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">Me</div>
          <div className="space-y-1">{renderPartList(myParts)}</div>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">Focused</div>
          <div className="space-y-1">{renderPartList(focusedParts)}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">Recent</div>
        <div className="space-y-1 text-[11px] text-slate-200">
          {recentEvents.length === 0 ? (
            <div className="text-slate-400">No combat events received.</div>
          ) : recentEvents.map((event, index) => (
            <div key={`${event.tick}-${index}`}>{formatEvent(event)}</div>
          ))}
        </div>
      </div>

      {metrics ? (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300">
          <span>Rigged</span><span className="text-right text-white">{metrics.riggedEntitiesRendered}</span>
          <span>IK full/simple</span><span className="text-right text-white">{metrics.fullIkSolves}/{metrics.simplifiedSolves}</span>
          <span>Instanced quads</span><span className="text-right text-white">{metrics.instancedQuadsSubmitted}</span>
          <span>Draw calls</span><span className="text-right text-white">{metrics.drawCallsBeforeBatching}{'->'}{metrics.drawCallsAfterBatching}</span>
          <span>Facing switches/s</span><span className="text-right text-white">{metrics.facingSectorSwitchesPerSecond.toFixed(1)}</span>
          <span>Event drops</span><span className="text-right text-white">{metrics.lateCombatEventsDiscarded + metrics.staleCombatEventsDiscarded}</span>
          <span>UI updates combat/anim</span><span className="text-right text-white">{uiRenderMetrics.combat.notificationCount}/{uiRenderMetrics.animationMetrics.notificationCount}</span>
        </div>
      ) : null}
    </div>
  );
};
