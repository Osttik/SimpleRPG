import en from './locales/en.json';

type DotPrefix<Prefix extends string, Key extends string> = `${Prefix}.${Key}`;

type LeafPaths<TValue, Prefix extends string = ''> = {
  [Key in keyof TValue & string]: TValue[Key] extends string
    ? Prefix extends ''
      ? Key
      : DotPrefix<Prefix, Key>
    : TValue[Key] extends Record<string, unknown>
      ? LeafPaths<TValue[Key], Prefix extends '' ? Key : DotPrefix<Prefix, Key>>
      : never;
}[keyof TValue & string];

export const DEFAULT_LOCALE = 'en';
export const LANGUAGE_STORAGE_KEY = 'ui.language';
export const SUPPORTED_LOCALES = ['en', 'uk', 'pl'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LocaleResource = typeof en;
export type TranslationKey = LeafPaths<LocaleResource>;

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}
