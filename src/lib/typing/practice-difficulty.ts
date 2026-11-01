import type { SessionConfiguration } from './exercise-generator';
import { segmentGraphemes } from './text';

function customContentProfile(value: string) {
  const graphemes = segmentGraphemes(value);
  return {
    count: graphemes.length,
    spaces: graphemes.filter((character) => /^\s+$/u.test(character)).length,
    letters: graphemes.filter((character) => /\p{L}/u.test(character)).length,
    numbers: graphemes.filter((character) => /\p{N}/u.test(character)).length,
    symbols: graphemes.filter((character) => /[^\p{L}\p{N}\s]/u.test(character)).length
  };
}

export function practiceDifficultyFingerprint(
  configuration: SessionConfiguration | null | undefined,
  customTarget: string,
  adaptiveKeys: readonly string[] | null
): string {
  const description = JSON.stringify({
    configuration,
    customContentProfile: configuration?.mode === 'custom' ? customContentProfile(customTarget) : null,
    adaptiveKeys: configuration?.mode === 'custom' ? [...(adaptiveKeys ?? [])].sort() : null
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < description.length; index += 1) {
    hash ^= description.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `difficulty-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
