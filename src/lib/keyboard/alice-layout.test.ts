import { describe, expect, it } from 'vitest';
import { ALICE_CODES, ALICE_HALF_TRANSFORMS, ALICE_LAYOUT, ALICE_VIEW_BOX, keycapTransform } from './alice-layout';
import { PRACTICE_TEXT } from '../typing/typing-engine';

describe('generic Alice layout', () => {
  it('has unique logical physical codes and readable legends', () => {
    expect(ALICE_CODES.size).toBe(ALICE_LAYOUT.length);
    for (const key of ALICE_LAYOUT) {
      expect(key.code).not.toBe('');
      expect(key.legend.trim()).not.toBe('');
      expect(key.keycaps.length).toBeGreaterThan(0);
    }
    expect(ALICE_CODES.has('Unidentified')).toBe(false);
    expect(ALICE_CODES.has('')).toBe(false);
    expect(ALICE_CODES.has('Fn')).toBe(false);
  });

  it('covers all US ANSI printable physical keys and the fixed exercise', () => {
    const characterCodes = new Map<string, string>();
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
      characterCodes.set(letter, `Key${letter.toUpperCase()}`);
      characterCodes.set(letter.toUpperCase(), `Key${letter.toUpperCase()}`);
    }
    for (const [index, digit] of Array.from('1234567890').entries()) {
      characterCodes.set(digit, `Digit${digit}`);
      characterCodes.set('!@#$%^&*()'[index], `Digit${digit}`);
    }
    for (const [code, legends] of [
      ['Backquote', '`~'], ['Minus', '-_'], ['Equal', '=+'],
      ['BracketLeft', '[{'], ['BracketRight', ']}'], ['Backslash', '\\|'],
      ['Semicolon', ';:'], ['Quote', "'\""], ['Comma', ',<'],
      ['Period', '.>'], ['Slash', '/?'], ['Space', ' ']
    ]) {
      for (const legend of legends) characterCodes.set(legend, code);
    }
    expect(characterCodes.size).toBe(95);
    for (const code of characterCodes.values()) expect(ALICE_CODES.has(code)).toBe(true);
    for (const character of PRACTICE_TEXT) {
      expect(ALICE_CODES.has(characterCodes.get(character) ?? '')).toBe(true);
    }
  });

  it('represents split spacebars as two shapes under one logical Space code', () => {
    const spaces = ALICE_LAYOUT.filter((key) => key.code === 'Space');
    expect(spaces).toHaveLength(1);
    expect(spaces[0].keycaps.map((cap) => cap.half)).toEqual(['left', 'right']);
    expect(ALICE_CODES.has('ShiftLeft')).toBe(true);
    expect(ALICE_CODES.has('ShiftRight')).toBe(true);
    expect(ALICE_CODES.has('Backspace')).toBe(true);
  });

  it('uses finite positive geometry without overlap or clipping after half transforms', () => {
    expect(ALICE_VIEW_BOX).toBe('0 0 860 315');
    const caps = ALICE_LAYOUT.flatMap((key) => key.keycaps);
    for (const cap of caps) {
      if (!cap.half) throw new Error('Generic Alice keycaps must belong to a half');
      expect(Object.hasOwn(ALICE_HALF_TRANSFORMS, cap.half)).toBe(true);
      expect(cap.rotation).toBeUndefined();
      expect(keycapTransform(cap)).toBe(ALICE_HALF_TRANSFORMS[cap.half]);
      for (const value of [cap.x, cap.y, cap.width, cap.height]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(cap.x).toBeGreaterThanOrEqual(0);
      expect(cap.y).toBeGreaterThanOrEqual(0);
      expect(cap.width).toBeGreaterThan(0);
      expect(cap.height).toBeGreaterThan(0);
      expect(cap.x + cap.width).toBeLessThanOrEqual(378);
      expect(cap.y + cap.height).toBeLessThanOrEqual(234);

      const transform = ALICE_HALF_TRANSFORMS[cap.half];
      const values = transform.match(/-?\d+/g)?.map(Number);
      if (!values || values.length !== 5) throw new Error('Unexpected half transform format');
      const [tx, ty, degrees, cx, cy] = values;
      const radians = degrees * Math.PI / 180;
      for (const x of [cap.x, cap.x + cap.width]) {
        for (const y of [cap.y, cap.y + cap.height]) {
          const transformedX = tx + cx + (x - cx) * Math.cos(radians) - (y - cy) * Math.sin(radians);
          const transformedY = ty + cy + (x - cx) * Math.sin(radians) + (y - cy) * Math.cos(radians);
          expect(transformedX).toBeGreaterThanOrEqual(0);
          expect(transformedX).toBeLessThanOrEqual(860);
          expect(transformedY).toBeGreaterThanOrEqual(0);
          expect(transformedY).toBeLessThanOrEqual(315);
        }
      }
    }
    for (const [index, cap] of caps.entries()) {
      for (const other of caps.slice(index + 1).filter((other) => other.half === cap.half)) {
        expect(
          cap.x + cap.width <= other.x || other.x + other.width <= cap.x
          || cap.y + cap.height <= other.y || other.y + other.height <= cap.y
        ).toBe(true);
      }
    }
  });
});
