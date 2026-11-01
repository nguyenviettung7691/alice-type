import { describe, expect, it } from 'vitest';
import { practiceDifficultyFingerprint } from './practice-difficulty';

describe('practice difficulty fingerprint', () => {
  const configuration = { mode: 'custom' as const, language: 'en' as const };

  it('matches custom sessions by non-text content shape and grapheme counts', () => {
    expect(practiceDifficultyFingerprint(configuration, 'abc 123!', null))
      .toBe(practiceDifficultyFingerprint(configuration, 'xyz 456?', null));
    expect(practiceDifficultyFingerprint(configuration, 'é', null))
      .toBe(practiceDifficultyFingerprint(configuration, 'e\u0301', null));
    expect(practiceDifficultyFingerprint(configuration, 'abc 123!', null))
      .not.toBe(practiceDifficultyFingerprint(configuration, 'abcd', null));
  });

  it('includes mode configuration and adaptive key selection', () => {
    expect(practiceDifficultyFingerprint(configuration, 'words', ['KeyB']))
      .not.toBe(practiceDifficultyFingerprint(configuration, 'words', ['KeyV']));
    expect(practiceDifficultyFingerprint(configuration, 'words', ['KeyB', 'KeyV']))
      .toBe(practiceDifficultyFingerprint(configuration, 'words', ['KeyV', 'KeyB']));
  });
});
