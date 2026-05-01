export interface RealtimeMessagePort {
  postMessage(message: unknown): void;
}

export type GameplayWorkerMessage =
  | { type: 'request_player_inventory' }
  | { type: 'drop_item'; itemIndex: number; targetId: number }
  | { type: 'equip_item'; itemIndex: number }
  | { type: 'interact'; targetId?: number }
  | { type: 'transfer_item'; targetId: string | number; fromContainer: number; toContainer: number; itemIndex: number }
  | { type: 'request_crafting_inventory' }
  | { type: 'request_station_state'; stationId: number }
  | { type: 'insert_station_item'; stationId: number; itemIndex: number; slotId?: string }
  | { type: 'remove_station_item'; stationId: number; slotId?: string }
  | { type: 'start_heating'; stationId: number }
  | { type: 'collect_smelt_result'; stationId: number; slotId?: string }
  | { type: 'cast_workpiece'; stationId: number; mold: number; width: number; length: number; thicknessRaw: number }
  | { type: 'bend_workpiece'; stationId: number; zone: number; displacement: number }
  | { type: 'forge_workpiece'; stationId: number; zone: number; intensity: number }
  | { type: 'chip_workpiece'; stationId: number; startX: number; startY: number; width: number; height: number }
  | { type: 'sharpen_workpiece'; stationId: number; side: number; amount: number }
  | { type: 'join_workpieces'; stationId: number };

export class GameplayRealtimeAdapter {
  private readonly getPort: () => RealtimeMessagePort | null | undefined;

  constructor(getPort: () => RealtimeMessagePort | null | undefined) {
    this.getPort = getPort;
  }

  post(message: GameplayWorkerMessage) {
    const port = this.getPort();
    if (!port) return false;

    port.postMessage(message);
    return true;
  }

  requestPlayerInventory() {
    return this.post({ type: 'request_player_inventory' });
  }

  dropItem(itemIndex: number, targetId = 0) {
    return this.post({ type: 'drop_item', itemIndex, targetId });
  }

  equipItem(itemIndex: number) {
    return this.post({ type: 'equip_item', itemIndex });
  }

  interactWithTarget(targetId?: string | number | null) {
    const numericTargetId = targetId == null ? undefined : Number(targetId);
    return this.post({
      type: 'interact',
      targetId: Number.isFinite(numericTargetId) ? numericTargetId : undefined,
    });
  }

  transferItem(targetId: string | number, fromContainer: number, toContainer: number, itemIndex: number) {
    return this.post({ type: 'transfer_item', targetId, fromContainer, toContainer, itemIndex });
  }

  requestCraftingInventory() {
    return this.post({ type: 'request_crafting_inventory' });
  }

  requestStationState(stationId: number) {
    return this.post({ type: 'request_station_state', stationId });
  }

  insertStationItem(stationId: number, itemIndex: number, slotId: string) {
    return this.post({ type: 'insert_station_item', stationId, itemIndex, slotId });
  }

  removeStationItem(stationId: number, slotId: string) {
    return this.post({ type: 'remove_station_item', stationId, slotId });
  }

  startHeating(stationId: number) {
    return this.post({ type: 'start_heating', stationId });
  }

  collectSmeltResult(stationId: number, slotId = 'output') {
    return this.post({ type: 'collect_smelt_result', stationId, slotId });
  }

  castWorkpiece(stationId: number, mold: number, width: number, length: number, thicknessRaw: number) {
    return this.post({ type: 'cast_workpiece', stationId, mold, width, length, thicknessRaw });
  }

  bendWorkpiece(stationId: number, zone: number, displacement: number) {
    return this.post({ type: 'bend_workpiece', stationId, zone, displacement });
  }

  forgeWorkpiece(stationId: number, zone: number, intensity: number) {
    return this.post({ type: 'forge_workpiece', stationId, zone, intensity });
  }

  chipWorkpiece(stationId: number, startX: number, startY: number, width: number, height: number) {
    return this.post({ type: 'chip_workpiece', stationId, startX, startY, width, height });
  }

  sharpenWorkpiece(stationId: number, side: number, amount: number) {
    return this.post({ type: 'sharpen_workpiece', stationId, side, amount });
  }

  joinWorkpieces(stationId: number) {
    return this.post({ type: 'join_workpieces', stationId });
  }
}

export const createGameplayRealtimeAdapter = (
  getPort: () => RealtimeMessagePort | null | undefined,
) => new GameplayRealtimeAdapter(getPort);
