import {
  DEFAULT_SETTINGS, DURATIONS, WORD_LIMITS, WORD_BANK_TIERS,
  type PracticeSettings
} from '../typing/exercise-generator';
import { isRecord, StorageError, storageFailure } from './errors';
import { KEYBOARD_TEST_EFFECTS, type KeyboardTestEffect } from '../audio/keyboard-test-sound';

export const PREFERENCES_KEY = 'alicetype.preferences';
export const CARET_STYLES = ['block', 'line', 'underline'] as const;
export type CaretStyle = typeof CARET_STYLES[number];

export interface Preferences extends PracticeSettings {
  readonly caretStyle: CaretStyle;
  readonly soundEnabled: boolean;
  readonly showLiveStats: boolean;
  readonly onboardingComplete: boolean;
  readonly keyboardTestSoundEnabled: boolean;
  readonly keyboardTestSoundEffect: KeyboardTestEffect;
}

export const DEFAULT_PREFERENCES: Preferences = {
  ...DEFAULT_SETTINGS,
  caretStyle: 'block',
  soundEnabled: false,
  showLiveStats: true,
  onboardingComplete: false,
  keyboardTestSoundEnabled: false,
  keyboardTestSoundEffect: 'default'
};

function member<T>(values: readonly T[], value: unknown): value is T {
  return values.some((entry) => entry === value);
}

function validateVersion1(value: unknown): Omit<Preferences, 'keyboardTestSoundEnabled' | 'keyboardTestSoundEffect'> {
  if (!isRecord(value)
    || (value.mode !== 'timed' && value.mode !== 'words')
    || !member(DURATIONS, value.durationSeconds)
    || !member(WORD_LIMITS, value.wordLimit)
    || !member(WORD_BANK_TIERS, value.wordBankTier)
    || !member(CARET_STYLES, value.caretStyle)
    || typeof value.punctuation !== 'boolean' || typeof value.numbers !== 'boolean'
    || typeof value.soundEnabled !== 'boolean' || typeof value.showLiveStats !== 'boolean'
    || typeof value.onboardingComplete !== 'boolean') {
    throw new StorageError('Saved preferences contain invalid or missing settings.');
  }
  return {
    mode: value.mode,
    durationSeconds: value.durationSeconds,
    wordLimit: value.wordLimit,
    wordBankTier: value.wordBankTier,
    punctuation: value.punctuation,
    numbers: value.numbers,
    caretStyle: value.caretStyle,
    soundEnabled: value.soundEnabled,
    showLiveStats: value.showLiveStats,
    onboardingComplete: value.onboardingComplete
  };
}

export function validatePreferences(value: unknown): Preferences {
  const existing = validateVersion1(value);
  if (!isRecord(value) || typeof value.keyboardTestSoundEnabled !== 'boolean') {
    throw new StorageError('Saved preferences contain an invalid keyboard test sound toggle.');
  }
  const effect = KEYBOARD_TEST_EFFECTS.find((effect) => effect.id === value.keyboardTestSoundEffect);
  if (!effect) throw new StorageError('Saved preferences contain an invalid keyboard test sound effect.');
  return { ...existing, keyboardTestSoundEnabled: value.keyboardTestSoundEnabled, keyboardTestSoundEffect: effect.id };
}

export class PreferenceMigrationError extends StorageError {
  constructor(readonly settings: Preferences, cause: StorageError) {
    super(`Preferences were migrated in memory but were not saved. ${cause.message}`, { cause });
  }
}

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function loadPreferences(storage?: PreferenceStorage): Preferences {
  try {
    const raw = (storage ?? window.localStorage).getItem(PREFERENCES_KEY);
    if (raw === null) return { ...DEFAULT_PREFERENCES };
    const record: unknown = JSON.parse(raw);
    if (!isRecord(record) || (record.version !== 1 && record.version !== 2)) {
      throw new StorageError('Saved preferences use an unsupported schema version.');
    }
    if (record.version === 1) {
      const settings = validatePreferences({
        ...validateVersion1(record.settings), keyboardTestSoundEnabled: false, keyboardTestSoundEffect: 'default'
      });
      try { savePreferences(settings, storage); } catch (error) {
        if (!(error instanceof StorageError)) throw error;
        throw new PreferenceMigrationError(settings, error);
      }
      return settings;
    }
    return validatePreferences(record.settings);
  } catch (error) {
    if (error instanceof PreferenceMigrationError) throw error;
    throw storageFailure('Preferences could not be loaded', error);
  }
}

export function savePreferences(settings: Preferences, storage?: PreferenceStorage): void {
  const record = { version: 2, settings: validatePreferences(settings) };
  try {
    (storage ?? window.localStorage).setItem(PREFERENCES_KEY, JSON.stringify(record));
  } catch (error) {
    throw storageFailure('Preferences were not saved', error);
  }
}
