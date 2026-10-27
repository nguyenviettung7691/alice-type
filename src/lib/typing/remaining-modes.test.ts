import { describe, expect, it } from 'vitest';
import {
  applyAction, createSession, createZenSession, expireSession, extendTarget,
  getMetrics, getProgress, getWritingWindow, stopSession, type ZenSession
} from './typing-engine';
import { DEFAULT_SETTINGS, generateExercise, getConfiguration } from './exercise-generator';

describe('finite passage modes', () => {
  it.each(['quote', 'custom'] as const)('uses character progress and finite completion for %s', (mode) => {
    const configuration = mode === 'quote' ? { mode, quoteId: 'reviewed-quote' } : { mode };
    let session = createSession('ab', configuration);
    const original = session;
    session = applyAction(session, { type: 'character', character: 'x' }, 100);
    expect(getProgress(session, 100)).toEqual({ value: 1, maximum: 2, percent: 50 });
    session = applyAction(session, { type: 'backspace' }, 200);
    expect(getProgress(session, 200).value).toBe(0);
    session = applyAction(session, { type: 'character', character: 'a' }, 300);
    session = applyAction(session, { type: 'character', character: 'x' }, 60_100);
    expect(session.status).toBe('completed');
    expect(getMetrics(session, 999_999)).toMatchObject({ elapsedMs: 60_000, accuracy: 33.3 });
    expect(original.input).toBe('');
    expect(expireSession(original, 999_999)).toBe(original);
    expect(() => extendTarget(original, generateExercise(getConfiguration(DEFAULT_SETTINGS)))).toThrow();
  });

  it('does not silently generate other modes', () => {
    for (const mode of ['quote', 'custom', 'zen'] as const) {
      expect(() => getConfiguration({ ...DEFAULT_SETTINGS, mode })).toThrow();
    }
    expect(() => createSession('text', JSON.parse('{"mode":"zen"}'))).toThrow('target-copying');
  });
});

describe('Zen writing', () => {
  const write = (count: number): ZenSession => {
    let session = createZenSession();
    for (let i = 0; i < count; i++) session = applyAction(session, { type: 'character', character: 'a' }, 100);
    return session;
  };

  it('starts on a space, not empty Backspace; has no target or live metrics', () => {
    const ready = createZenSession();
    expect(applyAction(ready, { type: 'backspace' }, 50)).toBe(ready);
    expect(stopSession(ready, 50)).toBe(ready);
    const session = applyAction(ready, { type: 'character', character: ' ' }, 100);
    expect(session).not.toHaveProperty('target');
    expect(session).not.toHaveProperty('correctAttempts');
    expect(getMetrics(session, 999999)).toMatchObject({ wpm: null, accuracy: null });
    expect(getProgress(session, 999999)).toBeNull();
    expect(session.status).toBe('running');
    expect(() => stopSession(createSession('a'), 100)).toThrow();
  });

  it('calculates 50/40/0 WPM only at Stop, retaining all attempts', () => {
    let session = write(250);
    expect(getMetrics(stopSession(session, 60_100), 0).wpm).toBe(50);
    for (let i = 0; i < 50; i++) session = applyAction(session, { type: 'backspace' }, 200);
    const stopped = stopSession(session, 60_100);
    expect(getMetrics(stopped, 0)).toEqual({ correctCharacters: null, elapsedMs: 60_000, wpm: 40, accuracy: null });
    expect(stopped.totalAttempts).toBe(250);
    expect(stopSession(stopped, 999999)).toBe(stopped);
    expect(applyAction(stopped, { type: 'character', character: 'z' }, 999999)).toBe(stopped);
    for (let i = 0; i < 200; i++) session = applyAction(session, { type: 'backspace' }, 200);
    expect(getMetrics(stopSession(session, 60_100), 0).wpm).toBe(0);
    expect(getMetrics(stopSession(write(1), 100), 0).wpm).toBe(0);
  });

  it('retains immutable chunk history beyond 100,000 characters with a 2,000 character window', () => {
    let session = write(100_001);
    const previous = session;
    session = applyAction(session, { type: 'character', character: 'Z' }, 200);
    expect(getWritingWindow(previous)).toBe('a'.repeat(2000));
    expect(getWritingWindow(session)).toBe('a'.repeat(1999) + 'Z');
    for (let i = 0; i < 3000; i++) session = applyAction(session, { type: 'backspace' }, 200);
    expect(session.retainedCharacters).toBe(97_002);
    expect(session.totalAttempts).toBe(100_002);
    expect(getWritingWindow(session)).toBe('a'.repeat(2000));
    expect(getMetrics(stopSession(session, 60_100), 0).wpm).toBe(Math.round(97_002 / 5));
  });
});
