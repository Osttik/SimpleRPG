import { useAppTranslation } from '@/i18n';
import {
  formatConnectorCandidate,
  formatFootprintSample,
  formatLandingCandidate,
} from '../debug-view-model';
import { useWorldLayerDebugController } from '../controllers/useWorldLayerDebugController';

interface WorldLayerDebugPanelProps {
  enabled?: boolean;
}

export function WorldLayerDebugPanel({ enabled }: WorldLayerDebugPanelProps) {
  const { t } = useAppTranslation();
  const controller = useWorldLayerDebugController({ enabled });

  if (!controller.enabled) {
    return null;
  }

  const debug = controller.debug;
  const validation = controller.validationIssues.slice(0, 4);

  return (
    <div className="pointer-events-none mt-3 w-[28rem] rounded-2xl border border-cyan-500/30 bg-slate-950/80 px-4 py-3 font-mono text-slate-100 shadow-2xl backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-300">{t('debug.worldLayers.title')}</div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300">
        <span>{t('debug.worldLayers.fields.authoritativeZ')}</span><span className="text-right text-white">{controller.currentZ}</span>
        <span>{t('debug.worldLayers.fields.focusedInteractableZ')}</span><span className="text-right text-white">{controller.focusedZ ?? t('debug.worldLayers.fallbacks.notAvailable')}</span>
        <span>{t('debug.worldLayers.fields.visibleLayers')}</span><span className="text-right text-white">{controller.visibleLayers.min}..{controller.visibleLayers.max}</span>
        <span>{t('debug.worldLayers.fields.phase')}</span><span className="text-right text-white">{debug?.phase || t('debug.worldLayers.fallbacks.idle')}</span>
        <span>{t('debug.worldLayers.fields.reason')}</span><span className="text-right text-white">{debug?.reason || t('debug.worldLayers.fallbacks.notAvailable')}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">{t('debug.worldLayers.sections.footprint')}</div>
          <div className="space-y-1 text-[11px] text-slate-200">
            {(debug?.supportSamples ?? []).length === 0 ? (
              <div className="text-slate-500">{t('debug.worldLayers.empty.footprint')}</div>
            ) : (debug?.supportSamples ?? []).slice(0, 6).map((sample, index) => (
              <div key={`${sample.tileX}-${sample.tileY}-${index}`}>
                {formatFootprintSample(sample, t)}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">{t('debug.worldLayers.sections.connectors')}</div>
          <div className="space-y-1 text-[11px] text-slate-200">
            {(debug?.connectorCandidates ?? []).length === 0 ? (
              <div className="text-slate-500">{t('debug.worldLayers.empty.connectors')}</div>
            ) : (debug?.connectorCandidates ?? []).slice(0, 4).map((candidate, index) => (
              <div key={`${candidate.tileX}-${candidate.tileY}-${candidate.destinationZ}-${index}`}>
                {formatConnectorCandidate(candidate, t)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">{t('debug.worldLayers.sections.fallSearch')}</div>
        <div className="space-y-1 text-[11px] text-slate-200">
          {(debug?.landingCandidates ?? []).length === 0 ? (
            <div className="text-slate-500">{t('debug.worldLayers.empty.landing')}</div>
          ) : (debug?.landingCandidates ?? []).slice(0, 6).map((candidate, index) => (
            <div key={`${candidate.candidateZ}-${index}`}>{formatLandingCandidate(candidate, t)}</div>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">{t('debug.worldLayers.sections.validation')}</div>
        <div className="space-y-1 text-[11px] text-slate-200">
          {validation.length === 0 ? (
            <div className="text-slate-500">{t('debug.worldLayers.empty.validation')}</div>
          ) : validation.map((issue, index) => (
            <div key={`${issue.code}-${issue.tileX}-${issue.tileY}-${issue.tileZ}-${index}`}>
              [{issue.code}] {issue.tileX},{issue.tileY},Z{issue.tileZ}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
