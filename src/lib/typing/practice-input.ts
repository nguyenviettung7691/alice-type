import { preparePracticeText } from './text';

export interface CommittedEdit {
  readonly start: number;
  readonly deleteCount: number;
  readonly inserted: readonly string[];
}

export type PracticeEditFailure = 'earlier-edit' | 'target-overrun';

export class PracticeEditError extends Error {
  constructor(readonly code: PracticeEditFailure) {
    super(code === 'earlier-edit'
      ? 'Only the active trailing token can be rewritten.'
      : 'Committed input exceeds the target length.');
  }
}

export interface ReconciledInput {
  readonly text: string;
  readonly edit: CommittedEdit | null;
}

export function reconcilePracticeInput(
  accepted: string, nativeValue: string, maximumCharacters?: number
): ReconciledInput {
  if (maximumCharacters !== undefined
    && (!Number.isSafeInteger(maximumCharacters) || maximumCharacters < 0)) {
    throw new Error('The input character limit must be a non-negative safe integer.');
  }
  const previous = preparePracticeText(accepted, true);
  const next = preparePracticeText(nativeValue, true);
  if (maximumCharacters !== undefined && next.graphemes.length > maximumCharacters) {
    throw new PracticeEditError('target-overrun');
  }
  if (previous.text === next.text) return { text: previous.text, edit: null };

  let start = 0;
  while (start < previous.graphemes.length && start < next.graphemes.length
    && previous.graphemes[start] === next.graphemes[start]) start++;

  let suffix = 0;
  while (suffix < previous.graphemes.length - start && suffix < next.graphemes.length - start
    && previous.graphemes[previous.graphemes.length - 1 - suffix] === next.graphemes[next.graphemes.length - 1 - suffix]) {
    suffix++;
  }
  const deleteCount = previous.graphemes.length - start - suffix;
  const inserted = next.graphemes.slice(start, next.graphemes.length - suffix);
  const trailingTokenStart = previous.graphemes.lastIndexOf(' ') + 1;
  const singleBackspace = inserted.length === 0 && suffix === 0 && deleteCount === 1;
  if (start < trailingTokenStart && !singleBackspace) throw new PracticeEditError('earlier-edit');

  return { text: next.text, edit: { start, deleteCount, inserted } };
}

export interface EditScore {
  readonly attempts: number;
  readonly correctAttempts: number;
  readonly correctCharacters: number;
}

export function scoreCommittedEdit(
  target: string, accepted: string, result: ReconciledInput
): EditScore {
  const targetText = preparePracticeText(target);
  const previous = preparePracticeText(accepted, true);
  const next = preparePracticeText(result.text, true);
  const edit = result.edit;
  if (next.graphemes.length > targetText.graphemes.length) throw new PracticeEditError('target-overrun');
  if (edit) {
    if (!Number.isSafeInteger(edit.start) || !Number.isSafeInteger(edit.deleteCount)
      || edit.start < 0 || edit.deleteCount < 0 || edit.start + edit.deleteCount > previous.graphemes.length
      || edit.inserted.some((grapheme) => {
        const prepared = preparePracticeText(grapheme);
        return prepared.text !== grapheme || prepared.graphemes.length !== 1;
      })) {
      throw new Error('Invalid committed edit range or graphemes.');
    }
    const applied = [
      ...previous.graphemes.slice(0, edit.start), ...edit.inserted,
      ...previous.graphemes.slice(edit.start + edit.deleteCount)
    ].join('');
    if (applied !== next.text) throw new Error('The committed edit does not match the resulting text.');
  } else if (previous.text !== next.text) {
    throw new Error('A changed input requires a committed edit.');
  }
  return {
    attempts: edit?.inserted.length ?? 0,
    correctAttempts: edit?.inserted.reduce(
      (count, grapheme, index) => count + Number(grapheme === targetText.graphemes[edit.start + index]), 0
    ) ?? 0,
    correctCharacters: next.graphemes.reduce(
      (count, grapheme, index) => count + Number(grapheme === targetText.graphemes[index]), 0
    )
  };
}
