import { useAppTranslation } from '@/i18n';
import type { CombatPartStateView } from '@/modules/game_module/game_state';
import { formatBodyPartLabel, formatCombatEvent } from '../debug-view-model';
import { useCombatDebugController } from '../controllers/useCombatDebugController';

interface CombatDebugPanelProps {
  enabled?: boolean;
}

export function CombatDebugPanel({ enabled }: CombatDebugPanelProps) {
  const { t } = useAppTranslation();
  const controller = useCombatDebugController({ enabled });

  if (!controller.enabled) {
    return null;
  }

  const renderPartList = (parts?: Record<number, CombatPartStateView>) => {
    const entries = Object.entries(parts ?? {});
    if (entries.length === 0) {
      return <div className="text-[11px] text-slate-400">{t('debug.combat.emptyParts')}</div>;
    }

    return entries
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([partId, state]) => (
        <div key={partId} className="flex justify-between gap-3 text-[11px] text-slate-200">
          <span>{formatBodyPartLabel(Number(partId), t)}</span>
          <span>{state.hp.toFixed(1)}</span>
        </div>
      ));
  };

  return (
    <div className="pointer-events-none w-[22rem] rounded-2xl border border-amber-500/30 bg-black/65 px-4 py-3 font-mono text-slate-100 shadow-2xl backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-[0.28em] text-amber-300">{t('debug.combat.title')}</div>
      <div className="mt-2 text-[11px] leading-5 text-slate-300">
        {t('debug.combat.controls', { attacks: 'J/K/L/U/O', block: 'B' })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">{t('debug.combat.sections.me')}</div>
          <div className="space-y-1">{renderPartList(controller.myParts)}</div>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">{t('debug.combat.sections.focused')}</div>
          <div className="space-y-1">{renderPartList(controller.focusedParts)}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">{t('debug.combat.sections.recent')}</div>
        <div className="space-y-1 text-[11px] text-slate-200">
          {controller.recentEvents.length === 0 ? (
            <div className="text-slate-400">{t('debug.combat.emptyEvents')}</div>
          ) : controller.recentEvents.map((event, index) => (
            <div key={`${event.tick}-${index}`}>{formatCombatEvent(event, t)}</div>
          ))}
        </div>
      </div>

      {controller.metrics && controller.uiRenderMetrics ? (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300">
          <span>{t('debug.combat.metrics.rigged')}</span><span className="text-right text-white">{controller.metrics.riggedEntitiesRendered}</span>
          <span>{t('debug.combat.metrics.ik')}</span><span className="text-right text-white">{controller.metrics.fullIkSolves}/{controller.metrics.simplifiedSolves}</span>
          <span>{t('debug.combat.metrics.instancedQuads')}</span><span className="text-right text-white">{controller.metrics.instancedQuadsSubmitted}</span>
          <span>{t('debug.combat.metrics.drawCalls')}</span><span className="text-right text-white">{controller.metrics.drawCallsBeforeBatching}{'->'}{controller.metrics.drawCallsAfterBatching}</span>
          <span>{t('debug.combat.metrics.facingSwitches')}</span><span className="text-right text-white">{controller.metrics.facingSectorSwitchesPerSecond.toFixed(1)}</span>
          <span>{t('debug.combat.metrics.eventDrops')}</span><span className="text-right text-white">{controller.metrics.lateCombatEventsDiscarded + controller.metrics.staleCombatEventsDiscarded}</span>
          <span>{t('debug.combat.metrics.uiUpdates')}</span><span className="text-right text-white">{controller.uiRenderMetrics.combat.notificationCount}/{controller.uiRenderMetrics.animationMetrics.notificationCount}</span>
        </div>
      ) : null}
    </div>
  );
}
