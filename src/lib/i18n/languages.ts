export const LANGUAGES = Object.freeze({
  en: Object.freeze({ nativeName: 'English', documentLanguage: 'en', locale: 'en-US' }),
  vi: Object.freeze({ nativeName: 'Tiếng Việt', documentLanguage: 'vi', locale: 'vi-VN' })
});

export type LanguageId = keyof typeof LANGUAGES;
export const DEFAULT_LANGUAGE: LanguageId = 'en';

export function isLanguageId(value: unknown): value is LanguageId {
  return typeof value === 'string' && Object.hasOwn(LANGUAGES, value);
}

export function getLanguage(value: unknown): typeof LANGUAGES[LanguageId] {
  if (!isLanguageId(value)) throw new Error('Unsupported language identifier.');
  return LANGUAGES[value];
}
