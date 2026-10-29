import english from './word-banks/english.json';
import vietnamese from './word-banks/vietnamese.json';
import { isLanguageId, type LanguageId } from '../i18n/languages';
import { isSupportedResourceText } from './text';

export const DURATIONS = [15, 30, 60, 120] as const;
export const WORD_LIMITS = [10, 25, 50, 100] as const;
export const WORD_BANK_TIERS = [200, 1000, 5000] as const;

export const PRACTICE_MODES = ['timed', 'words', 'quote', 'custom', 'zen', 'drills', 'code'] as const;
export type PracticeMode = typeof PRACTICE_MODES[number];
export type RandomSource = () => number;
export const DRILL_TYPES = ['split-boundary', 'hand-alternation', 'cross-boundary'] as const;
export type DrillType = typeof DRILL_TYPES[number];
export const CODE_LANGUAGES = ['python', 'javascript', 'rust'] as const;
export type CodeLanguage = typeof CODE_LANGUAGES[number];
/** Programming-language names are proper nouns and are not translated. */
export const CODE_LANGUAGE_NAMES: Readonly<Record<CodeLanguage, string>> = { python: 'Python', javascript: 'JavaScript', rust: 'Rust' };
export const B_KEY_HANDS = ['left', 'right'] as const;
export type BKeyHand = typeof B_KEY_HANDS[number];

export class ExerciseGenerationError extends Error {}

interface GeneratorSettings {
  readonly language?: LanguageId;
  readonly wordBankTier: typeof WORD_BANK_TIERS[number];
  readonly punctuation: boolean;
  readonly numbers: boolean;
}

export type GeneratedConfiguration = GeneratorSettings & (
  | { readonly mode: 'timed'; readonly durationSeconds: typeof DURATIONS[number] }
  | { readonly mode: 'words'; readonly wordLimit: typeof WORD_LIMITS[number] }
);
export interface DrillConfiguration {
  readonly mode: 'drills';
  readonly language?: LanguageId;
  readonly drillType: DrillType;
  readonly wordLimit: typeof WORD_LIMITS[number];
  readonly bKeyHand: BKeyHand;
  readonly numbers: boolean;
}
export interface CodeConfiguration {
  readonly mode: 'code';
  readonly language?: LanguageId;
  readonly codeLanguage: CodeLanguage;
  readonly snippetId: string;
}
export type CopyConfiguration = GeneratedConfiguration | DrillConfiguration | CodeConfiguration
  | { readonly mode: 'quote'; readonly quoteId: string; readonly language?: LanguageId }
  | { readonly mode: 'custom'; readonly language?: LanguageId };
export type SessionConfiguration = CopyConfiguration | { readonly mode: 'zen'; readonly language?: LanguageId };

export interface PracticeSettings extends GeneratorSettings {
  readonly mode: PracticeMode;
  readonly durationSeconds: typeof DURATIONS[number];
  readonly wordLimit: typeof WORD_LIMITS[number];
  readonly drillType: DrillType;
  readonly codeLanguage: CodeLanguage;
  readonly bKeyHand: BKeyHand;
}

export const DEFAULT_SETTINGS: PracticeSettings = {
  language: 'en',
  mode: 'timed',
  durationSeconds: 30,
  wordLimit: 25,
  wordBankTier: 200,
  punctuation: false,
  numbers: false,
  drillType: 'split-boundary',
  codeLanguage: 'python',
  bKeyHand: 'left'
};

export interface Exercise {
  readonly target: string;
  readonly wordEnds: readonly number[];
  readonly configuration: GeneratedConfiguration | DrillConfiguration;
}

export function validateWordBank(words: readonly string[], expectedSize: number, language: LanguageId = 'en'): void {
  if (!isLanguageId(language)) throw new ExerciseGenerationError('Unsupported language identifier.');
  const validToken = (word: string) => {
    if (typeof word !== 'string') return false;
    if (language === 'en') return /^[a-z]+$/.test(word);
    if (!word || word !== word.normalize('NFC') || word !== word.toLowerCase() || !/^\p{Letter}+$/u.test(word)) return false;
    return isSupportedResourceText(word);
  };
  if (!Number.isInteger(expectedSize) || expectedSize <= 0
    || !Array.isArray(words) || words.length !== expectedSize || new Set(words).size !== expectedSize
    || words.some((word) => !validToken(word))) {
    throw new ExerciseGenerationError(language === 'en'
      ? `The ${expectedSize}-word vocabulary must contain unique lowercase ASCII words.`
      : `The ${expectedSize}-token vocabulary must contain unique NFC lowercase supported Vietnamese tokens.`);
  }
}

validateWordBank(english, 5000);
validateWordBank(vietnamese, 5000, 'vi');

