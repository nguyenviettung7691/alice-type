// VIA-compatible reader for KLE keymaps in VIA v3 keyboard definitions.
// Semantics mirror the-via/reader `kleLayoutToVIALayout` (GPL-3.0) so imported
// geometry matches what VIA renders for the same definition.

export interface KleSecondary {
  readonly x2: number;
  readonly y2: number;
  readonly w2: number;
  readonly h2: number;
}

export interface KleKey {
  readonly row: number;
  readonly col: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly r: number;
  readonly rx: number;
  readonly ry: number;
  readonly secondary: KleSecondary | null;
  /** -1 when the key is not part of a layout option group. */
  readonly group: number;
  readonly option: number;
}

export interface KleLayout {
  readonly width: number;
  readonly height: number;
  readonly keys: readonly KleKey[];
}

export interface KleBounds {
  readonly xStart: number;
  readonly yStart: number;
  readonly xEnd: number;
  readonly yEnd: number;
}

interface RawKey extends Omit<KleKey, 'secondary'> {
  readonly x2?: number;
  readonly y2?: number;
  readonly w2?: number;
  readonly h2?: number;
}

const ALIGNMENT: readonly (readonly number[])[] = [
  [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10],
  [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10],
  [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10],
  [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10],
  [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1],
  [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1],
  [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1],
  [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1]
];
const ROWCOL = 0;
const ENCODER = 4;
const GROUP = 8;
const ENCODER_PATTERN = /^[eE]\d+\s*$/;

function normalizeLabels(labels: string, alignment: number): string[] {
  const map = ALIGNMENT[alignment];
  if (!map) throw new Error(`Unsupported KLE alignment ${alignment}.`);
  const normalized: string[] = [];
  labels.split('\n').forEach((label, index) => {
    const target = map[index];
    if (target !== undefined && target >= 0) normalized[target] = label.trim();
  });
  return normalized;
}

function parsePair(label: string | undefined, kind: string): [number, number] {
  const parts = (label ?? '').split(/[，,]/);
  const numbers = parts.map((part) => Number.parseInt(part, 10));
  if (parts.length !== 2 || numbers.some((value) => !Number.isInteger(value))) {
    throw new Error(`Invalid ${kind} label "${label ?? ''}".`);
  }
  return [numbers[0], numbers[1]];
}

function rotatePoint(x: number, y: number, originX: number, originY: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  const dx = x - originX;
  const dy = y - originY;
  return {
    x: originX + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: originY + dx * Math.sin(radians) + dy * Math.cos(radians)
  };
}

export function kleKeyBounds(key: Pick<KleKey, 'x' | 'y' | 'w' | 'h' | 'r' | 'rx' | 'ry' | 'secondary'>): KleBounds {
  const { x2 = 0, y2 = 0, w2 = key.w, h2 = key.h } = key.secondary ?? {};
  const xStart = Math.min(key.x, key.x + x2);
  const yStart = Math.min(key.y, key.y + y2);
  const xEnd = Math.max(key.x + key.w, key.x + x2 + w2);
  const yEnd = Math.max(key.y + key.h, key.y + y2 + h2);
  const points = [[xStart, yStart], [xEnd, yStart], [xStart, yEnd], [xEnd, yEnd]]
    .map(([px, py]) => rotatePoint(px, py, key.rx, key.ry, key.r));
  return {
    xStart: Math.min(...points.map((point) => point.x)),
    yStart: Math.min(...points.map((point) => point.y)),
    xEnd: Math.max(...points.map((point) => point.x)),
    yEnd: Math.max(...points.map((point) => point.y))
  };
}

export function kleLayoutBounds(keys: readonly Parameters<typeof kleKeyBounds>[0][]): KleBounds {
  if (keys.length === 0) throw new Error('Cannot compute bounds of an empty layout.');
  const boxes = keys.map(kleKeyBounds);
  return {
    xStart: Math.min(...boxes.map((box) => box.xStart)),
    yStart: Math.min(...boxes.map((box) => box.yStart)),
    xEnd: Math.max(...boxes.map((box) => box.xEnd)),
    yEnd: Math.max(...boxes.map((box) => box.yEnd))
  };
}

function toSecondary(key: RawKey): KleSecondary | null {
  if (key.x2 === undefined && key.y2 === undefined && key.w2 === undefined && key.h2 === undefined) return null;
  return { x2: key.x2 ?? 0, y2: key.y2 ?? 0, w2: key.w2 ?? key.w, h2: key.h2 ?? key.h };
}

function pivotPoint(key: RawKey) {
  const { x, y, x2 = 0, y2 = 0 } = key;
  const secondRect = y2 === 0 ? x > x + x2 : y2 < 0;
  return secondRect ? { x: x + x2, y: y + y2 } : { x, y };
}

