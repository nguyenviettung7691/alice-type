import { describe, expect, it } from 'vitest';
import {
  applyCommittedInput, createSession, createZenSession, extendTarget, finishSession,
  getAcceptedText, getMetrics, getWritingWindow, requiresFinish, stopSession
} from './typing-engine';
import { generateExercise, getWordBank, validateWordBank, type GeneratedConfiguration } from './exercise-generator';
import { getQuoteCatalog, selectQuote, validateQuoteCatalog } from './quote-catalog';
import { EMPTY_ATTRIBUTION, completedRecord, summarizeSessions, validateSessionRecord } from '../storage/session-history';
import { isSupportedResourceText } from './text';

describe('Vietnamese content resources', () => {
  it.each([200, 1000, 5000] as const)('has exactly %i unique NFC tokens, using the same ordered prefix', (tier) => {
    const bank = getWordBank(tier, 'vi');
    expect(bank).toHaveLength(tier);
    expect(bank).toEqual(getWordBank(5000, 'vi').slice(0, tier));
    expect(new Set(bank).size).toBe(tier);
    expect(bank[0]).toBe('tôi');
    expect(bank).not.toEqual(getWordBank(tier, 'en'));
    for (const token of bank) {
      expect(token).toBe(token.normalize('NFC'));
      expect(token).toMatch(/^\p{Letter}+$/u);
      expect(isSupportedResourceText(token)).toBe(true);
    }
    expect(() => validateWordBank(bank, tier, 'vi')).not.toThrow();
  });

  it.each(['timed', 'words'] as const)('generates Vietnamese %s targets with exact boundaries and modifiers', (mode) => {
    const configuration: GeneratedConfiguration = mode === 'words'
      ? { mode, language: 'vi', wordLimit: 10, wordBankTier: 200, punctuation: true, numbers: true }
      : { mode, language: 'vi', durationSeconds: 15, wordBankTier: 200, punctuation: true, numbers: true };
    const exercise = generateExercise(configuration, () => 0);
    expect(exercise.target).toContain('tôi, 0 tôi,');
    expect(exercise.configuration.language).toBe('vi');
    expect(exercise.wordEnds).toHaveLength(mode === 'words' ? 10 : 75);
    expect(exercise.wordEnds.at(-1)).toBe(exercise.target.length);
    expect(() => createSession(exercise.target, exercise.configuration, exercise.wordEnds)).not.toThrow();
  });

  it('has twelve original Vietnamese passages across three works, separate from stable English IDs', () => {
    const quotes = getQuoteCatalog('vi');
    expect(quotes).toHaveLength(12);
    expect(new Set(quotes.map((quote) => quote.workTitle)).size).toBe(3);
    expect(() => validateQuoteCatalog(quotes, 'vi')).not.toThrow();
    expect(selectQuote(quotes[0].id, () => 0, 'vi').id).not.toBe(quotes[0].id);
    for (const quote of quotes) {
      expect(quote.language).toBe('vi');
      expect(quote.id).toMatch(/^vi-/);
      expect(isSupportedResourceText(quote.text)).toBe(true);
      expect(getQuoteCatalog('en').some((english) => english.id === quote.id)).toBe(false);
    }
  });
});

