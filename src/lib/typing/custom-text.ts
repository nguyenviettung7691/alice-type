import { ExerciseGenerationError } from './exercise-generator';

export const CUSTOM_TEXT_LIMIT = 10_000;

const typography: Readonly<Record<string, string>> = {
  '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"',
  '\u2013': '-', '\u2014': '-', '\u2026': '...'
};

export function prepareCustomText(draft: string): { target: string; changed: boolean } {
  if (draft.length > CUSTOM_TEXT_LIMIT) {
    throw new ExerciseGenerationError('The draft exceeds 10,000 characters. Shorten it before applying.');
  }
  const target = draft
    .replace(/\r\n|[\r\n\t \u00a0]/g, ' ')
    .replace(/[\u2018\u2019\u201c\u201d\u2013\u2014\u2026]/g, (character) => typography[character])
    .replace(/ +/g, ' ')
    .replace(/^ +| +$/g, '');
  if (!target) throw new ExerciseGenerationError('Enter at least one printable ASCII character.');
  if (target.length > CUSTOM_TEXT_LIMIT) {
    throw new ExerciseGenerationError('The normalized target exceeds 10,000 characters. Shorten the draft.');
  }
  const position = target.search(/[^\x20-\x7e]/);
  if (position !== -1) {
    const code = target.codePointAt(position)!.toString(16).toUpperCase().padStart(4, '0');
    throw new ExerciseGenerationError(`Unsupported character at target position ${position + 1} (U+${code}). Use printable ASCII text.`);
  }
  return { target, changed: target !== draft };
}
