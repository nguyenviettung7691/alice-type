// Maps the next expected character to the physical key that types it, for the finger guide.

export interface KeyTarget {
  readonly code: string;
  readonly shift: boolean;
}

const US_UNSHIFTED: Readonly<Record<string, string>> = (() => {
  const table: Record<string, string> = { ' ': 'Space' };
  for (const letter of 'abcdefghijklmnopqrstuvwxyz') table[letter] = `Key${letter.toUpperCase()}`;
  for (const digit of '0123456789') table[digit] = `Digit${digit}`;
  Object.assign(table, {
    '`': 'Backquote', '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash',
    ';': 'Semicolon', "'": 'Quote', ',': 'Comma', '.': 'Period', '/': 'Slash'
  });
  return table;
})();

const US_SHIFTED: Readonly<Record<string, string>> = (() => {
  const table: Record<string, string> = {};
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') table[letter] = `Key${letter}`;
  const pairs = '~`!1@2#3$4%5^6&7*8(9)0_-+={[}]|\\:;"\'<,>.?/';
  for (let index = 0; index < pairs.length; index += 2) table[pairs[index]] = US_UNSHIFTED[pairs[index + 1]];
  return table;
})();

/**
 * Physical key for one grapheme. With a browser layout map, only unshifted characters and uppercase letters are
 * resolved (the map has no shifted layer); without one, a US-QWERTY reference is used. Returns `null` when no single
 * key types the grapheme (for example Vietnamese diacritics), never a guess.
 */
export function keyForCharacter(grapheme: string, layoutMap: ReadonlyMap<string, string> | null): KeyTarget | null {
  if (grapheme === ' ') return { code: 'Space', shift: false };
  if (layoutMap) {
    const inverted = invert(layoutMap);
    const plain = inverted.get(grapheme);
    if (plain) return { code: plain, shift: false };
    const lower = grapheme.toLowerCase();
    if (lower !== grapheme && lower.toUpperCase() === grapheme) {
      const shifted = inverted.get(lower);
      if (shifted) return { code: shifted, shift: true };
    }
    return null;
  }
  if (US_UNSHIFTED[grapheme]) return { code: US_UNSHIFTED[grapheme], shift: false };
  if (US_SHIFTED[grapheme]) return { code: US_SHIFTED[grapheme], shift: true };
  return null;
}

const cache = new WeakMap<ReadonlyMap<string, string>, Map<string, string>>();

function invert(layoutMap: ReadonlyMap<string, string>): Map<string, string> {
  let inverted = cache.get(layoutMap);
  if (!inverted) {
    inverted = new Map();
    // Prefer standard alphanumeric codes when a character appears on several keys (e.g. numpad duplicates).
    const entries = [...layoutMap].sort(([a], [b]) => Number(/^Numpad/.test(a)) - Number(/^Numpad/.test(b)) || a.localeCompare(b));
    for (const [code, character] of entries) if (character.length > 0 && !inverted.has(character)) inverted.set(character, code);
    cache.set(layoutMap, inverted);
  }
  return inverted;
}
