import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, PreferenceMigrationError, loadPreferences, savePreferences, validatePreferences } from './preferences';
import { StorageError } from './errors';
import { KEYBOARD_TEST_EFFECTS } from '../audio/keyboard-test-sound';

const ALICE_PROFILE_ID = 'generic-alice';

function storage(raw: string | null = null) {
  return { getItem: vi.fn(() => raw), setItem: vi.fn() };
}

describe('preferences version 6', () => {
  it.each([1, 2, 3, 4, 5])('migrates a genuine language-less v%i record exactly once without losing preferences', (version) => {
    const { language, ...oldSettings } = DEFAULT_PREFERENCES;
    expect(language).toBe('en');
    const source = storage(JSON.stringify({ version, settings: {
      ...oldSettings, durationSeconds: 120, wordBankTier: 1000, caretStyle: 'line', soundEnabled: true
    } }));
    const migrated = loadPreferences(source);
    expect(migrated).toMatchObject({ language: 'en', durationSeconds: 120, wordBankTier: 1000, caretStyle: 'line', soundEnabled: true });
    expect(source.setItem).toHaveBeenCalledTimes(1);
    expect(source.setItem).toHaveBeenCalledWith(PREFERENCES_KEY, JSON.stringify({ version: 6, settings: migrated }));
  });

  it('round trips Vietnamese and rejects missing/unsupported current language IDs without rewriting stored data', () => {
    const settings = { ...DEFAULT_PREFERENCES, language: 'vi' as const };
    const source = storage(JSON.stringify({ version: 6, settings }));
    expect(loadPreferences(source)).toEqual(settings);
    expect(source.setItem).not.toHaveBeenCalled();
    for (const language of [undefined, '', 'fr', 'VI', null]) {
      const invalid = storage(JSON.stringify({ version: 6, settings: { ...settings, language } }));
      expect(() => loadPreferences(invalid)).toThrow(/language/);
      expect(invalid.setItem).not.toHaveBeenCalled();
    }
  });
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
    expect(raw).toEqual([PREFERENCES_KEY, JSON.stringify({ version: 6, settings: normalized })]);
    expect(loadPreferences(storage(JSON.stringify({ version: 6, settings: { ...normalized, target: 'private' } })))).toEqual(normalized);
  });

  it.each(['{', 'null', '[]', '{"version":0}', '{"version":6}', '{"version":1,"settings":{}}',
    '{"version":2,"settings":{}}', '{"version":3,"settings":{}}', '{"version":4,"settings":{}}', '{"version":5,"settings":{}}'])(
    'rejects %s without overwriting it', (raw) => {
      const source = storage(raw);
      expect(() => loadPreferences(source)).toThrow(StorageError);
      expect(source.setItem).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['mode', 'unknown'], ['durationSeconds', 17], ['wordLimit', 11], ['wordBankTier', 100],
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
    const source = storage(JSON.stringify({ version: 6, settings }));
    expect(loadPreferences(source)).toEqual(settings);
    expect(source.setItem).not.toHaveBeenCalled();
    expect(settings.soundEnabled).toBe(false);
  });

  it.each(['timed', 'words', 'quote', 'custom', 'zen'] as const)('round trips v6 mode %s without content', (mode) => {
    const settings = { ...DEFAULT_PREFERENCES, mode, durationSeconds: 120 as const, wordLimit: 100 as const };
    const destination = storage();
    savePreferences({
      ...settings, target: 'private', draft: 'private', writing: { text: 'private' }
    } as typeof settings, destination);
    const raw = destination.setItem.mock.calls[0]?.[1];
    expect(raw).toBe(JSON.stringify({ version: 6, settings }));
    expect(loadPreferences(storage(raw))).toEqual(settings);
  });

  it.each([1, 2, 3, 4])('rejects new modes in historical v%s without writing', (version) => {
    for (const mode of ['quote', 'custom', 'zen']) {
      const source = storage(JSON.stringify({ version, settings: { ...DEFAULT_PREFERENCES, mode } }));
      expect(() => loadPreferences(source)).toThrow(/invalid or missing/);
      expect(source.setItem).not.toHaveBeenCalled();
    }
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
    expect(source.setItem).toHaveBeenCalledWith(PREFERENCES_KEY, JSON.stringify({ version: 6, settings: loaded }));
    expect(source.setItem).toHaveBeenCalledTimes(1);
  });

  it('migrates v2 preferences directly to v6 without losing test-sound settings', () => {
    const {
      keyboardProfileId, keyboardUserDetails, ...phaseTwo
    } = DEFAULT_PREFERENCES;
    const existing = { ...phaseTwo, keyboardTestSoundEnabled: true, keyboardTestSoundEffect: 'glass' as const };
    const source = storage(JSON.stringify({ version: 2, settings: existing }));
    const loaded = loadPreferences(source);
    expect(loaded).toEqual({ ...existing, keyboardProfileId, keyboardUserDetails });
    expect(source.setItem).toHaveBeenCalledTimes(1);
    expect(source.setItem).toHaveBeenCalledWith(PREFERENCES_KEY, JSON.stringify({ version: 6, settings: loaded }));
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
    expect(source.setItem).toHaveBeenCalledWith(PREFERENCES_KEY, JSON.stringify({ version: 6, settings: failure.settings }));
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

describe('keyboard layout confirmation (version 5)', () => {
  const PROFILE = 'projectkb-alice';
  const confirmation = {
    profileId: PROFILE, variant: { 0: 1, 1: 0 }, confirmedFor: { vendorId: 0x0159, productId: 0xa71c },
    catalogRevision: 'via-9e3e9f4.qmk-180f394'
  };

  it('migrates v3 preferences to v6 with a null confirmation and one final write', () => {
    const { keyboardLayoutConfirmation, ...phaseThree } = DEFAULT_PREFERENCES;
    const existing = { ...phaseThree, keyboardProfileId: PROFILE, keyboardUserDetails: { model: 'Rev 1' }, onboardingComplete: true };
    const source = storage(JSON.stringify({ version: 3, settings: existing }));
    const loaded = loadPreferences(source);
    expect(keyboardLayoutConfirmation).toBeNull();
    expect(loaded).toEqual({ ...existing, keyboardLayoutConfirmation: null });
    expect(source.setItem).toHaveBeenCalledTimes(1);
    expect(source.setItem).toHaveBeenCalledWith(PREFERENCES_KEY, JSON.stringify({ version: 6, settings: loaded }));
  });

  it('ignores a confirmation-shaped field in v3 records instead of trusting it', () => {
    const source = storage(JSON.stringify({ version: 3, settings: {
      ...DEFAULT_PREFERENCES, keyboardProfileId: PROFILE, keyboardLayoutConfirmation: confirmation
    } }));
    expect(loadPreferences(source).keyboardLayoutConfirmation).toBeNull();
  });

  it('round trips a confirmation and strips unknown confirmation fields', () => {
    const settings = { ...DEFAULT_PREFERENCES, keyboardProfileId: PROFILE, keyboardLayoutConfirmation: confirmation };
    const source = storage(JSON.stringify({ version: 6, settings: {
      ...settings, keyboardLayoutConfirmation: { ...confirmation, score: 0.9, observedCodes: ['KeyA'] }
    } }));
    expect(loadPreferences(source)).toEqual(settings);
    expect(source.setItem).not.toHaveBeenCalled();
    expect(validatePreferences({ ...settings, keyboardLayoutConfirmation: { ...confirmation, confirmedFor: null } })
      .keyboardLayoutConfirmation?.confirmedFor).toBeNull();
  });

  it('migrates v4 once, preserving all historical fields and confirmation', () => {
    const settings = {
      ...DEFAULT_PREFERENCES, mode: 'words' as const, durationSeconds: 120 as const, wordLimit: 100 as const,
      wordBankTier: 5000 as const, punctuation: true, numbers: true, caretStyle: 'line' as const,
      soundEnabled: true, showLiveStats: false, onboardingComplete: true,
      keyboardTestSoundEnabled: true, keyboardTestSoundEffect: 'horn' as const,
      keyboardProfileId: PROFILE, keyboardUserDetails: { name: 'My board', keyRollover: false },
      keyboardLayoutConfirmation: confirmation
    };
    const source = storage(JSON.stringify({ version: 4, settings }));
    expect(loadPreferences(source)).toEqual(settings);
    expect(source.setItem).toHaveBeenCalledExactlyOnceWith(
      PREFERENCES_KEY, JSON.stringify({ version: 6, settings })
    );
  });

  it.each([3, 4])('retains v%s settings and confirmation semantics on a failed final migration write', (version) => {
    const original = {
      ...DEFAULT_PREFERENCES, keyboardProfileId: PROFILE, keyboardLayoutConfirmation: confirmation,
      keyboardUserDetails: { model: 'Rev 1' }, soundEnabled: true, onboardingComplete: true
    };
    const source = storage(JSON.stringify({ version, settings: original }));
    source.setItem.mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    let failure: PreferenceMigrationError | undefined;
    try { loadPreferences(source); } catch (error) {
      if (!(error instanceof PreferenceMigrationError)) throw error;
      failure = error;
    }
    const settings = { ...original, keyboardLayoutConfirmation: version === 3 ? null : confirmation };
    expect(failure?.settings).toEqual(settings);
    expect(failure?.message).toMatch(/migrated in memory.*not saved.*Full/);
    expect(JSON.parse(source.getItem() ?? '').version).toBe(version);
    source.setItem.mockReset();
    savePreferences(settings, source);
    expect(source.setItem).toHaveBeenCalledExactlyOnceWith(
      PREFERENCES_KEY, JSON.stringify({ version: 6, settings })
    );
  });

  it('keeps a structurally valid but stale variant so the app can report it', () => {
    const stale = { ...confirmation, variant: { 7: 3 } };
    expect(validatePreferences({
      ...DEFAULT_PREFERENCES, keyboardProfileId: PROFILE, keyboardLayoutConfirmation: stale
    }).keyboardLayoutConfirmation).toEqual(stale);
  });

  it.each([
    ['a different profile', { keyboardProfileId: 'generic-alice' }],
    ['no selected profile', { keyboardProfileId: null }],
    ['a negative option', { keyboardLayoutConfirmation: { ...confirmation, variant: { 0: -1 } } }],
    ['a fractional option', { keyboardLayoutConfirmation: { ...confirmation, variant: { 0: 0.5 } } }],
    ['a non-index group', { keyboardLayoutConfirmation: { ...confirmation, variant: { split: 1 } } }],
    ['an array variant', { keyboardLayoutConfirmation: { ...confirmation, variant: [1] } }],
    ['an out-of-range vendor ID', { keyboardLayoutConfirmation: { ...confirmation, confirmedFor: { vendorId: 0x10000, productId: 1 } } }],
    ['a missing product ID', { keyboardLayoutConfirmation: { ...confirmation, confirmedFor: { vendorId: 1 } } }],
    ['an empty revision', { keyboardLayoutConfirmation: { ...confirmation, catalogRevision: ' ' } }],
    ['an overlong revision', { keyboardLayoutConfirmation: { ...confirmation, catalogRevision: 'r'.repeat(41) } }],
    ['a missing confirmation field', { keyboardLayoutConfirmation: undefined }]
  ])('rejects a confirmation with %s', (_, override) => {
    expect(() => validatePreferences({
      ...DEFAULT_PREFERENCES, keyboardProfileId: PROFILE, keyboardLayoutConfirmation: confirmation, ...override
    })).toThrow(StorageError);
  });
});
