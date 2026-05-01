import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, LANGUAGE_STORAGE_KEY, SUPPORTED_LOCALES, isSupportedLocale, type SupportedLocale } from './types';
import { i18nextResources } from './resources';

const LEGACY_LANGUAGE_STORAGE_KEY = 'lang';
const LEGACY_LANGUAGE_CODES: Record<string, SupportedLocale> = {
  EN: 'en',
  PL: 'pl',
  UA: 'uk',
};

function storage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export function normalizeLocale(value: string | null | undefined): SupportedLocale {
  if (!value) return DEFAULT_LOCALE;

  const directValue = value.toLowerCase();
  if (isSupportedLocale(directValue)) return directValue;

  return LEGACY_LANGUAGE_CODES[value.toUpperCase()] ?? DEFAULT_LOCALE;
}

export function getInitialLocale(): SupportedLocale {
  const persistentStorage = storage();
  const savedLocale = persistentStorage?.getItem(LANGUAGE_STORAGE_KEY);
  if (isSupportedLocale(savedLocale)) return savedLocale;

  const legacyLocale = normalizeLocale(persistentStorage?.getItem(LEGACY_LANGUAGE_STORAGE_KEY));
  if (legacyLocale !== DEFAULT_LOCALE) return legacyLocale;

  const browserLocale = typeof navigator === 'undefined' ? undefined : navigator.language.split('-')[0];
  return normalizeLocale(browserLocale);
}

export async function changeLanguage(locale: SupportedLocale): Promise<void> {
  storage()?.setItem(LANGUAGE_STORAGE_KEY, locale);
  await i18n.changeLanguage(locale);
}

if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      resources: i18nextResources,
      lng: getInitialLocale(),
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES,
      interpolation: {
        escapeValue: false,
      },
    });
}

export { i18n };
