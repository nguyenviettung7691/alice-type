import type { UserKeyboard } from './user-keyboards';

export function keyboardSetupFingerprint(board: UserKeyboard): string {
  const setup = JSON.stringify({
    family: board.hardware.family,
    switchType: board.hardware.switchType,
    actuationForce: board.hardware.actuationForce,
    keycapProfile: board.hardware.keycapProfile,
    tentingAngle: board.hardware.tentingAngle,
    thumbs: board.thumbs,
    profileId: board.settings.keyboardProfileId,
    variant: board.settings.keyboardLayoutConfirmation?.variant ?? null,
    bKeyHand: board.settings.bKeyHand,
    layerBindings: board.settings.keyboardLayerBindings,
    keymap: board.settings.keyboardKeymapImport?.layers ?? null
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < setup.length; index += 1) {
    hash ^= setup.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
