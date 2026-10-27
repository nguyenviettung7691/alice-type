import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createSession,
  expireSession,
  extendTarget,
  getMetrics,
  getProgress,
  getTypingAction,
  PRACTICE_TEXT,
  type TypingKey,
  type TypingSession
} from './typing-engine';
import { generateExercise, type GeneratedConfiguration } from './exercise-generator';

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

  describe('mode-aware sessions', () => {
    const timed: GeneratedConfiguration = {
      mode: 'timed', durationSeconds: 15, wordBankTier: 200, punctuation: false, numbers: false
    };
    const words: GeneratedConfiguration = {
      mode: 'words', wordLimit: 10, wordBankTier: 200, punctuation: false, numbers: false
    };
    const create = (configuration: GeneratedConfiguration) => {
      const exercise = generateExercise(configuration, () => 0);
      return createSession(exercise.target, exercise.configuration, exercise.wordEnds);
    };

    it('copies configuration and boundaries, rejecting invalid metadata', () => {
      const exercise = generateExercise(words, () => 0);
      const session = createSession(exercise.target, words, exercise.wordEnds);
      expect(session.configuration).not.toBe(words);
      expect(Object.isFrozen(session.wordEnds)).toBe(true);
      for (const ends of [undefined, [], [1], [...exercise.wordEnds].reverse(),
        [0, ...exercise.wordEnds.slice(1)], [1.5, ...exercise.wordEnds.slice(1)]]) {
        expect(() => createSession(exercise.target, words, ends)).toThrow('word boundaries');
      }
    });

    it('stays ready for empty Backspace and starts on an incorrect character at time zero', () => {
      const ready = create(timed);
      expect(getProgress(ready, 50_000)).toEqual({ value: 0, maximum: 15, percent: 0 });
      expect(applyAction(ready, { type: 'backspace' }, 1)).toBe(ready);
      const running = type(ready, 'x', 0);
      expect(getProgress(running, 7500)).toEqual({ value: 7.5, maximum: 15, percent: 50 });
      expect(expireSession(running, 14999)).toBe(running);
    });

    it.each([15, 30, 60, 120] as const)('expires at exactly %i seconds, not a delayed callback time', (durationSeconds) => {
      const running = type(create({ ...timed, durationSeconds }), 'y', 1000);
      const deadline = 1000 + durationSeconds * 1000;
      expect(getProgress(running, deadline + 9000)).toEqual({ value: durationSeconds, maximum: durationSeconds, percent: 100 });
      expect(getMetrics(running, deadline + 9000).elapsedMs).toBe(durationSeconds * 1000);
      const completed = expireSession(running, deadline + 9000);
      expect(completed).toMatchObject({ status: 'completed', endedAt: deadline, input: 'y', totalAttempts: 1 });
      expect(getMetrics(completed, deadline)).toEqual(getMetrics(completed, deadline + 90_000));
      expect(expireSession(completed, deadline + 1000)).toBe(completed);
    });

    it('rejects character and Backspace actions at or beyond the deadline before changing counters', () => {
      const running = type(create(timed), 'y', 1000);
      for (const action of [{ type: 'character', character: 'o' }, { type: 'backspace' }] as const) {
        expect(applyAction(running, action, 16_000)).toMatchObject({
          status: 'completed', input: 'y', totalAttempts: 1, endedAt: 16_000
        });
      }
    });

    it('does not complete at timed-buffer exhaustion and safely extends the prefix', () => {
      let session = create(timed);
      for (const character of session.target) session = type(session, character, 0);
      expect(session.status).toBe('running');
      expect(() => type(session, 'x', 1)).toThrow('extended');
      const previous = session;
      const exercise = generateExercise(timed, () => 0.5);
      session = extendTarget(session, exercise);
      expect(session.target).toBe(`${previous.target} ${exercise.target}`);
      expect(session).toMatchObject({
        input: previous.input, startedAt: 0, totalAttempts: previous.totalAttempts,
        correctAttempts: previous.correctAttempts, status: 'running'
      });
      expect(getMetrics(session, 1000)).toEqual(getMetrics(previous, 1000));
      expect(type(session, ' ', 1000).correctAttempts).toBe(previous.correctAttempts + 1);
      expect(() => extendTarget(create(words), exercise)).toThrow('timed');
      expect(() => extendTarget(expireSession(session, 15_000), exercise)).toThrow('timed');
      expect(() => extendTarget(session, generateExercise({ ...timed, numbers: true }, () => 0))).toThrow('same session');
      expect(() => extendTarget(session, { ...exercise, target: '' })).toThrow('non-empty');
    });

    it('tracks base-word offsets, not numeric tokens or correctness, and rolls back with Backspace', () => {
      let session = create({ ...words, punctuation: true, numbers: true });
      expect(session.target).toMatch(/^you, 0 you,/);
      for (const character of 'xxxx ') session = type(session, character, 0);
      expect(getProgress(session, 0)).toEqual({ value: 1, maximum: 10, percent: 10 });
      session = applyAction(session, { type: 'backspace' }, 1);
      expect(getProgress(session, 1).value).toBe(0);
      session = type(session, ' ', 2);
      for (const character of '0 ') session = type(session, character, 3);
      expect(getProgress(session, 3).value).toBe(1);
      expect(session.totalAttempts).toBe(8);
    });

    it.each([10, 25, 50, 100] as const)('completes %i base words only at the final modified character', (wordLimit) => {
      let session = create({ ...words, wordLimit, punctuation: true, numbers: true });
      for (const character of session.target.slice(0, -1)) session = type(session, character, 0);
      expect(session.status).toBe('running');
      expect(getProgress(session, 500).value).toBe(wordLimit - 1);
      session = type(session, 'x', 1000);
      expect(session).toMatchObject({ status: 'completed', endedAt: 1000 });
      expect(getProgress(session, 50_000)).toEqual({ value: wordLimit, maximum: wordLimit, percent: 100 });
      expect(type(session, 'x', 2000)).toBe(session);
      expect(getMetrics(session, 2000)).toEqual(getMetrics(session, 1000));
    });
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
