import { getWordBank } from './exercise-generator';
import type { LanguageId } from '../i18n/languages';
import { keyForCharacter } from '../keyboard/key-for-character';
import type { SessionRecord } from '../storage/session-history';

export const MIN_ADAPTIVE_KEY_ATTEMPTS = 20;
export const MIN_ADAPTIVE_SESSIONS = 3;
export const MIN_ADAPTIVE_CANDIDATES = 20;
export const MIN_ADAPTIVE_COVERAGE = 0.6;
export const MAX_ADAPTIVE_KEYS = 5;
export const ADAPTIVE_WORD_COUNT = 10;

export interface AdaptiveDrill {
  readonly target: string;
  readonly wordEnds: readonly number[];
  readonly keys: readonly string[];
  readonly sampleAttempts: number;
  readonly sampleSessions: number;
  readonly candidateCount: number;
  readonly coverage: number;
}

export type AdaptiveDrillResult =
  | { readonly kind: 'ready'; readonly drill: AdaptiveDrill }
  | { readonly kind: 'insufficient'; readonly reason: 'keys' | 'candidates' | 'coverage' };

function seededRandom(seedText: string): () => number {
  let seed = 0x811c9dc5;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 0x01000193);
  }
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

export function buildAdaptiveDrill(
  records: readonly SessionRecord[],
  boardId: string,
  language: LanguageId
): AdaptiveDrillResult {
  const attempts = new Map<string, number>();
  const misses = new Map<string, number>();
  const keySessions = new Map<string, number>();
  for (const record of records) {
    if (record.mode === 'zen' || record.mode === 'command' || record.keyboard?.id !== boardId
      || (record.language ?? 'en') !== language || record.scoringVersion !== 'committed-grapheme-v1'
      || !record.keyAttempts) continue;
    for (const [code, count] of Object.entries(record.keyAttempts)) {
      attempts.set(code, (attempts.get(code) ?? 0) + count);
      keySessions.set(code, (keySessions.get(code) ?? 0) + 1);
    }
    for (const [code, count] of Object.entries(record.missedKeys)) misses.set(code, (misses.get(code) ?? 0) + count);
  }
  const weakKeys = [...attempts]
    .filter(([code, count]) => count >= MIN_ADAPTIVE_KEY_ATTEMPTS
      && (keySessions.get(code) ?? 0) >= MIN_ADAPTIVE_SESSIONS)
    .map(([code, count]) => ({ code, count, misses: misses.get(code) ?? 0 }))
    .sort((a, b) => b.misses / b.count - a.misses / a.count || b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, MAX_ADAPTIVE_KEYS);
  if (!weakKeys.length) return { kind: 'insufficient', reason: 'keys' };

  const weakCodes = new Set(weakKeys.map((key) => key.code));
  const candidates = getWordBank(5000, language).filter((token) =>
    Array.from(token).some((character) => {
      const target = keyForCharacter(character, null);
      return target !== null && weakCodes.has(target.code);
    }));
  if (candidates.length < MIN_ADAPTIVE_CANDIDATES) return { kind: 'insufficient', reason: 'candidates' };

  const eligibleRecordIds = records
    .filter((record) => record.mode !== 'zen' && record.mode !== 'command'
      && record.keyboard?.id === boardId && (record.language ?? 'en') === language
      && record.scoringVersion === 'committed-grapheme-v1')
    .map((record) => record.id)
    .sort();
  const random = seededRandom(`${boardId}|${language}|${weakKeys.map(({ code }) => code).join(',')}|${eligibleRecordIds.join(',')}`);
  const shuffled = [...candidates];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  const selected = shuffled.slice(0, ADAPTIVE_WORD_COUNT);
  const coverage = selected.filter((token) => Array.from(token).some((character) => {
    const target = keyForCharacter(character, null);
    return target !== null && weakCodes.has(target.code);
  })).length / selected.length;
  if (coverage < MIN_ADAPTIVE_COVERAGE) return { kind: 'insufficient', reason: 'coverage' };

  let target = '';
  const wordEnds = selected.map((word, index) => {
    target += word;
    if (index < selected.length - 1) target += ' ';
    return target.length;
  });
  return {
    kind: 'ready',
    drill: {
      target, wordEnds, keys: weakKeys.map((key) => key.code),
      sampleAttempts: weakKeys.reduce((sum, key) => sum + key.count, 0),
      sampleSessions: Math.min(...weakKeys.map((key) => keySessions.get(key.code) ?? 0)),
      candidateCount: candidates.length, coverage
    }
  };
}
