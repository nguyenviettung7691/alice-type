import { describe, expect, it } from 'vitest';
import { defaultVariant, findCatalogEntry, isResolvedLayoutEligible, loadLayoutProfile, LAYOUT_CATALOG } from './layout-catalog';
import {
  KeymapImportError, MAX_KEYMAP_FILE_BYTES, TRANSPARENT_LEGEND, applyKeymapLayer, keymapKeyInfo, layersFitMatrix,
  normalizeKeycode, parseKeymapFile, physicalCodeMap, previewKeymap
} from './keymap-import';

const entry = findCatalogEntry('projectkb-alice')!;
const { rows, cols } = entry.matrix;
const vendorProductId = entry.vendorId * 65536 + entry.productId;

async function defaultLayer() {
  const profile = await loadLayoutProfile(entry.id);
  const layer: (string | null)[] = Array.from({ length: rows * cols }, () => null);
  for (const key of profile.keys) if (key.g < 0 || key.o === 0) layer[key.row * cols + key.col] ??= key.kc;
  return { profile, layer };
}

function failure(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof KeymapImportError) return error.reason;
    throw error;
  }
  throw new Error('Expected a KeymapImportError.');
}

describe('keymap import', () => {
  it('records matrix dimensions for every catalog entry', () => {
    for (const profile of LAYOUT_CATALOG.profiles) {
      expect(Number.isInteger(profile.matrix.rows) && profile.matrix.rows > 0).toBe(true);
      expect(Number.isInteger(profile.matrix.cols) && profile.matrix.cols > 0).toBe(true);
    }
  });

  it('normalizes string and numeric keycodes', () => {
    expect(normalizeKeycode('LT(1, KC_SPC)')).toBe('LT(1,KC_SPC)');
    expect(normalizeKeycode(0x04)).toBe('KC_A');
    expect(normalizeKeycode(0x2c)).toBe('KC_SPC');
    expect(normalizeKeycode(0xe0)).toBe('KC_LCTL');
    expect(normalizeKeycode(0x5100)).toBe('0x5100');
    expect(normalizeKeycode(-1)).toBeNull();
    expect(normalizeKeycode(0)).toBeNull();
    expect(normalizeKeycode('KC_NO')).toBeNull();
    expect(() => normalizeKeycode('KC_É')).toThrow(KeymapImportError);
    expect(() => normalizeKeycode({})).toThrow(KeymapImportError);
  });

  it('describes tap/hold, layer, transparent, and unrecognized keys', () => {
    expect(keymapKeyInfo('LT(1,KC_SPC)')).toMatchObject({ code: 'Space', legend: 'Space / L1' });
    expect(keymapKeyInfo('MT(MOD_LCTL,KC_ESC)')).toMatchObject({ code: 'Escape', legend: 'Esc / Ctrl' });
    expect(keymapKeyInfo('LCTL_T(KC_CAPS)')).toMatchObject({ code: 'CapsLock', legend: 'Caps / Ctrl' });
    expect(keymapKeyInfo('MO(2)')).toMatchObject({ code: null, legend: 'Fn' });
    expect(keymapKeyInfo('KC_TRNS')).toMatchObject({ code: null, legend: TRANSPARENT_LEGEND, transparent: true });
    expect(keymapKeyInfo('0x5100')).toMatchObject({ code: null, recognized: false });
    expect(keymapKeyInfo('KC_A')).toMatchObject({ code: 'KeyA', legend: 'A' });
  });

  it('parses a VIA saved layout for the confirmed board', async () => {
    const { layer } = await defaultLayer();
    const file = JSON.stringify({ name: 'Alice', vendorProductId, macros: ['x'], layers: [layer, layer.map(() => 'KC_TRNS')] });
    const parsed = parseKeymapFile(file, file.length, entry);
    expect(parsed.format).toBe('via');
    expect(parsed.layers).toHaveLength(2);
    expect(parsed.ignored).toEqual(['macros']);
    expect(parsed.identityUnconfirmed).toBe(false);
    expect(layersFitMatrix(parsed.layers, entry)).toBe(true);
  });

  it('parses a Vial layout with an identity warning', async () => {
    const { layer } = await defaultLayer();
    const grid = Array.from({ length: rows }, (_, row) => layer.slice(row * cols, (row + 1) * cols).map((kc) => kc ?? -1));
    const file = JSON.stringify({ version: 1, uid: 123, layout: [grid], encoder_layout: [] });
    const parsed = parseKeymapFile(file, file.length, entry);
    expect(parsed).toMatchObject({ format: 'vial', identityUnconfirmed: true, ignored: [] });
    expect(parsed.layers[0]).toEqual(layer);
  });

  it('rejects files with specific reasons', async () => {
    const { layer } = await defaultLayer();
    const via = (patch: object) => JSON.stringify({ vendorProductId, layers: [layer], ...patch });
    expect(failure(() => parseKeymapFile('{', 1, entry))).toBe('malformed');
    expect(failure(() => parseKeymapFile('[]', 2, entry))).toBe('malformed');
    expect(failure(() => parseKeymapFile(via({}), MAX_KEYMAP_FILE_BYTES + 1, entry))).toBe('too-large');
    expect(failure(() => parseKeymapFile(via({ vendorProductId: vendorProductId + 1 }), 10, entry))).toBe('wrong-board');
    expect(failure(() => parseKeymapFile(via({ layers: [layer.slice(1)] }), 10, entry))).toBe('wrong-size');
    expect(failure(() => parseKeymapFile(via({ layers: [] }), 10, entry))).toBe('no-layers');
    expect(failure(() => parseKeymapFile(via({ layers: Array(33).fill(layer) }), 10, entry))).toBe('too-many-layers');
    expect(failure(() => parseKeymapFile(JSON.stringify({ version: 2, layout: [] }), 10, entry))).toBe('unsupported');
    expect(failure(() => parseKeymapFile(JSON.stringify({ version: 1, layout: [[[]]] }), 10, entry))).toBe('wrong-size');
    expect(failure(() => parseKeymapFile(JSON.stringify({ name: 'x' }), 10, entry))).toBe('unsupported');
  });

  it('previews no differences for the catalog default and applies a remap', async () => {
    const { profile, layer } = await defaultLayer();
    const variant = defaultVariant(entry);
    expect(previewKeymap(entry, profile, variant, [layer]).differences).toBe(0);

    const caps = profile.keys.find((key) => key.code === 'CapsLock')!;
    const remapped = [...layer];
    remapped[caps.row * cols + caps.col] = 'LCTL_T(KC_ESC)';
    const preview = previewKeymap(entry, profile, variant, [remapped]);
    expect(preview.differences).toBe(1);
    expect(preview.examples[0]).toEqual({ row: caps.row, col: caps.col, from: 'Caps', to: 'Esc / Ctrl' });
    expect(isResolvedLayoutEligible(preview.layout)).toBe(true);
    expect(preview.layout.keys.find((key) => key.code === 'CapsLock')).toBeUndefined();

    const applied = applyKeymapLayer(profile, entry, remapped);
    expect(physicalCodeMap(profile, applied, variant)).toEqual({ Escape: 'CapsLock' });
  });

  it('flags an ineligible remap through missing codes', async () => {
    const { profile, layer } = await defaultLayer();
    const preview = previewKeymap(entry, profile, defaultVariant(entry), [layer.map((kc) => kc === 'KC_A' ? 'KC_F1' : kc)]);
    expect(isResolvedLayoutEligible(preview.layout)).toBe(false);
    expect(preview.layout.missingCodes).toContain('KeyA');
  });
});
