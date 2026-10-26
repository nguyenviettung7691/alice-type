import { type AliceKey } from './alice-layout';

export interface KeyboardDevice {
  readonly productName: string;
  readonly vendorId: number;
  readonly productId: number;
}

export interface KeyboardHid extends EventTarget {
  getDevices(): Promise<KeyboardDevice[]>;
  requestDevice(options: { filters: readonly object[] }): Promise<KeyboardDevice[]>;
}

export interface KeyboardLayoutAccess extends EventTarget {
  getLayoutMap(): Promise<ReadonlyMap<string, string>>;
}

export function browserKeyboardAccess() {
  const browser = navigator as Navigator & {
    hid?: KeyboardHid;
    keyboard?: KeyboardLayoutAccess;
  };
  return { hid: browser.hid, keyboard: browser.keyboard };
}

export function applyLayoutLegends(
  layout: readonly AliceKey[], legends: ReadonlyMap<string, string> | null
): readonly AliceKey[] {
  if (!legends) return layout;
  return layout.map((key) => {
    const legend = legends.get(key.code);
    return legend?.trim() ? { ...key, legend } : key;
  });
}

export function deviceId(value: number): string {
  return `0x${value.toString(16).padStart(4, '0').toUpperCase()}`;
}
