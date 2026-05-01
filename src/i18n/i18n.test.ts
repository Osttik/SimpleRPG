import { describe, expect, it } from 'vitest';
import { i18n, changeLanguage, LANGUAGE_STORAGE_KEY, normalizeLocale, validateI18nStatements } from '.';
import { localeResources } from './resources';

describe('i18n runtime', () => {
  it('normalizes current and legacy locale codes', () => {
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('UA')).toBe('uk');
    expect(normalizeLocale('PL')).toBe('pl');
    expect(normalizeLocale('fr')).toBe('en');
  });

  it('persists runtime language changes through the stable language key', async () => {
    await changeLanguage('pl');

    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pl');
    expect(i18n.t('menu.actions.play')).toBe('Graj');
  });
});

describe('i18n statement validation', () => {
  it('passes the shipped locale dictionaries', () => {
    expect(validateI18nStatements()).toEqual({ passed: true, errors: [] });
  });

  it('reports missing translated statements', () => {
    const brokenResources = {
      ...localeResources,
      pl: {
        ...localeResources.pl,
        menu: {
          ...localeResources.pl.menu,
          actions: {
            continue: 'Kontynuuj',
            play: 'Graj',
            quit: 'Wyjdź',
            saveGame: 'Zapisz grę',
            saving: 'Zapisywanie...',
          },
        },
      },
    } as unknown as Parameters<typeof validateI18nStatements>[0];

    expect(validateI18nStatements(brokenResources)).toEqual({
      passed: false,
      errors: ['pl is missing menu.actions.exit'],
    });
  });
});
