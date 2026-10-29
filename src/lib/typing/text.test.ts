import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasGraphemeSupport, PracticeTextError, preparePracticeText, segmentGraphemes
} from './text';

afterEach(() => vi.unstubAllGlobals());

describe('shared practice text profile', () => {
  it('retains the complete printable ASCII range', () => {
    const ascii = Array.from({ length: 95 }, (_, index) => String.fromCharCode(index + 32)).join('');
    expect(preparePracticeText(ascii)).toEqual({ text: ascii, graphemes: Array.from(ascii) });
  });

  it.each([
    'àáảãạăằắẳẵặâầấẩẫậ',
    'èéẻẽẹêềếểễệ',
    'ìíỉĩị',
    'òóỏõọôồốổỗộơờớởỡợ',
    'ùúủũụưừứửữự',
    'ỳýỷỹỵđ'
  ])('supports every Vietnamese vowel/tone and its uppercase form: %s', (letters) => {
    for (const text of [letters, letters.toUpperCase()]) {
      expect(preparePracticeText(text).text).toBe(text);
      expect(preparePracticeText(text.normalize('NFD')).text).toBe(text);
      expect(preparePracticeText(text).graphemes).toHaveLength(Array.from(text).length);
    }
  });

  it('normalizes canonical equivalents without stripping accents, changing case or collapsing spaces', () => {
    expect(preparePracticeText('Tie\u0302\u0301ng Vie\u0323\u0302t')).toEqual({
      text: 'Tiếng Việt', graphemes: ['T', 'i', 'ế', 'n', 'g', ' ', 'V', 'i', 'ệ', 't']
    });
    expect(preparePracticeText('  Đất  ')).toEqual({
      text: '  Đất  ', graphemes: [' ', ' ', 'Đ', 'ấ', 't', ' ', ' ']
    });
  });

  it('segments arbitrary draft text before practice-profile validation', () => {
    expect(segmentGraphemes('a\r\nb')).toEqual(['a', '\r\n', 'b']);
    expect(segmentGraphemes('“a”\r\n😀')).toEqual(['“', 'a', '”', '\r\n', '😀']);
    expect(segmentGraphemes('a'.repeat(10_000))).toHaveLength(10_000);
    expect(segmentGraphemes('ấ'.normalize('NFD').repeat(10_000))).toHaveLength(10_000);
  });

  it('allows empty buffers but not empty practice targets', () => {
    expect(preparePracticeText('', true)).toEqual({ text: '', graphemes: [] });
    expect(() => preparePracticeText('')).toThrow(PracticeTextError);
    try { preparePracticeText(''); } catch (error) {
      expect(error).toMatchObject({ failure: { code: 'empty-text' } });
    }
  });

  it.each([
    ['a\nb', 2, '000A'], ['a\tb', 2, '0009'], ['\x00', 1, '0000'], ['\x7f', 1, '007F'],
    ['😀', 1, '1F600'], ['\ud800', 1, 'D800'], ['\udc00', 1, 'DC00'],
    ['\u0301', 1, '0301'], ['x\u0301', 1, '0301'], ['\u200b', 1, '200B'],
    ['a\u00a0b', 2, '00A0'], ['ç', 1, '00E7'], ['漢', 1, '6F22']
  ])('rejects unsupported text %j with structured position/code point only', (text, position, codePoint) => {
    try {
      preparePracticeText(String(text));
      expect.unreachable('Unsupported text must throw.');
    } catch (error) {
      expect(error).toBeInstanceOf(PracticeTextError);
      expect(error).toMatchObject({ failure: { code: 'unsupported-character', position, codePoint } });
      expect(String(error)).not.toContain('漢');
    }
  });

  it('reports grapheme positions, not decomposed UTF-16 offsets', () => {
    expect(() => preparePracticeText('a\u0302\u0301b😀')).toThrow('position 3 (U+1F600)');
  });

  it('does not silently fall back when Intl.Segmenter is unavailable, even after it was cached', () => {
    expect(hasGraphemeSupport()).toBe(true);
    expect(segmentGraphemes('ế')).toEqual(['ế']);
    vi.stubGlobal('Intl', { Segmenter: undefined });
    expect(hasGraphemeSupport()).toBe(false);
    expect(() => segmentGraphemes('ascii')).toThrow(PracticeTextError);
    expect(() => preparePracticeText('')).toThrow('does not support grapheme segmentation');
  });

  it('reports an unsupported browser when Intl itself is unavailable', () => {
    vi.stubGlobal('Intl', undefined);
    expect(hasGraphemeSupport()).toBe(false);
    expect(() => segmentGraphemes('ascii')).toThrow(PracticeTextError);
  });
});
