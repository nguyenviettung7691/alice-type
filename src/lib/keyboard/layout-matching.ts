import { deviceId, type KeyboardDevice } from './keyboard-access';
import { type ImportedLayoutProfile, type LayoutCatalogEntry } from './layout-catalog';

export interface LayoutCandidate {
  readonly entry: LayoutCatalogEntry;
  readonly score: number;
  readonly reasons: readonly LayoutCandidateReason[];
}

export type LayoutCandidateReason =
  | { readonly code: 'usb-id'; readonly id: string }
  | { readonly code: 'shared-id'; readonly count: number }
  | { readonly code: 'device-name' | 'board-name'; readonly name: string }
  | { readonly code: 'name-only' };

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function nameMatchScore(productName: string, entry: LayoutCatalogEntry): number {
  const words = normalizedName(productName).split(' ').filter(Boolean);
  if (!words.length) return 0;
  const brandWords = normalizedName(entry.brand).split(' ');
  const generic = new Set(['alice', 'keyboard', 'board', 'usb', 'hid', 'rgb', 'ansi', 'iso', 'knob', 'encoder', 'rev1', ...brandWords]);
  return Math.max(...[entry.name, entry.displayName, entry.sources.qmkInfo.keyboard].map((name) => {
    const candidateWords = normalizedName(name).split(' ');
    const modelWords = candidateWords.filter((word) => !generic.has(word));
    if (candidateWords.length > 1 && candidateWords.every((word) => words.includes(word))) return 2;
    // Require a model token, not just a brand, layout family, or a substring (Q8 != Q80).
    if (!modelWords.length || !modelWords.every((word) => words.includes(word))) return 0;
    const withoutBrand = candidateWords.filter((word) => !brandWords.includes(word));
    return withoutBrand.every((word) => words.includes(word)) ? 2 : 1;
  }));
}

/**
 * Rank local evidence without treating names or shared USB IDs as proof of a physical layout.
 * Board names are user-provided hints; no evidence here activates a layout.
 */
export function rankLayoutCandidates(
  device: KeyboardDevice | null,
  catalog: readonly LayoutCatalogEntry[],
  boardNames: readonly string[] = []
): LayoutCandidate[] {
  return catalog
    .map((entry) => {
      const shared = Math.max(1, entry.sharedIdCount);
      const idMatch = !!device && entry.vendorId === device.vendorId && entry.productId === device.productId;
      const named = device ? nameMatchScore(device.productName, entry) : 0;
      const board = boardNames.map((name) => ({ name, score: nameMatchScore(name, entry) }))
        .sort((a, b) => b.score - a.score)[0];
      const boardName = board?.score ? board.name : '';
      const reasons: LayoutCandidateReason[] = [];
      if (idMatch) {
        reasons.push({ code: 'usb-id', id: `${deviceId(device.vendorId)}:${deviceId(device.productId)}` });
        if (shared > 1) reasons.push({ code: 'shared-id', count: shared });
      }
      if (named && device) reasons.push({ code: 'device-name', name: device.productName });
      if (boardName) reasons.push({ code: 'board-name', name: boardName });
      if (!idMatch && (named || boardName)) reasons.push({ code: 'name-only' });
      return { entry, score: (idMatch ? 3 + 1 / shared : 0) + named * 0.5 + (board?.score ?? 0), reasons };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => (b.score - a.score) || a.entry.displayName.localeCompare(b.entry.displayName));
}

/**
 * Returns, per variant group, the option indexes ruled out by observed physical codes: an
 * observed code that appears in the group only under other options eliminates this option.
 * Codes that also exist outside the group, or nowhere in it, eliminate nothing.
 */
export function eliminatedVariantOptions(
  entry: LayoutCatalogEntry,
  profile: ImportedLayoutProfile,
  observedCodes: ReadonlySet<string>
): ReadonlyMap<number, ReadonlySet<number>> {
  const result = new Map<number, Set<number>>();
  entry.groups.forEach((group, groupIndex) => {
    const elsewhere = new Set(profile.keys.filter((key) => key.g !== groupIndex && key.code).map((key) => key.code as string));
    const codesByOption = group.options.map((_, option) => new Set(profile.keys
      .filter((key) => key.g === groupIndex && key.o === option && key.code)
      .map((key) => key.code as string)));
    const eliminated = new Set<number>();
    for (const code of observedCodes) {
      if (elsewhere.has(code)) continue;
      const having = codesByOption.map((codes) => codes.has(code));
      if (!having.some(Boolean)) continue;
      having.forEach((has, option) => { if (!has) eliminated.add(option); });
    }
    if (eliminated.size > 0 && eliminated.size < group.options.length) result.set(groupIndex, eliminated);
  });
  return result;
}

/** Per variant group, the codes whose presence would rule out at least one option (used as key-check hints). */
export function distinguishingCodes(
  entry: LayoutCatalogEntry,
  profile: ImportedLayoutProfile
): ReadonlyMap<number, readonly string[]> {
  const result = new Map<number, string[]>();
  entry.groups.forEach((group, groupIndex) => {
    const elsewhere = new Set(profile.keys.filter((key) => key.g !== groupIndex && key.code).map((key) => key.code as string));
    const byOption = group.options.map((_, option) => new Set(profile.keys
      .filter((key) => key.g === groupIndex && key.o === option && key.code && !elsewhere.has(key.code))
      .map((key) => key.code as string)));
    const codes = [...new Set(byOption.flatMap((codes) => [...codes]))]
      .filter((code) => !byOption.every((codes) => codes.has(code)))
      .sort();
    if (codes.length > 0) result.set(groupIndex, codes);
  });
  return result;
}
