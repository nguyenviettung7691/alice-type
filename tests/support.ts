import { type Page } from '@playwright/test';
import { type Preferences } from '../src/lib/storage/preferences';

export const PREFERENCES_KEY = 'alicetype.preferences';
export const DEFAULT_PREFERENCES: Preferences = {
  mode: 'timed', durationSeconds: 30, wordLimit: 25, wordBankTier: 200,
  punctuation: false, numbers: false, caretStyle: 'block', soundEnabled: false,
  showLiveStats: true, onboardingComplete: false, keyboardTestSoundEnabled: false, keyboardTestSoundEffect: 'default',
  keyboardProfileId: null, keyboardUserDetails: {}
};

export async function skipOnboarding(page: Page) {
  await disableDeviceAccess(page);
  await page.addInitScript(({ key, defaults }) => {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, JSON.stringify({ version: 3, settings: defaults }));
    }
  }, { key: PREFERENCES_KEY, defaults: { ...DEFAULT_PREFERENCES, onboardingComplete: true } });
}

export async function disableDeviceAccess(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hid', { configurable: true, value: undefined });
  });
}
