import { describe, expect, it } from 'vitest';
import { LAYOUT_PRESETS } from './layout-presets';

describe('featured geometry presets', () => {
  it('maps each requested family to a sourced catalog profile', () => {
    expect(LAYOUT_PRESETS.map(({ id }) => id)).toEqual(['standard-alice', 'arisu', 'alice75', 'split']);
    expect(LAYOUT_PRESETS.map(({ family }) => family)).toEqual(['alice', 'arisu', 'alice75', 'split']);
    for (const preset of LAYOUT_PRESETS) {
      expect(preset.entry.family).toBe(preset.family);
      expect(preset.entry.sources.via.url).toMatch(/^https:\/\//);
      expect(preset.entry.sources.qmkInfo.url).toMatch(/^https:\/\//);
    }
    expect(LAYOUT_PRESETS.find(({ id }) => id === 'split')?.entry.id).toBe('sofle-keyhive');
  });
});
