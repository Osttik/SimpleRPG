import en from './locales/en.json';
import pl from './locales/pl.json';
import uk from './locales/uk.json';
import type { LocaleResource, SupportedLocale } from './types';

export const localeResources = {
  en,
  uk,
  pl,
} satisfies Record<SupportedLocale, LocaleResource>;

export const i18nextResources = {
  en: { translation: en },
  uk: { translation: uk },
  pl: { translation: pl },
} as const;
