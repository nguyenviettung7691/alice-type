// QMK keymap parsing and a strict QMK keycode → KeyboardEvent.code table.
// Only plain HID keycodes map to a physical code. Layer, mod-tap, shifted, macro,
// lighting, media, system, transparent, and custom keycodes stay uncoded.

export interface KeymapLayer {
  readonly name: string;
  readonly macro: string;
  readonly keycodes: readonly string[];
}

export interface KeycodeInfo {
  readonly code: string | null;
  readonly legend: string;
}

const CODES: Readonly<Record<string, readonly [code: string, legend: string]>> = (() => {
  const table: Record<string, readonly [string, string]> = {};
  const add = (code: string, legend: string, ...names: string[]) => {
    for (const name of names) table[name] = [code, legend];
  };
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') add(`Key${letter}`, letter, `KC_${letter}`);
  for (const digit of '1234567890') add(`Digit${digit}`, digit, `KC_${digit}`);
  for (let index = 1; index <= 24; index += 1) add(`F${index}`, `F${index}`, `KC_F${index}`);
  add('Enter', 'Enter', 'KC_ENT', 'KC_ENTER');
  add('Escape', 'Esc', 'KC_ESC', 'KC_ESCAPE');
  add('Backspace', 'Bksp', 'KC_BSPC', 'KC_BACKSPACE');
  add('Tab', 'Tab', 'KC_TAB');
  add('Space', 'Space', 'KC_SPC', 'KC_SPACE');
  add('Minus', '-', 'KC_MINS', 'KC_MINUS');
  add('Equal', '=', 'KC_EQL', 'KC_EQUAL');
  add('BracketLeft', '[', 'KC_LBRC', 'KC_LEFT_BRACKET', 'KC_LBRACKET');
  add('BracketRight', ']', 'KC_RBRC', 'KC_RIGHT_BRACKET', 'KC_RBRACKET');
  add('Backslash', '\\', 'KC_BSLS', 'KC_BACKSLASH');
  add('Backslash', '#', 'KC_NUHS', 'KC_NONUS_HASH');
  add('IntlBackslash', '\\', 'KC_NUBS', 'KC_NONUS_BACKSLASH');
  add('Semicolon', ';', 'KC_SCLN', 'KC_SEMICOLON');
  add('Quote', "'", 'KC_QUOT', 'KC_QUOTE');
  add('Backquote', '`', 'KC_GRV', 'KC_GRAVE');
  add('Comma', ',', 'KC_COMM', 'KC_COMMA');
  add('Period', '.', 'KC_DOT');
  add('Slash', '/', 'KC_SLSH', 'KC_SLASH');
  add('CapsLock', 'Caps', 'KC_CAPS', 'KC_CAPS_LOCK', 'KC_CAPSLOCK', 'KC_CLCK');
  add('PrintScreen', 'PrtSc', 'KC_PSCR', 'KC_PRINT_SCREEN');
  add('ScrollLock', 'ScrLk', 'KC_SCRL', 'KC_SCROLL_LOCK', 'KC_SLCK');
  add('Pause', 'Pause', 'KC_PAUS', 'KC_PAUSE', 'KC_BRK');
  add('Insert', 'Ins', 'KC_INS', 'KC_INSERT');
  add('Home', 'Home', 'KC_HOME');
  add('PageUp', 'PgUp', 'KC_PGUP', 'KC_PAGE_UP');
  add('Delete', 'Del', 'KC_DEL', 'KC_DELETE');
  add('End', 'End', 'KC_END');
  add('PageDown', 'PgDn', 'KC_PGDN', 'KC_PAGE_DOWN');
  add('ArrowRight', '→', 'KC_RGHT', 'KC_RIGHT');
  add('ArrowLeft', '←', 'KC_LEFT');
  add('ArrowDown', '↓', 'KC_DOWN');
  add('ArrowUp', '↑', 'KC_UP');
  add('ControlLeft', 'Ctrl', 'KC_LCTL', 'KC_LEFT_CTRL', 'KC_LCTRL');
  add('ControlRight', 'Ctrl', 'KC_RCTL', 'KC_RIGHT_CTRL', 'KC_RCTRL');
  add('ShiftLeft', 'Shift', 'KC_LSFT', 'KC_LEFT_SHIFT', 'KC_LSHIFT');
  add('ShiftRight', 'Shift', 'KC_RSFT', 'KC_RIGHT_SHIFT', 'KC_RSHIFT');
  add('AltLeft', 'Alt', 'KC_LALT', 'KC_LEFT_ALT', 'KC_LOPT');
  add('AltRight', 'Alt', 'KC_RALT', 'KC_RIGHT_ALT', 'KC_ROPT', 'KC_ALGR');
  add('MetaLeft', 'Meta', 'KC_LGUI', 'KC_LEFT_GUI', 'KC_LCMD', 'KC_LWIN');
  add('MetaRight', 'Meta', 'KC_RGUI', 'KC_RIGHT_GUI', 'KC_RCMD', 'KC_RWIN');
  add('ContextMenu', 'Menu', 'KC_APP', 'KC_APPLICATION');
  return table;
})();

