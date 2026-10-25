import english from './word-banks/english.json';

export const DURATIONS = [15, 30, 60, 120] as const;
export const WORD_LIMITS = [10, 25, 50, 100] as const;
export const WORD_BANK_TIERS = [200, 1000, 5000] as const;

export type PracticeMode = 'timed' | 'words';
export type RandomSource = () => number;

export class ExerciseGenerationError extends Error {}

interface GeneratorSettings {
  readonly wordBankTier: typeof WORD_BANK_TIERS[number];
  readonly punctuation: boolean;
  readonly numbers: boolean;
}

export type SessionConfiguration = GeneratorSettings & (
  | { readonly mode: 'timed'; readonly durationSeconds: typeof DURATIONS[number] }
  | { readonly mode: 'words'; readonly wordLimit: typeof WORD_LIMITS[number] }
);

export interface PracticeSettings extends GeneratorSettings {
  readonly mode: PracticeMode;
  readonly durationSeconds: typeof DURATIONS[number];
  readonly wordLimit: typeof WORD_LIMITS[number];
}

export const DEFAULT_SETTINGS: PracticeSettings = {
  mode: 'timed',
  durationSeconds: 30,
  wordLimit: 25,
  wordBankTier: 200,
  punctuation: false,
  numbers: false
};

export interface Exercise {
  readonly target: string;
  readonly wordEnds: readonly number[];
  readonly configuration: SessionConfiguration;
}

export function validateWordBank(words: readonly string[], expectedSize: number): void {
  if (!Number.isInteger(expectedSize) || expectedSize <= 0
    || words.length !== expectedSize || new Set(words).size !== expectedSize
    || words.some((word) => typeof word !== 'string' || !/^[a-z]+$/.test(word))) {
    throw new ExerciseGenerationError(`The ${expectedSize}-word vocabulary must contain unique lowercase ASCII words.`);
  }
}

validateWordBank(english, 5000);

const banks = new Map(WORD_BANK_TIERS.map((tier) => [tier, Object.freeze(english.slice(0, tier))]));

export function getWordBank(tier: typeof WORD_BANK_TIERS[number]): readonly string[] {
  const bank = banks.get(tier);
  if (!bank) throw new ExerciseGenerationError('Unsupported vocabulary tier.');
  return bank;
}

export function validateConfiguration(configuration: SessionConfiguration): void {
  getWordBank(configuration.wordBankTier);
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

export function getConfiguration(settings: PracticeSettings): SessionConfiguration {
  const shared = {
    wordBankTier: settings.wordBankTier,
    punctuation: settings.punctuation,
    numbers: settings.numbers
  };
  const configuration: SessionConfiguration = settings.mode === 'timed'
    ? { ...shared, mode: settings.mode, durationSeconds: settings.durationSeconds }
    : { ...shared, mode: settings.mode, wordLimit: settings.wordLimit };
  validateConfiguration(configuration);
  return configuration;
}

export function generateExercise(
  configuration: SessionConfiguration,
  random: RandomSource = Math.random
): Exercise {
  validateConfiguration(configuration);
  const bank = getWordBank(configuration.wordBankTier);
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
    configuration: Object.freeze({ ...configuration })
  };
}
