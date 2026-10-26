import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, PreferenceMigrationError, loadPreferences, savePreferences, validatePreferences } from './preferences';
import { StorageError } from './errors';
import { KEYBOARD_TEST_EFFECTS } from '../audio/keyboard-test-sound';

const ALICE_PROFILE_ID = 'generic-alice';

function storage(raw: string | null = null) {
  return { getItem: vi.fn(() => raw), setItem: vi.fn() };
}

describe('preferences version 3', () => {
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
      keyboardTestSoundEnabled: true, keyboardTestSoundEffect: 'plastic-chicken' as const,
      keyboardProfileId: ALICE_PROFILE_ID, keyboardUserDetails: {
        name: ' Split Alice ', brand: ' Example ', connectivity: 'USB-C',
        rgbBacklighting: false, programmableKeys: true
      }
    };
    const destination = storage();
    savePreferences(settings, destination);
    const raw = destination.setItem.mock.calls[0];
    const normalized = { ...settings, keyboardUserDetails: {
      name: 'Split Alice', brand: 'Example', connectivity: 'USB-C', rgbBacklighting: false, programmableKeys: true
    } };
    expect(raw).toEqual([PREFERENCES_KEY, JSON.stringify({ version: 3, settings: normalized })]);
    expect(loadPreferences(storage(JSON.stringify({ version: 3, settings: { ...normalized, target: 'private' } })))).toEqual(normalized);
  });

  it.each(['{', 'null', '[]', '{"version":0}', '{"version":4}', '{"version":1,"settings":{}}',
    '{"version":2,"settings":{}}', '{"version":3,"settings":{}}'])(
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
    ['keyboardTestSoundEnabled', 1], ['keyboardTestSoundEffect', 'unknown'], ['keyboardTestSoundEffect', undefined],
    ['keyboardProfileId', 'unrecognized']
  ])('rejects invalid %s', (field, value) => {
    expect(() => validatePreferences({ ...DEFAULT_PREFERENCES, [field]: value })).toThrow(StorageError);
  });

  it.each([
    ['name', 4], ['brand', 'x'.repeat(121)], ['connectivity', {}], ['rgbBacklighting', 'yes'],
    ['keyRollover', null], ['programmableKeys', 0]
  ])('rejects invalid keyboard detail %s', (field, value) => {
    expect(() => validatePreferences({
      ...DEFAULT_PREFERENCES, keyboardUserDetails: { [field]: value }
    })).toThrow(StorageError);
  });

  it('trims keyboard detail text and treats empty text as no user override', () => {
    expect(validatePreferences({
      ...DEFAULT_PREFERENCES, keyboardUserDetails: { name: '   Alice board  ', model: ' ' }
    }).keyboardUserDetails).toEqual({ name: 'Alice board' });
  });

  it('strips unknown keyboard detail properties without retaining them', () => {
    expect(validatePreferences({
      ...DEFAULT_PREFERENCES, keyboardUserDetails: { model: 'M1', internalNote: 'unrecognized' }
    }).keyboardUserDetails).toEqual({ model: 'M1' });
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
    const source = storage(JSON.stringify({ version: 3, settings }));
    expect(loadPreferences(source)).toEqual(settings);
    expect(source.setItem).not.toHaveBeenCalled();
    expect(settings.soundEnabled).toBe(false);
  });

  it('migrates valid v1 values, defaulting only new fields and stripping unknown data', () => {
    const {
      keyboardTestSoundEnabled, keyboardTestSoundEffect, keyboardProfileId, keyboardUserDetails, ...previous
    } = DEFAULT_PREFERENCES;
    const existing = { ...previous, mode: 'words', wordLimit: 100, durationSeconds: 120, soundEnabled: true,
      caretStyle: 'underline', showLiveStats: false, onboardingComplete: true };
    const source = storage(JSON.stringify({ version: 1, settings: { ...existing, target: 'private' } }));
    const loaded = loadPreferences(source);
    expect(loaded).toEqual({
      ...existing, keyboardTestSoundEnabled, keyboardTestSoundEffect, keyboardProfileId, keyboardUserDetails
    });
    expect(source.setItem).toHaveBeenCalledWith(PREFERENCES_KEY, JSON.stringify({ version: 3, settings: loaded }));
    expect(source.setItem).toHaveBeenCalledTimes(1);
  });

  it('migrates v2 preferences directly to v3 without losing test-sound settings', () => {
    const {
      keyboardProfileId, keyboardUserDetails, ...phaseTwo
    } = DEFAULT_PREFERENCES;
    const existing = { ...phaseTwo, keyboardTestSoundEnabled: true, keyboardTestSoundEffect: 'glass' as const };
    const source = storage(JSON.stringify({ version: 2, settings: existing }));
    const loaded = loadPreferences(source);
    expect(loaded).toEqual({ ...existing, keyboardProfileId, keyboardUserDetails });
    expect(source.setItem).toHaveBeenCalledTimes(1);
    expect(source.setItem).toHaveBeenCalledWith(PREFERENCES_KEY, JSON.stringify({ version: 3, settings: loaded }));
  });

  it('retains validated migrated settings and the original record when v1 migration cannot be saved', () => {
    const {
      keyboardTestSoundEnabled, keyboardTestSoundEffect, keyboardProfileId, keyboardUserDetails, ...phaseOne
    } = DEFAULT_PREFERENCES;
    const source = storage(JSON.stringify({ version: 1, settings: { ...phaseOne, durationSeconds: 60 } }));
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
    expect(source.setItem).toHaveBeenCalledWith(PREFERENCES_KEY, JSON.stringify({ version: 3, settings: failure.settings }));
  });

  it('retains v2 values and the original record when migration cannot be saved', () => {
    const { keyboardProfileId, keyboardUserDetails, ...phaseTwo } = DEFAULT_PREFERENCES;
    const original = { ...phaseTwo, keyboardTestSoundEnabled: true, keyboardTestSoundEffect: 'horn' as const };
    const source = storage(JSON.stringify({ version: 2, settings: original }));
    source.setItem.mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    let failure: PreferenceMigrationError | undefined;
    try { loadPreferences(source); } catch (error) {
      if (!(error instanceof PreferenceMigrationError)) throw error;
      failure = error;
    }
    expect(failure?.settings).toEqual({ ...original, keyboardProfileId, keyboardUserDetails });
    expect(JSON.parse(source.getItem() ?? '').version).toBe(2);
  });

  it('never repairs an invalid v1 field using a default', () => {
    const { keyboardProfileId, keyboardUserDetails, keyboardTestSoundEnabled, keyboardTestSoundEffect, ...phaseOne } =
      DEFAULT_PREFERENCES;
    const source = storage(JSON.stringify({ version: 1, settings: { ...phaseOne, mode: 'zen' } }));
    expect(() => loadPreferences(source)).toThrow(/invalid or missing/);
    expect(source.setItem).not.toHaveBeenCalled();
  });
});
