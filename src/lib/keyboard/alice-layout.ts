export type KeyboardHalf = 'left' | 'right';

export interface AliceKeycap {
  /** Generic Alice keycaps use a half transform; imported keycaps use their own rotation instead. */
  readonly half?: KeyboardHalf;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation?: number;
  readonly originX?: number;
  readonly originY?: number;
  /** Second rectangle of a stepped key (for example ISO Enter); drawn without a legend. */
  readonly secondary?: boolean;
}

export interface AliceKey {
  readonly code: string;
  readonly legend: string;
  readonly keycaps: readonly AliceKeycap[];
}

/** A physical key without a standard browser code; drawn but never highlighted or tested. */
export interface InertKey {
  readonly id: string;
  readonly legend: string;
  readonly keycaps: readonly AliceKeycap[];
}

export function keycapTransform(cap: AliceKeycap): string | undefined {
  if (cap.half) return ALICE_HALF_TRANSFORMS[cap.half];
  return cap.rotation ? `rotate(${cap.rotation} ${cap.originX ?? 0} ${cap.originY ?? 0})` : undefined;
}

export type KeyFeedback = Readonly<Partial<Record<string, 'correct' | 'incorrect'>>>;

export const ALICE_VIEW_BOX = '0 0 860 315';
export const ALICE_HALF_TRANSFORMS: Readonly<Record<KeyboardHalf, string>> = {
  left: 'translate(28 38) rotate(10 171 117)',
  right: 'translate(452 38) rotate(-10 189 117)'
};

function key(
  code: string,
  legend: string,
  half: KeyboardHalf,
  x: number,
  y: number,
  width = 42
): AliceKey {
  return { code, legend, keycaps: [{ half, x, y, width, height: 42 }] };
}

export const ALICE_LAYOUT: readonly AliceKey[] = [
  key('Backquote', '`', 'left', 0, 0),
  key('Digit1', '1', 'left', 48, 0),
  key('Digit2', '2', 'left', 96, 0),
  key('Digit3', '3', 'left', 144, 0),
  key('Digit4', '4', 'left', 192, 0),
  key('Digit5', '5', 'left', 240, 0),
  key('Digit6', '6', 'left', 288, 0),
  key('Digit7', '7', 'right', 0, 0),
  key('Digit8', '8', 'right', 48, 0),
  key('Digit9', '9', 'right', 96, 0),
  key('Digit0', '0', 'right', 144, 0),
  key('Minus', '-', 'right', 192, 0),
  key('Equal', '=', 'right', 240, 0),
  key('Backspace', 'Backspace', 'right', 288, 0, 90),

  key('Tab', 'Tab', 'left', 0, 48, 66),
  key('KeyQ', 'Q', 'left', 72, 48),
  key('KeyW', 'W', 'left', 120, 48),
  key('KeyE', 'E', 'left', 168, 48),
  key('KeyR', 'R', 'left', 216, 48),
  key('KeyT', 'T', 'left', 264, 48),
  key('KeyY', 'Y', 'right', 0, 48),
  key('KeyU', 'U', 'right', 48, 48),
  key('KeyI', 'I', 'right', 96, 48),
  key('KeyO', 'O', 'right', 144, 48),
  key('KeyP', 'P', 'right', 192, 48),
  key('BracketLeft', '[', 'right', 240, 48),
  key('BracketRight', ']', 'right', 288, 48),
  key('Backslash', '\\', 'right', 336, 48),

  key('CapsLock', 'Caps', 'left', 0, 96, 78),
  key('KeyA', 'A', 'left', 84, 96),
  key('KeyS', 'S', 'left', 132, 96),
  key('KeyD', 'D', 'left', 180, 96),
  key('KeyF', 'F', 'left', 228, 96),
  key('KeyG', 'G', 'left', 276, 96),
  key('KeyH', 'H', 'right', 0, 96),
  key('KeyJ', 'J', 'right', 48, 96),
  key('KeyK', 'K', 'right', 96, 96),
  key('KeyL', 'L', 'right', 144, 96),
  key('Semicolon', ';', 'right', 192, 96),
  key('Quote', "'", 'right', 240, 96),
  key('Enter', 'Enter', 'right', 288, 96, 90),

  key('ShiftLeft', 'Shift', 'left', 0, 144, 102),
  key('KeyZ', 'Z', 'left', 108, 144),
  key('KeyX', 'X', 'left', 156, 144),
  key('KeyC', 'C', 'left', 204, 144),
  key('KeyV', 'V', 'left', 252, 144),
  key('KeyB', 'B', 'left', 300, 144),
  key('KeyN', 'N', 'right', 0, 144),
  key('KeyM', 'M', 'right', 48, 144),
  key('Comma', ',', 'right', 96, 144),
  key('Period', '.', 'right', 144, 144),
  key('Slash', '/', 'right', 192, 144),
  key('ShiftRight', 'Shift', 'right', 240, 144, 138),

  key('ControlLeft', 'Ctrl', 'left', 0, 192, 54),
  key('MetaLeft', 'Meta', 'left', 60, 192, 54),
  key('AltLeft', 'Alt', 'left', 120, 192, 54),
  {
    code: 'Space',
    legend: 'Space',
    keycaps: [
      { half: 'left', x: 180, y: 192, width: 162, height: 42 },
      { half: 'right', x: 0, y: 192, width: 162, height: 42 }
    ]
  },
  key('AltRight', 'Alt', 'right', 168, 192, 54),
  key('MetaRight', 'Meta', 'right', 228, 192, 54),
  key('ControlRight', 'Ctrl', 'right', 288, 192, 90)
];

export const ALICE_CODES: ReadonlySet<string> = new Set(ALICE_LAYOUT.map((entry) => entry.code));
