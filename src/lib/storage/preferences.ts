import {
  DEFAULT_SETTINGS, DURATIONS, WORD_LIMITS, WORD_BANK_TIERS,
  type PracticeSettings
} from '../typing/exercise-generator';
import { isRecord, StorageError, storageFailure } from './errors';
import { KEYBOARD_TEST_EFFECTS, type KeyboardTestEffect } from '../audio/keyboard-test-sound';
import { isKeyboardProfileId } from '../keyboard/keyboard-profiles';

export const PREFERENCES_KEY = 'alicetype.preferences';
export const CARET_STYLES = ['block', 'line', 'underline'] as const;
export type CaretStyle = typeof CARET_STYLES[number];

export const KEYBOARD_DETAIL_TEXT_FIELDS = ['name', 'brand', 'model', 'version', 'connectivity'] as const;
export const KEYBOARD_DETAIL_BOOLEAN_FIELDS = ['rgbBacklighting', 'keyRollover', 'programmableKeys'] as const;
export const KEYBOARD_DETAIL_MAX_LENGTH = 120;

export type KeyboardUserDetails = Readonly<
  Partial<Record<typeof KEYBOARD_DETAIL_TEXT_FIELDS[number], string>
    & Record<typeof KEYBOARD_DETAIL_BOOLEAN_FIELDS[number], boolean>>
>;

export interface KeyboardLayoutConfirmation {
  readonly profileId: string;
  /** Selected option index per variant group index. */
  readonly variant: Readonly<Record<string, number>>;
  readonly confirmedFor: { readonly vendorId: number; readonly productId: number } | null;
  readonly catalogRevision: string;
}

export interface Preferences extends PracticeSettings {
  readonly caretStyle: CaretStyle;
  readonly soundEnabled: boolean;
  readonly showLiveStats: boolean;
  readonly onboardingComplete: boolean;
  readonly keyboardTestSoundEnabled: boolean;
  readonly keyboardTestSoundEffect: KeyboardTestEffect;
  readonly keyboardProfileId: string | null;
  readonly keyboardUserDetails: KeyboardUserDetails;
  readonly keyboardLayoutConfirmation: KeyboardLayoutConfirmation | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  ...DEFAULT_SETTINGS,
  caretStyle: 'block',
  soundEnabled: false,
  showLiveStats: true,
  onboardingComplete: false,
  keyboardTestSoundEnabled: false,
  keyboardTestSoundEffect: 'default',
  keyboardProfileId: null,
  keyboardUserDetails: {},
  keyboardLayoutConfirmation: null
};

function member<T>(values: readonly T[], value: unknown): value is T {
  return values.some((entry) => entry === value);
}

type Version1Preferences = Omit<Preferences,
  'keyboardTestSoundEnabled' | 'keyboardTestSoundEffect' | 'keyboardProfileId' | 'keyboardUserDetails'
  | 'keyboardLayoutConfirmation'>;
type Version2Preferences = Omit<Preferences, 'keyboardProfileId' | 'keyboardUserDetails' | 'keyboardLayoutConfirmation'>;
type Version3Preferences = Omit<Preferences, 'keyboardLayoutConfirmation'>;

