import { B_KEY_HANDS, CODE_LANGUAGES, DRILL_TYPES, DURATIONS, WORD_LIMITS, WORD_BANK_TIERS, type BKeyHand, type CodeLanguage, type DrillType } from '../typing/exercise-generator';
import { getMetrics, isZenSession, type PracticeSession } from '../typing/typing-engine';
import { isRecord, StorageError, storageFailure } from './errors';
import { isLanguageId, type LanguageId } from '../i18n/languages';

export interface HandAttempts {
  readonly left: number;
  readonly right: number;
  readonly thumb: number;
  readonly unattributed: number;
}

/** Direct-keystroke attribution stored from history record version 4. */
export interface SessionAttribution {
  readonly keyAttempts: Readonly<Record<string, number>>;
  readonly handAttempts: HandAttempts;
  readonly bKeyHand: BKeyHand;
}

export const HAND_BUCKETS = ['left', 'right', 'thumb', 'unattributed'] as const;
const SAFE_CODE = /^[A-Za-z][A-Za-z0-9]{0,63}$/;

interface RecordBase {
  readonly version: 2 | 3 | 4;
  readonly language?: LanguageId;
  readonly scoringVersion?: 'committed-grapheme-v1';
  readonly id: string;
  readonly completedAt: number;
  readonly wpm: number;
  readonly totalAttempts: number;
  readonly keyAttempts?: Readonly<Record<string, number>>;
  readonly handAttempts?: HandAttempts;
  readonly bKeyHand?: BKeyHand;
}

interface CopyRecord extends RecordBase {
  readonly accuracy: number;
  readonly correctAttempts: number;
  readonly missedKeys: Readonly<Record<string, number>>;
}

type GeneratedRecord = CopyRecord & {
  readonly mode: 'timed' | 'words';
  readonly limit: number;
  readonly wordBankTier: number;
  readonly punctuation: boolean;
  readonly numbers: boolean;
};

type FiniteRecord = CopyRecord & {
  readonly targetCharacters: number;
  readonly elapsedMs: number;
} & ({ readonly mode: 'quote'; readonly quoteId: string } | { readonly mode: 'custom' }
  | { readonly mode: 'drills'; readonly drillType: DrillType; readonly limit: number }
  | { readonly mode: 'code'; readonly codeLanguage: CodeLanguage; readonly snippetId: string });

type ZenRecord = RecordBase & {
  readonly mode: 'zen';
  readonly retainedCharacters: number;
  readonly elapsedMs: number;
  readonly accuracy: null;
  readonly correctAttempts: null;
  readonly missedKeys: Readonly<Record<string, number>>;
};

export type SessionRecord = GeneratedRecord | FiniteRecord | ZenRecord;

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateLegacyRecord(value: unknown): GeneratedRecord {
  if (!isRecord(value)
    || typeof value.id !== 'string' || !value.id.trim()
    || !finite(value.completedAt) || value.completedAt < 0 || value.completedAt > 8.64e15
    || (value.mode !== 'timed' && value.mode !== 'words')
    || !finite(value.limit)
    || !(value.mode === 'timed' ? [...DURATIONS] : [...WORD_LIMITS]).some((limit) => limit === value.limit)
    || !WORD_BANK_TIERS.some((tier) => tier === value.wordBankTier)
    || typeof value.punctuation !== 'boolean' || typeof value.numbers !== 'boolean'
    || !finite(value.wpm) || value.wpm < 0) {
    throw new StorageError('A saved session contains invalid data.');
  }
  const scoring = validateScoring(value);
  return {
    version: 2,
    id: value.id, completedAt: value.completedAt, mode: value.mode, limit: value.limit,
    wordBankTier: Number(value.wordBankTier), punctuation: value.punctuation, numbers: value.numbers,
    wpm: value.wpm, ...scoring
  };
}

