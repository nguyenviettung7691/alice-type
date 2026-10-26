import { describe, expect, it } from 'vitest';
import { kleKeyBounds, kleLayoutBounds, parseViaKeymap } from './kle-layout';

const close = (value: number) => Math.round(value * 1e6) / 1e6 + 0;

describe('VIA KLE keymap parser', () => {
  it('places keys by cursor, width, and row like VIA', () => {
    const layout = parseViaKeymap([['0,0', { w: 1.5 }, '0,1', '0,2'], [{ x: 0.25 }, '1,0']]);
    expect(layout.keys.map(({ row, col, x, y, w }) => ({ row, col, x, y, w }))).toEqual([
      { row: 0, col: 0, x: 0, y: 0, w: 1 },
      { row: 0, col: 1, x: 1, y: 0, w: 1.5 },
      { row: 0, col: 2, x: 2.5, y: 0, w: 1 },
      { row: 1, col: 0, x: 0.25, y: 1, w: 1 }
    ]);
    expect(layout.width).toBe(3.5);
    expect(layout.height).toBe(2);
  });

  it('carries rotation across rows and shifts rotation origins with the layout origin', () => {
    const layout = parseViaKeymap([
      [{ r: 10, rx: 1, ry: 2, y: -1, x: 0.5 }, '0,0', '0,1'],
      ['1,0'],
      [{ r: 0, rx: 0, ry: 0, y: 3 }, '2,0']
    ]);
    const [first, second, third, flat] = layout.keys;
    expect([first.r, second.r, third.r, flat.r]).toEqual([10, 10, 10, 0]);
    expect(close(first.x - first.rx)).toBe(0.5);
    expect(close(second.x - second.rx)).toBe(1.5);
    expect(close(third.x - third.rx)).toBe(0);
    expect(close(first.y - first.ry)).toBe(-1);
    expect(close(third.y - third.ry)).toBe(0);
    expect(first.rx).toBe(second.rx);
    const bounds = kleLayoutBounds(layout.keys);
    expect(close(bounds.xStart)).toBe(0);
    expect(close(bounds.yStart)).toBe(0);
    expect(close(bounds.xEnd)).toBe(close(layout.width));
  });

  it('skips decals and encoders without matrix keys but keeps their cursor width', () => {
    const layout = parseViaKeymap([['0,0', { d: true }, 'decal', '0,2', '0,3\n\n\n\n\n\n\n\n\ne0']]);
    expect(layout.keys.map(({ col, x }) => [col, x])).toEqual([[0, 0], [2, 2]]);
  });

  it('reads group/option labels and aligns options to the option 0 pivot', () => {
    const layout = parseViaKeymap([
      ['0,0', '0,1\n\n\n0,0'],
      [{ y: 1, x: 3 }, '0,1\n\n\n0,1', '0,2\n\n\n0,1']
    ]);
    expect(layout.keys.map(({ col, x, y, group, option }) => ({ col, x, y, group, option }))).toEqual([
      { col: 0, x: 0, y: 0, group: -1, option: 0 },
      { col: 1, x: 1, y: 0, group: 0, option: 0 },
      { col: 1, x: 1, y: 0, group: 0, option: 1 },
      { col: 2, x: 2, y: 0, group: 0, option: 1 }
    ]);
    expect(layout.width).toBe(2);
    expect(layout.height).toBe(1);
  });

  it('honors label alignment and reports missing matrix labels', () => {
    expect(parseViaKeymap([[{ a: 4 }, '0,0\n\n\n0,0']]).keys[0]).toMatchObject({ group: 0, option: 0 });
    expect(() => parseViaKeymap([[{ a: 7 }, '0,0']])).toThrow(/row,col/);
    expect(() => parseViaKeymap([['A']])).toThrow(/row,col/);
    expect(() => parseViaKeymap({})).toThrow(/array/);
    expect(() => parseViaKeymap([[{ w: '2' }, '0,0']])).toThrow(/finite number/);
    expect(() => parseViaKeymap([['0,0\n\n\n0,1']])).toThrow(/no keys|option 0/);
  });

  it('keeps ISO secondary rectangles and includes them in bounds', () => {
    const layout = parseViaKeymap([[{ x: 0.25, w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 }, '1,13']]);
    expect(layout.keys[0].secondary).toEqual({ x2: -0.25, y2: 0, w2: 1.5, h2: 1 });
    expect(layout.keys[0].x).toBe(0.25);
    expect(layout.width).toBe(1.5);
    expect(kleKeyBounds(layout.keys[0])).toEqual({ xStart: 0, yStart: 0, xEnd: 1.5, yEnd: 2 });
  });

  it('rotates key corners around the rotation origin', () => {
    const box = kleKeyBounds({ x: 1, y: 0, w: 1, h: 1, r: 90, rx: 0, ry: 0, secondary: null });
    expect([box.xStart, box.yStart, box.xEnd, box.yEnd].map(close)).toEqual([-1, 1, 0, 2]);
  });
});
