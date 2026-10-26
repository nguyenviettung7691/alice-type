import { deviceId, type KeyboardDevice } from './keyboard-access';
import { type ImportedLayoutProfile, type LayoutCatalogEntry } from './layout-catalog';

export interface LayoutCandidate {
  readonly entry: LayoutCatalogEntry;
  readonly score: number;
  readonly reasons: readonly string[];
}

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function nameMatches(productName: string, entry: LayoutCatalogEntry): boolean {
  const product = normalizedName(productName);
  if (!product) return false;
  return [entry.name, entry.displayName].some((name) => {
    const candidate = normalizedName(name);
    return candidate !== '' && (product.includes(candidate) || candidate.includes(product));
  });
}

/**
 * Ranks catalog layouts for a browser-reported device. Only an exact vendor/product ID match
 * creates a candidate; the product name is a tie-breaker. Results are suggestions, never detections.
 */
export function rankLayoutCandidates(
  device: KeyboardDevice | null,
  catalog: readonly LayoutCatalogEntry[]
): LayoutCandidate[] {
  if (!device) return [];
  const id = `${deviceId(device.vendorId)}:${deviceId(device.productId)}`;
  return catalog
    .filter((entry) => entry.vendorId === device.vendorId && entry.productId === device.productId)
    .map((entry) => {
      const shared = Math.max(1, entry.sharedIdCount);
      const named = nameMatches(device.productName, entry);
      const reasons = [
        `Vendor/product ID ${id} matches this catalog entry.`,
        shared === 1
          ? 'QMK lists this ID for 1 keyboard.'
          : `This ID is shared by ${shared} keyboards in QMK, so it may belong to a different board.`
      ];
      if (named) reasons.push(`The browser-reported name "${device.productName}" is similar.`);
      return { entry, score: 1 / shared + (named ? 0.5 : 0), reasons };
    })
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
