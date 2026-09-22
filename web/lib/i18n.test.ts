import { describe, expect, it } from 'vitest';

import { defaultLocale, dictionary, locales, localeFrom, translate } from './i18n';

describe('dictionaries', () => {
  it('has the same keys in every locale', () => {
    // `en` is typed as Record<MessageKey, string>, so tsc already refuses a
    // missing key. This catches the other direction: a key present only in en.
    const uk = Object.keys(dictionary('uk')).sort();
    const en = Object.keys(dictionary('en')).sort();
    expect(en).toEqual(uk);
  });

  it('has no empty strings', () => {
    for (const locale of locales) {
      for (const [key, value] of Object.entries(dictionary(locale))) {
        expect(value.trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('keeps the same placeholders in both locales', () => {
    // A translation that drops {login} silently renders a sentence about
    // nobody; one that invents {name} renders the braces to the user.
    const placeholders = (text: string): string[] =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] as string).sort();

    const uk = dictionary('uk');
    const en = dictionary('en');
    for (const key of Object.keys(uk) as Array<keyof typeof uk>) {
      expect(placeholders(en[key]), key).toEqual(placeholders(uk[key]));
    }
  });
});

describe('localeFrom', () => {
  it('defaults to Ukrainian', () => {
    expect(defaultLocale).toBe('uk');
    expect(localeFrom(null)).toBe('uk');
    expect(localeFrom('')).toBe('uk');
    expect(localeFrom('fr-FR,de;q=0.8')).toBe('uk');
  });

  it('takes the first tag it recognises, in header order', () => {
    expect(localeFrom('en-US,en;q=0.9')).toBe('en');
    expect(localeFrom('uk-UA,uk;q=0.9,en;q=0.8')).toBe('uk');
    expect(localeFrom('de,en;q=0.9,uk;q=0.8')).toBe('en');
    expect(localeFrom('de,uk;q=0.9,en;q=0.8')).toBe('uk');
  });
});

describe('translate', () => {
  it('fills placeholders', () => {
    expect(translate('en', 'dashboard.signedInAs', { login: 'regressor' })).toContain('regressor');
    expect(translate('uk', 'dashboard.signedInAs', { login: 'regressor' })).toContain('regressor');
  });

  it('leaves an unknown placeholder visible rather than printing "undefined"', () => {
    expect(translate('en', 'dashboard.signedInAs', {})).toContain('{login}');
  });
});
