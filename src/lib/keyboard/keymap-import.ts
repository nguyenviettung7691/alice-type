// Local VIA/Vial keymap file import. Files are parsed in the browser only; nothing is uploaded or written to a device.
import { qmkKeycodeInfo } from './qmk-keycodes';
import {
  resolveImportedLayout, type ImportedLayoutProfile, type LayoutCatalogEntry, type LayoutVariant,
  type ResolvedKeyboardLayout
} from './layout-catalog';
import { MAX_KEYMAP_LAYERS } from '../storage/preferences';

export type KeymapFormat = 'via' | 'vial';
export const MAX_KEYMAP_FILE_BYTES = 256 * 1024;
export const KEYMAP_PREVIEW_EXAMPLES = 12;
export const TRANSPARENT_LEGEND = '▽';

export type KeymapImportFailure =
  | 'too-large' | 'malformed' | 'unsupported' | 'wrong-board' | 'wrong-size' | 'too-many-layers' | 'no-layers';

export class KeymapImportError extends Error {
  constructor(readonly reason: KeymapImportFailure, message: string) {
    super(message);
    this.name = 'KeymapImportError';
  }
}

export interface ParsedKeymap {
  readonly format: KeymapFormat;
  /** Keycodes per layer, row-major matrix order; `null` means no key. */
  readonly layers: readonly (readonly (string | null)[])[];
  /** File features AliceType does not import (macros, encoders, ...). */
  readonly ignored: readonly string[];
  /** Vial files carry no USB ID, so only matrix dimensions tie them to the board. */
  readonly identityUnconfirmed: boolean;
  readonly unrecognized: number;
}

export interface KeymapKeyInfo {
  readonly code: string | null;
  readonly legend: string;
  readonly transparent: boolean;
  readonly recognized: boolean;
}

const KEYCODE = /^[\x21-\x7e]{1,64}$/;
const TRANSPARENT = new Set(['_______', 'KC_TRNS', 'KC_TRANSPARENT']);
const HID_NAMES: Readonly<Record<number, string>> = (() => {
  const table: Record<number, string> = {};
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((letter, index) => { table[0x04 + index] = `KC_${letter}`; });
  '1234567890'.split('').forEach((digit, index) => { table[0x1e + index] = `KC_${digit}`; });
  const named = ['KC_ENT', 'KC_ESC', 'KC_BSPC', 'KC_TAB', 'KC_SPC', 'KC_MINS', 'KC_EQL', 'KC_LBRC', 'KC_RBRC', 'KC_BSLS',
    'KC_NUHS', 'KC_SCLN', 'KC_QUOT', 'KC_GRV', 'KC_COMM', 'KC_DOT', 'KC_SLSH', 'KC_CAPS'];
  named.forEach((name, index) => { table[0x28 + index] = name; });
  for (let index = 0; index < 12; index += 1) table[0x3a + index] = `KC_F${index + 1}`;
  ['KC_PSCR', 'KC_SCRL', 'KC_PAUS', 'KC_INS', 'KC_HOME', 'KC_PGUP', 'KC_DEL', 'KC_END', 'KC_PGDN', 'KC_RGHT', 'KC_LEFT',
    'KC_DOWN', 'KC_UP'].forEach((name, index) => { table[0x46 + index] = name; });
  table[0x64] = 'KC_NUBS';
  table[0x65] = 'KC_APP';
  for (let index = 0; index < 12; index += 1) table[0x68 + index] = `KC_F${index + 13}`;
  ['KC_LCTL', 'KC_LSFT', 'KC_LALT', 'KC_LGUI', 'KC_RCTL', 'KC_RSFT', 'KC_RALT', 'KC_RGUI']
    .forEach((name, index) => { table[0xe0 + index] = name; });
  return table;
})();

/** Normalizes one file keycode; numbers decode only in the basic HID range, `-1`/`0` mean no key. */
export function normalizeKeycode(value: unknown): string | null {
  if (value === null || value === -1 || value === 0) return null;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff) throw new KeymapImportError('malformed', `Keycode ${value} is out of range.`);
    if (value >= 0x04 && value <= 0xe7 && HID_NAMES[value]) return HID_NAMES[value];
    return `0x${value.toString(16).toUpperCase().padStart(4, '0')}`;
  }
  if (typeof value !== 'string') throw new KeymapImportError('malformed', 'A keycode is not a string or number.');
  const compact = value.replace(/\s+/g, '');
  if (compact === '' || compact === 'KC_NO' || compact === 'XXXXXXX') return null;
  if (!KEYCODE.test(compact)) throw new KeymapImportError('malformed', 'A keycode contains unsupported characters.');
  return compact;
}

