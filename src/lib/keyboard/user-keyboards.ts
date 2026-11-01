import { isRecord, StorageError } from '../storage/errors';
import type { KeyboardKeymapImport, KeyboardLayoutConfirmation, KeyboardUserDetails } from '../storage/preferences';
import type { BKeyHand } from '../typing/exercise-generator';

export const MAX_USER_KEYBOARDS = 20;
export const KEYBOARD_NAME_LENGTH = 80;
export const KEYBOARD_FAMILIES = ['unknown', 'alice', 'arisu', 'alice75', 'split'] as const;
export const SWITCH_TYPES = ['unknown', 'linear', 'tactile', 'clicky'] as const;
export const THUMB_ROLES = ['unknown', 'space', 'backspace', 'delete', 'enter', 'layer-1', 'space-shift', 'space-layer-1'] as const;
export const MAX_LAYER_BINDINGS = 64;
export const COMMAND_OUTPUT_CODES = [
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  ...Array.from({ length: 12 }, (_, index) => `F${index + 1}`)
] as const;
export const LAYER_MODIFIERS = ['shift'] as const;
export type ThumbRole = typeof THUMB_ROLES[number];
export type LayerModifier = typeof LAYER_MODIFIERS[number];

export interface KeyboardLayerBinding {
  readonly id: string;
  readonly layer: number;
  readonly holdCue: string;
  readonly sourcePosition: string;
  readonly sourceCode: string;
  readonly outputCode: typeof COMMAND_OUTPUT_CODES[number];
  readonly modifiers: readonly LayerModifier[];
}

export interface KeyboardHardware {
  readonly family: typeof KEYBOARD_FAMILIES[number];
  readonly switchType: typeof SWITCH_TYPES[number];
  readonly actuationForce: number | null;
  readonly keycapProfile: string;
  readonly tentingAngle: number | null;
}

export interface BoardSettings {
  readonly keyboardProfileId: string | null;
  readonly keyboardUserDetails: KeyboardUserDetails;
  readonly keyboardLayoutConfirmation: KeyboardLayoutConfirmation | null;
  readonly keyboardKeymapImport: KeyboardKeymapImport | null;
  readonly keyboardLayerBindings: readonly KeyboardLayerBinding[];
  readonly bKeyHand: BKeyHand;
}

export interface KeyboardIdentity {
  readonly id: string;
  readonly name: string;
  readonly hardware: KeyboardHardware;
  readonly thumbs: { readonly left: ThumbRole; readonly right: ThumbRole };
}

export interface UserKeyboard extends KeyboardIdentity {
  readonly settings: BoardSettings;
}

export interface KeyboardSnapshot extends KeyboardIdentity {
  readonly keyboardProfileId: string | null;
  readonly bKeyHand: BKeyHand;
}

export const DEFAULT_HARDWARE: KeyboardHardware = {
  family: 'unknown', switchType: 'unknown', actuationForce: null, keycapProfile: '', tentingAngle: null
};

export function isKeyboardId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9-]{1,80}$/.test(value);
}

function member<T>(values: readonly T[], value: unknown): value is T {
  return values.some((entry) => entry === value);
}

export function validateKeyboardIdentity(value: unknown): KeyboardIdentity {
  const invalid = () => new StorageError('Keyboard profile contains invalid identity, hardware or thumb settings.');
  if (!isRecord(value) || !isKeyboardId(value.id) || typeof value.name !== 'string'
    || !value.name.trim() || value.name.trim().length > KEYBOARD_NAME_LENGTH
    || !isRecord(value.hardware) || !isRecord(value.thumbs)) throw invalid();
  const { hardware, thumbs } = value;
  const measurement = (value: unknown, min: number, max: number): value is number | null =>
    value === null || (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max);
  if (!member(KEYBOARD_FAMILIES, hardware.family) || !member(SWITCH_TYPES, hardware.switchType)
    || !measurement(hardware.actuationForce, 1, 200) || !measurement(hardware.tentingAngle, 0, 90)
    || typeof hardware.keycapProfile !== 'string' || hardware.keycapProfile.trim().length > 40
    || !member(THUMB_ROLES, thumbs.left) || !member(THUMB_ROLES, thumbs.right)) throw invalid();
  return {
    id: value.id, name: value.name.trim(),
    hardware: {
      family: hardware.family, switchType: hardware.switchType, actuationForce: hardware.actuationForce,
      keycapProfile: hardware.keycapProfile.trim(), tentingAngle: hardware.tentingAngle
    },
    thumbs: { left: thumbs.left, right: thumbs.right }
  };
}

export function validateKeyboardSnapshot(value: unknown): KeyboardSnapshot {
  const identity = validateKeyboardIdentity(value);
  if (!isRecord(value) || (value.keyboardProfileId !== null
    && (typeof value.keyboardProfileId !== 'string' || !value.keyboardProfileId.trim() || value.keyboardProfileId.length > 120))
    || (value.bKeyHand !== 'left' && value.bKeyHand !== 'right')) {
    throw new StorageError('A saved session contains an invalid keyboard snapshot.');
  }
  return { ...identity, keyboardProfileId: value.keyboardProfileId, bKeyHand: value.bKeyHand };
}

export function snapshotKeyboard(board: UserKeyboard): KeyboardSnapshot {
  return validateKeyboardSnapshot({ ...board, keyboardProfileId: board.settings.keyboardProfileId, bKeyHand: board.settings.bKeyHand });
}

export function validateLayerBindings(value: unknown): readonly KeyboardLayerBinding[] {
  const invalid = () => new StorageError('Keyboard layer bindings contain invalid or unsupported key output.');
  if (!Array.isArray(value) || value.length > MAX_LAYER_BINDINGS) throw invalid();
  const ids = new Set<string>();
  const bindings = value.map((entry) => {
    if (!isRecord(entry) || !isKeyboardId(entry.id) || ids.has(entry.id)
      || !Number.isInteger(entry.layer) || (entry.layer as number) < 1 || (entry.layer as number) > 32
      || typeof entry.holdCue !== 'string' || !entry.holdCue.trim() || entry.holdCue.trim().length > 80
      || typeof entry.sourcePosition !== 'string' || !entry.sourcePosition.trim() || entry.sourcePosition.trim().length > 40
      || typeof entry.sourceCode !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(entry.sourceCode)
      || entry.sourceCode === 'Unidentified'
      || !member(COMMAND_OUTPUT_CODES, entry.outputCode)
      || !Array.isArray(entry.modifiers) || entry.modifiers.length > 1
      || entry.modifiers.some((modifier) => !member(LAYER_MODIFIERS, modifier))) throw invalid();
    ids.add(entry.id);
    return {
      id: entry.id, layer: entry.layer as number, holdCue: entry.holdCue.trim(),
      sourcePosition: entry.sourcePosition.trim(), sourceCode: entry.sourceCode,
      outputCode: entry.outputCode, modifiers: [...entry.modifiers] as LayerModifier[]
    };
  });
  return bindings;
}

export function boardSettings(value: BoardSettings): BoardSettings {
  return {
    keyboardProfileId: value.keyboardProfileId, keyboardUserDetails: value.keyboardUserDetails,
    keyboardLayoutConfirmation: value.keyboardLayoutConfirmation, keyboardKeymapImport: value.keyboardKeymapImport,
    keyboardLayerBindings: value.keyboardLayerBindings,
    bKeyHand: value.bKeyHand
  };
}
