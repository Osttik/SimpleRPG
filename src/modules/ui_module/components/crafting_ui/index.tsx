import { createGameplayRealtimeAdapter, type GameplayWorkerMessage } from '@/api/realtime/gameplay-worker-adapter';
import { CoreOverlay } from '@/components/overlay';
import { gameState, type CraftingStatSnapshotView } from '@/modules/game_module/game_state';
import { useGameStateSubscription } from '@/modules/game_module/game_state_subscriptions';
import { selectIsCraftingOpen, useUIActions } from '@/store/slices/ui.slice';
import { useEffect, useMemo, useState } from 'react';
import type { InventoryItemView } from '../inventory_view';

type WorkpieceView = {
  stage?: string;
  materialId?: string;
  profileWidth?: number;
  profileHeight?: number;
  profileMask?: number[];
  temperatureRaw?: number;
  quality?: number;
  invalidReason?: string;
  swingEfficiency?: number;
  thrustEfficiency?: number;
  diggingEfficiency?: number;
  cuttingEffectiveness?: number;
  piercingEffectiveness?: number;
  bluntEffectiveness?: number;
  durability?: number;
  breakRisk?: number;
};

const MOLD_OPTIONS = [
  { value: 0, label: 'Blade Blank' },
  { value: 1, label: 'Hammer Blank' },
  { value: 2, label: 'Shaft Blank' },
  { value: 3, label: 'Shovel Blank' },
  { value: 4, label: 'Spike Blank' },
];

const BEND_ZONES = [
  { value: 0, label: 'Center' },
  { value: 1, label: 'Top' },
  { value: 2, label: 'Bottom' },
];

const SHARPEN_SIDES = [
  { value: 0, label: 'Top' },
  { value: 1, label: 'Bottom' },
  { value: 2, label: 'Left' },
  { value: 3, label: 'Right' },
];
const gameplayRealtime = createGameplayRealtimeAdapter(() => gameState.socketWorker);

function getWorkpiece(item: InventoryItemView | null): WorkpieceView | null {
  if (!item?.workpiece || typeof item.workpiece !== 'object') {
    return null;
  }
  return item.workpiece as WorkpieceView;
}

function formatTemperature(raw?: number) {
  return Math.round(raw ?? 0);
}

function statValue(workpiece: WorkpieceView | null, key: keyof NonNullable<WorkpieceView>) {
  const value = workpiece?.[key];
  return typeof value === 'number' ? value : 0;
}

