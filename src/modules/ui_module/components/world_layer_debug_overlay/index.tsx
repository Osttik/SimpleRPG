import {
  gameState,
  type WorldLayerConnectorCandidateView,
  type WorldLayerFootprintSampleView,
} from "@/modules/game_module/game_state";
import { useEffect, useState } from "react";

const ENABLED = import.meta.env.DEV && import.meta.env.VITE_DEBUG_WORLD_LAYERS === "1";
const TILE_SIZE = 40;

function maskToArrow(mask: number) {
  if (mask & 1) return { dx: 0, dy: -12 };
  if (mask & 2) return { dx: 0, dy: 12 };
  if (mask & 4) return { dx: -12, dy: 0 };
  if (mask & 8) return { dx: 12, dy: 0 };
  return { dx: 0, dy: -12 };
}

function triggerRect(candidate: WorldLayerConnectorCandidateView) {
  return {
    x: candidate.tileX * TILE_SIZE + candidate.triggerMinX,
    y: candidate.tileY * TILE_SIZE + candidate.triggerMinY,
    width: candidate.triggerMaxX - candidate.triggerMinX,
    height: candidate.triggerMaxY - candidate.triggerMinY,
  };
}

function sampleColor(sample: WorldLayerFootprintSampleView) {
  if (sample.blocked) return "#ef4444";
  if (sample.support) return "#22c55e";
  if (sample.fallThrough) return "#facc15";
  return "#94a3b8";
}

export const WorldLayerDebugOverlay = () => {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!ENABLED) return;
    const refresh = () => setVersion((v) => v + 1);
    window.addEventListener("gameStateUpdate", refresh);
    return () => window.removeEventListener("gameStateUpdate", refresh);
  }, []);

  void version;

  if (!ENABLED) return null;

  const debug = gameState.worldLayerDebug;
  const camera = gameState.camera;
  const validationIssues = gameState.worldLayerValidationIssues;

  return (
    <svg className="pointer-events-none absolute inset-0 z-40 h-full w-full overflow-visible">
      {(debug?.supportSamples ?? []).map((sample, index) => {
        const x = (sample.tileX * TILE_SIZE) - camera.x;
        const y = (sample.tileY * TILE_SIZE) - camera.y;
        return (
          <g key={`sample-${sample.tileX}-${sample.tileY}-${index}`}>
            <rect
              x={x + 3}
              y={y + 3}
              width={TILE_SIZE - 6}
              height={TILE_SIZE - 6}
              fill="none"
              stroke={sampleColor(sample)}
              strokeWidth={2}
              strokeDasharray="4 3"
            />
            <circle
              cx={x + TILE_SIZE / 2}
              cy={y + TILE_SIZE / 2}
              r={5}
              fill={sampleColor(sample)}
              opacity={0.85}
            />
          </g>
        );
      })}

      {(debug?.connectorCandidates ?? []).map((candidate, index) => {
        const rect = triggerRect(candidate);
        const arrow = maskToArrow(candidate.allowedMovementDirectionMask);
        const centerX = rect.x + rect.width / 2 - camera.x;
        const centerY = rect.y + rect.height / 2 - camera.y;
        const stroke = candidate.accepted ? "#22c55e" : candidate.triggerHit ? "#f59e0b" : "#38bdf8";
        return (
          <g key={`connector-${candidate.tileX}-${candidate.tileY}-${candidate.destinationZ}-${index}`}>
            <rect
              x={rect.x - camera.x}
              y={rect.y - camera.y}
              width={rect.width}
              height={rect.height}
              fill="rgba(8,145,178,0.08)"
              stroke={stroke}
              strokeWidth={2}
            />
            <line
              x1={centerX}
              y1={centerY}
              x2={centerX + arrow.dx}
              y2={centerY + arrow.dy}
              stroke={stroke}
              strokeWidth={2}
            />
            <text
              x={centerX + 6}
              y={centerY - 6}
              fill={stroke}
              fontSize="10"
              fontFamily="monospace"
            >
              {candidate.destinationZ > candidate.sourceZ ? `+${candidate.destinationZ - candidate.sourceZ}` : candidate.destinationZ - candidate.sourceZ}
            </text>
          </g>
        );
      })}

      {validationIssues.map((issue, index) => {
        const x = (issue.tileX * TILE_SIZE) - camera.x;
        const y = (issue.tileY * TILE_SIZE) - camera.y;
        return (
          <g key={`issue-${issue.code}-${issue.tileX}-${issue.tileY}-${issue.tileZ}-${index}`}>
            <rect
              x={x + 1}
              y={y + 1}
              width={TILE_SIZE - 2}
              height={TILE_SIZE - 2}
              fill="none"
              stroke="#ef4444"
              strokeWidth={2}
            />
            <text
              x={x + 4}
              y={y + 12}
              fill="#fecaca"
              fontSize="9"
              fontFamily="monospace"
            >
              {issue.code}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
