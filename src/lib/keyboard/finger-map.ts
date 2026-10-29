import type { AliceKey, AliceKeycap } from './alice-layout';

export type Hand = 'left' | 'right';
export type Finger = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';
export const HANDS: readonly Hand[] = ['left', 'right'];
export const FINGERS: readonly Finger[] = ['pinky', 'ring', 'middle', 'index', 'thumb'];

export interface FingerAssignment {
  /** `null` for a thumb key that either hand may press (Space). */
  readonly hand: Hand | null;
  readonly finger: Finger;
}

export type LoadBucket = Hand | 'thumb';

const table = new Map<string, FingerAssignment>();
function assign(hand: Hand | null, finger: Finger, ...codes: string[]) {
  for (const code of codes) table.set(code, Object.freeze({ hand, finger }));
}

// Standard touch-typing assignment, split 6|7 to match the generic Alice layout.
assign('left', 'pinky', 'Escape', 'Backquote', 'Digit1', 'Tab', 'KeyQ', 'CapsLock', 'KeyA', 'ShiftLeft', 'KeyZ', 'ControlLeft');
assign('left', 'ring', 'Digit2', 'KeyW', 'KeyS', 'KeyX');
assign('left', 'middle', 'Digit3', 'KeyE', 'KeyD', 'KeyC');
assign('left', 'index', 'Digit4', 'Digit5', 'Digit6', 'KeyR', 'KeyT', 'KeyF', 'KeyG', 'KeyV');
assign('right', 'index', 'Digit7', 'KeyY', 'KeyU', 'KeyH', 'KeyJ', 'KeyN', 'KeyM');
assign('right', 'middle', 'Digit8', 'KeyI', 'KeyK', 'Comma');
assign('right', 'ring', 'Digit9', 'KeyO', 'KeyL', 'Period');
assign('right', 'pinky', 'Digit0', 'Minus', 'Equal', 'Backspace', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash',
  'Semicolon', 'Quote', 'Enter', 'Slash', 'ShiftRight', 'ControlRight');
assign('left', 'thumb', 'AltLeft', 'MetaLeft');
assign('right', 'thumb', 'AltRight', 'MetaRight');
assign(null, 'thumb', 'Space');

/**
 * Finger for a physical code under standard touch typing. `KeyB` follows the user's
 * preference because Alice boards often have a B on each half; unknown codes return null.
 */
export function fingerForCode(code: string, bKeyHand: Hand): FingerAssignment | null {
  if (code === 'KeyB') return { hand: bKeyHand, finger: 'index' };
  return table.get(code) ?? null;
}

export function loadBucket(assignment: FingerAssignment): LoadBucket {
  return assignment.finger === 'thumb' || assignment.hand === null ? 'thumb' : assignment.hand;
}

function centre(cap: AliceKeycap): number {
  return cap.x + cap.width / 2;
}

/** Horizontal midpoint of the unrotated keycap rectangles, used to classify flat imported keys. */
export function layoutCentreX(keys: readonly Pick<AliceKey, 'keycaps'>[]): number {
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const key of keys) for (const cap of key.keycaps) {
    if (cap.half || cap.secondary) continue;
    minimum = Math.min(minimum, cap.x);
    maximum = Math.max(maximum, cap.x + cap.width);
  }
  return Number.isFinite(minimum) ? (minimum + maximum) / 2 : 0;
}

/** Which half a keycap sits on: generic caps carry a half; imported caps use rotation sign, else position. */
export function keycapHand(cap: AliceKeycap, centreX: number): Hand {
  if (cap.half) return cap.half;
  if (cap.rotation) return cap.rotation > 0 ? 'left' : 'right';
  return centre(cap) < centreX ? 'left' : 'right';
}

/**
 * Indices of the keycaps to mark as the expected key. A duplicate B marks only the preferred
 * half (falling back to every cap if that half has no B); every other key marks all its caps.
 */
export function expectedKeycaps(key: AliceKey, bKeyHand: Hand, centreX: number): readonly number[] {
  const primary = key.keycaps.flatMap((cap, index) => cap.secondary ? [] : [index]);
  if (key.code !== 'KeyB') return primary;
  const preferred = primary.filter((index) => keycapHand(key.keycaps[index], centreX) === bKeyHand);
  return preferred.length ? preferred : primary;
}