describe('committed native input lifecycle', () => {
  it('normalizes decomposed Vietnamese, scores edits once, and requires explicit finish after final tone edits', () => {
    const ready = createSession('á', { mode: 'custom', language: 'vi' });
    const first = applyCommittedInput(ready, 'a', 100);
    expect(first).toMatchObject({ status: 'running', totalAttempts: 1, correctAttempts: 0 });
    const corrected = applyCommittedInput(first, 'a\u0301', 200);
    expect(corrected).toMatchObject({ status: 'running', input: 'á', totalAttempts: 2, correctAttempts: 1 });
    expect(applyCommittedInput(corrected, 'á', 300)).toBe(corrected);
    expect(getMetrics(corrected, 60_100)).toMatchObject({ correctCharacters: 1, accuracy: 50 });
    const finished = finishSession(corrected, 60_100);
    expect(finished).toMatchObject({ status: 'completed', endedAt: 60_100 });
    expect(applyCommittedInput(finished, '', 70_000)).toBe(finished);
    expect(ready.input).toBe('');
  });

  it('finishes ASCII Vietnamese targets explicitly, as well as Vietnamese Custom under an English UI', () => {
    expect(requiresFinish(createSession('a', { mode: 'custom', language: 'vi' }))).toBe(true);
    expect(requiresFinish(createSession('á', { mode: 'custom', language: 'en' }))).toBe(true);
    const english = applyCommittedInput(createSession('a', { mode: 'custom', language: 'en' }), 'a', 10);
    expect(english.status).toBe('completed');
    expect(() => finishSession(english, 20)).toThrow();
    expect(() => finishSession(createSession('á', { mode: 'custom', language: 'vi' }), 20)).toThrow();
  });

  it('keeps prior tokens fixed but permits an active-token rewrite and Backspace across a boundary', () => {
    const first = applyCommittedInput(createSession('xin chào bạn', { mode: 'custom', language: 'vi' }), 'xin chao', 100);
    const rewritten = applyCommittedInput(first, 'xin chào', 200);
    expect(rewritten.correctAttempts).toBe(8);
    expect(rewritten.totalAttempts).toBe(9);
    expect(() => applyCommittedInput(rewritten, 'xìn chào', 300)).toThrow();
    const boundary = applyCommittedInput(rewritten, 'xin chào ', 300);
    expect(applyCommittedInput(boundary, 'xin chào', 400).input).toBe('xin chào');
    expect(() => applyCommittedInput(rewritten, 'xin chào bạn!', 400)).toThrow();
    expect(() => applyCommittedInput(rewritten, 'xin chào🙂', 400)).toThrow();
  });

  it('expires before accepting a late commit and disallows cross-language timed refill', () => {
    const configuration = { mode: 'timed', language: 'vi', durationSeconds: 15, wordBankTier: 200, punctuation: false, numbers: false } as const;
    const exercise = generateExercise(configuration, () => 0);
    const running = applyCommittedInput(createSession(exercise.target, exercise.configuration, exercise.wordEnds), 't', 100);
    const expired = applyCommittedInput(running, 'tôi', 15_100);
    expect(expired).toMatchObject({ status: 'completed', input: 't', totalAttempts: 1, endedAt: 15_100 });
    expect(() => extendTarget(running, generateExercise({ ...configuration, language: 'en' }, () => 0))).toThrow(/language/);
  });

  it('keeps full NFC Zen counts while bounding rendering and supporting chunk-spanning deletion', () => {
    const first = applyCommittedInput(createZenSession('vi'), 'á'.repeat(2501), 100);
    expect(first.retainedCharacters).toBe(2501);
    expect(getWritingWindow(first)).toBe('á'.repeat(2000));
    const removed = applyCommittedInput(first, 'á'.repeat(1901), 200);
    expect(removed.totalAttempts).toBe(2501);
    expect(getAcceptedText(removed)).toBe('á'.repeat(1901));
    const rewritten = applyCommittedInput(removed, 'á'.repeat(1900) + 'à', 300);
    expect(rewritten.totalAttempts).toBe(2502);
    expect(getAcceptedText(rewritten)).toBe('á'.repeat(1900) + 'à');
    const stopped = stopSession(rewritten, 60_100);
    expect(getMetrics(stopped, 70_000)).toMatchObject({ wpm: 380, accuracy: null });
  });

  it('writes private v3 metadata without reclassifying or mixing historical accuracy', () => {
    const completed = finishSession(applyCommittedInput(createSession('á', { mode: 'custom', language: 'vi' }), 'á', 100), 1100);
    const record = completedRecord(completed, 'a'.repeat(32), 1_800_000_000_000, {}, EMPTY_ATTRIBUTION('left'));
    expect(validateSessionRecord(record)).toEqual(record);
    expect(record).toMatchObject({ version: 4, language: 'vi', scoringVersion: 'committed-grapheme-v1' });
    expect(record).not.toHaveProperty('input');
    expect(record).not.toHaveProperty('target');
    const { language, scoringVersion, ...body } = record;
    expect(language).toBe('vi');
    expect(scoringVersion).toBe('committed-grapheme-v1');
    const legacy = { ...body, version: 2, accuracy: 50, correctAttempts: 1, totalAttempts: 2 };
    const validatedLegacy = validateSessionRecord(legacy);
    expect(validatedLegacy).not.toHaveProperty('language');
    expect(summarizeSessions([record, validatedLegacy])).toMatchObject({ committedAccuracy: 100, legacyAccuracy: 50 });
    expect(() => validateSessionRecord({ ...record, language: 'fr' })).toThrow();
    expect(() => validateSessionRecord({ ...record, scoringVersion: 'future' })).toThrow();
  });
});
