import { describe, expect, it } from 'vitest';
import { prepareCustomText } from './custom-text';

describe('Custom preparation', () => {
  it('normalizes only documented whitespace and typography in order', () => {
    expect(prepareCustomText(' \r\n“A”\t\u2018B\u2019\rC\nD\u00a0E–F—G…  ')).toEqual({
      target: '"A" \'B\' C D E-F-G...', changed: true
    });
    expect(prepareCustomText('Case 123 ! <b>literal</b>')).toEqual({
      target: 'Case 123 ! <b>literal</b>', changed: false
    });
  });

  it.each(['', ' \r\n\t\u00a0', '\x00', '\v', '\f', '\u200b', '\ufeff', 'emoji😀'])(
    'rejects unsupported/empty draft without echoing content: %j', (draft) => {
      expect(() => prepareCustomText(draft)).toThrow();
    }
  );

  it('reports the normalized position and full Unicode point safely', () => {
    expect(() => prepareCustomText(' a 😀')).toThrow('position 3 (U+1F600)');
  });

  it('accepts one character and exact limits, rejects both overflow boundaries', () => {
    expect(prepareCustomText('a').target).toBe('a');
    expect(prepareCustomText('x'.repeat(10_000)).target).toHaveLength(10_000);
    expect(() => prepareCustomText('x'.repeat(10_001))).toThrow('draft exceeds');
    expect(prepareCustomText('…'.repeat(3333) + 'x').target).toHaveLength(10_000);
    expect(() => prepareCustomText('…'.repeat(3333) + 'xx')).toThrow('normalized target exceeds');
  });
});
