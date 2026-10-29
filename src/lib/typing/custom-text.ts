import { ExerciseGenerationError } from './exercise-generator';
import { PracticeTextError, preparePracticeText, segmentGraphemes } from './text';

export const CUSTOM_TEXT_LIMIT = 10_000;

const typography: Readonly<Record<string, string>> = {
  '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"',
  '\u2013': '-', '\u2014': '-', '\u2026': '...'
};

export function prepareCustomText(draft: string): { target: string; changed: boolean } {
  if (segmentGraphemes(draft).length > CUSTOM_TEXT_LIMIT) {
    throw new ExerciseGenerationError('The draft exceeds 10,000 characters. Shorten it before applying.');
  }
  const target = draft.normalize('NFC')
    .replace(/\r\n|[\r\n\t \u00a0]/g, ' ')
    .replace(/[\u2018\u2019\u201c\u201d\u2013\u2014\u2026]/g, (character) => typography[character])
    .replace(/ +/g, ' ')
    .replace(/^ +| +$/g, '');
  if (!target) throw new ExerciseGenerationError('Enter at least one supported English or Vietnamese character.');
  if (target.length > CUSTOM_TEXT_LIMIT) {
    throw new ExerciseGenerationError('The normalized target exceeds 10,000 characters. Shorten the draft.');
  }
  try { preparePracticeText(target); }
  catch (error) {
    if (!(error instanceof PracticeTextError)) throw error;
    throw new ExerciseGenerationError(error.message, { cause: error });
  }
  return { target, changed: target !== draft };
}
