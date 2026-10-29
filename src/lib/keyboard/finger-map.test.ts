import { describe, expect, it } from 'vitest';
import { ALICE_LAYOUT } from './alice-layout';
import { LAYOUT_CATALOG, defaultVariant, loadLayoutProfile, resolveImportedLayout } from './layout-catalog';
import { expectedKeycaps, fingerForCode, keycapHand, layoutCentreX, loadBucket } from './finger-map';

describe('finger map', () => {
  it('assigns split-boundary keys to the conventional hands', () => {
    for (const code of ['Digit6', 'KeyT', 'KeyG', 'KeyV']) expect(fingerForCode(code, 'right')?.hand).toBe('left');
    for (const code of ['Digit7', 'KeyY', 'KeyH', 'KeyN']) expect(fingerForCode(code, 'left')?.hand).toBe('right');
  });

  it('follows the B-key preference', () => {
    expect(fingerForCode('KeyB', 'left')).toEqual({ hand: 'left', finger: 'index' });
    expect(fingerForCode('KeyB', 'right')).toEqual({ hand: 'right', finger: 'index' });
  });

  it('puts Space in the thumb bucket and rejects unknown codes', () => {
    const space = fingerForCode('Space', 'left');
    expect(space).toEqual({ hand: null, finger: 'thumb' });
    expect(loadBucket(space!)).toBe('thumb');
    expect(loadBucket(fingerForCode('KeyA', 'left')!)).toBe('left');
    expect(fingerForCode('F13', 'left')).toBeNull();
  });

  it('marks only the preferred B keycap on the generic layout', () => {
    const b = ALICE_LAYOUT.find((key) => key.code === 'KeyB')!;
    const centre = layoutCentreX(ALICE_LAYOUT);
    const left = expectedKeycaps(b, 'left', centre);
    expect(left.every((index) => keycapHand(b.keycaps[index], centre) === 'left')).toBe(true);
    const space = ALICE_LAYOUT.find((key) => key.code === 'Space')!;
    expect(expectedKeycaps(space, 'left', centre).length).toBe(space.keycaps.filter((cap) => !cap.secondary).length);
  });

  it('separates the two B keycaps of an imported dual-B board', async () => {
    const entry = LAYOUT_CATALOG.profiles.find((profile) => profile.id === 'projectkb-alice');
    expect(entry).toBeDefined();
    const layout = resolveImportedLayout(entry!, await loadLayoutProfile(entry!.id), defaultVariant(entry!));
    const b = layout.keys.find((key) => key.code === 'KeyB')!;
    expect(b.keycaps.filter((cap) => !cap.secondary).length).toBe(2);
    const centre = layoutCentreX(layout.keys);
    const left = expectedKeycaps(b, 'left', centre);
    const right = expectedKeycaps(b, 'right', centre);
    expect(left).toHaveLength(1);
    expect(right).toHaveLength(1);
    expect(left[0]).not.toBe(right[0]);
  });
});
