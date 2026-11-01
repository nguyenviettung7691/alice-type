import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES } from '../storage/preferences';
import { keyboardSetupFingerprint } from './setup-fingerprint';

describe('keyboard setup fingerprint', () => {
  const board = DEFAULT_PREFERENCES.keyboardBoards[0];

  it('is stable for equivalent setup data and excludes board identity/name', () => {
    expect(keyboardSetupFingerprint({ ...board, name: 'Other name', id: 'other-board' }))
      .toBe(keyboardSetupFingerprint(board));
  });

  it('changes when a setup factor used for longitudinal matching changes', () => {
    const fingerprint = keyboardSetupFingerprint(board);
    expect(keyboardSetupFingerprint({
      ...board, hardware: { ...board.hardware, actuationForce: 62 }
    })).not.toBe(fingerprint);
    expect(keyboardSetupFingerprint({
      ...board, thumbs: { left: 'space', right: 'backspace' }
    })).not.toBe(fingerprint);
  });
});
