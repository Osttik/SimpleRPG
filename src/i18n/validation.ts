import { localeResources } from './resources';
import { SUPPORTED_LOCALES, type LocaleResource, type SupportedLocale, type TranslationKey } from './types';

type LocaleResourceMap = Record<SupportedLocale, LocaleResource>;

export interface StatementValidationResult {
  passed: boolean;
  errors: string[];
}

export interface EpicStatementValidationRule {
  id: string;
  descriptionKey: TranslationKey;
  validate: () => StatementValidationResult;
}

function flattenStatements(value: unknown, prefix = ''): Map<string, string> {
  if (typeof value === 'string') {
    return new Map([[prefix, value]]);
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return new Map();
  }

  const entries = new Map<string, string>();
  for (const [key, child] of Object.entries(value)) {
    const childPrefix = prefix ? `${prefix}.${key}` : key;
    for (const [childKey, statement] of flattenStatements(child, childPrefix)) {
      entries.set(childKey, statement);
    }
  }
  return entries;
}

function validateDictionaryShape(resources: LocaleResourceMap): StatementValidationResult {
  const sourceKeys = new Set(flattenStatements(resources.en).keys());
  const errors: string[] = [];

  for (const locale of SUPPORTED_LOCALES) {
    const localeKeys = new Set(flattenStatements(resources[locale]).keys());

    for (const sourceKey of sourceKeys) {
      if (!localeKeys.has(sourceKey)) errors.push(`${locale} is missing ${sourceKey}`);
    }

    for (const localeKey of localeKeys) {
      if (!sourceKeys.has(localeKey)) errors.push(`${locale} has unexpected ${localeKey}`);
    }
  }

  return { passed: errors.length === 0, errors };
}

function validateNonEmptyStatements(resources: LocaleResourceMap): StatementValidationResult {
  const errors: string[] = [];

  for (const locale of SUPPORTED_LOCALES) {
    for (const [key, statement] of flattenStatements(resources[locale])) {
      if (statement.trim().length === 0) errors.push(`${locale}.${key} is empty`);
    }
  }

  return { passed: errors.length === 0, errors };
}

function validateSupportedLocales(resources: LocaleResourceMap): StatementValidationResult {
  const supported = new Set<string>(SUPPORTED_LOCALES);
  const errors = Object.keys(resources)
    .filter((locale) => !supported.has(locale))
    .map((locale) => `${locale} is not supported`);

  return { passed: errors.length === 0, errors };
}

export function buildEpicStatementValidationRules(resources: LocaleResourceMap = localeResources): EpicStatementValidationRule[] {
  return [
    {
      id: 'i18n.supported-locales',
      descriptionKey: 'validation.i18nStatements.supportedLocales',
      validate: () => validateSupportedLocales(resources),
    },
    {
      id: 'i18n.dictionary-shape',
      descriptionKey: 'validation.i18nStatements.dictionaryShape',
      validate: () => validateDictionaryShape(resources),
    },
    {
      id: 'i18n.non-empty-statements',
      descriptionKey: 'validation.i18nStatements.nonEmptyStatements',
      validate: () => validateNonEmptyStatements(resources),
    },
  ];
}

export function validateI18nStatements(resources: LocaleResourceMap = localeResources): StatementValidationResult {
  const errors = buildEpicStatementValidationRules(resources).flatMap((rule) => rule.validate().errors);
  return { passed: errors.length === 0, errors };
}