function validateScoring(value: Record<string, unknown>) {
  if (!finite(value.accuracy) || value.accuracy < 0 || value.accuracy > 100
    || !finite(value.totalAttempts) || !Number.isSafeInteger(value.totalAttempts) || value.totalAttempts < 1
    || !finite(value.correctAttempts) || !Number.isSafeInteger(value.correctAttempts)
    || value.correctAttempts < 0 || value.correctAttempts > value.totalAttempts
    || !isRecord(value.missedKeys)) {
    throw new StorageError('A saved session contains invalid data.');
  }
  const missedKeys: Record<string, number> = {};
  let misses = 0;
  for (const [code, count] of Object.entries(value.missedKeys)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(code) || code === 'Unidentified'
      || !finite(count) || !Number.isSafeInteger(count) || count < 1) {
      throw new StorageError('A saved session contains invalid physical-key counts.');
    }
    Object.defineProperty(missedKeys, code, { value: count, enumerable: true });
    misses += count;
  }
  if (misses > value.totalAttempts - value.correctAttempts
    || Math.abs(value.accuracy - Math.round(value.correctAttempts / value.totalAttempts * 1000) / 10) > 0.001) {
    throw new StorageError('A saved session has inconsistent attempt totals.');
  }
  return {
    accuracy: value.accuracy, totalAttempts: value.totalAttempts,
    correctAttempts: value.correctAttempts, missedKeys
  };
}

function safeCount(value: unknown, minimum = 0): value is number {
  return finite(value) && Number.isSafeInteger(value) && value >= minimum;
}

export function validateSessionRecord(value: unknown): SessionRecord {
  if (isRecord(value) && value.version === 4) {
    if (!isLanguageId(value.language) || value.scoringVersion !== 'committed-grapheme-v1') {
      throw new StorageError('A saved session contains invalid language or scoring metadata.');
    }
    const validated = validateRecordBody({ ...value, version: 2 }, true);
    const attribution = validateAttribution(value, validated);
    return { ...validated, version: 4, language: value.language, scoringVersion: value.scoringVersion, ...attribution };
  }
  if (isRecord(value) && value.version === 3) {
    if (!isLanguageId(value.language) || value.scoringVersion !== 'committed-grapheme-v1') {
      throw new StorageError('A saved session contains invalid language or scoring metadata.');
    }
    const validated = validateRecordBody({ ...value, version: 2 }, false);
    return { ...validated, version: 3, language: value.language, scoringVersion: value.scoringVersion };
  }
  return validateRecordBody(value, false);
}

function validateAttribution(value: Record<string, unknown>, record: SessionRecord): SessionAttribution {
  const invalid = () => new StorageError('A saved session contains invalid physical-key attribution.');
  if (!isRecord(value.keyAttempts) || !isRecord(value.handAttempts) || !B_KEY_HANDS.some((hand) => hand === value.bKeyHand)) {
    throw invalid();
  }
  const keyAttempts: Record<string, number> = {};
  for (const [code, count] of Object.entries(value.keyAttempts)) {
    if (!SAFE_CODE.test(code) || code === 'Unidentified' || !safeCount(count, 1)) throw invalid();
    Object.defineProperty(keyAttempts, code, { value: count, enumerable: true });
  }
  const hands = value.handAttempts;
  if (Object.keys(hands).length !== HAND_BUCKETS.length || HAND_BUCKETS.some((bucket) => !safeCount(hands[bucket]))) throw invalid();
  const handAttempts = Object.fromEntries(HAND_BUCKETS.map((bucket) => [bucket, hands[bucket] as number])) as unknown as HandAttempts;
  const handTotal = HAND_BUCKETS.reduce((sum, bucket) => sum + handAttempts[bucket], 0);
  if (handTotal > record.totalAttempts) throw invalid();
  for (const [code, misses] of Object.entries(record.missedKeys)) {
    if (misses > (Object.hasOwn(keyAttempts, code) ? keyAttempts[code] : 0)) throw invalid();
  }
  if (record.mode === 'zen' && (Object.keys(keyAttempts).length || handTotal)) throw invalid();
  return { keyAttempts, handAttempts, bKeyHand: value.bKeyHand as BKeyHand };
}

