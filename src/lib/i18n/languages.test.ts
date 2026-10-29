import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, getLanguage, isLanguageId, LANGUAGES } from './languages';

describe('language registry', () => {
  it('uses stable IDs, native names and explicit formatting locales', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
    expect(Object.keys(LANGUAGES)).toEqual(['en', 'vi']);
    expect(getLanguage('en')).toEqual({ nativeName: 'English', documentLanguage: 'en', locale: 'en-US' });
    expect(getLanguage('vi')).toEqual({ nativeName: 'Tiếng Việt', documentLanguage: 'vi', locale: 'vi-VN' });
    expect(Object.isFrozen(LANGUAGES)).toBe(true);
    for (const language of Object.values(LANGUAGES)) expect(Object.isFrozen(language)).toBe(true);
  });

  it.each(['en', 'vi'])('recognizes the supported language %s', (value) => {
    expect(isLanguageId(value)).toBe(true);
  });

  it.each(['', 'EN', 'vi-VN', 'en-US', 'fr', 'constructor', '__proto__', 'toString', null, undefined, 0, {}])(
    'rejects unknown IDs without guessing or falling back: %j', (value) => {
      expect(isLanguageId(value)).toBe(false);
      expect(() => getLanguage(value)).toThrow('Unsupported language identifier');
    }
  );
});
