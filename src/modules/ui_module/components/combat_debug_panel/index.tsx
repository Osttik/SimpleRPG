import { gameState, type CombatEventView } from "@/modules/game_module/game_state";
import { useEffect, useState } from "react";

const BODY_PART_NAMES: Record<number, string> = {
  0: 'Head',
  1: 'Neck',
  2: 'Torso',
  3: 'Chest',
  4: 'Belly',
  5: 'Pelvis',
  6: 'Shoulder L',
  7: 'Upper Arm L',
  8: 'Forearm L',
  9: 'Shoulder R',
  10: 'Upper Arm R',
  11: 'Forearm R',
  12: 'Thigh L',
  13: 'Shin L',
  14: 'Thigh R',
  15: 'Shin R',
  16: 'Shield',
};

const EVENT_LABELS: Record<number, string> = {
  0: 'Start',
  1: 'Hit',
  2: 'Blocked',
  3: 'Stop',
  4: 'Disabled',
};

const formatEvent = (event: CombatEventView) => {
  const bodyLabel = BODY_PART_NAMES[event.routedPartId] ?? BODY_PART_NAMES[event.partId] ?? `Part ${event.partId}`;
  return `${EVENT_LABELS[event.eventType] ?? 'Combat'} T${event.tick} A${event.attackerId} -> V${event.victimId} ${bodyLabel} ${event.damage.toFixed(1)}`;
};

export const CombatDebugPanel = () => {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1);
    window.addEventListener('gameStateUpdate', refresh);
    return () => window.removeEventListener('gameStateUpdate', refresh);
  }, []);

  void version;

  const myParts = gameState.myId ? gameState.combatBodies[gameState.myId] : undefined;
  const focusedParts = gameState.focusedId ? gameState.combatBodies[gameState.focusedId] : undefined;
  const recentEvents = gameState.combatEventLog.slice(-6).reverse();

  const renderPartList = (parts?: Record<number, { hp: number }>) => {
    if (!parts || Object.keys(parts).length === 0) {
      return <div className="text-[11px] text-slate-400">No combat part updates yet.</div>;
    }

    return Object.entries(parts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([partId, state]) => (
        <div key={partId} className="flex justify-between gap-3 text-[11px] text-slate-200">
          <span>{BODY_PART_NAMES[Number(partId)] ?? `Part ${partId}`}</span>
          <span>{state.hp.toFixed(1)}</span>
        </div>
      ));
  };

  return (
    <div className="pointer-events-none w-[22rem] rounded-2xl border border-amber-500/30 bg-black/65 px-4 py-3 font-mono text-slate-100 shadow-2xl backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Combat Debug</div>
      <div className="mt-2 text-[11px] leading-5 text-slate-300">
        Attacks: <span className="text-white">J/K/L/U/O</span> | Hold block: <span className="text-white">Z/X/C/V</span>
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
    </div>
  );
};

