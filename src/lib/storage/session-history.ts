import { DURATIONS, WORD_LIMITS, WORD_BANK_TIERS } from '../typing/exercise-generator';
import { getMetrics, type TypingSession } from '../typing/typing-engine';
import { isRecord, StorageError, storageFailure } from './errors';

export interface SessionRecord {
  readonly id: string;
  readonly completedAt: number;
  readonly mode: 'timed' | 'words';
  readonly limit: number;
  readonly wordBankTier: number;
  readonly punctuation: boolean;
  readonly numbers: boolean;
  readonly wpm: number;
  readonly accuracy: number;
  readonly totalAttempts: number;
  readonly correctAttempts: number;
  readonly missedKeys: Readonly<Record<string, number>>;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateSessionRecord(value: unknown): SessionRecord {
  if (!isRecord(value)
    || typeof value.id !== 'string' || !value.id.trim()
    || !finite(value.completedAt) || value.completedAt < 0 || value.completedAt > 8.64e15
    || (value.mode !== 'timed' && value.mode !== 'words')
    || !finite(value.limit)
    || !(value.mode === 'timed' ? [...DURATIONS] : [...WORD_LIMITS]).some((limit) => limit === value.limit)
    || !WORD_BANK_TIERS.some((tier) => tier === value.wordBankTier)
    || typeof value.punctuation !== 'boolean' || typeof value.numbers !== 'boolean'
    || !finite(value.wpm) || value.wpm < 0
    || !finite(value.accuracy) || value.accuracy < 0 || value.accuracy > 100
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
    id: value.id, completedAt: value.completedAt, mode: value.mode, limit: value.limit,
    wordBankTier: Number(value.wordBankTier), punctuation: value.punctuation, numbers: value.numbers,
    wpm: value.wpm, accuracy: value.accuracy, totalAttempts: value.totalAttempts,
    correctAttempts: value.correctAttempts, missedKeys
  };
}

export function completedRecord(
  session: TypingSession, id: string, startedWallTime: number, missedKeys: Readonly<Record<string, number>>
): SessionRecord {
  if (session.status !== 'completed' || !session.configuration) {
    throw new StorageError('Only completed configured sessions can be saved.');
  }
  const metrics = getMetrics(session, session.endedAt);
  const configuration = session.configuration;
  return validateSessionRecord({
    id,
    completedAt: startedWallTime + metrics.elapsedMs,
    mode: configuration.mode,
    limit: configuration.mode === 'timed' ? configuration.durationSeconds : configuration.wordLimit,
    wordBankTier: configuration.wordBankTier, punctuation: configuration.punctuation, numbers: configuration.numbers,
    wpm: metrics.wpm, accuracy: metrics.accuracy, totalAttempts: session.totalAttempts,
    correctAttempts: session.correctAttempts, missedKeys
  });
}

export function summarizeSessions(records: readonly SessionRecord[]) {
  const count = records.length;
  const keys = new Map<string, number>();
  let bestWpm = 0;
  let wpm = 0;
  let accuracy = 0;
  for (const record of records) {
    bestWpm = Math.max(bestWpm, record.wpm);
    wpm += record.wpm;
    accuracy += record.accuracy;
    for (const [code, misses] of Object.entries(record.missedKeys)) {
      keys.set(code, (keys.get(code) ?? 0) + misses);
    }
  }
  return {
    count, bestWpm,
    averageWpm: count ? Math.round(wpm / count) : 0,
    averageAccuracy: count ? (accuracy / count).toFixed(1) : '0.0',
    missedKeys: [...keys].sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
  };
}

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
    await this.transaction('readwrite', (store) => store.put(validated));
  }

  async read(): Promise<SessionRecord[]> {
    const values: unknown[] = await this.transaction('readonly', (store) => store.getAll());
    return values.map(validateSessionRecord).sort((a, b) => b.completedAt - a.completedAt || a.id.localeCompare(b.id));
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
