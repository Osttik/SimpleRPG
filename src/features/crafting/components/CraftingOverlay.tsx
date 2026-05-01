import { CoreOverlay } from '@/components/overlay';
import { useAppTranslation } from '@/i18n';
import { CraftingActionPanels } from './CraftingActionPanels';
import {
  CraftingStationPanel,
  MaterialInsertPanel,
  MoltenPoolPanel,
  StationSlotsPanel,
  WorkpiecePreviewPanel,
} from './CraftingStationPanels';
import { useCraftingStationController } from '../controllers/useCraftingStationController';

export function CraftingOverlay() {
  const { t } = useAppTranslation();
  const controller = useCraftingStationController();
  const {
    isOpen,
    station,
    inventory,
    insertSlotOptions,
    previewItem,
    previewWorkpiece,
    actionState,
    form,
    formActions,
    setOverlayVisible,
    refreshStation,
    refreshCraftingInventory,
    insertSelectedItem,
    removeStationItem,
    startHeating,
    collectOutput,
    castWorkpiece,
    bendWorkpiece,
    forgeWorkpiece,
    chipWorkpiece,
    sharpenWorkpiece,
    joinWorkpieces,
  } = controller;

  if (!isOpen) {
    return null;
  }

  return (
    <CoreOverlay
      visible={isOpen}
      setVisible={setOverlayVisible}
      title={t('crafting.title')}
      closeLabel={t('common.close')}
      maximized
      content={(
        <div className="flex h-full w-full gap-4 bg-[linear-gradient(180deg,rgba(15,12,10,0.98),rgba(31,22,14,0.98))] p-5 text-amber-50">
          <div className="flex min-w-0 flex-[1.15] flex-col gap-4">
            <CraftingStationPanel
              station={station}
              actionState={actionState}
              onRefresh={refreshStation}
              onRefreshInventory={refreshCraftingInventory}
            />
            <StationSlotsPanel
              slots={station.slots}
              selectedPreviewSlot={form.selectedPreviewSlot}
              onSelectPreviewSlot={formActions.setSelectedPreviewSlot}
              onRemoveSlotItem={removeStationItem}
            />
            {station.stationType === 'smelter' ? <MoltenPoolPanel moltenPool={station.moltenPool} /> : null}
          </div>

          <div className="flex min-w-0 flex-[1] flex-col gap-4">
            <MaterialInsertPanel
              inventory={inventory}
              insertSlotOptions={insertSlotOptions}
              form={form}
              formActions={formActions}
              stationId={station.stationId}
              onInsert={insertSelectedItem}
            />
            <WorkpiecePreviewPanel
              previewItem={previewItem}
              previewWorkpiece={previewWorkpiece}
              station={station}
            />
            <CraftingActionPanels
              station={station}
              form={form}
              formActions={formActions}
              onStartHeating={startHeating}
              onCollectOutput={collectOutput}
              onCast={castWorkpiece}
              onBend={bendWorkpiece}
              onForge={forgeWorkpiece}
              onChip={chipWorkpiece}
              onSharpen={sharpenWorkpiece}
              onJoin={joinWorkpieces}
            />
          </div>
        </div>
      )}
    />
  );
}

export const CraftingUI = CraftingOverlay;