function modifierLegend(name: string): string {
  const upper = name.toUpperCase();
  if (/HYPR|ALL/.test(upper)) return 'Hyper';
  if (/MEH/.test(upper)) return 'Meh';
  const parts: string[] = [];
  if (/CTL|CTRL/.test(upper)) parts.push('Ctrl');
  if (/SFT|SHIFT/.test(upper)) parts.push('Shift');
  if (/ALT|OPT|ALGR/.test(upper)) parts.push('Alt');
  if (/GUI|CMD|WIN/.test(upper)) parts.push('Meta');
  return parts.length ? parts.join('+') : name.replace(/_T$/, '');
}

/** Code and legend for a keymap entry: plain HID keys keep their code, tap/hold keys use their tap code. */
export function keymapKeyInfo(keycode: string | null): KeymapKeyInfo {
  if (keycode === null) return { code: null, legend: '', transparent: false, recognized: true };
  if (TRANSPARENT.has(keycode)) return { code: null, legend: TRANSPARENT_LEGEND, transparent: true, recognized: true };
  if (/^0x[0-9A-F]+$/i.test(keycode)) return { code: null, legend: '?', transparent: false, recognized: false };
  const call = /^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/.exec(keycode);
  if (call) {
    const [, name, inner] = call;
    const args = inner.split(',');
    if (name === 'LT' && args.length === 2) {
      const tap = qmkKeycodeInfo(args[1]);
      return { code: tap.code, legend: `${tap.legend} / L${args[0]}`, transparent: false, recognized: true };
    }
    if (name === 'MT' && args.length === 2) {
      const tap = qmkKeycodeInfo(args[1]);
      return { code: tap.code, legend: `${tap.legend} / ${modifierLegend(args[0])}`, transparent: false, recognized: true };
    }
    if (/_T$/.test(name) && args.length === 1) {
      const tap = qmkKeycodeInfo(args[0]);
      return { code: tap.code, legend: `${tap.legend} / ${modifierLegend(name)}`, transparent: false, recognized: true };
    }
  }
  const info = qmkKeycodeInfo(keycode);
  return { code: info.code, legend: info.legend, transparent: false, recognized: true };
}