function validateRecordBody(value: unknown, alice: boolean): SessionRecord {
  const invalid = () => new StorageError('A saved session contains invalid data.');
  if (!isRecord(value) || value.version !== 2
    || typeof value.id !== 'string' || !value.id.trim()
    || !finite(value.completedAt) || value.completedAt < 0 || value.completedAt > 8.64e15
    || !finite(value.wpm) || value.wpm < 0 || !safeCount(value.totalAttempts, 1)) throw invalid();

  const base: RecordBase = {
    version: 2, id: value.id, completedAt: value.completedAt,
    wpm: value.wpm, totalAttempts: value.totalAttempts
  };
  const generated = value.mode === 'timed' || value.mode === 'words';
  const aliceMode = alice && (value.mode === 'drills' || value.mode === 'code');
  const finiteCopy = value.mode === 'quote' || value.mode === 'custom' || aliceMode;
  if (!generated && !finiteCopy && value.mode !== 'zen') throw invalid();
  const branchFields = ['limit', 'wordBankTier', 'punctuation', 'numbers', 'quoteId',
    'targetCharacters', 'retainedCharacters', 'elapsedMs', 'drillType', 'codeLanguage', 'snippetId'];
  const allowedFields = generated
    ? ['limit', 'wordBankTier', 'punctuation', 'numbers']
    : value.mode === 'zen' ? ['retainedCharacters', 'elapsedMs']
      : value.mode === 'quote' ? ['quoteId', 'targetCharacters', 'elapsedMs']
        : value.mode === 'drills' ? ['drillType', 'limit', 'targetCharacters', 'elapsedMs']
          : value.mode === 'code' ? ['codeLanguage', 'snippetId', 'targetCharacters', 'elapsedMs']
            : ['targetCharacters', 'elapsedMs'];
  if (branchFields.some((field) => field in value && !allowedFields.includes(field))) throw invalid();

  if (generated) return validateLegacyRecord(value);
  if (!finite(value.elapsedMs) || value.elapsedMs < 0) throw invalid();
  if (value.mode === 'zen') {
    if (!safeCount(value.retainedCharacters) || value.retainedCharacters > value.totalAttempts
      || value.accuracy !== null || value.correctAttempts !== null
      || !isRecord(value.missedKeys) || Object.keys(value.missedKeys).length !== 0) throw invalid();
    return {
      ...base, mode: 'zen', retainedCharacters: value.retainedCharacters, elapsedMs: value.elapsedMs,
      accuracy: null, correctAttempts: null, missedKeys: {}
    };
  }
  if (value.mode === 'drills' || value.mode === 'code') {
    const code = value.mode === 'code';
    if (!safeCount(value.targetCharacters, code ? 30 : 1) || value.targetCharacters > (code ? 160 : 10_000)
      || value.totalAttempts < value.targetCharacters) throw invalid();
    if (code ? !CODE_LANGUAGES.some((language) => language === value.codeLanguage)
        || typeof value.snippetId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.snippetId)
      : !DRILL_TYPES.some((type) => type === value.drillType) || !WORD_LIMITS.some((limit) => limit === value.limit)) throw invalid();
    const scoring = validateScoring(value);
    const copy = {
      ...base, targetCharacters: value.targetCharacters, elapsedMs: value.elapsedMs,
      accuracy: scoring.accuracy, correctAttempts: scoring.correctAttempts, missedKeys: scoring.missedKeys
    };
    return code
      ? { ...copy, mode: 'code', codeLanguage: value.codeLanguage as CodeLanguage, snippetId: value.snippetId as string }
      : { ...copy, mode: 'drills', drillType: value.drillType as DrillType, limit: value.limit as number };
  }
  if (!safeCount(value.targetCharacters, value.mode === 'quote' ? 40 : 1)
    || value.targetCharacters > (value.mode === 'quote' ? 1000 : 10_000)
    || value.totalAttempts < value.targetCharacters) throw invalid();
  if (value.mode === 'quote'
    && (typeof value.quoteId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.quoteId))) throw invalid();
  const scoring = validateScoring(value);
  const copy = {
    ...base, targetCharacters: value.targetCharacters, elapsedMs: value.elapsedMs,
    accuracy: scoring.accuracy, correctAttempts: scoring.correctAttempts, missedKeys: scoring.missedKeys
  };
  return value.mode === 'quote'
    ? { ...copy, mode: 'quote', quoteId: value.quoteId as string }
    : { ...copy, mode: 'custom' };
}