const EMPTY = new Set(['_______', 'KC_TRNS', 'KC_TRANSPARENT', 'XXXXXXX', 'KC_NO']);
const NAMED_LEGENDS: Readonly<Record<string, string>> = {
  KC_TILD: '~', KC_EXLM: '!', KC_AT: '@', KC_HASH: '#', KC_DLR: '$', KC_PERC: '%', KC_CIRC: '^',
  KC_AMPR: '&', KC_ASTR: '*', KC_LPRN: '(', KC_RPRN: ')', KC_UNDS: '_', KC_PLUS: '+', KC_PIPE: '|',
  KC_MUTE: 'Mute', KC_VOLU: 'Vol+', KC_VOLD: 'Vol-', KC_MPLY: 'Play', KC_MNXT: 'Next', KC_MPRV: 'Prev',
  QK_GESC: 'Esc', KC_GESC: 'Esc', QK_GRAVE_ESCAPE: 'Esc'
};

export const QMK_KEYCODE_TABLE_SIZE = Object.keys(CODES).length;

export function qmkKeycodeInfo(keycode: string): KeycodeInfo {
  const trimmed = keycode.trim();
  const plain = CODES[trimmed];
  if (plain) return { code: plain[0], legend: plain[1] };
  return { code: null, legend: uncodedLegend(trimmed) };
}

function uncodedLegend(keycode: string): string {
  if (EMPTY.has(keycode)) return '';
  if (NAMED_LEGENDS[keycode]) return NAMED_LEGENDS[keycode];
  const call = /^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/s.exec(keycode);
  if (call) {
    const [, name, inner] = call;
    const args = splitTopLevel(inner);
    if (/^(MO|TG|TT|TO|DF|OSL|PDF)$/.test(name)) return 'Fn';
    const tapped = /^LT$|^MT$/.test(name) ? args[1] : /_T$/.test(name) ? args[0] : undefined;
    if (tapped) return qmkKeycodeInfo(tapped).legend;
    if (/^(S|LSFT|RSFT)$/.test(name) && args[0]) return `⇧${qmkKeycodeInfo(args[0]).legend}`;
  }
  return keycode.replace(/^(KC|QK|RGB|RM|BL|UG)_/, '').slice(0, 5);
}

export function stripCComments(source: string): string {
  let output = '';
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"' || char === "'") {
      const start = index;
      index += 1;
      while (index < source.length && source[index] !== char) index += source[index] === '\\' ? 2 : 1;
      output += source.slice(start, index + 1);
      index += 1;
    } else if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
    } else if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      if (end < 0) throw new Error('Unterminated block comment in keymap.');
      output += ' ';
      index = end + 2;
    } else {
      output += char;
      index += 1;
    }
  }
  return output;
}

export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(' || char === '{' || char === '[') depth += 1;
    if (char === ')' || char === '}' || char === ']') depth -= 1;
    if (depth < 0) throw new Error('Unbalanced brackets in keymap arguments.');
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (depth !== 0) throw new Error('Unbalanced brackets in keymap arguments.');
  if (current.trim()) parts.push(current.trim());
  return parts.map((part) => part.replace(/\s+/g, ' '));
}

/** Parses designated `[LAYER] = LAYOUT_xxx(...)` entries from a QMK `keymap.c`. */
export function parseKeymapC(source: string): KeymapLayer[] {
  const code = stripCComments(source);
  const layers: KeymapLayer[] = [];
  const pattern = /\[\s*([A-Za-z0-9_]+)\s*\]\s*=\s*(LAYOUT[A-Za-z0-9_]*)\s*\(/g;
  for (let match = pattern.exec(code); match; match = pattern.exec(code)) {
    const open = pattern.lastIndex - 1;
    let depth = 0;
    let close = -1;
    for (let index = open; index < code.length; index += 1) {
      if (code[index] === '(') depth += 1;
      if (code[index] === ')') depth -= 1;
      if (depth === 0) {
        close = index;
        break;
      }
    }
    if (close < 0) throw new Error(`Unterminated layer ${match[1]} in keymap.`);
    layers.push({ name: match[1], macro: match[2], keycodes: splitTopLevel(code.slice(open + 1, close)) });
    pattern.lastIndex = close + 1;
  }
  return layers;
}

/** Parses a QMK `keymap.json` (`{ layout, layers: string[][] }`). Layer names are indexes. */
export function parseKeymapJson(source: unknown): KeymapLayer[] {
  if (!source || typeof source !== 'object') throw new Error('keymap.json must be an object.');
  const { layout, layers } = source as { layout?: unknown; layers?: unknown };
  if (typeof layout !== 'string' || !Array.isArray(layers)) throw new Error('keymap.json needs layout and layers.');
  return layers.map((layer, index) => {
    if (!Array.isArray(layer) || !layer.every((value) => typeof value === 'string')) {
      throw new Error(`keymap.json layer ${index} must be a string array.`);
    }
    return { name: String(index), macro: layout, keycodes: layer.map((value) => value.trim()) };
  });
}

/** Returns the copyright lines from a source header for attribution. */
export function extractCopyrightLines(source: string): string[] {
  return [...source.matchAll(/^[\s/*#]*(Copyright\b.*?)\s*(?:\*\/)?$/gim)]
    .map((match) => match[1].trim())
    .filter((line, index, all) => all.indexOf(line) === index);
}
