import { findCatalogEntry, type LayoutCatalogEntry, type LayoutFamily } from './layout-catalog';

export interface LayoutPreset {
  readonly id: LayoutPresetId;
  readonly family: LayoutFamily;
  readonly entry: LayoutCatalogEntry;
}

export type LayoutPresetId = 'standard-alice' | 'arisu' | 'alice75' | 'split';

const PRESET_CATALOG: readonly { readonly id: LayoutPresetId; readonly family: LayoutFamily; readonly profileId: string }[] = [
  { id: 'standard-alice', family: 'alice', profileId: 'projectkb-alice' },
  { id: 'arisu', family: 'arisu', profileId: 'fate-nozomi-arisu' },
  { id: 'alice75', family: 'alice75', profileId: 'keychron-q10-ansi-encoder' },
  { id: 'split', family: 'split', profileId: 'sofle-keyhive' }
];

export const LAYOUT_PRESETS: readonly LayoutPreset[] = PRESET_CATALOG.flatMap((preset) => {
  const entry = findCatalogEntry(preset.profileId);
  return entry && entry.family === preset.family ? [{ ...preset, entry }] : [];
});

export function layoutPreset(id: string): LayoutPreset | undefined {
  return LAYOUT_PRESETS.find((preset) => preset.id === id);
}