export function validateStoredSessionRecord(value: unknown): SessionRecord {
  return isRecord(value) && value.version === undefined
    ? validateLegacyRecord(value)
    : validateSessionRecord(value);
}

export const EMPTY_ATTRIBUTION = (bKeyHand: BKeyHand): SessionAttribution => ({
  keyAttempts: {}, handAttempts: { left: 0, right: 0, thumb: 0, unattributed: 0 }, bKeyHand
});

export function completedRecord(
  session: PracticeSession, id: string, startedWallTime: number, missedKeys: Readonly<Record<string, number>>,
  attribution: SessionAttribution
): SessionRecord {
  if (session.status !== 'completed' || !session.configuration) {
    throw new StorageError('Only completed configured sessions can be saved.');
  }
  const metrics = getMetrics(session, session.endedAt);
  const base = {
    version: 4, language: session.configuration.language ?? 'en', scoringVersion: 'committed-grapheme-v1',
    id, completedAt: startedWallTime + metrics.elapsedMs,
    wpm: metrics.wpm, totalAttempts: session.totalAttempts
  };
  if (isZenSession(session)) {
    return validateSessionRecord({
      ...base, mode: 'zen', retainedCharacters: session.retainedCharacters, elapsedMs: metrics.elapsedMs,
      accuracy: null, correctAttempts: null, missedKeys: {}, ...EMPTY_ATTRIBUTION(attribution.bKeyHand)
    });
  }
  const copy = {
    ...base, accuracy: metrics.accuracy, correctAttempts: session.correctAttempts, missedKeys,
    keyAttempts: attribution.keyAttempts, handAttempts: attribution.handAttempts, bKeyHand: attribution.bKeyHand
  };
  const configuration = session.configuration!;
  switch (configuration.mode) {
    case 'timed':
    case 'words':
      return validateSessionRecord({
        ...copy, mode: configuration.mode,
        limit: configuration.mode === 'timed' ? configuration.durationSeconds : configuration.wordLimit,
        wordBankTier: configuration.wordBankTier, punctuation: configuration.punctuation, numbers: configuration.numbers
      });
    case 'quote':
      return validateSessionRecord({
        ...copy, mode: 'quote', quoteId: configuration.quoteId,
        targetCharacters: session.target.length, elapsedMs: metrics.elapsedMs
      });
    case 'custom':
      return validateSessionRecord({
        ...copy, mode: 'custom', targetCharacters: session.target.length, elapsedMs: metrics.elapsedMs
      });
    case 'drills':
      return validateSessionRecord({
        ...copy, mode: 'drills', drillType: configuration.drillType, limit: configuration.wordLimit,
        targetCharacters: session.target.length, elapsedMs: metrics.elapsedMs
      });
    case 'code':
      return validateSessionRecord({
        ...copy, mode: 'code', codeLanguage: configuration.codeLanguage, snippetId: configuration.snippetId,
        targetCharacters: session.target.length, elapsedMs: metrics.elapsedMs
      });
    default:
      throw new StorageError('Only supported configured sessions can be saved.');
  }
}

