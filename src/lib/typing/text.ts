export type PracticeTextFailure =
  | { readonly code: 'unsupported-browser' }
  | { readonly code: 'empty-text' }
  | { readonly code: 'unsupported-character'; readonly position: number; readonly codePoint: string };

export class PracticeTextError extends Error {
  constructor(readonly failure: PracticeTextFailure) {
    super(failure.code === 'unsupported-character'
      ? `Unsupported character at position ${failure.position} (U+${failure.codePoint}).`
      : failure.code === 'empty-text' ? 'Practice text must not be empty.'
        : 'This browser does not support grapheme segmentation.');
  }
}

let segmenter: Intl.Segmenter | undefined;

export function hasGraphemeSupport(): boolean {
  return typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';
}

export function segmentGraphemes(text: string): readonly string[] {
  if (!hasGraphemeSupport()) throw new PracticeTextError({ code: 'unsupported-browser' });
  const normalized = text.normalize('NFC');
  if (/^[\x20-\x7e]*$/.test(normalized)) return Array.from(normalized);
  segmenter ??= new Intl.Segmenter('und', { granularity: 'grapheme' });
  return Array.from(segmenter.segment(normalized), (part) => part.segment);
}

const supportedGrapheme = /^[\x20-\x7eÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯư\u1ea0-\u1ef9]$/u;

// All supported NFC graphemes are single BMP code points. Resource validation
// must also work before the UI can report a missing Intl.Segmenter capability.
export function isSupportedResourceText(text: string): boolean {
  return text === text.normalize('NFC') && Array.from(text).every((point) => supportedGrapheme.test(point));
}

export interface PracticeText {
  readonly text: string;
  readonly graphemes: readonly string[];
}

export function preparePracticeText(text: string, allowEmpty = false): PracticeText {
  const graphemes = segmentGraphemes(text);
  if (!allowEmpty && graphemes.length === 0) throw new PracticeTextError({ code: 'empty-text' });
  for (const [index, grapheme] of graphemes.entries()) {
    if (!supportedGrapheme.test(grapheme)) {
      const unsupported = Array.from(grapheme).find((point) => !supportedGrapheme.test(point)) ?? grapheme;
      throw new PracticeTextError({
        code: 'unsupported-character', position: index + 1,
        codePoint: unsupported.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')
      });
    }
  }
  return { text: graphemes.join(''), graphemes };
}
