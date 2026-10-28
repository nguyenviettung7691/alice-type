import { ALICE_LAYOUT, type AliceKey } from './alice-layout';

export type KeyboardTestMode = 'guided' | 'freestyle';

export const KEYBOARD_TEST_MODES: readonly { readonly id: KeyboardTestMode; readonly label: string }[] = [
  { id: 'guided', label: 'One key at a time' },
  { id: 'freestyle', label: 'Freestyle' }
];

type Counts = Readonly<Partial<Record<string, number>>>;

export type KeyboardTestState =
  | { readonly mode: 'guided'; readonly expectedIndex: number; readonly correctCounts: Counts }
  | { readonly mode: 'freestyle'; readonly pressCounts: Counts; readonly totalPresses: number };

export type TestKeyEvent = Pick<KeyboardEvent,
  'code' | 'key' | 'repeat' | 'isComposing' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'>;

export function createKeyboardTest(mode: KeyboardTestMode = 'guided'): KeyboardTestState {
  if (mode === 'guided') return { mode, expectedIndex: 0, correctCounts: {} };
  if (mode === 'freestyle') return { mode, pressCounts: {}, totalPresses: 0 };
  throw new Error(`Unsupported keyboard test mode: ${String(mode)}.`);
}

export function expectedTestKey(state: KeyboardTestState, layout: readonly AliceKey[] = ALICE_LAYOUT): AliceKey | undefined {
  return state.mode === 'guided' ? layout[state.expectedIndex] : undefined;
}

/** Returns the same state object when the press is not counted. */
export function pressTestKey(
  state: KeyboardTestState,
  code: string,
  layout: readonly AliceKey[] = ALICE_LAYOUT
): KeyboardTestState {
  if (state.mode === 'freestyle') {
    if (!layout.some((key) => key.code === code)) return state;
    return {
      mode: 'freestyle',
      pressCounts: { ...state.pressCounts, [code]: (state.pressCounts[code] ?? 0) + 1 },
      totalPresses: state.totalPresses + 1
    };
  }
  const expected = expectedTestKey(state, layout);
  if (!expected || expected.code !== code) return state;
  return {
    mode: 'guided',
    expectedIndex: state.expectedIndex + 1,
    correctCounts: { ...state.correctCounts, [code]: (state.correctCounts[code] ?? 0) + 1 }
  };
}

export function testKeyCount(state: KeyboardTestState, code: string): number {
  return (state.mode === 'guided' ? state.correctCounts[code] : state.pressCounts[code]) ?? 0;
}

export function testedKeyCount(state: KeyboardTestState, layout: readonly AliceKey[] = ALICE_LAYOUT): number {
  if (state.mode === 'guided') return state.expectedIndex;
  return new Set(layout.map((key) => key.code).filter((code) => testKeyCount(state, code) > 0)).size;
}

export function classifyTestKey(
  event: TestKeyEvent,
  captureTab: boolean,
  captureEscape = false
): 'ignore' | 'exit' | 'press' {
  if (event.repeat || event.isComposing || event.key === 'Process') return 'ignore';
  const control = event.code === 'ControlLeft' || event.code === 'ControlRight';
  const alt = event.code === 'AltLeft' || event.code === 'AltRight';
  const meta = event.code === 'MetaLeft' || event.code === 'MetaRight';
  const shift = event.code === 'ShiftLeft' || event.code === 'ShiftRight';
  if ((event.ctrlKey && !control) || (event.altKey && !alt) || (event.metaKey && !meta)
    || (event.shiftKey && (control || alt || meta))) return 'ignore';
  if (event.code === 'Escape' && !captureEscape) return 'exit';
  if (event.code === 'Tab' && (event.shiftKey || !captureTab)) return 'ignore';
  if (shift && (event.ctrlKey || event.altKey || event.metaKey)) return 'ignore';
  return 'press';
}