export const MINIMUM_KEY_ATTEMPTS = 20;
/** Layout-convention reach keys: number row and outer punctuation, not a measured strain. */
export const REACH_KEYS: readonly string[] = [
  'Backquote', ...'1234567890'.split('').map((digit) => `Digit${digit}`), 'Minus', 'Equal',
  'BracketLeft', 'BracketRight', 'Backslash', 'Quote', 'Slash'
];
export const HOME_ROW_KEYS: readonly string[] = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];

export interface KeyAccuracy {
  readonly code: string;
  readonly attempts: number;
  readonly misses: number;
  /** Percentage, 0-100. */
  readonly accuracy: number;
}

export function summarizeAttribution(records: readonly SessionRecord[]) {
  const hands = { left: 0, right: 0, thumb: 0, unattributed: 0 };
  const attempts = new Map<string, number>();
  const misses = new Map<string, number>();
  let included = 0;
  let excluded = 0;
  for (const record of records) {
    if (record.mode === 'zen') continue;
    if (!record.keyAttempts || !record.handAttempts) {
      excluded += 1;
      continue;
    }
    included += 1;
    for (const bucket of HAND_BUCKETS) hands[bucket] += record.handAttempts[bucket];
    for (const [code, count] of Object.entries(record.keyAttempts)) attempts.set(code, (attempts.get(code) ?? 0) + count);
    for (const [code, count] of Object.entries(record.missedKeys)) misses.set(code, (misses.get(code) ?? 0) + count);
  }
  const keys: KeyAccuracy[] = [...attempts]
    .filter(([, count]) => count >= MINIMUM_KEY_ATTEMPTS)
    .map(([code, count]) => {
      const missed = misses.get(code) ?? 0;
      return { code, attempts: count, misses: missed, accuracy: Math.round((1 - missed / count) * 1000) / 10 };
    })
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || a.code.localeCompare(b.code));
  const pooled = (codes: readonly string[]) => {
    let total = 0;
    let missed = 0;
    for (const key of keys) if (codes.includes(key.code)) { total += key.attempts; missed += key.misses; }
    return total ? Math.round((1 - missed / total) * 1000) / 10 : null;
  };
  return {
    included, excluded, hands,
    keys,
    reachKeys: keys.filter((key) => REACH_KEYS.includes(key.code)),
    reachAccuracy: pooled(REACH_KEYS),
    homeRowAccuracy: pooled(HOME_ROW_KEYS)
  };
}

export function summarizeSessions(records: readonly SessionRecord[]) {
  const count = records.length;
  const keys = new Map<string, number>();
  let bestWpm = 0;
  let wpm = 0;
  let accuracy = 0;
  let targetCount = 0;
  let zenCount = 0;
  let zenBestWpm = 0;
  let zenWpm = 0;
  let committedAccuracy = 0;
  let committedCount = 0;
  let legacyAccuracy = 0;
  let legacyCount = 0;
  for (const record of records) {
    if (record.mode === 'zen') {
      zenCount += 1;
      zenBestWpm = Math.max(zenBestWpm, record.wpm);
      zenWpm += record.wpm;
      continue;
    }
    targetCount += 1;
    bestWpm = Math.max(bestWpm, record.wpm);
    wpm += record.wpm;
    accuracy += record.accuracy;
    if (record.scoringVersion === 'committed-grapheme-v1') {
      committedAccuracy += record.accuracy;
      committedCount++;
    } else {
      legacyAccuracy += record.accuracy;
      legacyCount++;
    }
    for (const [code, misses] of Object.entries(record.missedKeys)) {
      keys.set(code, (keys.get(code) ?? 0) + misses);
    }
  }
  return {
    count, targetCount, bestWpm: targetCount ? bestWpm : null,
    averageWpm: targetCount ? Math.round(wpm / targetCount) : null,
    averageAccuracy: targetCount ? (accuracy / targetCount).toFixed(1) : null,
    committedAccuracy: committedCount ? committedAccuracy / committedCount : null,
    legacyAccuracy: legacyCount ? legacyAccuracy / legacyCount : null,
    zenCount, zenBestWpm: zenCount ? zenBestWpm : null,
    zenAverageWpm: zenCount ? Math.round(zenWpm / zenCount) : null,
    missedKeys: [...keys].sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
  };
}

