import { describe, expect, it } from 'vitest';
import { ALICE_LAYOUT } from './alice-layout';
import { applyLayoutLegends, deviceId } from './keyboard-access';

describe('browser keyboard legends', () => {
  it('preserves reference geometry and codes and overlays only nonblank mapped legends', () => {
    const layout = applyLayoutLegends(ALICE_LAYOUT, new Map([
      ['KeyQ', 'a'], ['KeyW', ''], ['Space', ' '], ['Unknown', 'extra']
    ]));
    expect(layout).toHaveLength(ALICE_LAYOUT.length);
    expect(layout.find((key) => key.code === 'KeyQ')?.legend).toBe('a');
    expect(layout.find((key) => key.code === 'KeyW')?.legend).toBe('W');
    expect(layout.find((key) => key.code === 'Space')?.legend).toBe('Space');
    expect(layout.map((key) => key.keycaps)).toEqual(ALICE_LAYOUT.map((key) => key.keycaps));
    expect(ALICE_LAYOUT.find((key) => key.code === 'KeyQ')?.legend).toBe('Q');
  });

  it('uses the original reference when layout access is unavailable', () => {
    expect(applyLayoutLegends(ALICE_LAYOUT, null)).toBe(ALICE_LAYOUT);
  });

  it('formats browser device identifiers without guessing a manufacturer', () => {
    expect(deviceId(0x123)).toBe('0x0123');
    expect(deviceId(0xabcd)).toBe('0xABCD');
  });
});
