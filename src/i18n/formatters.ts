import { i18n } from './runtime';
import { normalizeLocale } from './runtime';
import { DEFAULT_LOCALE, type SupportedLocale } from './types';

function activeLocale(): SupportedLocale {
  return normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LOCALE);
}

export function formatDateTime(value: Date | number | string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(activeLocale(), options).format(new Date(value));
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(activeLocale(), options).format(value);
}
