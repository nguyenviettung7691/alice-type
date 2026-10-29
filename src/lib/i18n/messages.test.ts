import { describe, expect, it } from 'vitest';
import { translate, validateMessageCatalog } from './messages';
import { LANGUAGES, type LanguageId } from './languages';
import { MESSAGE_PARAMETERS } from './message-contract';
import { en } from './ui/en';
import { vi } from './ui/vi';

describe('foundation message catalogs', () => {
  it.each([en, vi])('has exact key/placeholder coverage for the initial message contract', (catalog) => {
    expect(Object.keys(catalog).sort()).toEqual(Object.keys(MESSAGE_PARAMETERS).sort());
    expect(() => validateMessageCatalog(catalog)).not.toThrow();
    for (const value of Object.values(catalog)) expect(value).toBe(value.normalize('NFC'));
  });

  it.each(Object.keys(LANGUAGES) as LanguageId[])('translates stable keys for %s', (language) => {
    const catalog = language === 'en' ? en : vi;
    expect(translate(language, 'header.language')).toBe(catalog['header.language']);
    expect(translate(language, 'practice.finish')).toBe(catalog['practice.finish']);
    expect(translate(language, 'text.unsupportedCharacter', { position: 3, codePoint: '1F600' }))
      .toContain('3 (U+1F600)');
  });

  it('formats numeric parameters in the selected locale without formatting code points', () => {
    expect(translate('en', 'text.unsupportedCharacter', { position: 1200, codePoint: '0301' }))
      .toContain('1,200 (U+0301)');
    expect(translate('vi', 'text.unsupportedCharacter', { position: 1200, codePoint: '0301' }))
      .toContain('1.200 (U+0301)');
  });

  it('returns plain text and does not interpret parameter markup or replacement syntax', () => {
    expect(translate('en', 'text.unsupportedCharacter', { position: 1, codePoint: '<b>$&{position}</b>' }))
      .toBe('Unsupported character at position 1 (U+<b>$&{position}</b>). Use English or Vietnamese text.');
  });

  it('rejects added, missing, empty and malformed catalog messages', () => {
    const { 'header.language': omitted, ...missing } = en;
    expect(omitted).toBe('Language');
    for (const catalog of [
      { ...en, extra: 'unexpected' }, missing,
      { ...en, 'header.language': '' },
      { ...en, 'header.language': '   ' },
      { ...en, 'header.language': '{unexpected}' },
      { ...en, 'text.unsupportedCharacter': 'Position {position}' },
      { ...en, 'text.unsupportedCharacter': '{position} {codePoint} {other}' },
      { ...en, 'text.unsupportedCharacter': '{position} {codePoint} {' }
    ]) {
      expect(() => Reflect.apply(validateMessageCatalog, undefined, [catalog])).toThrow();
    }
  });

  it('rejects unknown runtime languages/keys and invalid parameters rather than showing English', () => {
    const cases: unknown[][] = [
      ['fr', 'header.language'],
      ['vi', 'constructor'],
      ['vi', 'missing.message'],
      ['vi', 'header.language', { unexpected: 'value' }],
      ['vi', 'header.language', undefined],
      ['vi', 'header.language', ''],
      ['vi', 'text.unsupportedCharacter'],
      ['vi', 'text.unsupportedCharacter', null],
      ['vi', 'text.unsupportedCharacter', ['3', '1F600']],
      ['vi', 'text.unsupportedCharacter', { position: '3', codePoint: '1F600' }],
      ['vi', 'text.unsupportedCharacter', { position: NaN, codePoint: '1F600' }],
      ['vi', 'text.unsupportedCharacter', { position: Infinity, codePoint: '1F600' }],
      ['vi', 'text.unsupportedCharacter', { position: 3, codePoint: 123 }],
      ['vi', 'text.unsupportedCharacter', { position: 3, codePoint: '1F600', extra: 'value' }],
      ['vi', 'text.unsupportedCharacter', { position: 3, codePoint: '1F600' }, { ignored: 'value' }],
      ['vi', 'text.unsupportedCharacter', Object.create({ position: 3, codePoint: '1F600' })]
    ];
    for (const args of cases) expect(() => Reflect.apply(translate, undefined, args)).toThrow();
  });
});
