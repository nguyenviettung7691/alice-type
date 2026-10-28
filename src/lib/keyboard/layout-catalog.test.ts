import { describe, expect, it } from 'vitest';
import {
  LAYOUT_CATALOG, REQUIRED_LAYOUT_CODES, defaultVariant, describeVariant, findCatalogEntry, isResolvedLayoutEligible,
  isValidVariant, loadLayoutProfile, resolveImportedLayout, untestedCodes, LayoutProfileLoadError,
  type LayoutCatalogEntry, type LayoutVariant
} from './layout-catalog';

function allVariants(entry: LayoutCatalogEntry): LayoutVariant[] {
  return entry.groups.reduce<LayoutVariant[]>((variants, group, index) => variants.flatMap((variant) =>
    group.options.map((_, option) => ({ ...variant, [String(index)]: option }))), [{}]);
}

describe('imported keyboard layout catalog', () => {
  it('records a pinned, attributed source for every entry', () => {
    expect(LAYOUT_CATALOG.profiles.length).toBeGreaterThan(0);
    expect(LAYOUT_CATALOG.pins.via).toMatch(/^[0-9a-f]{40}$/);
    expect(LAYOUT_CATALOG.pins.qmk).toMatch(/^[0-9a-f]{40}$/);
    expect(new Set(LAYOUT_CATALOG.profiles.map((entry) => entry.id)).size).toBe(LAYOUT_CATALOG.profiles.length);
    expect(new Set(LAYOUT_CATALOG.profiles.map((entry) => entry.displayName)).size).toBe(LAYOUT_CATALOG.profiles.length);
    for (const entry of LAYOUT_CATALOG.profiles) {
      expect(entry.id).toMatch(/^[a-z0-9-]+$/);
      expect(entry.vendorId).toBeGreaterThanOrEqual(0);
      expect(entry.vendorId).toBeLessThanOrEqual(0xffff);
      expect(entry.productId).toBeLessThanOrEqual(0xffff);
      expect(entry.sharedIdCount).toBeGreaterThanOrEqual(1);
      const { via, qmkInfo, keymap } = entry.sources;
      expect(via.commit).toBe(LAYOUT_CATALOG.pins.via);
      expect(keymap.commit).toBe(LAYOUT_CATALOG.pins.qmk);
      for (const url of [via.url, qmkInfo.url, keymap.url]) expect(url).toMatch(/^https:\/\//);
      expect(via.url).toContain(via.commit);
      expect(keymap.url).toContain(keymap.commit);
      for (const source of [via, qmkInfo, keymap]) expect(source.license).toMatch(/GPL/);
    }
  });

  it('loads and resolves every profile and variant into an eligible layout', async () => {
    for (const entry of LAYOUT_CATALOG.profiles) {
      const profile = await loadLayoutProfile(entry.id);
      expect(isValidVariant(entry, defaultVariant(entry))).toBe(true);
      for (const variant of allVariants(entry)) {
        const layout = resolveImportedLayout(entry, profile, variant);
        expect(isResolvedLayoutEligible(layout), `${entry.id} ${describeVariant(entry, variant)}`).toBe(true);
        expect(layout.missingCodes).toEqual([]);
        expect(layout.viewBox.split(' ').map(Number).every(Number.isFinite)).toBe(true);
        expect(new Set(layout.keys.map((key) => key.code)).size).toBe(layout.keys.length);
        expect(new Set(layout.testSequence.map((key) => key.code))).toEqual(new Set(layout.keys.map((key) => key.code)));
        for (const code of REQUIRED_LAYOUT_CODES) expect(layout.testSequence.some((key) => key.code === code)).toBe(true);
        expect(untestedCodes(layout)).toEqual([]);
      }
    }
  });

  it('switches Alice variant keys and keeps uncoded keys inert', async () => {
    const entry = findCatalogEntry('projectkb-alice')!;
    const profile = await loadLayoutProfile(entry.id);
    expect(entry.groups.map((group) => group.label)).toEqual(['Long Backspace', 'Long RShift']);
    const standard = resolveImportedLayout(entry, profile, { 0: 0, 1: 0 });
    const long = resolveImportedLayout(entry, profile, { 0: 1, 1: 1 });
    expect(standard.keys.some((key) => key.code === 'Delete')).toBe(true);
    expect(long.keys.some((key) => key.code === 'Delete')).toBe(false);
    expect(standard.keys.some((key) => key.code === 'MetaRight')).toBe(true);
    expect(long.keys.some((key) => key.code === 'MetaRight')).toBe(false);
    expect(standard.inertKeys.map((key) => key.legend)).toContain('Fn');
    expect(standard.keys.some((key) => key.keycaps.some((cap) => cap.rotation))).toBe(true);
    expect(describeVariant(entry, { 0: 1, 1: 0 })).toBe('Long Backspace: On, Long RShift: Off');
  });

  it('rejects invalid variants, mismatched data, and unknown profiles', async () => {
    const entry = findCatalogEntry('projectkb-alice')!;
    for (const variant of [null, [], {}, { 0: 0 }, { 0: 0, 1: 2 }, { 0: 0, 1: 0.5 }, { 0: 0, 2: 0 }, { 0: 0, 1: 0, 2: 0 }]) {
      expect(isValidVariant(entry, variant)).toBe(false);
    }
    const other = await loadLayoutProfile('chalice');
    expect(() => resolveImportedLayout(entry, other, defaultVariant(entry))).toThrow(LayoutProfileLoadError);
    await expect(loadLayoutProfile('missing-board')).rejects.toThrow(LayoutProfileLoadError);
    await expect(loadLayoutProfile('../index')).rejects.toThrow(LayoutProfileLoadError);
    expect(findCatalogEntry(null)).toBeUndefined();
  });
});
