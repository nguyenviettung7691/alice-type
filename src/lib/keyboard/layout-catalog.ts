import { type AliceKey, type AliceKeycap, type InertKey } from './alice-layout';
import { kleLayoutBounds } from './kle-layout';
import catalogIndex from './layout-data/index.json';

export interface LayoutVariantGroup {
  readonly label: string;
  readonly options: readonly string[];
}

export interface LayoutCatalogEntry {
  readonly id: string;
  readonly displayName: string;
  readonly name: string;
  readonly brand: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly sharedIdCount: number;
  /** VIA matrix dimensions; saved VIA layers are flattened row-major `rows × cols`. */
  readonly matrix: { readonly rows: number; readonly cols: number };
  readonly groups: readonly LayoutVariantGroup[];
  readonly sources: {
    readonly via: { readonly repository: string; readonly path: string; readonly commit: string; readonly url: string; readonly license: string };
    readonly qmkInfo: { readonly keyboard: string; readonly url: string; readonly lastUpdated: string | null; readonly license: string };
    readonly keymap: {
      readonly repository: string; readonly path: string; readonly commit: string; readonly url: string;
      readonly layer: string; readonly layoutMacro: string; readonly license: string;
    };
  };
}

export interface LayoutCatalog {
  readonly revision: string;
  readonly generatedAt: string;
  readonly pins: { readonly via: string; readonly qmk: string };
  readonly profiles: readonly LayoutCatalogEntry[];
}

export interface ImportedLayoutKey {
  readonly row: number;
  readonly col: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly r: number;
  readonly rx: number;
  readonly ry: number;
  readonly s: readonly [number, number, number, number] | readonly number[] | null;
  readonly g: number;
  readonly o: number;
  readonly kc: string | null;
  readonly code: string | null;
  readonly legend: string;
}

export interface ImportedLayoutProfile {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly keys: readonly ImportedLayoutKey[];
}

/** Selected option index per variant group index (as a string key, for JSON storage). */
export type LayoutVariant = Readonly<Record<string, number>>;

export interface ResolvedKeyboardLayout {
  readonly profileId: string;
  readonly label: string;
  readonly keys: readonly AliceKey[];
  readonly inertKeys: readonly InertKey[];
  readonly testSequence: readonly AliceKey[];
  readonly viewBox: string;
  readonly missingCodes: readonly string[];
}

export const LAYOUT_CATALOG = catalogIndex as LayoutCatalog;
export const LAYOUT_UNIT = 48;
const KEY_INSET = 3;
const VIEW_PADDING = 8;
export const REQUIRED_LAYOUT_CODES: readonly string[] = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `Key${letter}`),
  ...'0123456789'.split('').map((digit) => `Digit${digit}`),
  'Space'
];
const loaders = import.meta.glob<ImportedLayoutProfile>('./layout-data/profiles/*.json', { import: 'default' });

export class LayoutProfileLoadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LayoutProfileLoadError';
  }
}

export function findCatalogEntry(id: string | null | undefined): LayoutCatalogEntry | undefined {
  return id ? LAYOUT_CATALOG.profiles.find((entry) => entry.id === id) : undefined;
}

export function defaultVariant(entry: LayoutCatalogEntry): LayoutVariant {
  return Object.fromEntries(entry.groups.map((_, index) => [String(index), 0]));
}

export function isValidVariant(entry: LayoutCatalogEntry, variant: unknown): variant is LayoutVariant {
  if (!variant || typeof variant !== 'object' || Array.isArray(variant)) return false;
  const record = variant as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== entry.groups.length) return false;
  return entry.groups.every((group, index) => {
    const option = record[String(index)];
    return Number.isInteger(option) && (option as number) >= 0 && (option as number) < group.options.length;
  });
}

export function describeVariant(entry: LayoutCatalogEntry, variant: LayoutVariant): string {
  return entry.groups.map((group, index) => `${group.label}: ${group.options[variant[String(index)]] ?? 'Unknown'}`).join(', ');
}

export async function loadLayoutProfile(id: string): Promise<ImportedLayoutProfile> {
  const loader = loaders[`./layout-data/profiles/${id}.json`];
  if (!findCatalogEntry(id) || !loader) throw new LayoutProfileLoadError(`Layout profile "${id}" is not in the catalog.`);
  let profile: ImportedLayoutProfile;
  try {
    profile = await loader();
  } catch (error) {
    throw new LayoutProfileLoadError(`Layout profile "${id}" could not be loaded.`, { cause: error });
  }
  if (profile.id !== id || !Array.isArray(profile.keys)) throw new LayoutProfileLoadError(`Layout profile "${id}" is malformed.`);
  return profile;
}

