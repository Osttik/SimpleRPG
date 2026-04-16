import { RefObject } from "react";
import type { InventoryItemView, InventoryMetaView } from "../ui_module/components/inventory_view";

interface IPlayer {
  x: number;
  y: number;
  z?: number;
  color: number[];
  type: string;
  focusedId: string;
}

export interface CombatPartStateView {
  hp: number;
}

export interface CombatEventView {
  tick: number;
  attackerId: string;
  victimId: string;
  damage: number;
  remainingHp: number;
  eventType: number;
  partId: number;
  routedPartId: number;
  flags: number;
  attackEpoch: number;
  visualTrackId: number;
}

export interface AnimationMetricsView {
  riggedEntitiesRendered: number;
  fullIkSolves: number;
  simplifiedSolves: number;
  instancedQuadsSubmitted: number;
  drawCallsBeforeBatching: number;
  drawCallsAfterBatching: number;
  facingSectorSwitchesPerSecond: number;
  lateCombatEventsDiscarded: number;
  staleCombatEventsDiscarded: number;
  attackVisualResetsDueToEpochMismatch: number;
  shieldDamageEvents: number;
  shieldBreakEvents: number;
  guardCrushEvents: number;
  averageAnimationUpdateMs: number;
}

export interface WorldLayerFootprintSampleView {
  tileX: number;
  tileY: number;
  z: number;
  tileId: number;
  support: boolean;
  fallThrough: boolean;
  blocked: boolean;
}

export interface WorldLayerConnectorCandidateView {
  tileX: number;
  tileY: number;
  sourceZ: number;
  destinationZ: number;
  type: number;
  triggerMinX: number;
  triggerMinY: number;
  triggerMaxX: number;
  triggerMaxY: number;
  allowedEnterDirectionMask: number;
  allowedMovementDirectionMask: number;
  triggerHit: boolean;
  directionAllowed: boolean;
  destinationSupportOk: boolean;
  destinationBlockedOk: boolean;
  selected: boolean;
  accepted: boolean;
  rejectionReason: string;
}

export interface WorldLayerLandingCandidateView {
  candidateZ: number;
  supportOk: boolean;
  blocked: boolean;
  accepted: boolean;
}

export interface WorldLayerDebugView {
  tick: number;
  entityId: number;
  sourceZ: number;
  resolvedZ: number;
  transitioned: boolean;
  fell: boolean;
  phase: string;
  reason: string;
  supportSamples: WorldLayerFootprintSampleView[];
  connectorCandidates: WorldLayerConnectorCandidateView[];
  landingCandidates: WorldLayerLandingCandidateView[];
}

export interface WorldLayerValidationIssueView {
  tileX: number;
  tileY: number;
  tileZ: number;
  code: string;
  message: string;
}

export interface CraftingStatSnapshotView {
  valid?: boolean;
  swingEfficiency?: number;
  thrustEfficiency?: number;
  diggingEfficiency?: number;
  cuttingEffectiveness?: number;
  piercingEffectiveness?: number;
  bluntEffectiveness?: number;
  durability?: number;
  breakRisk?: number;
}

export interface CraftingStationSlotView {
  slotId: string;
  label: string;
  role: string;
  item: InventoryItemView | null;
}

export interface CraftingMoltenPoolView {
  active?: boolean;
  materialId?: string;
  amountUnits?: number;
  temperatureRaw?: number;
  quality?: number;
  sourceCount?: number;
}

interface IGameState {
  canvasRef: RefObject<HTMLCanvasElement | null> | null;
  myId: string | null;
  players: Record<string, IPlayer>;
  chunks: Map<string, ChunkData>;
  tileRegistry: Record<number, string>;
  ping: number;
  mousePosition: { x: number; y: number };
  /** Current OffscreenCanvas resolution — updated on resize, used for mouse coord conversion */
  canvasWidth: number;
  canvasHeight: number;
  lootingTargetId?: string | null;
  playerInventory: InventoryItemView[];
  chestInventory: InventoryItemView[];
  playerInventoryMeta: InventoryMetaView;
  chestInventoryMeta: InventoryMetaView;
  focusedId?: string | null;
  socketWorker?: Worker | null;
  combatBodies: Record<string, Record<number, CombatPartStateView>>;
  combatEventLog: CombatEventView[];
  animationMetrics?: AnimationMetricsView;
  camera: { x: number; y: number };
  visibleLayers?: { min: number; max: number };
  worldLayerDebug?: WorldLayerDebugView | null;
  worldLayerValidationIssues: WorldLayerValidationIssueView[];
  craftingInventory: InventoryItemView[];
  craftingInventoryMeta: InventoryMetaView;
  craftingStation: {
    stationId: string | null;
    stationType: string | null;
    stationLabel: string | null;
    insertedItems: InventoryItemView[];
    slots: CraftingStationSlotView[];
    moldSlots: number[];
    moltenPool: CraftingMoltenPoolView | null;
    comparisonBefore: CraftingStatSnapshotView | null;
    warnings: string[];
    heatingActive: boolean;
    heatingTicks: number;
    lastMold: number;
    error: string | null;
  };
}

export interface ChunkData {
  raw: Uint16Array;
  visual: Uint8Array;
}

export const gameState: IGameState = {
  canvasRef: null,
  myId: null,
  players: {}, // This will be mutated by RenderWorker / Update Logic
  chunks: new Map(),
  tileRegistry: {},
  ping: 0,
  mousePosition: { x: 0, y: 0 },
  canvasWidth: 300,
  canvasHeight: 150,
  lootingTargetId: null,
  playerInventory: [],
  chestInventory: [],
  playerInventoryMeta: {
    currentVolume: 0,
    maxVolume: 0,
    currentWeight: 0,
  },
  chestInventoryMeta: {
    currentVolume: 0,
    maxVolume: 0,
    currentWeight: 0,
  },
  focusedId: null,
  combatBodies: {},
  combatEventLog: [],
  camera: { x: 0, y: 0 },
  visibleLayers: { min: -3, max: 3 },
  worldLayerDebug: null,
  worldLayerValidationIssues: [],
  craftingInventory: [],
  craftingInventoryMeta: {
    currentVolume: 0,
    maxVolume: 0,
    currentWeight: 0,
  },
  craftingStation: {
    stationId: null,
    stationType: null,
    stationLabel: null,
    insertedItems: [],
    slots: [],
    moldSlots: [],
    moltenPool: null,
    comparisonBefore: null,
    warnings: [],
    heatingActive: false,
    heatingTicks: 0,
    lastMold: 0,
    error: null,
  },
};