function findPivot(keys: readonly RawKey[]): RawKey {
  return [...keys].sort((a, b) => (a.y - b.y) || (a.x - b.x))[0];
}

function numberProp(item: Record<string, unknown>, name: string): number | undefined {
  const value = item[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`KLE property "${name}" must be a finite number.`);
  return value;
}

/**
 * Parses a VIA `layouts.keymap` KLE array. Decals and encoders are skipped. Option keys
 * are aligned to their group's option 0 position, and coordinates are normalized so the
 * option 0 layout starts at (0, 0), as VIA does.
 */
export function parseViaKeymap(keymap: unknown): KleLayout {
  if (!Array.isArray(keymap)) throw new Error('VIA layouts.keymap must be an array.');
  const raw: RawKey[] = [];
  let cursor = { x: 0, y: 0 };
  let rowState = { r: 0, rx: 0, ry: 0, a: 0 };

  for (const row of keymap) {
    if (!Array.isArray(row)) continue;
    let { r, rx, ry, a } = rowState;
    let w = 1;
    let h = 1;
    let decal = false;
    let extra: { x2?: number; y2?: number; w2?: number; h2?: number } = {};
    for (const item of row) {
      if (typeof item === 'string') {
        const labels = normalizeLabels(item, a);
        const encoder = labels[ENCODER] !== undefined && ENCODER_PATTERN.test(labels[ENCODER]);
        if (!decal && !encoder) {
          const [matrixRow, matrixCol] = parsePair(labels[ROWCOL], 'row,col');
          const [group, option] = labels[GROUP] ? parsePair(labels[GROUP], 'group,option') : [-1, 0];
          raw.push({ row: matrixRow, col: matrixCol, x: cursor.x + rx, y: cursor.y, w, h, r, rx, ry, group, option, ...extra });
        }
        cursor = { x: cursor.x + w, y: cursor.y };
        w = 1;
        h = 1;
        decal = false;
        extra = {};
      } else if (item && typeof item === 'object') {
        const props = item as Record<string, unknown>;
        extra = {};
        for (const name of ['x2', 'y2', 'w2', 'h2'] as const) {
          const value = numberProp(props, name);
          if (value !== undefined) extra[name] = value;
        }
        r = numberProp(props, 'r') ?? r;
        rx = numberProp(props, 'rx') ?? rx;
        ry = numberProp(props, 'ry') ?? ry;
        h = numberProp(props, 'h') ?? h;
        w = numberProp(props, 'w') ?? w;
        if (typeof props.d === 'boolean') decal = props.d;
        if (props.rx !== undefined || props.ry !== undefined) cursor = { x: cursor.x, y: ry };
        const dy = numberProp(props, 'y');
        if (dy !== undefined) cursor = { x: cursor.x, y: cursor.y + dy };
        const dx = numberProp(props, 'x');
        if (dx !== undefined) cursor = { x: cursor.x + dx, y: cursor.y };
        a = numberProp(props, 'a') ?? a;
      } else {
        throw new Error('KLE rows may contain only strings and objects.');
      }
    }
    rowState = { r, rx, ry, a };
    cursor = { x: 0, y: cursor.y + 1 };
  }

  const defaults = raw.filter((key) => key.option === 0);
  if (defaults.length === 0) throw new Error('VIA keymap has no keys.');
  const bounds = kleLayoutBounds(defaults.map((key) => ({ ...key, secondary: toSecondary(key) })));

  const shifted = new Map<RawKey, { x: number; y: number }>();
  const groups = new Map<number, Map<number, RawKey[]>>();
  for (const key of raw) {
    if (key.group < 0) continue;
    const options = groups.get(key.group) ?? new Map<number, RawKey[]>();
    options.set(key.option, [...(options.get(key.option) ?? []), key]);
    groups.set(key.group, options);
  }
  for (const [group, options] of groups) {
    const zero = options.get(0);
    if (!zero) throw new Error(`Layout option group ${group} has no option 0.`);
    const zeroPivot = pivotPoint(findPivot(zero));
    for (const keys of options.values()) {
      const pivot = pivotPoint(findPivot(keys));
      for (const key of keys) shifted.set(key, { x: key.x - (pivot.x - zeroPivot.x), y: key.y - (pivot.y - zeroPivot.y) });
    }
  }

  const keys = raw.map((key): KleKey => {
    const position = shifted.get(key) ?? key;
    return {
      row: key.row,
      col: key.col,
      x: position.x - bounds.xStart,
      y: position.y - bounds.yStart,
      w: key.w,
      h: key.h,
      r: key.r,
      rx: key.rx - bounds.xStart,
      ry: key.ry - bounds.yStart,
      secondary: toSecondary(key),
      group: key.group,
      option: key.option
    };
  });
  return { width: bounds.xEnd - bounds.xStart, height: bounds.yEnd - bounds.yStart, keys };
}
