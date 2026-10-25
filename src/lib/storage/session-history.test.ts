import { describe, expect, it } from 'vitest';
import { applyAction, createSession, expireSession } from '../typing/typing-engine';
import { generateExercise } from '../typing/exercise-generator';
import { completedRecord, summarizeSessions, validateSessionRecord, type SessionRecord } from './session-history';

const record: SessionRecord = {
  id: 'session-one', completedAt: 1000, mode: 'words', limit: 10, wordBankTier: 200,
  punctuation: false, numbers: false, wpm: 30, accuracy: 80, totalAttempts: 10,
  correctAttempts: 8, missedKeys: { KeyX: 1 }
};

describe('completed session contracts', () => {
  it('validates and serializes only the allowed text-free fields', () => {
    const result = validateSessionRecord({ ...record, target: 'secret', input: 'secret', events: [] });
    expect(result).toEqual(record);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(result.missedKeys).not.toBe(record.missedKeys);
  });

  it.each([
    ['id', ''], ['completedAt', Infinity], ['completedAt', -1], ['completedAt', 9e15],
    ['mode', 'zen'], ['limit', 11], ['wordBankTier', 500], ['wpm', NaN], ['wpm', -1],
    ['accuracy', 101], ['accuracy', 70], ['totalAttempts', 0], ['correctAttempts', 11],
    ['punctuation', 'true'], ['numbers', null], ['missedKeys', { Unidentified: 1 }],
    ['missedKeys', { KeyX: -1 }], ['missedKeys', { KeyX: 1.5 }], ['missedKeys', { KeyX: 3 }]
  ])('rejects malformed %s = %j', (field, value) => {
    expect(() => validateSessionRecord({ ...record, [field]: value })).toThrow();
  });

  it('derives the deadline wall time and frozen metrics after delayed timed expiry', () => {
    const exercise = generateExercise({
      mode: 'timed', durationSeconds: 15, wordBankTier: 200, punctuation: false, numbers: false
    }, () => 0);
    const ready = createSession(exercise.target, exercise.configuration, exercise.wordEnds);
    const running = applyAction(ready, { type: 'character', character: 'x' }, 50);
    const completed = expireSession(running, 99_999);
    expect(completedRecord(completed, 'stable', 1_000_000, { KeyX: 1 })).toMatchObject({
      id: 'stable', completedAt: 1_015_000, mode: 'timed', limit: 15,
      wpm: 0, accuracy: 0, missedKeys: { KeyX: 1 }
    });
    expect(() => completedRecord(ready, 'ready', 1000, {})).toThrow(/Only completed/);
  });

  it('computes arithmetic session means, stable missed-key ordering, and empty summaries', () => {
    const second = { ...record, id: 'two', wpm: 60, missedKeys: { KeyX: 1, KeyA: 1 } };
    expect(summarizeSessions([record, second])).toEqual({
      count: 2, bestWpm: 60, averageWpm: 45, averageAccuracy: '80.0',
      missedKeys: [['KeyX', 2], ['KeyA', 1]]
    });
    expect(summarizeSessions([])).toEqual({
      count: 0, bestWpm: 0, averageWpm: 0, averageAccuracy: '0.0', missedKeys: []
    });
  });
});
