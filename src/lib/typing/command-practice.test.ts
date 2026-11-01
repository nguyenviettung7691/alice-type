import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES } from '../storage/preferences';
import { validateSessionRecord } from '../storage/session-history';
import { snapshotKeyboard } from '../keyboard/user-keyboards';
import { commandMatches, commandRecord, isCommandOutputCode } from './command-practice';
import type { KeyboardLayerBinding } from '../keyboard/user-keyboards';

const binding: KeyboardLayerBinding = {
  id: 'layer-one-h', layer: 1, holdCue: 'Hold Fn1 + H', sourcePosition: 'H',
  sourceCode: 'KeyH', outputCode: 'ArrowLeft', modifiers: []
};

describe('observable layer command practice', () => {
  it('restricts expected outputs and requires exactly the configured modifiers', () => {
    expect(isCommandOutputCode('ArrowLeft')).toBe(true);
    expect(isCommandOutputCode('F12')).toBe(true);
    expect(isCommandOutputCode('Space')).toBe(false);
    expect(commandMatches(binding, { code: 'ArrowLeft', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false })).toBe(true);
    expect(commandMatches(binding, { code: 'ArrowRight', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false })).toBe(false);
    expect(commandMatches(binding, { code: 'ArrowLeft', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false })).toBe(false);
    expect(commandMatches(binding, { code: 'ArrowLeft', shiftKey: false, ctrlKey: true, altKey: false, metaKey: false })).toBe(false);
  });

  it('saves a validated, text-free v6 output record with a binding snapshot', () => {
    const keyboard = snapshotKeyboard(DEFAULT_PREFERENCES.keyboardBoards[0]);
    const record = commandRecord(keyboard, [binding], {
      attempts: 2, correct: 1, misses: { ArrowRight: 1 }, outputAttempts: { ArrowLeft: 1, ArrowRight: 1 }
    }, 'en', 100, 500, '00000000-0000-4000-8000-000000000001');
    expect(validateSessionRecord(record)).toMatchObject({
      version: 6, mode: 'command', totalAttempts: 2, correctAttempts: 1, accuracy: 50,
      bindings: [binding], outputAttempts: { ArrowLeft: 1, ArrowRight: 1 }
    });
    expect(JSON.stringify(record)).not.toContain('private text');
  });
});
