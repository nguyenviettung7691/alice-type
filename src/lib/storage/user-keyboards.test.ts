import { describe, expect, it, vi } from 'vitest';
import {
  activeKeyboard, addKeyboard, DEFAULT_PREFERENCES, deleteKeyboard, editKeyboard,
  loadPreferences, PREFERENCES_KEY, PreferenceMigrationError, savePreferences, switchKeyboard, validatePreferences
} from './preferences';
import { MAX_USER_KEYBOARDS, snapshotKeyboard, validateKeyboardIdentity } from '../keyboard/user-keyboards';
import { StorageError } from './errors';
import { sessionsForKeyboard, summarizeAttribution, summarizeSessions, validateSessionRecord } from './session-history';

function collection() {
  const preferences = validatePreferences({
    ...DEFAULT_PREFERENCES, language: 'vi', bKeyHand: 'right',
    keyboardProfileId: 'projectkb-alice', keyboardUserDetails: { name: 'First board' },
    keyboardLayoutConfirmation: { profileId: 'projectkb-alice', variant: {}, catalogRevision: 'r1', confirmedFor: null },
    keyboardKeymapImport: {
      profileId: 'projectkb-alice', catalogRevision: 'r1', variantKey: '{}',
      format: 'via', fileName: 'first.json', importedAt: 1, layers: [['KC_A']]
    }
  });
  return addKeyboard(preferences, 'Second board', false, 'second-board');
}