function validateVersion1(value: unknown): Version1Preferences {
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

function validateVersion2(value: unknown): Version2Preferences {
  const existing = validateVersion1(value);
  if (!isRecord(value) || typeof value.keyboardTestSoundEnabled !== 'boolean') {
    throw new StorageError('Saved preferences contain an invalid keyboard test sound toggle.');
  }
  const effect = KEYBOARD_TEST_EFFECTS.find((effect) => effect.id === value.keyboardTestSoundEffect);
  if (!effect) throw new StorageError('Saved preferences contain an invalid keyboard test sound effect.');
  return { ...existing, keyboardTestSoundEnabled: value.keyboardTestSoundEnabled, keyboardTestSoundEffect: effect.id };
}

function validateKeyboardUserDetails(value: unknown): KeyboardUserDetails {
  if (!isRecord(value)) throw new StorageError('Saved keyboard details are invalid.');
  const details: Partial<Record<typeof KEYBOARD_DETAIL_TEXT_FIELDS[number], string>
    & Record<typeof KEYBOARD_DETAIL_BOOLEAN_FIELDS[number], boolean>> = {};
  for (const field of KEYBOARD_DETAIL_TEXT_FIELDS) {
    const entry = value[field];
    if (entry === undefined) continue;
    if (typeof entry !== 'string') throw new StorageError(`Saved keyboard detail "${field}" must be text.`);
    const trimmed = entry.trim();
    if (trimmed.length > KEYBOARD_DETAIL_MAX_LENGTH) {
      throw new StorageError(`Saved keyboard detail "${field}" exceeds ${KEYBOARD_DETAIL_MAX_LENGTH} characters.`);
    }
    if (trimmed) details[field] = trimmed;
  }
  for (const field of KEYBOARD_DETAIL_BOOLEAN_FIELDS) {
    const entry = value[field];
    if (entry === undefined) continue;
    if (typeof entry !== 'boolean') throw new StorageError(`Saved keyboard detail "${field}" must be yes or no.`);
    details[field] = entry;
  }
  return details;
}

function validateVersion3(value: unknown): Version3Preferences {
  const existing = validateVersion2(value);
  if (!isRecord(value)) throw new StorageError('Saved preferences contain invalid keyboard details.');
  const profileId = value.keyboardProfileId;
  if (profileId !== null && !isKeyboardProfileId(profileId)) {
    throw new StorageError('Saved preferences refer to an unknown keyboard profile.');
  }
  return {
    ...existing,
    keyboardProfileId: profileId,
    keyboardUserDetails: validateKeyboardUserDetails(value.keyboardUserDetails)
  };
}

const MAX_VARIANT_GROUPS = 32;
const MAX_REVISION_LENGTH = 40;

function validateLayoutConfirmation(value: unknown, profileId: string | null): KeyboardLayoutConfirmation | null {
  if (value === null) return null;
  const invalid = () => new StorageError('Saved keyboard layout confirmation is invalid.');
  if (!isRecord(value) || typeof value.profileId !== 'string' || !isRecord(value.variant)) throw invalid();
  if (value.profileId !== profileId) {
    throw new StorageError('Saved keyboard layout confirmation does not match the selected keyboard profile.');
  }
  const entries = Object.entries(value.variant);
  if (entries.length > MAX_VARIANT_GROUPS
    || entries.some(([group, option]) => !/^(0|[1-9]\d?)$/.test(group) || !Number.isInteger(option) || (option as number) < 0
      || (option as number) > 99)) throw invalid();
  const { confirmedFor, catalogRevision } = value;
  const usbId = (id: unknown) => Number.isInteger(id) && (id as number) >= 0 && (id as number) <= 0xffff;
  if (confirmedFor !== null && (!isRecord(confirmedFor) || !usbId(confirmedFor.vendorId) || !usbId(confirmedFor.productId))) {
    throw invalid();
  }
  if (typeof catalogRevision !== 'string' || !catalogRevision.trim() || catalogRevision.length > MAX_REVISION_LENGTH) {
    throw invalid();
  }
  return {
    profileId: value.profileId,
    variant: Object.fromEntries(entries) as Record<string, number>,
    confirmedFor: confirmedFor === null
      ? null
      : { vendorId: confirmedFor.vendorId as number, productId: confirmedFor.productId as number },
    catalogRevision
  };
}

export function validatePreferences(value: unknown): Preferences {
  const existing = validateVersion3(value);
  if (!isRecord(value)) throw new StorageError('Saved preferences contain invalid keyboard details.');
  return {
    ...existing,
    keyboardLayoutConfirmation: validateLayoutConfirmation(value.keyboardLayoutConfirmation, existing.keyboardProfileId)
  };
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
    if (!isRecord(record) || (record.version !== 1 && record.version !== 2 && record.version !== 3 && record.version !== 4)) {
      throw new StorageError('Saved preferences use an unsupported schema version.');
    }
    if (record.version === 4) return validatePreferences(record.settings);

    let migrated: Preferences;
    if (record.version === 1) {
      const phaseOne = validateVersion1(record.settings);
      migrated = validatePreferences({
        ...phaseOne,
        keyboardTestSoundEnabled: false,
        keyboardTestSoundEffect: 'default',
        keyboardProfileId: null,
        keyboardUserDetails: {},
        keyboardLayoutConfirmation: null
      });
    } else if (record.version === 2) {
      const phaseTwo = validateVersion2(record.settings);
      migrated = validatePreferences({
        ...phaseTwo,
        keyboardProfileId: null,
        keyboardUserDetails: {},
        keyboardLayoutConfirmation: null
      });
    } else {
      migrated = validatePreferences({ ...validateVersion3(record.settings), keyboardLayoutConfirmation: null });
    }
    try {
      savePreferences(migrated, storage);
    } catch (error) {
      if (error instanceof StorageError) {
        throw new PreferenceMigrationError(migrated, error);
      }
      throw error;
    }
    return migrated;
  } catch (error) {
    if (error instanceof PreferenceMigrationError) throw error;
    throw storageFailure('Preferences could not be loaded', error);
  }
}

export function savePreferences(settings: Preferences, storage?: PreferenceStorage): void {
  const record = { version: 4, settings: validatePreferences(settings) };
  try {
    (storage ?? window.localStorage).setItem(PREFERENCES_KEY, JSON.stringify(record));
  } catch (error) {
    throw storageFailure('Preferences were not saved', error);
  }
}
