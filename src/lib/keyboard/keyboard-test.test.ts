import { describe, expect, it } from 'vitest';
import { ALICE_LAYOUT } from './alice-layout';
import { classifyTestKey, createKeyboardTest, expectedTestKey, pressTestKey, type TestKeyEvent } from './keyboard-test';

function event(code: string, changes: Partial<TestKeyEvent> = {}): TestKeyEvent {
  return { code, key: '', repeat: false, isComposing: false, ctrlKey: false, altKey: false,
    metaKey: false, shiftKey: false, ...changes };
}

describe('guided physical keyboard test', () => {
  it('tests every logical code exactly once in layout order and freezes on completion', () => {
    let state = createKeyboardTest();
    for (const key of ALICE_LAYOUT) {
      expect(expectedTestKey(state)).toBe(key);
      state = pressTestKey(state, key.code);
      expect(state.correctCounts[key.code]).toBe(1);
    }
    expect(expectedTestKey(state)).toBeUndefined();
    expect(state.expectedIndex).toBe(ALICE_LAYOUT.length);
    expect(Object.keys(state.correctCounts)).toHaveLength(ALICE_LAYOUT.length);
    expect(state.correctCounts.Space).toBe(1);
    expect(pressTestKey(state, 'Space')).toBe(state);
  });

  it('never advances for wrong, empty, or unmapped codes and resets without mutating old state', () => {
    const initial = createKeyboardTest();
    for (const code of ['KeyA', '', 'Unidentified', 'Fn']) expect(pressTestKey(initial, code)).toBe(initial);
    const next = pressTestKey(initial, 'Backquote');
    expect(initial.correctCounts).toEqual({});
    expect(pressTestKey(next, 'Backquote')).toBe(next);
    expect(createKeyboardTest()).toEqual(initial);
    expect(next.correctCounts.Backquote).toBe(1);
  });

  it('uses physical identity regardless of character or shifted legend', () => {
    expect(classifyTestKey(event('Digit1', { key: '!', shiftKey: true }), 'Digit1')).toBe('press');
    expect(pressTestKey(createKeyboardTest(), 'Backquote').expectedIndex).toBe(1);
  });

  it.each([
    event('KeyA', { repeat: true }), event('KeyA', { isComposing: true }),
    event('KeyA', { key: 'Process' }), event('KeyR', { ctrlKey: true }),
    event('KeyL', { metaKey: true }), event('KeyF', { altKey: true }),
    event('AltRight', { altKey: true, ctrlKey: true }),
    event('ControlLeft', { ctrlKey: true, shiftKey: true }),
    event('ShiftLeft', { shiftKey: true, metaKey: true })
  ])('ignores repeat, composition, and shortcut combinations: %o', (input) => {
    expect(classifyTestKey(input, input.code)).toBe('ignore');
  });

  it.each([
    ['ShiftLeft', 'shiftKey'], ['ShiftRight', 'shiftKey'],
    ['ControlLeft', 'ctrlKey'], ['ControlRight', 'ctrlKey'],
    ['AltLeft', 'altKey'], ['AltRight', 'altKey'],
    ['MetaLeft', 'metaKey'], ['MetaRight', 'metaKey']
  ])('allows standalone %s with its own modifier flag', (code, flag) => {
    expect(classifyTestKey(event(code, { [flag]: true }), code)).toBe('press');
  });

  it('captures only expected unmodified Tab and always permits keyboard exit', () => {
    expect(classifyTestKey(event('Tab'), 'Tab')).toBe('press');
    expect(classifyTestKey(event('Tab'), 'KeyA')).toBe('ignore');
    expect(classifyTestKey(event('Tab', { shiftKey: true }), 'Tab')).toBe('ignore');
    expect(classifyTestKey(event('Escape'), 'KeyA')).toBe('exit');
    expect(classifyTestKey(event('Escape', { ctrlKey: true }), 'KeyA')).toBe('ignore');
    expect(classifyTestKey(event('ArrowRight'), 'KeyA')).toBe('press');
  });
});
