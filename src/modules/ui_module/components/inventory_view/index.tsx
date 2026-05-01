import { DataTable, type DataTableRowClickEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';
import type { InventoryItem, InventoryMeta } from '@/api/realtime/dtos';

export type InventoryItemView = InventoryItem;
export type InventoryMetaView = InventoryMeta;

interface InventoryViewProps {
  title: string;
  items: InventoryItemView[];
  selectedItemId: string | null;
  onSelectItem: (item: InventoryItemView | null) => void;
  onDoubleClickItem?: (item: InventoryItemView) => void;
  canExchangeItem?: (item: InventoryItemView) => boolean;
  showEquipSlot?: boolean;
}

export const InventoryView = ({
  title,
  items,
  selectedItemId,
  onSelectItem,
  onDoubleClickItem,
  canExchangeItem,
  showEquipSlot,
}: InventoryViewProps) => {
  const selectedItem = selectedItemId ? items.find(i => i.id === selectedItemId) ?? null : null;

  const rowClassName = (data: InventoryItemView) => {
    const classes: Record<string, boolean> = {};
    if (data.equipped) {
      classes['inventory-row-equipped'] = true;
    }
    if (canExchangeItem && !canExchangeItem(data)) {
      classes['opacity-40'] = true;
      classes['grayscale'] = true;
    }
    return classes;
  };

  const handleRowDoubleClick = (e: DataTableRowClickEvent) => {
    if (!onDoubleClickItem) return;
    const item = e.data as InventoryItemView;
    if (canExchangeItem && !canExchangeItem(item)) return;
    onDoubleClickItem(item);
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-600 bg-[#111827E6] p-3 shadow-2xl backdrop-blur-md">
      <h3 className="mb-3 text-xl font-bold tracking-wide text-white">{title}</h3>
      <DataTable
        className="inventory-table flex-1"
        value={items}
        dataKey="id"
        size="small"
        emptyMessage="No items"
        stripedRows
        rowHover={false}
        selectionMode="single"
        selection={selectedItem}
        onSelectionChange={(e) => onSelectItem((e.value as InventoryItemView | null) ?? null)}
        onRowDoubleClick={handleRowDoubleClick}
        rowClassName={rowClassName}
        scrollable
        scrollHeight="flex"
      >
        <Column field="name" header="Name" sortable />
        {showEquipSlot ? <Column field="equipSlot" header="Slot" sortable /> : null}
        <Column field="price" header="Price" sortable />
        <Column field="quantity" header="Qty" sortable />
        <Column field="weight" header="Weight" sortable body={(row: InventoryItemView) => row.weight.toFixed(2)} />
        <Column field="volume" header="Volume" sortable body={(row: InventoryItemView) => row.volume.toFixed(2)} />
      </DataTable>
    </div>
  );
};
