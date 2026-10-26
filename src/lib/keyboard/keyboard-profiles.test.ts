import { describe, expect, it } from 'vitest';
import { ALICE_LAYOUT } from './alice-layout';
import {
  findKeyboardProfile, GENERIC_ALICE_TEST_LAYOUT, isKeyboardProfileId, isTestLayoutEligible,
  KEYBOARD_PROFILE_CATALOG_REVISION, KEYBOARD_PROFILE_CATALOG_UPDATED_AT, KEYBOARD_PROFILES
} from './keyboard-profiles';

describe('keyboard profile catalog', () => {
  it('has a revision, review date, stable unique IDs, and a generic Alice layout', () => {
    expect(KEYBOARD_PROFILE_CATALOG_REVISION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(KEYBOARD_PROFILE_CATALOG_UPDATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Set(KEYBOARD_PROFILES.map((profile) => profile.id)).size).toBe(KEYBOARD_PROFILES.length);
    expect(KEYBOARD_PROFILES.map((profile) => profile.id)).toContain('generic-alice');
    expect(findKeyboardProfile('generic-alice')).toMatchObject({
      kind: 'generic-layout',
      displayName: 'Generic Alice layout',
      identity: {},
      features: {}
    });
    expect(findKeyboardProfile('generic-alice')?.testLayout).toEqual(GENERIC_ALICE_TEST_LAYOUT);
  });

  it('uses the existing Alice map and records internal provenance for test-map claims', () => {
    expect(GENERIC_ALICE_TEST_LAYOUT).toMatchObject({ verified: true, complete: true, layout: ALICE_LAYOUT });
    expect(GENERIC_ALICE_TEST_LAYOUT.source).toMatchObject({
      kind: 'internal',
      path: 'src/lib/keyboard/alice-layout.ts',
      fields: ['layout', 'physicalKeyCodes', 'legends', 'geometry']
    });
    expect(isTestLayoutEligible(findKeyboardProfile('generic-alice'))).toBe(true);
    expect(isTestLayoutEligible(undefined)).toBe(false);
    expect(GENERIC_ALICE_TEST_LAYOUT.layout.length).toBe(ALICE_LAYOUT.length);
  });

  it('accepts only catalog profile identifiers and keeps device claims absent when unsourced', () => {
    expect(isKeyboardProfileId('generic-alice')).toBe(true);
    expect(isKeyboardProfileId('unknown')).toBe(false);
    expect(isKeyboardProfileId(null)).toBe(false);
    expect(KEYBOARD_PROFILES.filter((profile) => profile.kind === 'device')).toEqual([]);
  });

  it('requires each catalog field claim to be covered by its source provenance', () => {
    for (const profile of KEYBOARD_PROFILES) {
      for (const [field, claim] of Object.entries({ ...profile.identity, ...profile.features })) {
        expect(claim?.source.fields).toContain(field);
        if (claim?.source.kind === 'external') {
          expect(claim.source.title.trim()).not.toBe('');
          expect(claim.source.url).toMatch(/^https:\/\//);
          expect(claim.source.accessedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
      if (profile.testLayout) {
        expect(profile.testLayout).toMatchObject({ verified: true, complete: true });
        for (const field of ['physicalKeyCodes', 'legends', 'geometry']) {
          expect(profile.testLayout.source.fields).toContain(field);
        }
      }
    }
  });
});
