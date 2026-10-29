import { describe, expect, it } from 'vitest';
import { LAYOUT_CATALOG, findCatalogEntry, loadLayoutProfile, type LayoutCatalogEntry } from './layout-catalog';
import { distinguishingCodes, eliminatedVariantOptions, rankLayoutCandidates } from './layout-matching';

const device = (vendorId: number, productId: number, productName = '') => ({ vendorId, productId, productName });

describe('layout candidate ranking', () => {
  it('returns no candidates without a device or exact vendor/product ID match', () => {
    expect(rankLayoutCandidates(null, LAYOUT_CATALOG.profiles)).toEqual([]);
    expect(rankLayoutCandidates(device(0x1234, 0x5678, 'Alice'), LAYOUT_CATALOG.profiles)).toEqual([]);
  });

  it('suggests an exact ID match with reasons and discloses shared IDs', () => {
    const [candidate] = rankLayoutCandidates(device(0x0159, 0xa71c), LAYOUT_CATALOG.profiles);
    expect(candidate.entry.id).toBe('projectkb-alice');
    expect(candidate.reasons[0]).toEqual({ code: 'usb-id', id: '0x0159:0xA71C' });
    expect(candidate.reasons[1]).toMatchObject({ code: 'shared-id', count: expect.any(Number) });
  });

  it('uses product names to rank ID matches and suggest boards with different IDs', () => {
    const base = findCatalogEntry('chalice')!;
    const entries: LayoutCatalogEntry[] = [
      { ...base, id: 'a', displayName: 'Alpha Board', name: 'Alpha Board', sharedIdCount: 2 },
      { ...base, id: 'b', displayName: 'Beta Board', name: 'Beta Board', sharedIdCount: 2 },
      { ...base, id: 'c', displayName: 'Gamma', name: 'Gamma', vendorId: base.vendorId + 1 }
    ];
    const ranked = rankLayoutCandidates(device(base.vendorId, base.productId, 'Gamma Beta Board'), entries);
    expect(ranked.map((candidate) => candidate.entry.id)).toEqual(['b', 'a', 'c']);
    expect(ranked[0].reasons.at(-1)).toMatchObject({ code: 'device-name' });
    expect(ranked[2].reasons.at(-1)).toEqual({ code: 'name-only' });
    expect(rankLayoutCandidates(device(base.vendorId, base.productId), entries).map((c) => c.entry.id)).toEqual(['a', 'b']);
  });

  it('suggests from a board name without a device and prioritizes named variants', () => {
    const ranked = rankLayoutCandidates(null, LAYOUT_CATALOG.profiles, ['keychron Q8 ISO']);
    expect(ranked[0].entry.id).toBe('keychron-q8-iso');
    expect(ranked[0].reasons).toEqual([
      { code: 'board-name', name: 'keychron Q8 ISO' }, { code: 'name-only' }
    ]);
    expect(ranked.every((candidate) => candidate.entry.id.startsWith('keychron-q8-'))).toBe(true);
    expect(rankLayoutCandidates(null, LAYOUT_CATALOG.profiles, ['ProjectKB Alice'])[0].entry.id).toBe('projectkb-alice');
  });

  it('uses saved name/model hints and QMK board aliases, with token boundaries', () => {
    const base = findCatalogEntry('chalice')!;
    const entry = { ...base, name: 'Display Model', displayName: 'Display Model',
      sources: { ...base.sources, qmkInfo: { ...base.sources.qmkInfo, keyboard: 'maker/secret42/rev2' } } };
    expect(rankLayoutCandidates(null, [entry], ['My board', 'maker/secret42/rev2'])).toHaveLength(1);
    expect(rankLayoutCandidates(device(1, 2, 'KEYCHRON Q8'), LAYOUT_CATALOG.profiles)).toHaveLength(4);
    for (const name of ['', 'keyboard', 'Alice', 'Keychron', 'Q80', 'notchalice', 'ANSI USB HID']) {
      expect(rankLayoutCandidates(null, LAYOUT_CATALOG.profiles, [name]), name).toEqual([]);
    }
  });
});

describe('variant elimination by key presses', () => {
  it('rules out options lacking an observed group-only code', async () => {
    const entry = findCatalogEntry('projectkb-alice')!;
    const profile = await loadLayoutProfile(entry.id);
    expect(eliminatedVariantOptions(entry, profile, new Set(['KeyA', 'Backspace', 'ShiftRight']))).toEqual(new Map());
    const result = eliminatedVariantOptions(entry, profile, new Set(['Delete', 'MetaRight']));
    expect(result.get(0)).toEqual(new Set([1]));
    expect(result.get(1)).toEqual(new Set([1]));
  });

  it('lists the codes that can distinguish each group', async () => {
    const entry = findCatalogEntry('projectkb-alice')!;
    const profile = await loadLayoutProfile(entry.id);
    expect(distinguishingCodes(entry, profile)).toEqual(new Map([[0, ['Delete']], [1, ['MetaRight']]]));
  });
});
