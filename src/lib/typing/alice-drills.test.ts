import { describe, expect, it } from 'vitest';
import {
  DrillPoolError, MINIMUM_DRILL_POOL, alternationRatio, boundaryLetterCount, generateDrill, getDrillPool,
  qualifiesForDrill
} from './alice-drills';
import { DRILL_TYPES, ExerciseGenerationError, WORD_LIMITS, type DrillConfiguration } from './exercise-generator';
import { applyCommittedInput, createSession, getProgress, requiresFinish } from './typing-engine';

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const config = (overrides: Partial<DrillConfiguration> = {}): DrillConfiguration => ({
  mode: 'drills', language: 'en', drillType: 'split-boundary', wordLimit: 25, bKeyHand: 'left', numbers: false, ...overrides
});

describe('Alice drills', () => {
  it('classifies words by drill rule', () => {
    expect(boundaryLetterCount('nothing')).toBe(5);
    expect(qualifiesForDrill('the', 'split-boundary', 'left')).toBe(true);
    expect(qualifiesForDrill('cat', 'split-boundary', 'left')).toBe(false);
    expect(qualifiesForDrill('very', 'cross-boundary', 'left')).toBe(true);
    expect(qualifiesForDrill('cat', 'cross-boundary', 'left')).toBe(false);
    expect(alternationRatio('form', 'left')).toBe(1);
    expect(alternationRatio('save', 'left')).toBe(0);
    expect(qualifiesForDrill('problem', 'hand-alternation', 'left')).toBe(true);
    expect(qualifiesForDrill('ab', 'hand-alternation', 'left')).toBe(false);
  });

  it('lets the B-key preference change hand alternation', () => {
    expect(alternationRatio('bob', 'left')).toBe(1);
    expect(alternationRatio('bob', 'right')).toBe(0);
  });

  it('has at least the minimum pool for every type and language', () => {
    for (const language of ['en', 'vi'] as const) for (const drillType of DRILL_TYPES) for (const hand of ['left', 'right'] as const) {
      const pool = getDrillPool(drillType, language, hand);
      expect(pool.length).toBeGreaterThanOrEqual(MINIMUM_DRILL_POOL);
      expect(pool.every((word) => /^[a-z]+$/.test(word) && qualifiesForDrill(word, drillType, hand))).toBe(true);
    }
  });

  it('generates deterministic targets that follow the selection rule', () => {
    for (const language of ['en', 'vi'] as const) for (const drillType of DRILL_TYPES) for (const wordLimit of WORD_LIMITS) {
      const configuration = config({ language, drillType, wordLimit });
      const first = generateDrill(configuration, seeded(7));
      expect(generateDrill(configuration, seeded(7))).toEqual(first);
      expect(first.wordEnds).toHaveLength(wordLimit);
      const tokens = first.target.split(' ');
      const words = tokens.filter((token) => /^[a-z]+$/.test(token));
      expect(words).toHaveLength(wordLimit);
      for (const word of words) expect(qualifiesForDrill(word, drillType, 'left')).toBe(true);
      for (let index = 1; index < words.length; index += 1) expect(words[index]).not.toBe(words[index - 1]);
      for (const token of tokens.filter((value) => !/^[a-z]+$/.test(value))) {
        expect(drillType).toBe('cross-boundary');
        expect(token).toMatch(/^[1-9]?[0-9]?[0-9]$/);
        expect(token).toMatch(/[67]/);
      }
      expect(() => createSession(first.target, first.configuration, first.wordEnds)).not.toThrow();
    }
  });

  it('injects 6/7 numbers in cross-boundary drills and ordinary numbers only with the modifier', () => {
    const cross = generateDrill(config({ drillType: 'cross-boundary', wordLimit: 100 }), seeded(3));
    expect(cross.target).toMatch(/\d/);
    const plain = generateDrill(config({ wordLimit: 100 }), seeded(3));
    expect(plain.target).not.toMatch(/\d/);
    expect(generateDrill(config({ wordLimit: 100, numbers: true }), seeded(3)).target).toMatch(/\d/);
  });

  it('rejects invalid configurations and random sources', () => {
    expect(() => generateDrill(config({ drillType: 'nope' as never }))).toThrow(ExerciseGenerationError);
    expect(() => generateDrill(config({ wordLimit: 12 as never }))).toThrow(ExerciseGenerationError);
    expect(() => generateDrill(config({ bKeyHand: 'both' as never }))).toThrow(ExerciseGenerationError);
    expect(() => generateDrill(config(), () => 1)).toThrow(ExerciseGenerationError);
    expect(new DrillPoolError('hand-alternation', 'vi', 3)).toBeInstanceOf(ExerciseGenerationError);
  });

  it('completes English drills automatically and asks for Finish in Vietnamese', () => {
    const en = generateDrill(config({ wordLimit: 10 }), seeded(1));
    let session = createSession(en.target, en.configuration, en.wordEnds);
    expect(requiresFinish(session)).toBe(false);
    session = applyCommittedInput(session, en.target, 10);
    expect(session.status).toBe('completed');
    expect(getProgress(session, 10)).toMatchObject({ value: 10, maximum: 10 });
    const vi = generateDrill(config({ language: 'vi', wordLimit: 10 }), seeded(1));
    expect(requiresFinish(createSession(vi.target, vi.configuration, vi.wordEnds))).toBe(true);
  });
});
