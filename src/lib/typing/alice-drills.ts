import english from './word-banks/english.json';
import vietnamese from './word-banks/vietnamese.json';
import {
  ExerciseGenerationError, validateConfiguration, type BKeyHand, type DrillConfiguration, type DrillType,
  type Exercise, type RandomSource
} from './exercise-generator';
import { fingerForCode, type Hand } from '../keyboard/finger-map';
import type { LanguageId } from '../i18n/languages';

export const MINIMUM_DRILL_POOL = 20;
const LEFT_BOUNDARY = new Set(['t', 'g', 'b', 'v']);
const RIGHT_BOUNDARY = new Set(['y', 'h', 'n']);
const CROSS_LETTERS = /[bvgy]/;

/** Raised when a language bank has too few words for a drill type; never replaced by another drill or language. */
export class DrillPoolError extends ExerciseGenerationError {
  constructor(readonly drillType: DrillType, readonly language: LanguageId, readonly size: number) {
    super(`Only ${size} ${language} words qualify for the ${drillType} drill; at least ${MINIMUM_DRILL_POOL} are required.`);
    this.name = 'DrillPoolError';
  }
}

export function letterHand(letter: string, bKeyHand: BKeyHand): Hand | null {
  if (!/^[a-z]$/.test(letter)) return null;
  return fingerForCode(`Key${letter.toUpperCase()}`, bKeyHand)?.hand ?? null;
}

export function boundaryLetterCount(word: string): number {
  return Array.from(word).filter((letter) => LEFT_BOUNDARY.has(letter) || RIGHT_BOUNDARY.has(letter)).length;
}

export function alternationRatio(word: string, bKeyHand: BKeyHand): number {
  if (word.length < 2) return 0;
  let switches = 0;
  for (let index = 1; index < word.length; index += 1) {
    if (letterHand(word[index - 1], bKeyHand) !== letterHand(word[index], bKeyHand)) switches += 1;
  }
  return switches / (word.length - 1);
}

export function qualifiesForDrill(word: string, drillType: DrillType, bKeyHand: BKeyHand): boolean {
  if (!/^[a-z]+$/.test(word)) return false;
  if (drillType === 'split-boundary') return boundaryLetterCount(word) >= 2;
  if (drillType === 'cross-boundary') return CROSS_LETTERS.test(word);
  return word.length >= 4 && alternationRatio(word, bKeyHand) >= 0.7;
}

const sources: Record<LanguageId, readonly string[]> = { en: english, vi: vietnamese };
const pools = new Map<string, readonly string[]>();

export function getDrillPool(drillType: DrillType, language: LanguageId, bKeyHand: BKeyHand): readonly string[] {
  const key = `${language}:${drillType}:${bKeyHand}`;
  let pool = pools.get(key);
  if (!pool) {
    const source = sources[language];
    if (!source) throw new ExerciseGenerationError('Unsupported language identifier.');
    pool = Object.freeze(source.filter((word) => qualifiesForDrill(word, drillType, bKeyHand)));
    pools.set(key, pool);
  }
  return pool;
}

export function generateDrill(configuration: DrillConfiguration, random: RandomSource = Math.random): Exercise {
  validateConfiguration(configuration);
  if (configuration.mode !== 'drills') throw new ExerciseGenerationError('Only Drills use the drill generator.');
  const language = configuration.language ?? 'en';
  const pool = getDrillPool(configuration.drillType, language, configuration.bKeyHand);
  if (pool.length < MINIMUM_DRILL_POOL) throw new DrillPoolError(configuration.drillType, language, pool.length);
  const draw = () => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new ExerciseGenerationError('The exercise random source must return a finite number in [0, 1).');
    }
    return value;
  };
  const crossNumber = () => {
    const length = 1 + Math.floor(draw() * 3);
    const digits = Array.from({ length }, (_, index) => String(index === 0 && length > 1 ? 1 + Math.floor(draw() * 9) : Math.floor(draw() * 10)));
    digits[Math.floor(draw() * length)] = draw() < 0.5 ? '6' : '7';
    return digits.join('');
  };

  let previous = -1;
  const wordEnds: number[] = [];
  let target = '';
  for (let index = 0; index < configuration.wordLimit; index += 1) {
    let choice = Math.floor(draw() * (previous < 0 ? pool.length : pool.length - 1));
    if (previous >= 0 && choice >= previous) choice += 1;
    previous = choice;
    target += pool[choice];
    if (index === configuration.wordLimit - 1) {
      wordEnds.push(target.length);
    } else {
      target += ' ';
      wordEnds.push(target.length);
      if (configuration.drillType === 'cross-boundary') {
        if (draw() < 0.2) target += `${crossNumber()} `;
      } else if (configuration.numbers && draw() < 0.2) {
        target += `${Math.floor(draw() * 1000)} `;
      }
    }
  }
  return {
    target,
    wordEnds: Object.freeze(wordEnds),
    configuration: Object.freeze({ ...configuration, language })
  };
}
