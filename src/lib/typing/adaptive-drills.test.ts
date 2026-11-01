import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES } from '../storage/preferences';
import type { SessionRecord } from '../storage/session-history';
import { snapshotKeyboard } from '../keyboard/user-keyboards';
import { buildAdaptiveDrill } from './adaptive-drills';

const keyboard = snapshotKeyboard(DEFAULT_PREFERENCES.keyboardBoards[0]);

function sample(id: string, keyAttempts: number, boardId = keyboard.id, language: 'en' | 'vi' = 'en'): SessionRecord {
  return {
    version: 4, id, completedAt: 1000, mode: 'custom', targetCharacters: 1, elapsedMs: 1000,
    wpm: 10, accuracy: 90, totalAttempts: 10, correctAttempts: 9, missedKeys: { KeyB: 1 },
    language, scoringVersion: 'committed-grapheme-v1', keyAttempts: { KeyB: keyAttempts },
    handAttempts: { left: 10, right: 0, thumb: 0, unattributed: 0 }, bKeyHand: 'left',
    keyboard: { ...keyboard, id: boardId }
  };
}

describe('board-scoped adaptive drills', () => {
  it('requires 20 attempts over three sessions, then returns a targeted language drill', () => {
    const records = [sample('a', 7), sample('b', 7), sample('c', 6)];
    expect(buildAdaptiveDrill(records.slice(0, 2), keyboard.id, 'en')).toEqual({ kind: 'insufficient', reason: 'keys' });
    const result = buildAdaptiveDrill(records, keyboard.id, 'en');
    expect(buildAdaptiveDrill(records, keyboard.id, 'en')).toEqual(result);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.drill).toMatchObject({
      keys: ['KeyB'], sampleAttempts: 20, sampleSessions: 3, coverage: 1
    });
    expect(result.drill.target.split(' ')).toHaveLength(10);
    expect(result.drill.candidateCount).toBeGreaterThanOrEqual(20);
  });

  it('does not pool weak-key evidence across boards or practice languages', () => {
    const records = [
      sample('other-board', 20, 'another-board'),
      sample('other-language', 20, keyboard.id, 'vi')
    ];
    expect(buildAdaptiveDrill(records, keyboard.id, 'en')).toEqual({ kind: 'insufficient', reason: 'keys' });
  });

  it('builds a targeted drill from the selected Vietnamese practice bank', () => {
    const records = [sample('vi-a', 7, keyboard.id, 'vi'), sample('vi-b', 7, keyboard.id, 'vi'), sample('vi-c', 6, keyboard.id, 'vi')];
    const result = buildAdaptiveDrill(records, keyboard.id, 'vi');
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.drill.candidateCount).toBeGreaterThanOrEqual(20);
    expect(result.drill.coverage).toBeGreaterThanOrEqual(0.6);
  });

  it('excludes records without the compatible committed-text scoring version', () => {
    const records = [sample('a', 10), sample('b', 10), sample('c', 10)]
      .map((record) => ({ ...record, scoringVersion: undefined }));
    expect(buildAdaptiveDrill(records, keyboard.id, 'en')).toEqual({ kind: 'insufficient', reason: 'keys' });
  });
});