function parseJson(text: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new KeymapImportError('malformed', 'The file is not valid JSON.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new KeymapImportError('malformed', 'The file is not a keymap object.');
  return value as Record<string, unknown>;
}

function checkLayerCount(count: number) {
  if (count < 1) throw new KeymapImportError('no-layers', 'The file has no keymap layers.');
  if (count > MAX_KEYMAP_LAYERS) throw new KeymapImportError('too-many-layers', `The file has ${count} layers; at most ${MAX_KEYMAP_LAYERS} are accepted.`);
}

function present(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== undefined && value !== null;
}

/** Parses a VIA saved layout (`.json`) or Vial layout (`.vil`) for the confirmed catalog board. */
export function parseKeymapFile(text: string, byteLength: number, entry: LayoutCatalogEntry): ParsedKeymap {
  if (byteLength > MAX_KEYMAP_FILE_BYTES) throw new KeymapImportError('too-large', 'The file is larger than 256 KB.');
  const file = parseJson(text);
  const { rows, cols } = entry.matrix;
  let format: KeymapFormat;
  let raw: unknown[][];
  let ignoredFields: readonly string[];
  if (Array.isArray(file.layout)) {
    if (file.version !== 1) throw new KeymapImportError('unsupported', 'Only Vial layout files with version 1 are supported.');
    format = 'vial';
    checkLayerCount(file.layout.length);
    raw = file.layout.map((layer) => {
      if (!Array.isArray(layer) || layer.length !== rows
        || layer.some((row) => !Array.isArray(row) || row.length !== cols)) {
        throw new KeymapImportError('wrong-size', `Each layer must be ${rows} rows by ${cols} columns for ${entry.displayName}.`);
      }
      return (layer as unknown[][]).flat();
    });
    ignoredFields = ['macro', 'encoder_layout', 'layout_options', 'tap_dance', 'combo', 'key_override'];
  } else if (Array.isArray(file.layers)) {
    format = 'via';
    if (typeof file.vendorProductId !== 'number' || file.vendorProductId !== entry.vendorId * 65536 + entry.productId) {
      throw new KeymapImportError('wrong-board', `The file is for a different keyboard than ${entry.displayName}.`);
    }
    checkLayerCount(file.layers.length);
    raw = file.layers.map((layer) => {
      if (!Array.isArray(layer) || layer.length !== rows * cols) {
        throw new KeymapImportError('wrong-size', `Each layer must have ${rows * cols} keys for ${entry.displayName}.`);
      }
      return layer as unknown[];
    });
    ignoredFields = ['macros', 'encoders'];
  } else {
    throw new KeymapImportError('unsupported', 'The file is not a VIA saved layout or Vial layout.');
  }
  const layers = raw.map((layer) => layer.map(normalizeKeycode));
  const unrecognized = layers[0].filter((keycode) => !keymapKeyInfo(keycode).recognized).length;
  return {
    format,
    layers,
    ignored: ignoredFields.filter((field) => present(file[field])),
    identityUnconfirmed: format === 'vial',
    unrecognized
  };
}

/** Whether stored layers still fit the board matrix (re-validated on load). */
export function layersFitMatrix(layers: readonly (readonly (string | null)[])[], entry: LayoutCatalogEntry): boolean {
  const size = entry.matrix.rows * entry.matrix.cols;
  return layers.length >= 1 && layers.length <= MAX_KEYMAP_LAYERS && layers.every((layer) => layer.length === size);
}

/** Replaces catalog keycodes with one imported layer; physical geometry and variant options are unchanged. */
export function applyKeymapLayer(
  profile: ImportedLayoutProfile, entry: LayoutCatalogEntry, layer: readonly (string | null)[]
): ImportedLayoutProfile {
  const { rows, cols } = entry.matrix;
  return {
    ...profile,
    keys: profile.keys.map((key) => {
      const keycode = key.row < rows && key.col < cols ? layer[key.row * cols + key.col] ?? null : null;
      const info = keymapKeyInfo(keycode);
      return { ...key, kc: keycode, code: info.code, legend: info.legend };
    })
  };
}

export interface KeymapDifference {
  readonly row: number;
  readonly col: number;
  readonly from: string;
  readonly to: string;
}

export interface KeymapPreview {
  readonly differences: number;
  readonly examples: readonly KeymapDifference[];
  readonly layout: ResolvedKeyboardLayout;
}

const shown = (legend: string, code: string | null) => legend || code || '—';

/** Base-layer comparison against the catalog default for the confirmed variant, plus the resulting layout. */
export function previewKeymap(
  entry: LayoutCatalogEntry, profile: ImportedLayoutProfile, variant: LayoutVariant, layers: readonly (readonly (string | null)[])[]
): KeymapPreview {
  const applied = applyKeymapLayer(profile, entry, layers[0]);
  const differences: KeymapDifference[] = [];
  profile.keys.forEach((key, index) => {
    if (key.g >= 0 && variant[String(key.g)] !== key.o) return;
    const next = applied.keys[index];
    if (next.code !== key.code || next.legend !== key.legend) {
      differences.push({ row: key.row, col: key.col, from: shown(key.legend, key.code), to: shown(next.legend, next.code) });
    }
  });
  return {
    differences: differences.length,
    examples: differences.slice(0, KEYMAP_PREVIEW_EXAMPLES),
    layout: resolveImportedLayout(entry, applied, variant)
  };
}

/**
 * Maps each remapped browser code to the catalog-default code of the physical slot that now sends it,
 * so finger assignment follows the finger that physically reaches the key.
 */
export function physicalCodeMap(profile: ImportedLayoutProfile, applied: ImportedLayoutProfile, variant: LayoutVariant): Readonly<Record<string, string>> {
  const map: Record<string, string> = {};
  profile.keys.forEach((key, index) => {
    if (key.g >= 0 && variant[String(key.g)] !== key.o) return;
    const next = applied.keys[index].code;
    if (next && key.code && next !== key.code && !(next in map)) map[next] = key.code;
  });
  return map;
}

/** Order-independent key identifying the confirmed variant an import was applied to. */
export function keymapVariantKey(variant: LayoutVariant): string {
  return JSON.stringify(Object.keys(variant).sort().map((group) => [group, variant[group]]));
}
