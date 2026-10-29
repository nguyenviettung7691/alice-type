import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS, DURATIONS, WORD_BANK_TIERS, WORD_LIMITS,
  generateExercise, getConfiguration, getWordBank, validateConfiguration, validateWordBank,
  type RandomSource, type GeneratedConfiguration, type SessionConfiguration
} from './exercise-generator';

function seeded(seed: number): RandomSource {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

const words: GeneratedConfiguration = {
  mode: 'words', wordLimit: 10, wordBankTier: 200, punctuation: false, numbers: false
};

describe('word banks and configuration', () => {
  it.each(WORD_BANK_TIERS)('has exactly %i unique lowercase words in an immutable pool', (tier) => {
    const bank = getWordBank(tier);
    expect(bank).toHaveLength(tier);
    expect(new Set(bank).size).toBe(tier);
    expect(bank.every((word) => /^[a-z]+$/.test(word))).toBe(true);
    expect(Object.isFrozen(bank)).toBe(true);
    expect(bank).toEqual(getWordBank(5000).slice(0, tier));
  });

  it.each([[], [''], ['One'], ['two words'], ['word!'], ['1'], ['caf\u00e9'], ['a', 'a']].map((bank) => ({ bank })))(
    'rejects malformed banks $bank', ({ bank }) => {
      expect(() => validateWordBank(bank, Math.max(1, bank.length))).toThrow('unique lowercase ASCII');
    }
  );

  it('validates runtime values, not just TypeScript types', () => {
    expect(() => validateWordBank([], 0)).toThrow('unique lowercase ASCII');
    expect(() => validateWordBank(JSON.parse('[null]'), 1)).toThrow('unique lowercase ASCII');
    for (const invalid of [
      { ...words, mode: 'unknown' }, { ...words, wordLimit: 11 },
      { ...words, wordBankTier: 201 }, { ...words, punctuation: 'true' },
      { ...words, numbers: null }, { ...words, mode: 'timed', durationSeconds: 45 }
    ]) {
      // JSON is an untyped input boundary, as with future saved settings.
      const configuration: SessionConfiguration = JSON.parse(JSON.stringify(invalid));
      expect(() => validateConfiguration(configuration)).toThrow();
    }
    expect(getConfiguration(DEFAULT_SETTINGS)).toEqual({
      language: 'en',
      mode: 'timed', durationSeconds: 30, wordBankTier: 200, punctuation: false, numbers: false
    });
  });

    describe('Vietnamese resource banks', () => {
      it.each(WORD_BANK_TIERS)('has exactly %i unique normalized tokens with prefix tiers', (tier) => {
        const bank = getWordBank(tier, 'vi');
        expect(bank).toHaveLength(tier);
        expect(new Set(bank).size).toBe(tier);
        expect(bank).toEqual(getWordBank(5000, 'vi').slice(0, tier));
        expect(() => validateWordBank(bank, tier, 'vi')).not.toThrow();
        expect(Object.isFrozen(bank)).toBe(true);
      });
      it('generates Vietnamese content without an English fallback', () => {
        const exercise = generateExercise({ ...words, language: 'vi' }, () => 0);
        expect(exercise.target).toBe(Array(10).fill('tôi').join(' '));
        expect(exercise.configuration.language).toBe('vi');
        expect(exercise.wordEnds.at(-1)).toBe(exercise.target.length);
      });
      it('rejects unknown languages and invalid Vietnamese tokens', () => {
        expect(() => validateConfiguration(JSON.parse('{"mode":"custom","language":"fr"}'))).toThrow('language');
        for (const token of ['a b', '😀', 'ấ'.normalize('NFD'), 'Đất', '漢']) {
          expect(() => validateWordBank([token], 1, 'vi')).toThrow();
        }
      });
  });
});

describe('exercise generation', () => {
  it.each(WORD_LIMITS)('generates exactly %i base words without modifying input', (wordLimit) => {
    const configuration = Object.freeze({ ...words, wordLimit });
    const exercise = generateExercise(configuration, seeded(12));
    expect(exercise.target.split(' ')).toHaveLength(wordLimit);
    expect(exercise.wordEnds).toHaveLength(wordLimit);
    expect(exercise.wordEnds.at(-1)).toBe(exercise.target.length);
    expect(exercise.configuration).not.toBe(configuration);
    expect(Object.isFrozen(exercise.configuration)).toBe(true);
    expect(Object.isFrozen(exercise.wordEnds)).toBe(true);
  });

  it.each(DURATIONS)('buffers %i seconds at five base words per second', (durationSeconds) => {
    const exercise = generateExercise({
      ...getConfiguration(DEFAULT_SETTINGS), mode: 'timed', durationSeconds
    }, seeded(1));
    expect(exercise.wordEnds).toHaveLength(durationSeconds * 5);
  });

  it('is reproducible and accepts constant randomness without rejection loops', () => {
    expect(generateExercise(words, seeded(42))).toEqual(generateExercise(words, seeded(42)));
    expect(generateExercise(words, () => 0).target).toBe(Array(10).fill('you').join(' '));
    expect(generateExercise(words, () => 0.999999).target.split(' ')).toEqual(
      Array(10).fill(getWordBank(200).at(-1))
    );
  });

  for (const punctuation of [false, true]) {
    for (const numbers of [false, true]) {
      it(`keeps valid boundaries with punctuation=${punctuation}, numbers=${numbers}`, () => {
        const exercise = generateExercise({ ...words, wordLimit: 100, punctuation, numbers }, seeded(7));
        expect(exercise.target).toMatch(/^[\x21-\x7e]+(?: [\x21-\x7e]+)*$/);
        expect(exercise.wordEnds).toHaveLength(100);
        expect(exercise.target.split(' ').filter((token) => /[a-z]/.test(token))).toHaveLength(100);
        expect(/[",.]/.test(exercise.target)).toBe(punctuation);
        expect(/\d/.test(exercise.target)).toBe(numbers);
        for (const [index, end] of exercise.wordEnds.entries()) {
          expect(end).toBeGreaterThan(exercise.wordEnds[index - 1] ?? 0);
          expect(end).toBeLessThanOrEqual(exercise.target.length);
          expect(end === exercise.target.length || exercise.target[end - 1] === ' ').toBe(true);
        }
        expect(exercise.target).not.toMatch(/\d$/);
      });
    }
  }

  it('attaches punctuation and places numeric tokens before the final word only', () => {
    const exercise = generateExercise({ ...words, punctuation: true, numbers: true }, () => 0);
    expect(exercise.target).toBe([...Array(9).fill('you, 0'), 'you,'].join(' '));
    expect(exercise.wordEnds[0]).toBe(5);
    expect(exercise.wordEnds.at(-1)).toBe(exercise.target.length);
  });

  it('supports paired quotes and inclusive three-digit number limits', () => {
    let index = 0;
    const values = [...Array(10).fill(0), 0, 0.9, 0, 0.999, ...Array(100).fill(0.99)];
    const exercise = generateExercise({ ...words, punctuation: true, numbers: true }, () => values[index++]);
    expect(exercise.target).toMatch(/^"you" 999 /);
  });

  it.each([-1, 1, 2, NaN, Infinity, -Infinity])('rejects invalid randomness %s', (value) => {
    expect(() => generateExercise(words, () => value)).toThrow('random source');
  });
});
