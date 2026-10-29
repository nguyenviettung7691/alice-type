import { describe, expect, it } from 'vitest';
import type { SessionRecord } from './session-history';
import { buildSessionTimeline, clampAccuracy, wpmAxisMax } from './session-timeline';

function timed(id: string, completedAt: number, overrides: Partial<Record<string, unknown>> = {}): SessionRecord {
  return {
    version: 3, language: 'en', scoringVersion: 'committed-grapheme-v1',
    id, completedAt, mode: 'timed', limit: 30, wordBankTier: 200, punctuation: false, numbers: false,
    wpm: 40, accuracy: 95, totalAttempts: 100, correctAttempts: 95, missedKeys: {},
    ...overrides
  } as SessionRecord;
}

const zen = {
  version: 3, language: 'vi', scoringVersion: 'committed-grapheme-v1',
  id: 'zen', completedAt: 99_999, mode: 'zen', elapsedMs: 1000, retainedCharacters: 5,
  totalAttempts: 5, wpm: 90, accuracy: null, correctAttempts: null, missedKeys: {}
} as SessionRecord;

describe('session timeline', () => {
  it('keeps the latest ten target-copying sessions in chronological order and excludes Zen', () => {
    const records = Array.from({ length: 14 }, (_, index) => timed(`s${index}`, 1000 + index * 60_000));
    const points = buildSessionTimeline([zen, ...records.slice().reverse()]);
    expect(points).toHaveLength(10);
    expect(points.map((point) => point.id)).toEqual(['s4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 's13']);
    expect(points.map((point) => point.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(points.some((point) => point.mode === ('zen' as string))).toBe(false);
  });

  it('uses stored numbers: integer WPM, float accuracy, and the below-floor flag', () => {
    const [low, high] = buildSessionTimeline([
      timed('low', 1, { wpm: 41.6, accuracy: 42.5, correctAttempts: 85, totalAttempts: 200 }),
      timed('high', 2, { wpm: 72, accuracy: 98.7 })
    ]);
    expect(low).toMatchObject({ wpm: 42, accuracy: 42.5, accuracyBelowFloor: true });
    expect(high).toMatchObject({ wpm: 72, accuracy: 98.7, accuracyBelowFloor: false });
  });

  it('preserves language, mode and scoring metadata and projects legacy records to English', () => {
    const legacy = { ...timed('legacy', 1), version: 2 } as Record<string, unknown>;
    delete legacy.language;
    delete legacy.scoringVersion;
    const quote = {
      version: 3, language: 'vi', scoringVersion: 'committed-grapheme-v1', id: 'quote', completedAt: 2,
      mode: 'quote', quoteId: 'vi-1', targetCharacters: 50, elapsedMs: 9000,
      wpm: 30, accuracy: 90, totalAttempts: 50, correctAttempts: 45, missedKeys: {}
    } as SessionRecord;
    const [first, second] = buildSessionTimeline([quote, legacy as unknown as SessionRecord]);
    expect(first).toMatchObject({ id: 'legacy', language: 'en', mode: 'timed', scoring: 'legacy' });
    expect(second).toMatchObject({ id: 'quote', language: 'vi', mode: 'quote', scoring: 'committed' });
  });

  it('breaks equal timestamps by ID consistently with history order', () => {
    const points = buildSessionTimeline([timed('b', 5), timed('a', 5), timed('c', 4)], 2);
    expect(points.map((point) => point.id)).toEqual(['b', 'a']);
  });

  it('returns no points for empty or Zen-only history and rejects invalid limits', () => {
    expect(buildSessionTimeline([])).toEqual([]);
    expect(buildSessionTimeline([zen])).toEqual([]);
    expect(() => buildSessionTimeline([], 0)).toThrow();
  });

  it('computes a rounded WPM axis ceiling and clamps accuracy to the 50-100 range', () => {
    expect(wpmAxisMax([])).toBe(20);
    expect(wpmAxisMax([{ wpm: 5 }])).toBe(20);
    expect(wpmAxisMax([{ wpm: 72 }])).toBe(80);
    expect(wpmAxisMax([{ wpm: 140 }])).toBe(160);
    expect(wpmAxisMax([{ wpm: 100 }]) / 5 % 2).toBe(0);
    expect(clampAccuracy(42)).toBe(50);
    expect(clampAccuracy(98.7)).toBe(98.7);
  });
});
