import {
  DEFAULT_SETTINGS, DURATIONS, WORD_LIMITS, WORD_BANK_TIERS,
  type PracticeSettings
} from '../typing/exercise-generator';
import { isRecord, StorageError, storageFailure } from './errors';

export const PREFERENCES_KEY = 'alicetype.preferences';
export const CARET_STYLES = ['block', 'line', 'underline'] as const;
export type CaretStyle = typeof CARET_STYLES[number];

export interface Preferences extends PracticeSettings {
  readonly caretStyle: CaretStyle;
  readonly soundEnabled: boolean;
  readonly showLiveStats: boolean;
  readonly onboardingComplete: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  ...DEFAULT_SETTINGS,
  caretStyle: 'block',
  soundEnabled: false,
  showLiveStats: true,
  onboardingComplete: false
};

function member<T>(values: readonly T[], value: unknown): value is T {
  return values.some((entry) => entry === value);
}

export function validatePreferences(value: unknown): Preferences {
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

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function loadPreferences(storage?: PreferenceStorage): Preferences {
  try {
    const raw = (storage ?? window.localStorage).getItem(PREFERENCES_KEY);
    if (raw === null) return { ...DEFAULT_PREFERENCES };
    const record: unknown = JSON.parse(raw);
    if (!isRecord(record) || record.version !== 1) {
      throw new StorageError('Saved preferences use an unsupported schema version.');
    }
    return validatePreferences(record.settings);
  } catch (error) {
    throw storageFailure('Preferences could not be loaded', error);
  }
}

export function savePreferences(settings: Preferences, storage?: PreferenceStorage): void {
  const record = { version: 1, settings: validatePreferences(settings) };
  try {
    (storage ?? window.localStorage).setItem(PREFERENCES_KEY, JSON.stringify(record));
  } catch (error) {
    throw storageFailure('Preferences were not saved', error);
  }
}
