import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createSession,
  getMetrics,
  getTypingAction,
  PRACTICE_TEXT,
  type TypingKey,
  type TypingSession
} from './typing-engine';

function type(session: TypingSession, character: string, now = 0) {
  return applyAction(session, { type: 'character', character }, now);
}

function key(key: string, overrides: Partial<TypingKey> = {}): TypingKey {
  return {
    key,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    isComposing: false,
    repeat: false,
    ...overrides
  };
}

describe('session transitions', () => {
  it('starts ready with the exact fixed exercise and neutral metrics', () => {
    const session = createSession(PRACTICE_TEXT);
    expect(session).toEqual({
      target: 'Slow down, take a breath, and let steady hands find their way across the keys.',
      input: '',
      status: 'ready',
      startedAt: null,
      endedAt: null,
      totalAttempts: 0,
      correctAttempts: 0
    });
    expect(getMetrics(session, 5000)).toEqual({
      correctCharacters: 0, elapsedMs: 0, wpm: null, accuracy: null
    });
  });

  it.each(['', 'a\nb', 'a\tb', 'caf\u00e9', '\u{1f600}', '\x7f'])(
    'rejects an unsupported target %j explicitly',
    (target) => {
      expect(() => createSession(target)).toThrow('non-empty printable ASCII');
    }
  );

  it.each(['a', 'x'])('starts on the first character %s without mutating prior state', (character) => {
    const ready = Object.freeze(createSession('abc'));
    const running = type(ready, character, 123);
    expect(ready.input).toBe('');
    expect(running).toMatchObject({
      input: character,
      status: 'running',
      startedAt: 123,
      totalAttempts: 1,
      correctAttempts: character === 'a' ? 1 : 0
    });
  });

  it('preserves the first timestamp, spaces, shifted punctuation, and case', () => {
    let session = createSession('A !');
    for (const [index, character] of Array.from('A !').entries()) {
      session = type(session, character, 100 + index * 100);
    }
    expect(session).toMatchObject({
      status: 'completed', input: 'A !', startedAt: 100, endedAt: 300,
      totalAttempts: 3, correctAttempts: 3
    });
    expect(type(createSession('Ab'), 'a').correctAttempts).toBe(0);
  });

  it('removes mistakes without erasing attempts, then records correction as a new attempt', () => {
    let session = type(createSession('abc'), 'x', 100);
    session = applyAction(session, { type: 'backspace' }, 200);
    expect(session).toMatchObject({
      input: '', status: 'running', startedAt: 100, totalAttempts: 1, correctAttempts: 0
    });
    session = type(session, 'a', 300);
    expect(session).toMatchObject({ input: 'a', totalAttempts: 2, correctAttempts: 1 });
    expect(getMetrics(session, 60_100).accuracy).toBe(50);
  });

  it('does not start the clock or change state for empty Backspace', () => {
    const session = createSession('abc');
    expect(applyAction(session, { type: 'backspace' }, 100)).toBe(session);
    const emptied = applyAction(type(session, 'a'), { type: 'backspace' }, 100);
    expect(applyAction(emptied, { type: 'backspace' }, 200)).toBe(emptied);
  });

  it('completes at target length even with errors and ignores further input', () => {
    const completed = type(type(createSession('ab'), 'a', 100), 'x', 1100);
    expect(completed).toMatchObject({
      status: 'completed', input: 'ax', endedAt: 1100, totalAttempts: 2, correctAttempts: 1
    });
    expect(type(completed, 'b', 2000)).toBe(completed);
    expect(applyAction(completed, { type: 'backspace' }, 2000)).toBe(completed);
  });

  it('supports a single-character exercise with zero duration', () => {
    const completed = type(createSession('a'), 'a', 100);
    expect(completed.status).toBe('completed');
    expect(getMetrics(completed, 100)).toMatchObject({ elapsedMs: 0, wpm: 0, accuracy: 100 });
  });

  it('restarts the same target and clears all session state', () => {
    const completed = type(createSession('a'), 'x', 500);
    expect(createSession(completed.target)).toEqual(createSession('a'));
  });

  it.each(['ab', '\n', '\u00e9'])('rejects an invalid direct character action %j', (character) => {
    expect(() => type(createSession('abc'), character)).toThrow('one printable ASCII character');
  });
});

describe('derived metrics', () => {
  it('calculates exact WPM from correct buffered characters and elapsed time', () => {
    let session = createSession('abcdef');
    for (const character of 'abcde') session = type(session, character, 1000);
    expect(getMetrics(session, 61_000)).toEqual({
      correctCharacters: 5, elapsedMs: 60_000, wpm: 1, accuracy: 100
    });
    expect(getMetrics(session, 31_000).wpm).toBe(2);
    expect(getMetrics(session, 41_000).wpm).toBe(2);
  });

  it('uses zero WPM at zero or negative elapsed time without dividing by zero', () => {
    const session = type(createSession('ab'), 'a', 1000);
    expect(getMetrics(session, 1000).wpm).toBe(0);
    expect(getMetrics(session, 0).wpm).toBe(0);
  });

  it('excludes wrong characters from WPM and rounds accuracy to one decimal place', () => {
    let session = createSession('abcd');
    for (const character of 'abx') session = type(session, character);
    expect(getMetrics(session, 60_000)).toEqual({
      correctCharacters: 2, elapsedMs: 60_000, wpm: 0, accuracy: 66.7
    });
  });

  it('deleting correct input reduces WPM but retains accuracy history', () => {
    const session = applyAction(type(createSession('ab'), 'a'), { type: 'backspace' }, 100);
    expect(session.correctAttempts).toBe(1);
    expect(getMetrics(session, 1000)).toEqual({
      correctCharacters: 0, elapsedMs: 1000, wpm: 0, accuracy: 100
    });
  });

  it('freezes elapsed time and WPM at completion', () => {
    const session = type(type(createSession('ab'), 'a', 100), 'b', 1100);
    expect(getMetrics(session, 1100)).toEqual(getMetrics(session, 1_000_000));
    expect(getMetrics(session, 1100).wpm).toBe(24);
  });

  it('retains first timestamp zero and returns zero accuracy for all-wrong input', () => {
    const session = type(type(createSession('abc'), 'x', 0), 'y', 100);
    expect(session.startedAt).toBe(0);
    expect(getMetrics(session, 60_000)).toEqual({
      correctCharacters: 0, elapsedMs: 60_000, wpm: 0, accuracy: 0
    });
  });
});

describe('keyboard filtering', () => {
  it.each(['a', 'A', ' ', ',', '.', '!', '0', '~'])('accepts printable key %j', (character) => {
    expect(getTypingAction(key(character))).toEqual({ type: 'character', character });
  });

  it('accepts Backspace as the only editing action', () => {
    expect(getTypingAction(key('Backspace'))).toEqual({ type: 'backspace' });
  });

  it.each(['Tab', 'Escape', 'Enter', 'ArrowLeft', 'Delete', 'Shift', 'CapsLock', 'Dead', 'Process', '\u00e9'])(
    'ignores unsupported key %j',
    (value) => expect(getTypingAction(key(value))).toBeNull()
  );

  it.each(['ctrlKey', 'altKey', 'metaKey', 'isComposing', 'repeat'] as const)(
    'ignores printable and Backspace input with %s',
    (flag) => {
      expect(getTypingAction(key('a', { [flag]: true }))).toBeNull();
      expect(getTypingAction(key('Backspace', { [flag]: true }))).toBeNull();
    }
  );
});
