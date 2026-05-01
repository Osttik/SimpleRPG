import { useAppTranslation } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { useInteractionController } from '../controllers/useInteractionController';
import type { InteractionMenuMode } from '../interaction-carousel-view-model';

const MODE_LABEL_KEYS: Record<InteractionMenuMode, TranslationKey> = {
  target: 'interactions.mode.target',
  interaction: 'interactions.mode.interaction',
};

const INTERACTION_LABEL_KEYS: Record<string, TranslationKey> = {
  craft: 'interactions.actions.craft',
  loot: 'interactions.actions.loot',
  pickup: 'interactions.actions.pickup',
  talk: 'interactions.actions.talk',
};

const TARGET_LABEL_KEYS: Record<string, TranslationKey> = {
  anvil: 'interactions.targets.anvil',
  chest: 'interactions.targets.chest',
  grindstone: 'interactions.targets.grindstone',
  smelter: 'interactions.targets.smelter',
  workbench: 'interactions.targets.workbench',
};

function normalizeLabelKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function translateTargetLabel(t: (key: TranslationKey) => string, label: string) {
  const suffixStart = label.indexOf('#');
  const baseLabel = suffixStart >= 0 ? label.slice(0, suffixStart).trim() : label;
  const suffix = suffixStart >= 0 ? ` ${label.slice(suffixStart).trim()}` : '';
  const key = TARGET_LABEL_KEYS[normalizeLabelKey(baseLabel)];

  return key ? `${t(key)}${suffix}` : label;
}

function translateCarouselLabel(
  t: (key: TranslationKey) => string,
  mode: InteractionMenuMode,
  id: string,
  label: string,
) {
  if (mode === 'target') return translateTargetLabel(t, label);

  const key = INTERACTION_LABEL_KEYS[id] ?? INTERACTION_LABEL_KEYS[normalizeLabelKey(label)];

  return key ? t(key) : label;
}

export function InteractionCarousel() {
  const { t } = useAppTranslation();
  const controller = useInteractionController();

  if (!controller.isVisible) return null;

  const activeItem = controller.visibleItems.find((item) => item.type === 'active');
  const activeItemId = activeItem ? `interaction-carousel-${activeItem.option.id}-${activeItem.index}` : undefined;

  return (
    <div
      className="carousel-wrapper"
      role="listbox"
      tabIndex={0}
      aria-label={t(MODE_LABEL_KEYS[controller.mode])}
      aria-activedescendant={activeItemId}
      aria-live="polite"
    >
      <div className="menu-mode-label">{t(MODE_LABEL_KEYS[controller.mode])}</div>
      {controller.visibleItems.map((item, itemIndex) => (
        <button
          key={`${item.option.id}-${itemIndex}`}
          id={`interaction-carousel-${item.option.id}-${item.index}`}
          type="button"
          role="option"
          className={`menu-item ${item.type}`}
          aria-selected={item.type === 'active'}
          onClick={() => controller.selectItem(item.index)}
        >
          {translateCarouselLabel(t, controller.mode, item.option.id, item.option.label)}
        </button>
      ))}
      <div className="menu-hint">{t('interactions.hint')}</div>
    </div>
  );
}

export const InteractionUIModal = InteractionCarousel;
