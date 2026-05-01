import { Tag } from 'primereact/tag';
import type { SaveSlotMeta } from '@/store/slices/lobby.slice';
import { formatDateTime } from '@/i18n/formatters';
import { useAppTranslation } from '@/i18n';

interface SaveSlotPickerProps {
  saves: SaveSlotMeta[];
  selectedSaveId: string | null;
  onSelect: (saveId: string) => void;
}

const SAVE_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export function SaveSlotPicker({ saves, selectedSaveId, onSelect }: SaveSlotPickerProps) {
  const { t } = useAppTranslation();

  if (saves.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-300/15 bg-black/30 px-4 py-5 text-sm text-amber-100/70">
        {t('lobby.saves.empty')}
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
                  {t('lobby.saves.slotLabel')}
                </div>
              </div>
              <Tag value={t('lobby.saves.version', { version: save.worldVersion })} severity="warning" />
            </div>
            <div className="mt-3 text-sm text-amber-100/75">
              {t('lobby.saves.updated', { date: formatDateTime(save.updatedAt, SAVE_DATE_FORMAT) })}
            </div>
            {save.sourceLobbyName ? (
              <div className="mt-1 text-xs text-amber-100/55">
                {t('lobby.saves.sourceLobby', { name: save.sourceLobbyName })}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