export const CraftingUI = () => {
  const isCraftingOpen = selectIsCraftingOpen();
  const { openCrafting } = useUIActions();
  const craftingVersion = useGameStateSubscription('crafting');
  const [selectedInventoryIndex, setSelectedInventoryIndex] = useState(0);
  const [selectedInsertSlot, setSelectedInsertSlot] = useState('');
  const [selectedPreviewSlot, setSelectedPreviewSlot] = useState('');
  const [mold, setMold] = useState(0);
  const [moldWidth, setMoldWidth] = useState(4);
  const [moldLength, setMoldLength] = useState(10);
  const [thicknessUnits, setThicknessUnits] = useState(3);
  const [bendZone, setBendZone] = useState(0);
  const [bendDisplacement, setBendDisplacement] = useState(1);
  const [forgeIntensity, setForgeIntensity] = useState(2);
  const [chipX, setChipX] = useState(0);
  const [chipY, setChipY] = useState(0);
  const [chipWidth, setChipWidth] = useState(1);
  const [chipHeight, setChipHeight] = useState(1);
  const [sharpenSide, setSharpenSide] = useState(0);
  const [sharpenAmount, setSharpenAmount] = useState(8);
  const station = gameState.craftingStation;

  useEffect(() => {
    if (selectedInventoryIndex >= gameState.craftingInventory.length) {
      setSelectedInventoryIndex(0);
    }
  }, [craftingVersion, selectedInventoryIndex]);

  useEffect(() => {
    const firstOpenSlot = station.slots.find((slot) => slot.role !== 'output' && !slot.item)?.slotId ?? station.slots[0]?.slotId ?? '';
    if (!selectedInsertSlot || !station.slots.some((slot) => slot.slotId === selectedInsertSlot)) {
      setSelectedInsertSlot(firstOpenSlot);
    }

    const firstPreviewSlot = station.slots.find((slot) => slot.item)?.slotId ?? station.slots[0]?.slotId ?? '';
    if (!selectedPreviewSlot || !station.slots.some((slot) => slot.slotId === selectedPreviewSlot)) {
      setSelectedPreviewSlot(firstPreviewSlot);
    }
  }, [selectedInsertSlot, selectedPreviewSlot, station.slots]);

  const previewSlot = useMemo(
    () => station.slots.find((slot) => slot.slotId === selectedPreviewSlot) ?? station.slots.find((slot) => slot.item) ?? null,
    [selectedPreviewSlot, station.slots],
  );
  const previewItem = previewSlot?.item ?? null;
  const previewWorkpiece = getWorkpiece(previewItem);

  const previewCells = useMemo(() => {
    if (!previewWorkpiece?.profileWidth || !previewWorkpiece?.profileHeight || !previewWorkpiece.profileMask) {
      return [];
    }
    return previewWorkpiece.profileMask.map((cell, index) => (
      <div
        key={index}
        className={`h-4 w-4 rounded-[2px] border border-black/20 ${cell !== 0 ? 'bg-amber-300' : 'bg-stone-900/40'}`}
      />
    ));
  }, [previewWorkpiece]);

  const post = (message: GameplayWorkerMessage) => {
    gameplayRealtime.post(message);
  };

  const refreshStation = () => {
    if (!station.stationId) return;
    post({ type: 'request_station_state', stationId: Number(station.stationId) });
  };

  useEffect(() => {
    if (!isCraftingOpen || !station.stationId || !station.heatingActive) {
      return;
    }

    const interval = window.setInterval(refreshStation, 500);
    return () => window.clearInterval(interval);
  }, [isCraftingOpen, station.stationId, station.heatingActive]);

  const statRows: Array<{ label: string; key: keyof CraftingStatSnapshotView & keyof WorkpieceView }> = [
    { label: 'Swing', key: 'swingEfficiency' },
    { label: 'Thrust', key: 'thrustEfficiency' },
    { label: 'Digging', key: 'diggingEfficiency' },
    { label: 'Cutting', key: 'cuttingEffectiveness' },
    { label: 'Piercing', key: 'piercingEffectiveness' },
    { label: 'Blunt', key: 'bluntEffectiveness' },
    { label: 'Durability', key: 'durability' },
    { label: 'Break Risk', key: 'breakRisk' },
  ];

  const insertSlotOptions = station.slots.filter((slot) => slot.role !== 'output');

  if (!isCraftingOpen) {
    return null;
  }

  return (
    <CoreOverlay
      visible={isCraftingOpen}
      setVisible={openCrafting}
      maximized
      content={(
        <div className="flex h-full w-full gap-4 bg-[linear-gradient(180deg,rgba(15,12,10,0.98),rgba(31,22,14,0.98))] p-5 text-amber-50">
          <div className="flex min-w-0 flex-[1.15] flex-col gap-4">
            <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">Station</div>
              <div className="mt-2 text-3xl font-semibold text-amber-50">{station.stationType ?? 'Station'}</div>
              <div className="mt-1 text-sm text-amber-100/65">{station.stationLabel ?? 'Interact with a nearby station.'}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={refreshStation}>Refresh</button>
                <button
                  className="rounded-lg bg-black/45 px-3 py-2 text-sm text-amber-50"
                  onClick={() => {
                    post({ type: 'request_crafting_inventory' });
                    refreshStation();
                  }}
                >
                  Refresh Inventory
                </button>
              </div>
              {station.error ? <div className="mt-3 rounded-lg border border-red-500/35 bg-red-950/45 px-3 py-2 text-sm text-red-100">{station.error}</div> : null}
              {station.warnings.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {station.warnings.map((warning, index) => (
                    <div key={`${warning}-${index}`} className="rounded-lg border border-amber-500/30 bg-amber-950/35 px-3 py-2 text-sm text-amber-100">{warning}</div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">Station Slots</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {station.slots.map((slot) => (
                  <div
                    key={slot.slotId}
                    className={`rounded-xl border px-3 py-3 text-left ${selectedPreviewSlot === slot.slotId ? 'border-amber-300 bg-amber-200/10' : 'border-amber-300/15 bg-stone-950/60'}`}
                    onClick={() => setSelectedPreviewSlot(slot.slotId)}
                  >
                    <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/45">{slot.label}</div>
                    <div className="mt-1 text-sm font-semibold text-amber-50">{slot.item?.name ?? 'Empty'}</div>
                    <div className="mt-1 text-xs text-amber-100/55">{slot.role}</div>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="rounded-md bg-black/50 px-2 py-1 text-xs text-amber-50"
                        onClick={(event) => {
                          event.stopPropagation();
                          post({ type: 'remove_station_item', stationId: Number(station.stationId), slotId: slot.slotId });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {station.stationType === 'smelter' ? (
              <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">Molten Pool</div>
                <div className="mt-2 grid gap-2 text-sm text-amber-100/70 sm:grid-cols-2">
                  <div>Active: {station.moltenPool?.active ? 'yes' : 'no'}</div>
                  <div>Material: {station.moltenPool?.materialId ?? 'none'}</div>
                  <div>Units: {station.moltenPool?.amountUnits ?? 0}</div>
                  <div>Heat: {formatTemperature(station.moltenPool?.temperatureRaw)}</div>
                  <div>Quality: {station.moltenPool?.quality ?? 0}</div>
                  <div>Sources: {station.moltenPool?.sourceCount ?? 0}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-[1] flex-col gap-4">
            <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">Backpack Materials</div>
              <select
                className="mt-3 w-full rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm text-amber-50"
                value={selectedInventoryIndex}
                onChange={(event) => setSelectedInventoryIndex(Number(event.target.value))}
              >
                {gameState.craftingInventory.map((item, index) => (
                  <option key={item.id} value={index}>{item.name}</option>
                ))}
              </select>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <select
                  className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm"
                  value={selectedInsertSlot}
                  onChange={(event) => setSelectedInsertSlot(event.target.value)}
                >
                  {insertSlotOptions.map((slot) => (
                    <option key={slot.slotId} value={slot.slotId}>{slot.label}</option>
                  ))}
                </select>
                <button
                  className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950"
                  disabled={!station.stationId || !selectedInsertSlot}
                  onClick={() => post({ type: 'insert_station_item', stationId: Number(station.stationId), itemIndex: selectedInventoryIndex, slotId: selectedInsertSlot })}
                >
                  Insert
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">Preview</div>
              <div className="mt-2 text-lg font-semibold text-amber-50">{previewItem?.name ?? 'No item selected'}</div>
              <div className="mt-2 text-sm text-amber-100/70">
                Heat: {formatTemperature(previewWorkpiece?.temperatureRaw)} | Quality: {previewWorkpiece?.quality ?? 0}
              </div>
              <div className="mt-1 text-sm text-amber-100/70">
                Stage: {previewWorkpiece?.stage ?? 'none'} | Invalid: {previewWorkpiece?.invalidReason ?? 'none'}
              </div>
              <div
                className="mt-4 grid gap-[2px] rounded-xl border border-amber-300/10 bg-stone-950/70 p-3"
                style={{
                  gridTemplateColumns: `repeat(${previewWorkpiece?.profileWidth ?? 1}, minmax(0, 1fr))`,
                  width: 'fit-content',
                }}
              >
                {previewCells.length > 0 ? previewCells : <div className="text-sm text-amber-100/55">No profile loaded.</div>}
              </div>
              <div className="mt-4 grid gap-2 text-sm text-amber-100/70 sm:grid-cols-2">
                {statRows.map((row) => {
                  const currentValue = statValue(previewWorkpiece, row.key);
                  const previousValue = station.comparisonBefore?.valid ? Number(station.comparisonBefore?.[row.key] ?? 0) : null;
                  const delta = previousValue == null ? null : currentValue - previousValue;
                  return (
                    <div key={row.key}>
                      {row.label}: {currentValue}
                      {delta != null ? (
                        <span className={`ml-2 text-xs ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-red-300' : 'text-amber-100/50'}`}>
                          {delta >= 0 ? `+${delta}` : delta}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {station.stationType === 'smelter' ? (
              <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">Smelter Actions</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={() => post({ type: 'start_heating', stationId: Number(station.stationId) })}>Start Heating</button>
                  <button className="rounded-lg bg-black/45 px-3 py-2 text-sm text-amber-50" onClick={() => post({ type: 'collect_smelt_result', stationId: Number(station.stationId), slotId: 'output' })}>Collect Output</button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <select className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" value={mold} onChange={(event) => setMold(Number(event.target.value))}>
                    {MOLD_OPTIONS.filter((option) => station.moldSlots.length === 0 || station.moldSlots.includes(option.value)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <input className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" type="number" value={moldWidth} min={2} onChange={(event) => setMoldWidth(Number(event.target.value))} />
                  <input className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" type="number" value={moldLength} min={2} onChange={(event) => setMoldLength(Number(event.target.value))} />
                </div>
                <div className="mt-2 flex gap-2">
                  <input className="w-full rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" type="number" value={thicknessUnits} min={1} onChange={(event) => setThicknessUnits(Number(event.target.value))} />
                  <button
                    className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950"
                    onClick={() => post({ type: 'cast_workpiece', stationId: Number(station.stationId), mold, width: moldWidth, length: moldLength, thicknessRaw: thicknessUnits * 65536 })}
                  >
                    Cast
                  </button>
                </div>
              </div>
            ) : null}

            {station.stationType === 'anvil' ? (
              <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">Anvil Actions</div>
                <div className="mt-3 space-y-4">
                  <div>
                    <div className="mb-2 text-sm text-amber-100/70">Bend</div>
                    <div className="flex gap-2">
                      <select className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" value={bendZone} onChange={(event) => setBendZone(Number(event.target.value))}>
                        {BEND_ZONES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <input className="w-full rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" type="number" value={bendDisplacement} onChange={(event) => setBendDisplacement(Number(event.target.value))} />
                      <button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={() => post({ type: 'bend_workpiece', stationId: Number(station.stationId), zone: bendZone, displacement: bendDisplacement })}>Apply</button>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-sm text-amber-100/70">Forge / Hammer</div>
                    <div className="flex gap-2">
                      <select className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" value={bendZone} onChange={(event) => setBendZone(Number(event.target.value))}>
                        {BEND_ZONES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <input className="w-full rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" type="number" min={1} value={forgeIntensity} onChange={(event) => setForgeIntensity(Number(event.target.value))} />
                      <button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={() => post({ type: 'forge_workpiece', stationId: Number(station.stationId), zone: bendZone, intensity: forgeIntensity })}>Forge</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {station.stationType === 'workbench' ? (
              <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">Workbench Actions</div>
                <div className="mt-3 space-y-4">
                  <div>
                    <div className="mb-2 text-sm text-amber-100/70">Chip / Chisel</div>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <input className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" type="number" value={chipX} onChange={(event) => setChipX(Number(event.target.value))} />
                      <input className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" type="number" value={chipY} onChange={(event) => setChipY(Number(event.target.value))} />
                      <input className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" type="number" value={chipWidth} min={1} onChange={(event) => setChipWidth(Number(event.target.value))} />
                      <input className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" type="number" value={chipHeight} min={1} onChange={(event) => setChipHeight(Number(event.target.value))} />
                    </div>
                    <button className="mt-2 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={() => post({ type: 'chip_workpiece', stationId: Number(station.stationId), startX: chipX, startY: chipY, width: chipWidth, height: chipHeight })}>Chip Area</button>
                  </div>
                  <div>
                    <div className="mb-2 text-sm text-amber-100/70">Join / Assemble</div>
                    <button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={() => post({ type: 'join_workpieces', stationId: Number(station.stationId) })}>Assemble Output</button>
                  </div>
                </div>
              </div>
            ) : null}

            {station.stationType === 'grindstone' ? (
              <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">Grindstone Actions</div>
                <div className="mt-3 flex gap-2">
                  <select className="rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" value={sharpenSide} onChange={(event) => setSharpenSide(Number(event.target.value))}>
                    {SHARPEN_SIDES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <input className="w-full rounded-lg border border-amber-300/20 bg-stone-900/80 px-3 py-2 text-sm" type="number" min={1} value={sharpenAmount} onChange={(event) => setSharpenAmount(Number(event.target.value))} />
                  <button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950" onClick={() => post({ type: 'sharpen_workpiece', stationId: Number(station.stationId), side: sharpenSide, amount: sharpenAmount })}>Sharpen</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    />
  );
};
