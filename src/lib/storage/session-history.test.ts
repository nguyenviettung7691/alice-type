import { describe, expect, it } from 'vitest';
import { applyAction, createSession, createZenSession, expireSession, stopSession } from '../typing/typing-engine';
import { generateExercise } from '../typing/exercise-generator';
import {
  completedRecord, summarizeSessions, validateSessionRecord, validateStoredSessionRecord, type SessionRecord
} from './session-history';

const record: SessionRecord = {
  version: 2, id: 'session-one', completedAt: 1000, mode: 'words', limit: 10, wordBankTier: 200,
  punctuation: false, numbers: false, wpm: 30, accuracy: 80, totalAttempts: 10,
  correctAttempts: 8, missedKeys: { KeyX: 1 }
};
const custom: SessionRecord = {
  version: 2, id: 'custom', completedAt: 1000, mode: 'custom', targetCharacters: 10,
  elapsedMs: 4000, wpm: 30, accuracy: 80, totalAttempts: 10, correctAttempts: 8, missedKeys: { KeyX: 1 }
};
const quote: SessionRecord = {
  ...custom, id: 'quote', mode: 'quote', quoteId: 'removed-quote-id',
  targetCharacters: 40, totalAttempts: 50, correctAttempts: 40
};
const zen: SessionRecord = {
  version: 2, id: 'zen', completedAt: 1000, mode: 'zen', retainedCharacters: 5,
  elapsedMs: 1000, wpm: 60, accuracy: null, totalAttempts: 10, correctAttempts: null, missedKeys: {}
};

