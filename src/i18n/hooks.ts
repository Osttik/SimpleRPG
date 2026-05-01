import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, normalizeLocale } from './runtime';
import type { TranslationKey } from './types';

type TranslationValues = Record<string, string | number | boolean | Date | null | undefined>;

export function useAppTranslation() {
  const { i18n, t: translate } = useTranslation();

  const t = useCallback(
    (key: TranslationKey, values?: TranslationValues) => translate(key, values),
    [translate],
  );

  return {
    t,
    language: normalizeLocale(i18n.resolvedLanguage ?? i18n.language),
    changeLanguage,
  };
}
