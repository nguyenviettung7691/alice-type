import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, PreferenceMigrationError, loadPreferences, savePreferences, validatePreferences } from './preferences';
import { StorageError } from './errors';
import { KEYBOARD_TEST_EFFECTS } from '../audio/keyboard-test-sound';

function storage(raw: string | null = null) {
  return { getItem: vi.fn(() => raw), setItem: vi.fn() };
}

describe('preferences version 2', () => {
  it('returns Phase 4-compatible defaults without writing an absent key', () => {
    const source = storage();
    expect(loadPreferences(source)).toEqual(DEFAULT_PREFERENCES);
    expect(source.getItem).toHaveBeenCalledWith(PREFERENCES_KEY);
    expect(source.setItem).not.toHaveBeenCalled();
  });

  it('round trips every setting, strips unknown fields, and preserves inactive limits', () => {
    const settings = {
      ...DEFAULT_PREFERENCES, mode: 'words' as const, durationSeconds: 120 as const, wordLimit: 100 as const,
      wordBankTier: 5000 as const, punctuation: true, numbers: true, caretStyle: 'underline' as const,
      soundEnabled: true, showLiveStats: false, onboardingComplete: true,
      keyboardTestSoundEnabled: true, keyboardTestSoundEffect: 'plastic-chicken' as const
    };
    const destination = storage();
    savePreferences(settings, destination);
    const raw = destination.setItem.mock.calls[0];
    expect(raw).toEqual([PREFERENCES_KEY, JSON.stringify({ version: 2, settings })]);
    expect(loadPreferences(storage(JSON.stringify({ version: 2, settings: { ...settings, target: 'private' } })))).toEqual(settings);
  });

  it.each(['{', 'null', '[]', '{"version":0}', '{"version":3}', '{"version":1,"settings":{}}', '{"version":2,"settings":{}}'])(
    'rejects %s without overwriting it', (raw) => {
      const source = storage(raw);
      expect(() => loadPreferences(source)).toThrow(StorageError);
      expect(source.setItem).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['mode', 'zen'], ['durationSeconds', 17], ['wordLimit', 11], ['wordBankTier', 100],
    ['punctuation', 1], ['numbers', 'true'], ['caretStyle', 'circle'], ['soundEnabled', null],
    ['showLiveStats', undefined], ['onboardingComplete', 'false'],
    ['keyboardTestSoundEnabled', 1], ['keyboardTestSoundEffect', 'unknown'], ['keyboardTestSoundEffect', undefined]
  ])('rejects invalid %s', (field, value) => {
    expect(() => validatePreferences({ ...DEFAULT_PREFERENCES, [field]: value })).toThrow(StorageError);
  });

  it('reports read and write denial explicitly', () => {
    expect(() => loadPreferences({
      getItem: () => { throw new DOMException('Blocked', 'SecurityError'); }, setItem: vi.fn()
    })).toThrow(/could not be loaded.*Blocked/);
    expect(() => savePreferences(DEFAULT_PREFERENCES, {
      getItem: vi.fn(), setItem: () => { throw new DOMException('Full', 'QuotaExceededError'); }
    })).toThrow(/not saved.*Full/);
  });

  it('does not mutate defaults or write invalid settings', () => {
    const loaded = loadPreferences(storage());
    expect(loaded).not.toBe(DEFAULT_PREFERENCES);
    const destination = storage();
    expect(() => {
      // @ts-expect-error Exercise validation also guards JavaScript/storage callers.
      savePreferences({ ...loaded, wordLimit: 12 }, destination);
    }).toThrow(StorageError);
    expect(destination.setItem).not.toHaveBeenCalled();
  });

  it.each(KEYBOARD_TEST_EFFECTS)('round trips independent test effect $id', ({ id }) => {
    const settings = { ...DEFAULT_PREFERENCES, keyboardTestSoundEnabled: true, keyboardTestSoundEffect: id };
    const source = storage(JSON.stringify({ version: 2, settings }));
    expect(loadPreferences(source)).toEqual(settings);
    expect(source.setItem).not.toHaveBeenCalled();
    expect(settings.soundEnabled).toBe(false);
  });

  it('migrates valid v1 values, defaulting only new fields and stripping unknown data', () => {
    const { keyboardTestSoundEnabled, keyboardTestSoundEffect, ...previous } = DEFAULT_PREFERENCES;
    const existing = { ...previous, mode: 'words', wordLimit: 100, durationSeconds: 120, soundEnabled: true,
      caretStyle: 'underline', showLiveStats: false, onboardingComplete: true };
    const source = storage(JSON.stringify({ version: 1, settings: { ...existing, target: 'private' } }));
    const loaded = loadPreferences(source);
    expect(loaded).toEqual({ ...existing, keyboardTestSoundEnabled, keyboardTestSoundEffect });
    expect(source.setItem).toHaveBeenCalledWith(PREFERENCES_KEY, JSON.stringify({ version: 2, settings: loaded }));
  });

  it('retains validated migrated settings and the v1 record when migration cannot be saved', () => {
    const source = storage(JSON.stringify({ version: 1, settings: { ...DEFAULT_PREFERENCES, durationSeconds: 60 } }));
    source.setItem.mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    let failure: PreferenceMigrationError | undefined;
    try { loadPreferences(source); } catch (error) {
      if (!(error instanceof PreferenceMigrationError)) throw error;
      failure = error;
    }
    expect(failure?.message).toMatch(/migrated in memory.*not saved.*Full/);
    expect(failure?.settings).toEqual({ ...DEFAULT_PREFERENCES, durationSeconds: 60 });
    expect(JSON.parse(source.getItem() ?? '').version).toBe(1);
    source.setItem.mockReset();
    if (!failure) throw new Error('Expected migration failure.');
    savePreferences(failure.settings, source);
    expect(source.setItem).toHaveBeenCalledWith(PREFERENCES_KEY, JSON.stringify({ version: 2, settings: failure.settings }));
  });

  it('never repairs an invalid v1 field using a default', () => {
    const source = storage(JSON.stringify({ version: 1, settings: { ...DEFAULT_PREFERENCES, mode: 'zen' } }));
    expect(() => loadPreferences(source)).toThrow(/invalid or missing/);
    expect(source.setItem).not.toHaveBeenCalled();
  });
});
