import { describe, expect, it } from 'vitest';
import { ALICE_LAYOUT } from './alice-layout';
import {
  classifyTestKey, createKeyboardTest, expectedTestKey, KEYBOARD_TEST_MODES, pressTestKey, testedKeyCount,
  testKeyCount, type KeyboardTestMode, type KeyboardTestState, type TestKeyEvent
} from './keyboard-test';

function event(code: string, changes: Partial<TestKeyEvent> = {}): TestKeyEvent {
  return { code, key: '', repeat: false, isComposing: false, ctrlKey: false, altKey: false,
    metaKey: false, shiftKey: false, ...changes };
}

function guided(state: KeyboardTestState) {
  if (state.mode !== 'guided') throw new Error('Expected a guided state.');
  return state;
}

function freestyle(state: KeyboardTestState) {
  if (state.mode !== 'freestyle') throw new Error('Expected a Freestyle state.');
  return state;
}

describe('keyboard test modes', () => {
  it('exposes both modes in a stable order and defaults to guided', () => {
    expect(KEYBOARD_TEST_MODES).toEqual([
      { id: 'guided', label: 'One key at a time' },
      { id: 'freestyle', label: 'Freestyle' }
    ]);
    expect(createKeyboardTest()).toEqual({ mode: 'guided', expectedIndex: 0, correctCounts: {} });
    expect(createKeyboardTest('freestyle')).toEqual({ mode: 'freestyle', pressCounts: {}, totalPresses: 0 });
  });

  it('rejects unknown modes instead of falling back', () => {
    expect(() => createKeyboardTest('zen' as KeyboardTestMode)).toThrow('Unsupported keyboard test mode');
  });
});

describe('guided physical keyboard test', () => {
  it('tests every logical code exactly once in layout order and freezes on completion', () => {
    let state = createKeyboardTest();
    for (const key of ALICE_LAYOUT) {
      expect(expectedTestKey(state)).toBe(key);
      state = pressTestKey(state, key.code);
      expect(testKeyCount(state, key.code)).toBe(1);
    }
    const done = guided(state);
    expect(expectedTestKey(done)).toBeUndefined();
    expect(done.expectedIndex).toBe(ALICE_LAYOUT.length);
    expect(testedKeyCount(done)).toBe(ALICE_LAYOUT.length);
    expect(Object.keys(done.correctCounts)).toHaveLength(ALICE_LAYOUT.length);
    expect(done.correctCounts.Space).toBe(1);
    expect(pressTestKey(done, 'Space')).toBe(done);
  });

  it('never advances for wrong, empty, or unmapped codes and resets without mutating old state', () => {
    const initial = guided(createKeyboardTest());
    for (const code of ['KeyA', '', 'Unidentified', 'Fn']) expect(pressTestKey(initial, code)).toBe(initial);
    const next = guided(pressTestKey(initial, 'Backquote'));
    expect(initial.correctCounts).toEqual({});
    expect(pressTestKey(next, 'Backquote')).toBe(next);
    expect(createKeyboardTest()).toEqual(initial);
    expect(next.correctCounts.Backquote).toBe(1);
  });

  it('uses physical identity regardless of character or shifted legend', () => {
    expect(classifyTestKey(event('Digit1', { key: '!', shiftKey: true }), false)).toBe('press');
    expect(guided(pressTestKey(createKeyboardTest(), 'Backquote')).expectedIndex).toBe(1);
  });

  it.each([
    event('KeyA', { repeat: true }), event('KeyA', { isComposing: true }),
    event('KeyA', { key: 'Process' }), event('KeyR', { ctrlKey: true }),
    event('KeyL', { metaKey: true }), event('KeyF', { altKey: true }),
    event('AltRight', { altKey: true, ctrlKey: true }),
    event('ControlLeft', { ctrlKey: true, shiftKey: true }),
    event('ShiftLeft', { shiftKey: true, metaKey: true })
  ])('ignores repeat, composition, and shortcut combinations: %o', (input) => {
    expect(classifyTestKey(input, true)).toBe('ignore');
  });

  it.each([
    ['ShiftLeft', 'shiftKey'], ['ShiftRight', 'shiftKey'],
    ['ControlLeft', 'ctrlKey'], ['ControlRight', 'ctrlKey'],
    ['AltLeft', 'altKey'], ['AltRight', 'altKey'],
    ['MetaLeft', 'metaKey'], ['MetaRight', 'metaKey']
  ])('allows standalone %s with its own modifier flag', (code, flag) => {
    expect(classifyTestKey(event(code, { [flag]: true }), false)).toBe('press');
  });

  it('captures unmodified Tab only when requested and always permits keyboard exit', () => {
    expect(classifyTestKey(event('Tab'), true)).toBe('press');
    expect(classifyTestKey(event('Tab'), false)).toBe('ignore');
    expect(classifyTestKey(event('Tab', { shiftKey: true }), true)).toBe('ignore');
    expect(classifyTestKey(event('Escape'), false)).toBe('exit');
    expect(classifyTestKey(event('Escape'), true)).toBe('exit');
    expect(classifyTestKey(event('Escape', { ctrlKey: true }), false)).toBe('ignore');
    expect(classifyTestKey(event('ArrowRight'), false)).toBe('press');
  });
});

describe('Freestyle keyboard test', () => {
  it('counts repeated presses of any sequence key in any order without an expected key', () => {
    let state = createKeyboardTest('freestyle');
    for (const code of ['KeyA', 'Space', 'KeyA', 'Backquote', 'KeyA']) {
      state = pressTestKey(state, code);
      expect(expectedTestKey(state)).toBeUndefined();
    }
    const result = freestyle(state);
    expect(testKeyCount(result, 'KeyA')).toBe(3);
    expect(testKeyCount(result, 'Space')).toBe(1);
    expect(testKeyCount(result, 'Digit1')).toBe(0);
    expect(result.totalPresses).toBe(5);
    expect(testedKeyCount(result)).toBe(3);
    expect('expectedIndex' in result).toBe(false);
  });

  it('returns the identical state for codes outside the active sequence', () => {
    const sequence = ALICE_LAYOUT.filter((key) => key.code !== 'KeyQ');
    const initial = createKeyboardTest('freestyle');
    for (const code of ['', 'Unidentified', 'Escape', 'F1', 'IntlBackslash', 'KeyQ']) {
      expect(pressTestKey(initial, code, sequence)).toBe(initial);
    }
    const next = pressTestKey(initial, 'KeyA', sequence);
    expect(freestyle(initial).totalPresses).toBe(0);
    expect(freestyle(next).totalPresses).toBe(1);
  });

  it('keeps counting after every key has been pressed', () => {
    let state = createKeyboardTest('freestyle');
    for (const key of ALICE_LAYOUT) state = pressTestKey(state, key.code);
    expect(testedKeyCount(state)).toBe(ALICE_LAYOUT.length);
    state = pressTestKey(state, 'Space');
    expect(testKeyCount(state, 'Space')).toBe(2);
    expect(freestyle(state).totalPresses).toBe(ALICE_LAYOUT.length + 1);
  });
});