const round = (value: number) => Math.round(value * 100) / 100;

function keycaps(key: ImportedLayoutKey): AliceKeycap[] {
  const rotation = key.r ? { rotation: key.r, originX: round(key.rx * LAYOUT_UNIT), originY: round(key.ry * LAYOUT_UNIT) } : {};
  const rect = (x: number, y: number, w: number, h: number) => ({
    x: round(x * LAYOUT_UNIT + KEY_INSET),
    y: round(y * LAYOUT_UNIT + KEY_INSET),
    width: round(w * LAYOUT_UNIT - 2 * KEY_INSET),
    height: round(h * LAYOUT_UNIT - 2 * KEY_INSET)
  });
  const caps: AliceKeycap[] = [{ ...rect(key.x, key.y, key.w, key.h), ...rotation }];
  if (key.s) {
    const [x2, y2, w2, h2] = key.s;
    caps.push({ ...rect(key.x + x2, key.y + y2, w2, h2), ...rotation, secondary: true });
  }
  return caps;
}

function selected(key: ImportedLayoutKey, variant: LayoutVariant): boolean {
  return key.g < 0 || variant[String(key.g)] === key.o;
}

export function resolveImportedLayout(
  entry: LayoutCatalogEntry,
  profile: ImportedLayoutProfile,
  variant: LayoutVariant
): ResolvedKeyboardLayout {
  if (profile.id !== entry.id) throw new LayoutProfileLoadError(`Profile data does not belong to "${entry.id}".`);
  if (!isValidVariant(entry, variant)) throw new LayoutProfileLoadError(`Invalid layout variant for "${entry.id}".`);
  const active = profile.keys.filter((key) => selected(key, variant));
  if (active.length === 0) throw new LayoutProfileLoadError(`Layout "${entry.id}" has no keys for this variant.`);

  const coded = new Map<string, { key: AliceKey; order: number }>();
  const inertKeys: InertKey[] = [];
  for (const key of active) {
    const caps = keycaps(key);
    const order = key.row * 1000 + key.col;
    if (key.code) {
      const existing = coded.get(key.code);
      coded.set(key.code, existing
        ? { key: { ...existing.key, keycaps: [...existing.key.keycaps, ...caps] }, order: Math.min(existing.order, order) }
        : { key: { code: key.code, legend: key.legend, keycaps: caps }, order });
    } else {
      inertKeys.push({ id: `${key.row},${key.col},${key.g},${key.o}`, legend: key.legend, keycaps: caps });
    }
  }
  const keys = [...coded.values()].map((value) => value.key);
  const testSequence = [...coded.values()]
    .sort((a, b) => a.order - b.order)
    .map((value) => value.key);

  const bounds = kleLayoutBounds(active.map((key) => ({
    ...key,
    secondary: key.s ? { x2: key.s[0], y2: key.s[1], w2: key.s[2], h2: key.s[3] } : null
  })));
  const viewBox = [
    bounds.xStart * LAYOUT_UNIT - VIEW_PADDING,
    bounds.yStart * LAYOUT_UNIT - VIEW_PADDING,
    (bounds.xEnd - bounds.xStart) * LAYOUT_UNIT + 2 * VIEW_PADDING,
    (bounds.yEnd - bounds.yStart) * LAYOUT_UNIT + 2 * VIEW_PADDING
  ].map(round).join(' ');

  return {
    profileId: entry.id,
    label: entry.displayName,
    keys,
    inertKeys,
    testSequence,
    viewBox,
    missingCodes: REQUIRED_LAYOUT_CODES.filter((code) => !coded.has(code))
  };
}

export function isResolvedLayoutEligible(layout: ResolvedKeyboardLayout): boolean {
  return layout.missingCodes.length === 0 && layout.keys.every((key) => key.legend.trim() !== '' && key.keycaps.every((cap) =>
    [cap.x, cap.y, cap.width, cap.height].every(Number.isFinite) && cap.width > 0 && cap.height > 0));
}

export function untestedCodes(layout: ResolvedKeyboardLayout): readonly string[] {
  const tested = new Set(layout.testSequence.map((key) => key.code));
  return layout.keys.map((key) => key.code).filter((code) => !tested.has(code));
}
