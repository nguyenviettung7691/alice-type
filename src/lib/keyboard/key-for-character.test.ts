import { describe, expect, it } from 'vitest';
import { keyForCharacter } from './key-for-character';

describe('keyForCharacter', () => {
  it('uses the US-QWERTY reference without a browser layout map', () => {
    expect(keyForCharacter('b', null)).toEqual({ code: 'KeyB', shift: false });
    expect(keyForCharacter('B', null)).toEqual({ code: 'KeyB', shift: true });
    expect(keyForCharacter(' ', null)).toEqual({ code: 'Space', shift: false });
    expect(keyForCharacter('{', null)).toEqual({ code: 'BracketLeft', shift: true });
    expect(keyForCharacter('|', null)).toEqual({ code: 'Backslash', shift: true });
    expect(keyForCharacter('"', null)).toEqual({ code: 'Quote', shift: true });
    expect(keyForCharacter('7', null)).toEqual({ code: 'Digit7', shift: false });
  });

  it('marks nothing for graphemes without a single key', () => {
    expect(keyForCharacter('ế', null)).toBeNull();
    expect(keyForCharacter('đ', null)).toBeNull();
    expect(keyForCharacter('€', null)).toBeNull();
  });

  it('inverts the browser layout map for unshifted characters and uppercase letters', () => {
    const azerty = new Map([['KeyQ', 'a'], ['KeyA', 'q'], ['Digit1', '&'], ['Numpad1', '1'], ['Semicolon', 'm']]);
    expect(keyForCharacter('a', azerty)).toEqual({ code: 'KeyQ', shift: false });
    expect(keyForCharacter('A', azerty)).toEqual({ code: 'KeyQ', shift: true });
    expect(keyForCharacter('&', azerty)).toEqual({ code: 'Digit1', shift: false });
    expect(keyForCharacter('m', azerty)).toEqual({ code: 'Semicolon', shift: false });
    expect(keyForCharacter('!', azerty)).toBeNull();
  });
});
