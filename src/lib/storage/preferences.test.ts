import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, loadPreferences, savePreferences, validatePreferences } from './preferences';
import { StorageError } from './errors';

function storage(raw: string | null = null) {
  return { getItem: vi.fn(() => raw), setItem: vi.fn() };
}

describe('preferences version 1', () => {
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
      soundEnabled: true, showLiveStats: false, onboardingComplete: true
    };
    const destination = storage();
    savePreferences(settings, destination);
    const raw = destination.setItem.mock.calls[0];
    expect(raw).toEqual([PREFERENCES_KEY, JSON.stringify({ version: 1, settings })]);
    expect(loadPreferences(storage(JSON.stringify({ version: 1, settings: { ...settings, target: 'private' } })))).toEqual(settings);
  });

  it.each(['{', 'null', '[]', '{"version":0}', '{"version":2}', '{"version":1,"settings":{}}'])(
    'rejects %s without overwriting it', (raw) => {
      const source = storage(raw);
      expect(() => loadPreferences(source)).toThrow(StorageError);
      expect(source.setItem).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['mode', 'zen'], ['durationSeconds', 17], ['wordLimit', 11], ['wordBankTier', 100],
    ['punctuation', 1], ['numbers', 'true'], ['caretStyle', 'circle'], ['soundEnabled', null],
    ['showLiveStats', undefined], ['onboardingComplete', 'false']
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
});
