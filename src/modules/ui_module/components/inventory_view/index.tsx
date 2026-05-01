import { DataTable, type DataTableRowClickEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';
import type { InventoryItem, InventoryMeta } from '@/api/realtime/dtos';

export type InventoryItemView = InventoryItem;
export type InventoryMetaView = InventoryMeta;

export interface InventoryViewLabels {
  empty: string;
  name: string;
  price: string;
  quantity: string;
  weight: string;
  volume: string;
  slot: string;
}

interface InventoryViewProps {
  title: string;
  items: InventoryItemView[];
  labels?: InventoryViewLabels;
  selectedItemId: string | null;
  onSelectItem: (item: InventoryItemView | null) => void;
  onDoubleClickItem?: (item: InventoryItemView) => void;
  canExchangeItem?: (item: InventoryItemView) => boolean;
  allowBlockedDoubleClick?: boolean;
  showEquipSlot?: boolean;
}

export const InventoryView = ({
  title,
  items,
  labels = {
    empty: 'No items',
    name: 'Name',
    price: 'Price',
    quantity: 'Qty',
    weight: 'Weight',
    volume: 'Volume',
    slot: 'Slot',
  },
  selectedItemId,
  onSelectItem,
  onDoubleClickItem,
  canExchangeItem,
  allowBlockedDoubleClick = false,
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
    if (!allowBlockedDoubleClick && canExchangeItem && !canExchangeItem(item)) return;
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
        emptyMessage={labels.empty}
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
        <Column field="name" header={labels.name} sortable />
        {showEquipSlot ? <Column field="equipSlot" header={labels.slot} sortable /> : null}
        <Column field="price" header={labels.price} sortable />
        <Column field="quantity" header={labels.quantity} sortable />
        <Column field="weight" header={labels.weight} sortable body={(row: InventoryItemView) => row.weight.toFixed(2)} />
        <Column field="volume" header={labels.volume} sortable body={(row: InventoryItemView) => row.volume.toFixed(2)} />
      </DataTable>
    </div>
  );
};