const banks = {
  en: new Map(WORD_BANK_TIERS.map((tier) => [tier, Object.freeze(english.slice(0, tier))])),
  vi: new Map(WORD_BANK_TIERS.map((tier) => [tier, Object.freeze(vietnamese.slice(0, tier))]))
} satisfies Record<LanguageId, ReadonlyMap<number, readonly string[]>>;

export function getWordBank(tier: typeof WORD_BANK_TIERS[number], language: LanguageId = 'en'): readonly string[] {
  if (!isLanguageId(language)) throw new ExerciseGenerationError('Unsupported language identifier.');
  if (!WORD_BANK_TIERS.includes(tier)) throw new ExerciseGenerationError('Unsupported vocabulary tier.');
  const bank = banks[language].get(tier);
  if (!bank) throw new ExerciseGenerationError('Unsupported vocabulary tier.');
  return bank;
}

export function validateConfiguration(configuration: SessionConfiguration): void {
  if (configuration.language !== undefined && !isLanguageId(configuration.language)) {
    throw new ExerciseGenerationError('Unsupported language identifier.');
  }
  if (configuration.mode === 'zen' || configuration.mode === 'custom') return;
  if (configuration.mode === 'quote') {
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(configuration.quoteId)) return;
    throw new ExerciseGenerationError('Unsupported quote identifier.');
  }
  if (configuration.mode === 'code') {
    if (!CODE_LANGUAGES.includes(configuration.codeLanguage)) throw new ExerciseGenerationError('Unsupported code language.');
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(configuration.snippetId)) return;
    throw new ExerciseGenerationError('Unsupported code snippet identifier.');
  }
  if (configuration.mode === 'drills') {
    if (!DRILL_TYPES.includes(configuration.drillType)) throw new ExerciseGenerationError('Unsupported drill type.');
    if (!B_KEY_HANDS.includes(configuration.bKeyHand)) throw new ExerciseGenerationError('Unsupported B-key hand.');
    if (typeof configuration.numbers !== 'boolean') throw new ExerciseGenerationError('Exercise modifiers must be boolean values.');
    if (WORD_LIMITS.includes(configuration.wordLimit)) return;
    throw new ExerciseGenerationError('Unsupported practice mode or limit.');
  }
  getWordBank(configuration.wordBankTier, configuration.language);
  if (typeof configuration.punctuation !== 'boolean' || typeof configuration.numbers !== 'boolean') {
    throw new ExerciseGenerationError('Exercise modifiers must be boolean values.');
  }
  if (configuration.mode === 'timed') {
    if (DURATIONS.includes(configuration.durationSeconds)) return;
  } else if (configuration.mode === 'words') {
    if (WORD_LIMITS.includes(configuration.wordLimit)) return;
  }
  throw new ExerciseGenerationError('Unsupported practice mode or limit.');
}

export function getConfiguration(settings: PracticeSettings): GeneratedConfiguration {
  if (settings.mode !== 'timed' && settings.mode !== 'words') {
    throw new ExerciseGenerationError('Only Timed and Words use generated exercises.');
  }
  const shared = {
    language: settings.language ?? 'en',
    wordBankTier: settings.wordBankTier,
    punctuation: settings.punctuation,
    numbers: settings.numbers
  };
  const configuration: GeneratedConfiguration = settings.mode === 'timed'
    ? { ...shared, mode: settings.mode, durationSeconds: settings.durationSeconds }
    : { ...shared, mode: settings.mode, wordLimit: settings.wordLimit };
  validateConfiguration(configuration);
  return configuration;
}

export function generateExercise(
  configuration: GeneratedConfiguration,
  random: RandomSource = Math.random
): Exercise {
  validateConfiguration(configuration);
  if (configuration.mode !== 'timed' && configuration.mode !== 'words') {
    throw new ExerciseGenerationError('Only Timed and Words use generated exercises.');
  }
  const bank = getWordBank(configuration.wordBankTier, configuration.language);
  const count = configuration.mode === 'words' ? configuration.wordLimit : configuration.durationSeconds * 5;
  const draw = () => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new ExerciseGenerationError('The exercise random source must return a finite number in [0, 1).');
    }
    return value;
  };
  const words = Array.from({ length: count }, () => bank[Math.floor(draw() * bank.length)]);
  const wordEnds: number[] = [];
  let target = '';

  for (const [index, word] of words.entries()) {
    let decorated = word;
    if (configuration.punctuation && draw() < 0.25) {
      const style = Math.floor(draw() * 3);
      decorated = style === 2 ? `"${word}"` : `${word}${style === 0 ? ',' : '.'}`;
    }
    target += decorated;
    if (index === words.length - 1) {
      wordEnds.push(target.length);
    } else {
      target += ' ';
      wordEnds.push(target.length);
      if (configuration.numbers && draw() < 0.2) {
        target += `${Math.floor(draw() * 1000)} `;
      }
    }
  }

  return {
    target,
    wordEnds: Object.freeze(wordEnds),
    configuration: Object.freeze({ ...configuration, language: configuration.language ?? 'en' })
  };
}