describe('physical keyboard collection', () => {
  it.each([1, 2, 3, 4, 5, 6, 7])('migrates v%i into one board with exactly one write', (version) => {
    const { keyboardBoards: _boards, activeKeyboardId: _id, ...old } = DEFAULT_PREFERENCES;
    const storage = {
      getItem: () => JSON.stringify({ version, settings: { ...old, keyboardUserDetails: { name: 'Desk board' }, bKeyHand: 'right' } }),
      setItem: vi.fn()
    };
    const value = loadPreferences(storage);
    expect(value.activeKeyboardId).toBe('default-board');
    expect(value.keyboardBoards).toHaveLength(1);
    expect(activeKeyboard(value).settings.keyboardUserDetails).toEqual(version >= 3 ? { name: 'Desk board' } : {});
    expect(activeKeyboard(value).settings.bKeyHand).toBe(version === 7 ? 'right' : 'left');
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const [key, raw] = storage.setItem.mock.calls[0];
    expect(key).toBe(PREFERENCES_KEY);
    expect(JSON.parse(raw)).toEqual({ version: 8, settings: value });
  });

  it('restores every board setting without changing global preferences', () => {
    const second = collection();
    expect(second.language).toBe('vi');
    expect(second.keyboardProfileId).toBeNull();
    expect(second.keyboardKeymapImport).toBeNull();
    expect(second.bKeyHand).toBe('left');
    const first = switchKeyboard(second, 'default-board');
    expect(first.language).toBe('vi');
    expect(first.keyboardUserDetails).toEqual({ name: 'First board' });
    expect(first.keyboardKeymapImport?.fileName).toBe('first.json');
    expect(first.keyboardLayoutConfirmation?.profileId).toBe('projectkb-alice');
    expect(first.bKeyHand).toBe('right');
    const updated = validatePreferences({ ...first, keyboardKeymapImport: null, bKeyHand: 'left' });
    expect(switchKeyboard(switchKeyboard(updated, 'second-board'), 'default-board').keyboardKeymapImport).toBeNull();
    expect(() => switchKeyboard(first, 'missing')).toThrow(StorageError);
  });

  it('duplicates setup with a fresh identity and independently cloned data', () => {
    const first = switchKeyboard(collection(), 'default-board');
    const duplicate = addKeyboard(first, 'Duplicate', true, 'copy-board');
    const source = duplicate.keyboardBoards[0];
    const copy = activeKeyboard(duplicate);
    expect(copy.settings).toEqual(source.settings);
    expect(copy.id).not.toBe(source.id);
    expect(copy.hardware).not.toBe(source.hardware);
    expect(copy.settings.keyboardUserDetails).not.toBe(source.settings.keyboardUserDetails);
    expect(copy.settings.keyboardKeymapImport?.layers).not.toBe(source.settings.keyboardKeymapImport?.layers);
  });

  it('round trips all profiles in one atomic envelope and normalizes metadata', () => {
    const current = collection();
    const value = editKeyboard(current, {
      ...activeKeyboard(current), name: '  Second  ',
      hardware: { family: 'arisu', switchType: 'tactile', actuationForce: 62, keycapProfile: ' MT3 ', tentingAngle: 0 },
      thumbs: { left: 'layer-1', right: 'space' }
    });
    const storage = { getItem: () => '', setItem: vi.fn() };
    savePreferences(value, storage);
    const raw = storage.setItem.mock.calls[0][1];
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const loaded = loadPreferences({ ...storage, getItem: () => raw });
    expect(loaded).toEqual(value);
    expect(activeKeyboard(loaded)).toMatchObject({ name: 'Second', hardware: { keycapProfile: 'MT3', tentingAngle: 0 } });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('deletes only the active profile, chooses a remaining board and protects the last one', () => {
    const next = deleteKeyboard(collection());
    expect(next.activeKeyboardId).toBe('default-board');
    expect(next.keyboardBoards).toHaveLength(1);
    expect(next.keyboardUserDetails.name).toBe('First board');
    expect(() => deleteKeyboard(next)).toThrow(/at least one/);
  });

  it('enforces collection limits and rejects duplicate and orphan identities', () => {
    let settings = DEFAULT_PREFERENCES;
    for (let index = 1; index < MAX_USER_KEYBOARDS; index++) settings = addKeyboard(settings, 'Same name', false, `board-${index}`);
    expect(() => addKeyboard(settings, 'Too many')).toThrow(/full/);
    expect(() => addKeyboard(DEFAULT_PREFERENCES, 'Duplicate ID', false, 'default-board')).toThrow(/duplicate/);
    expect(() => validatePreferences({ ...collection(), activeKeyboardId: 'missing' })).toThrow(/missing active/);
  });

  it.each([
    { name: ' ' }, { name: 'a'.repeat(81) }, { id: '__proto__' }, { id: '' },
    { hardware: { family: 'invented' } }, { thumbs: { left: 'unknown', right: 'Fn99' } }
  ])('rejects invalid identity %j', (override) => {
    expect(() => validateKeyboardIdentity({ ...activeKeyboard(DEFAULT_PREFERENCES), ...override })).toThrow(StorageError);
  });

  it.each([
    ['actuationForce', 0], ['actuationForce', 201], ['actuationForce', NaN], ['actuationForce', '45'],
    ['tentingAngle', -1], ['tentingAngle', 91], ['tentingAngle', Infinity], ['keycapProfile', 'x'.repeat(41)]
  ])('rejects invalid %s measurement %s', (field, value) => {
    const board = activeKeyboard(DEFAULT_PREFERENCES);
    expect(() => validateKeyboardIdentity({ ...board, hardware: { ...board.hardware, [field]: value } })).toThrow(StorageError);
  });

  it('validates inactive configurations and never overwrites corrupt saved data', () => {
    const value = collection();
    for (const settings of [{}, { ...value.keyboardBoards[0].settings, keyboardKeymapImport: { format: 'bad' } }]) {
      const raw = JSON.stringify({ version: 8, settings: {
        ...value, keyboardBoards: [{ ...value.keyboardBoards[0], settings }, value.keyboardBoards[1]]
      } });
      const storage = { getItem: () => raw, setItem: vi.fn() };
      expect(() => loadPreferences(storage)).toThrow(StorageError);
      expect(storage.setItem).not.toHaveBeenCalled();
    }
  });

  it('keeps migrated board data recoverable on quota failure', () => {
    const raw = JSON.stringify({ version: 7, settings: DEFAULT_PREFERENCES });
    const storage = { getItem: () => raw, setItem: vi.fn(() => { throw new Error('Quota'); }) };
    try {
      loadPreferences(storage);
      expect.fail('Expected migration failure');
    } catch (error) {
      expect(error).toBeInstanceOf(PreferenceMigrationError);
      if (!(error instanceof PreferenceMigrationError)) throw error;
      expect(error.settings.keyboardBoards).toHaveLength(1);
      expect(storage.getItem()).toBe(raw);
    }
  });
});

describe('board-aware history', () => {
  const v4 = {
    version: 4, language: 'en', scoringVersion: 'committed-grapheme-v1', id: 'session', completedAt: 1000,
    mode: 'words', limit: 10, wordBankTier: 200, punctuation: false, numbers: false,
    wpm: 40, totalAttempts: 20, correctAttempts: 18, accuracy: 90, missedKeys: { KeyB: 2 },
    keyAttempts: { KeyB: 20 }, handAttempts: { left: 20, right: 0, thumb: 0, unattributed: 0 }, bKeyHand: 'left'
  };

  it('preserves a copied hardware snapshot independently of subsequent metadata changes', () => {
    const board = activeKeyboard(DEFAULT_PREFERENCES);
    const record = validateSessionRecord({ ...v4, version: 5, keyboard: snapshotKeyboard(board) });
    const edited = editKeyboard(DEFAULT_PREFERENCES, { ...board, name: 'New name', hardware: { ...board.hardware, tentingAngle: 30 } });
    expect(record.keyboard?.name).toBe('My keyboard');
    expect(record.keyboard?.hardware.tentingAngle).toBeNull();
    expect(activeKeyboard(edited).hardware.tentingAngle).toBe(30);
    expect(record.keyboard?.hardware).not.toBe(board.hardware);
    expect(record.keyboard).not.toHaveProperty('settings');
  });

  it('isolates all aggregation inputs by ID, leaving legacy results unassigned', () => {
    const first = validateSessionRecord({ ...v4, version: 5, keyboard: snapshotKeyboard(activeKeyboard(DEFAULT_PREFERENCES)) });
    const second = validateSessionRecord({ ...v4, id: 'second', version: 5, keyboard: snapshotKeyboard(activeKeyboard(collection())) });
    const old = validateSessionRecord(v4);
    const records = [first, second, old];
    expect(sessionsForKeyboard(records, null)).toEqual([old]);
    expect(sessionsForKeyboard(records, 'missing')).toEqual([]);
    const selected = sessionsForKeyboard(records, 'second-board');
    expect(selected).toEqual([second]);
    expect(summarizeSessions(selected).missedKeys).toEqual([['KeyB', 2]]);
    expect(summarizeAttribution(selected).keys).toEqual([{ code: 'KeyB', attempts: 20, misses: 2, accuracy: 90 }]);
  });

  it('rejects missing/invalid snapshots and inconsistent B-hand metadata', () => {
    expect(() => validateSessionRecord({ ...v4, version: 5 })).toThrow(StorageError);
    expect(() => validateSessionRecord({
      ...v4, version: 5, keyboard: { ...snapshotKeyboard(activeKeyboard(DEFAULT_PREFERENCES)), bKeyHand: 'right' }
    })).toThrow(/disagree/);
    expect(validateSessionRecord(v4)).not.toHaveProperty('keyboard');
  });
});