// About three years of daily practice at roughly one session per day, kept small enough for fast reads and rendering.
export const MAX_SESSION_HISTORY = 1000;

export class SessionHistory {
  private connection: IDBDatabase | undefined;
  private opening: Promise<IDBDatabase> | undefined;
  private disposed = false;

  private open(): Promise<IDBDatabase> {
    if (this.disposed) return Promise.reject(new StorageError('Session history has been closed.'));
    if (this.connection) return Promise.resolve(this.connection);
    if (this.opening) return this.opening;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        if (!window.indexedDB) throw new StorageError('IndexedDB is unavailable in this browser.');
        request = window.indexedDB.open('alicetype', 1);
      } catch (error) {
        reject(storageFailure('History could not be opened', error));
        return;
      }
      let cancelled = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('completedAt', 'completedAt');
        }
      };
      request.onblocked = () => {
        cancelled = true;
        reject(new StorageError('History upgrade is blocked. Close other AliceType tabs, then retry.'));
      };
      request.onerror = () => reject(storageFailure('History could not be opened', request.error));
      request.onsuccess = () => {
        const db = request.result;
        if (cancelled || this.disposed) {
          db.close();
          reject(new StorageError('History opening was cancelled. Please retry.'));
          return;
        }
        this.connection = db;
        db.onversionchange = () => {
          db.close();
          if (this.connection === db) this.connection = undefined;
        };
        db.onclose = () => {
          if (this.connection === db) this.connection = undefined;
        };
        resolve(db);
      };
    });
    this.opening = opening;
    void opening.then(
      () => { if (this.opening === opening) this.opening = undefined; },
      () => { if (this.opening === opening) this.opening = undefined; }
    );
    return opening;
  }

  private async transaction<T>(
    mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      try {
        const transaction = db.transaction('sessions', mode);
        const request = operation(transaction.objectStore('sessions'));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(storageFailure(
          'History transaction failed', transaction.error ?? new StorageError('The transaction was aborted.')
        ));
      } catch (error) {
        reject(storageFailure('History transaction failed', error));
      }
    });
  }

  async save(record: SessionRecord): Promise<void> {
    const validated = validateSessionRecord(record);
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      try {
        const transaction = db.transaction('sessions', 'readwrite');
        const store = transaction.objectStore('sessions');
        store.put(validated);
        const countRequest = store.count();
        countRequest.onsuccess = () => {
          let excess = countRequest.result - MAX_SESSION_HISTORY;
          if (excess <= 0) return;
          // Oldest sessions first; the index is ordered by completedAt ascending.
          const cursorRequest = store.index('completedAt').openKeyCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor || excess <= 0) return;
            store.delete(cursor.primaryKey);
            excess -= 1;
            cursor.continue();
          };
        };
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(storageFailure(
          'History transaction failed', transaction.error ?? new StorageError('The transaction was aborted.')
        ));
      } catch (error) {
        reject(storageFailure('History transaction failed', error));
      }
    });
  }

  async read(): Promise<SessionRecord[]> {
    const values: unknown[] = await this.transaction('readonly', (store) => store.getAll());
    return values.map(validateStoredSessionRecord).sort((a, b) => b.completedAt - a.completedAt || a.id.localeCompare(b.id));
  }

  async clear(): Promise<void> {
    await this.transaction('readwrite', (store) => store.clear());
  }

  close(): void {
    this.disposed = true;
    this.connection?.close();
    this.connection = undefined;
  }
}
