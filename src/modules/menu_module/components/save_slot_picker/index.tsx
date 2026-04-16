import { Tag } from 'primereact/tag';
import type { SaveSlotMeta } from '@/store/slices/lobby.slice';

interface SaveSlotPickerProps {
  saves: SaveSlotMeta[];
  selectedSaveId: string | null;
  onSelect: (saveId: string) => void;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function SaveSlotPicker({ saves, selectedSaveId, onSelect }: SaveSlotPickerProps) {
  if (saves.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-300/15 bg-black/30 px-4 py-5 text-sm text-amber-100/70">
        No server-local saves exist yet.
      </div>
    );
  }

  return (
    <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
      {saves.map((save) => {
        const selected = save.saveId === selectedSaveId;
        return (
          <button
            key={save.saveId}
            type="button"
            onClick={() => onSelect(save.saveId)}
            className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
              selected
                ? 'border-amber-300/70 bg-amber-200/10 shadow-[0_0_24px_rgba(245,158,11,0.14)]'
                : 'border-amber-300/15 bg-black/25 hover:border-amber-200/35 hover:bg-amber-200/5'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-amber-50">{save.displayName}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.28em] text-amber-200/45">
                  Save Slot
                </div>
              </div>
              <Tag value={`v${save.worldVersion}`} severity="warning" />
            </div>
            <div className="mt-3 text-sm text-amber-100/75">
              Updated {dateFormatter.format(new Date(save.updatedAt))}
            </div>
            {save.sourceLobbyName ? (
              <div className="mt-1 text-xs text-amber-100/55">Source lobby: {save.sourceLobbyName}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
