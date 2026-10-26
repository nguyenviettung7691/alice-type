import { ALICE_LAYOUT, type AliceKey } from './alice-layout';
import { LAYOUT_CATALOG, type LayoutCatalogEntry } from './layout-catalog';

export type KeyboardProfileField =
  | 'name'
  | 'brand'
  | 'model'
  | 'version'
  | 'rgbBacklighting'
  | 'connectivity'
  | 'keyRollover'
  | 'programmableKeys'
  | 'layout'
  | 'physicalKeyCodes'
  | 'legends'
  | 'geometry';

export interface InternalProfileSource {
  readonly kind: 'internal';
  readonly label: string;
  readonly path: string;
  readonly fields: readonly KeyboardProfileField[];
}

export interface ExternalProfileSource {
  readonly kind: 'external';
  readonly title: string;
  readonly url: string;
  readonly accessedAt: string;
  readonly fields: readonly KeyboardProfileField[];
}

export type KeyboardProfileSource = InternalProfileSource | ExternalProfileSource;

export interface SourcedProfileValue<T> {
  readonly value: T;
  readonly source: KeyboardProfileSource;
}

export interface VerifiedTestLayout {
  readonly verified: true;
  readonly complete: true;
  readonly label: string;
  readonly layout: readonly AliceKey[];
  readonly source: InternalProfileSource | ExternalProfileSource;
}

export interface KeyboardProfile {
  readonly id: string;
  readonly kind: 'generic-layout' | 'device';
  readonly displayName: string;
  readonly identity: Readonly<Partial<Record<'name' | 'brand' | 'model' | 'version', SourcedProfileValue<string>>>>;
  readonly features: Readonly<Partial<Record<
    'rgbBacklighting' | 'connectivity' | 'keyRollover' | 'programmableKeys',
    SourcedProfileValue<string | boolean>
  >>>;
  readonly testLayout?: VerifiedTestLayout;
  /** Present for device profiles imported from the keyboard layout catalog. */
  readonly layoutCatalogId?: string;
}

export const KEYBOARD_PROFILE_CATALOG_REVISION = '1.1.0';
export const KEYBOARD_PROFILE_CATALOG_UPDATED_AT = '2026-10-26';

const aliceLayoutSource: InternalProfileSource = {
  kind: 'internal',
  label: 'AliceType generic Alice layout definition',
  path: 'src/lib/keyboard/alice-layout.ts',
  fields: ['layout', 'physicalKeyCodes', 'legends', 'geometry']
};

export const GENERIC_ALICE_TEST_LAYOUT: VerifiedTestLayout = {
  verified: true,
  complete: true,
  label: 'Generic Alice test layout',
  layout: ALICE_LAYOUT,
  source: aliceLayoutSource
};

function deviceProfile(entry: LayoutCatalogEntry): KeyboardProfile {
  const via: ExternalProfileSource = {
    kind: 'external',
    title: `VIA keyboard definition ${entry.sources.via.path} (GPL-3.0)`,
    url: entry.sources.via.url,
    accessedAt: LAYOUT_CATALOG.generatedAt,
    fields: ['name', 'layout', 'geometry']
  };
  const qmk: ExternalProfileSource = {
    kind: 'external',
    title: `QMK keyboard metadata for ${entry.sources.qmkInfo.keyboard} (GPL-2.0-or-later)`,
    url: entry.sources.qmkInfo.url,
    accessedAt: LAYOUT_CATALOG.generatedAt,
    fields: ['brand']
  };
  return {
    id: entry.id,
    kind: 'device',
    displayName: entry.displayName,
    identity: { name: { value: entry.name, source: via }, brand: { value: entry.brand, source: qmk } },
    features: {},
    layoutCatalogId: entry.id
  };
}

export const KEYBOARD_PROFILES: readonly KeyboardProfile[] = [
  {
    id: 'generic-alice',
    kind: 'generic-layout',
    displayName: 'Generic Alice layout',
    identity: {},
    features: {},
    testLayout: GENERIC_ALICE_TEST_LAYOUT
  },
  ...LAYOUT_CATALOG.profiles.map(deviceProfile)
];

export function findKeyboardProfile(id: string | null): KeyboardProfile | undefined {
  return id === null ? undefined : KEYBOARD_PROFILES.find((profile) => profile.id === id);
}

export function isKeyboardProfileId(value: unknown): value is string {
  return typeof value === 'string' && KEYBOARD_PROFILES.some((profile) => profile.id === value);
}

export function isTestLayoutEligible(profile: KeyboardProfile | undefined): profile is KeyboardProfile & {
  readonly testLayout: VerifiedTestLayout;
} {
  const testLayout = profile?.testLayout;
  if (!testLayout || !testLayout.verified || !testLayout.complete || testLayout.layout.length === 0) return false;
  const codes = new Set<string>();
  return testLayout.layout.every((key) => {
    if (!key.code.trim() || !key.legend.trim() || codes.has(key.code) || key.keycaps.length === 0) return false;
    codes.add(key.code);
    return key.keycaps.every((cap) => [
      cap.x, cap.y, cap.width, cap.height
    ].every(Number.isFinite) && cap.width > 0 && cap.height > 0);
  });
}
