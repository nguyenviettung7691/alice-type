import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES } from './preferences';
import type { SessionRecord } from './session-history';
import { snapshotKeyboard } from '../keyboard/user-keyboards';
import { summarizeSetupInsights } from './session-insights';

const keyboard = snapshotKeyboard(DEFAULT_PREFERENCES.keyboardBoards[0]);

function record(index: number, setup: 'light' | 'heavy', duplicate = false): SessionRecord {
  const currentKeyboard = {
    ...keyboard,
    hardware: { ...keyboard.hardware, switchType: setup === 'light' ? 'linear' as const : 'tactile' as const }
  };
  const deskSessionId = `${setup}-desk-${index}`;
  const windows = [
    ...Array.from({ length: 5 }, (_, minute) => ({
      minute, attempts: 20, correctAttempts: 18, correctCharacters: 18, activeMs: 60_000
    })),
    ...Array.from({ length: 5 }, (_, offset) => ({
      minute: 20 + offset, attempts: 20, correctAttempts: 17, correctCharacters: 17, activeMs: 60_000
    }))
  ];
  return {
    version: 6, id: `${setup}-${index}${duplicate ? '-snapshot' : ''}`,
    completedAt: Date.UTC(2026, 0, 1 + index), mode: 'custom', targetCharacters: 10,
    elapsedMs: 1_500_000, wpm: 10, totalAttempts: 200, correctAttempts: 175,
    accuracy: 87.5, missedKeys: {}, keyAttempts: { KeyA: 200 },
    handAttempts: { left: 100, right: 100, thumb: 0, unattributed: 0 }, bKeyHand: 'left',
    keyboard: currentKeyboard, language: 'en', scoringVersion: 'committed-grapheme-v1',
    setupFingerprint: setup === 'light' ? 'fnv1a-11111111' : 'fnv1a-22222222',
    difficultyKey: 'difficulty-12345678', deskSessionId, activeMsTotal: 25 * 60_000,
    activityWindows: windows
  };
}

describe('setup-matched session insights', () => {
  it('requires enough windows, attempts, desk sessions and distinct days', () => {
    const insufficient = Array.from({ length: 4 }, (_, index) => record(index, 'light'));
    expect(summarizeSetupInsights(insufficient, keyboard.id).insights).toEqual([]);
  });

  it('deduplicates cumulative snapshots and compares only matched difficulties', () => {
    const records = [
      ...Array.from({ length: 5 }, (_, index) => record(index, 'light')),
      ...Array.from({ length: 5 }, (_, index) => record(index, 'heavy')),
      record(0, 'light', true)
    ];
    const result = summarizeSetupInsights(records, keyboard.id);
    expect(result.insights).toHaveLength(2);
    expect(result.insights[0]).toMatchObject({
      sessions: 5, days: 5, early: { attempts: 500, accuracy: 90 }, late: { attempts: 500, accuracy: 85 }
    });
    expect(result.compared).toHaveLength(1);
    expect(result.compared[0].first.difficultyKey).toBe(result.compared[0].second.difficultyKey);
  });
});