describe('completed session contracts', () => {
  it('validates and serializes only the allowed text-free fields', () => {
    const result = validateSessionRecord({ ...record, target: 'secret', input: 'secret', events: [] });
    expect(result).toEqual(record);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(result.missedKeys).not.toBe(record.missedKeys);
  });

  it.each([
    ['version', undefined], ['version', 1], ['version', 3],
    ['id', ''], ['completedAt', Infinity], ['completedAt', -1], ['completedAt', 9e15],
    ['mode', 'zen'], ['limit', 11], ['wordBankTier', 500], ['wpm', NaN], ['wpm', -1],
    ['accuracy', 101], ['accuracy', 70], ['totalAttempts', 0], ['correctAttempts', 11],
    ['punctuation', 'true'], ['numbers', null], ['missedKeys', { Unidentified: 1 }],
    ['missedKeys', { KeyX: -1 }], ['missedKeys', { KeyX: 1.5 }], ['missedKeys', { KeyX: 3 }]
  ])('rejects malformed %s = %j', (field, value) => {
    expect(() => validateSessionRecord({ ...record, [field]: value })).toThrow();
  });

  it.each([record, { ...record, mode: 'timed', limit: 15 }, quote, custom, zen])(
    'whitelists text-free fields for $mode', (saved) => {
      const validated = validateSessionRecord({
        ...saved, target: 'private', input: 'private', draft: 'private', author: 'private',
        source: { passage: 'private' }, writing: { text: 'private' }, chunks: ['private'], events: ['private']
      });
      expect(validated).toEqual(saved);
      expect(JSON.stringify(validated)).not.toContain('private');
      expect(validated.missedKeys).not.toBe(saved.missedKeys);
    }
  );

  it('adapts exact unversioned generated records only on read without fabricating metadata', () => {
    const { version, ...legacy } = record;
    expect(version).toBe(2);
    expect(validateStoredSessionRecord(legacy)).toEqual(record);
    expect(validateStoredSessionRecord({ ...legacy, mode: 'timed', limit: 15 })).toEqual({
      ...record, mode: 'timed', limit: 15
    });
    expect(validateStoredSessionRecord(legacy)).not.toHaveProperty('elapsedMs');
    expect(validateStoredSessionRecord(legacy)).not.toHaveProperty('targetCharacters');
    expect(() => validateSessionRecord(legacy)).toThrow();
  });

  it.each([
    ['mode', 'quote'], ['mode', 'custom'], ['mode', 'zen'], ['mode', 'invalid'], ['limit', 11],
    ['accuracy', null], ['accuracy', 70], ['correctAttempts', null], ['totalAttempts', 0],
    ['totalAttempts', Number.MAX_SAFE_INTEGER + 1], ['missedKeys', { KeyX: 3 }],
    ['missedKeys', { Unidentified: 1 }], ['missedKeys', { 'not-a-code': 1 }],
    ['missedKeys', { KeyX: Number.MAX_SAFE_INTEGER + 1 }]
  ])('does not relax legacy %s validation', (field, value) => {
    const { version, ...legacy } = record;
    expect(version).toBe(2);
    expect(() => validateStoredSessionRecord({ ...legacy, [field]: value })).toThrow();
  });

  it.each([
    ['targetCharacters', 0], ['targetCharacters', 10_001], ['targetCharacters', 1.5],
    ['targetCharacters', 11], ['targetCharacters', undefined], ['elapsedMs', -1], ['elapsedMs', Infinity],
    ['elapsedMs', undefined], ['accuracy', null], ['correctAttempts', null], ['limit', 10],
    ['quoteId', 'not-custom'], ['retainedCharacters', 2], ['wordBankTier', 200]
  ])('rejects inconsistent Custom %s = %j', (field, value) => {
    expect(() => validateSessionRecord({ ...custom, [field]: value })).toThrow();
  });

  it.each([
    ['targetCharacters', 39], ['targetCharacters', 1001], ['targetCharacters', 51],
    ['quoteId', undefined], ['quoteId', ''], ['quoteId', 'Invalid Id'], ['quoteId', '-bad'],
    ['quoteId', 'bad--slug'], ['quoteId', 'private text'], ['correctAttempts', 51], ['missedKeys', { KeyX: 11 }]
  ])('rejects inconsistent Quote %s = %j', (field, value) => {
    expect(() => validateSessionRecord({ ...quote, [field]: value })).toThrow();
  });

  it('accepts finite target bounds and removed quote IDs without a catalog lookup', () => {
    expect(validateSessionRecord(quote)).toEqual(quote);
    for (const [mode, length] of [['custom', 1], ['custom', 10_000], ['quote', 40], ['quote', 1000]] as const) {
      expect(validateSessionRecord({
        ...(mode === 'quote' ? quote : custom), targetCharacters: length,
        totalAttempts: length, correctAttempts: length, accuracy: 100, missedKeys: {}
      })).toMatchObject({ mode, targetCharacters: length });
    }
  });

  it.each([
    ['accuracy', 0], ['accuracy', undefined], ['correctAttempts', 0], ['correctAttempts', undefined],
    ['missedKeys', { KeyX: 1 }], ['missedKeys', []], ['missedKeys', undefined],
    ['retainedCharacters', -1], ['retainedCharacters', 1.5], ['retainedCharacters', 11],
    ['retainedCharacters', Number.MAX_SAFE_INTEGER + 1], ['retainedCharacters', undefined],
    ['elapsedMs', -1], ['elapsedMs', NaN], ['elapsedMs', undefined], ['totalAttempts', 0],
    ['wpm', null], ['wpm', Infinity], ['wpm', -1], ['targetCharacters', 5], ['limit', 30],
    ['punctuation', false], ['numbers', false]
  ])('rejects inconsistent Zen %s = %j', (field, value) => {
    expect(() => validateSessionRecord({ ...zen, [field]: value })).toThrow();
  });

  it('keeps zero-duration and fully-deleted Zen records valid with null correctness', () => {
    expect(validateSessionRecord({
      ...zen, elapsedMs: 0, retainedCharacters: 0, wpm: 0
    })).toMatchObject({ elapsedMs: 0, retainedCharacters: 0, wpm: 0, accuracy: null, correctAttempts: null });
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

  it.each([
    ['custom', 'private', { mode: 'custom' }] as const,
    ['quote', 'a'.repeat(40), { mode: 'quote', quoteId: 'removed-quote-id' }] as const
  ])('creates text-free %s records from finite completions', (mode, target, configuration) => {
    let session = createSession(target, configuration);
    for (const [index, character] of [...target].entries()) {
      session = applyAction(session, { type: 'character', character }, 100 + index * 100);
    }
    const saved = completedRecord(session, mode, 1000, {});
    expect(saved).toMatchObject({
      version: 3, language: 'en', scoringVersion: 'committed-grapheme-v1',
      mode, targetCharacters: target.length, elapsedMs: (target.length - 1) * 100,
      completedAt: 1000 + (target.length - 1) * 100, accuracy: 100,
      totalAttempts: target.length, correctAttempts: target.length
    });
    expect(saved).not.toHaveProperty('limit');
    expect(saved).not.toHaveProperty('target');
    expect(saved).not.toHaveProperty('input');
  });

  it('saves stopped Zen only, excluding writing and supplied missed keys', () => {
    const ready = createZenSession();
    const running = applyAction(ready, { type: 'character', character: 'x' }, 100);
    expect(() => completedRecord(ready, 'ready', 1000, {})).toThrow(/Only completed/);
    expect(() => completedRecord(running, 'running', 1000, {})).toThrow(/Only completed/);
    const completed = stopSession(running, 1100);
    const saved = completedRecord(completed, 'zen-run', 1000, { KeyX: 1 });
    expect(saved).toEqual({
      version: 3, language: 'en', scoringVersion: 'committed-grapheme-v1',
      id: 'zen-run', completedAt: 2000, mode: 'zen', elapsedMs: 1000,
      retainedCharacters: 1, totalAttempts: 1, wpm: 12, accuracy: null, correctAttempts: null, missedKeys: {}
    });
    expect(saved).not.toHaveProperty('writing');
    const deleted = applyAction(running, { type: 'backspace' }, 200);
    expect(completedRecord(stopSession(deleted, 1100), 'deleted', 1000, {})).toMatchObject({
      totalAttempts: 1, retainedCharacters: 0, wpm: 0, accuracy: null
    });
  });

  it('computes arithmetic session means, stable missed-key ordering, and empty summaries', () => {
    const second = { ...record, id: 'two', wpm: 60, missedKeys: { KeyX: 1, KeyA: 1 } };
    expect(summarizeSessions([record, second])).toEqual({
      count: 2, targetCount: 2, bestWpm: 60, averageWpm: 45, averageAccuracy: '80.0',
      committedAccuracy: null, legacyAccuracy: 80,
      zenCount: 0, zenBestWpm: null, zenAverageWpm: null,
      missedKeys: [['KeyX', 2], ['KeyA', 1]]
    });
    expect(summarizeSessions([])).toEqual({
      count: 0, targetCount: 0, bestWpm: null, averageWpm: null, averageAccuracy: null,
      committedAccuracy: null, legacyAccuracy: null,
      zenCount: 0, zenBestWpm: null, zenAverageWpm: null, missedKeys: []
    });
  });

  it('separates mixed target-copying and Zen WPM populations and excludes null accuracy', () => {
    expect(summarizeSessions([record, custom, quote, zen, { ...zen, id: 'zen-two', wpm: 120 }])).toEqual({
      count: 5, targetCount: 3, bestWpm: 30, averageWpm: 30, averageAccuracy: '80.0',
      committedAccuracy: null, legacyAccuracy: 80,
      zenCount: 2, zenBestWpm: 120, zenAverageWpm: 90, missedKeys: [['KeyX', 3]]
    });
  });

  it('returns unavailable target scores and no missed keys for only-Zen history', () => {
    expect(summarizeSessions([zen])).toEqual({
      count: 1, targetCount: 0, bestWpm: null, averageWpm: null, averageAccuracy: null,
      committedAccuracy: null, legacyAccuracy: null,
      zenCount: 1, zenBestWpm: 60, zenAverageWpm: 60, missedKeys: []
    });
  });
});
