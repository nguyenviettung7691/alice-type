import { ALICE_LAYOUT, type AliceKey } from './alice-layout';

export interface KeyboardTestState {
  readonly expectedIndex: number;
  readonly correctCounts: Readonly<Partial<Record<string, number>>>;
}

export type TestKeyEvent = Pick<KeyboardEvent,
  'code' | 'key' | 'repeat' | 'isComposing' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'>;

export function createKeyboardTest(): KeyboardTestState {
  return { expectedIndex: 0, correctCounts: {} };
}

export function expectedTestKey(state: KeyboardTestState): AliceKey | undefined {
  return ALICE_LAYOUT[state.expectedIndex];
}

export function pressTestKey(state: KeyboardTestState, code: string): KeyboardTestState {
  const expected = expectedTestKey(state);
  if (!expected || expected.code !== code) return state;
  return {
    expectedIndex: state.expectedIndex + 1,
    correctCounts: { ...state.correctCounts, [code]: (state.correctCounts[code] ?? 0) + 1 }
  };
}

export function classifyTestKey(event: TestKeyEvent, expectedCode: string): 'ignore' | 'exit' | 'press' {
  if (event.repeat || event.isComposing || event.key === 'Process') return 'ignore';
  const control = event.code === 'ControlLeft' || event.code === 'ControlRight';
  const alt = event.code === 'AltLeft' || event.code === 'AltRight';
  const meta = event.code === 'MetaLeft' || event.code === 'MetaRight';
  const shift = event.code === 'ShiftLeft' || event.code === 'ShiftRight';
  if ((event.ctrlKey && !control) || (event.altKey && !alt) || (event.metaKey && !meta)
    || (event.shiftKey && (control || alt || meta))) return 'ignore';
  if (event.code === 'Escape') return 'exit';
  if (event.code === 'Tab' && (event.shiftKey || expectedCode !== 'Tab')) return 'ignore';
  if (shift && (event.ctrlKey || event.altKey || event.metaKey)) return 'ignore';
  return 'press';
}
