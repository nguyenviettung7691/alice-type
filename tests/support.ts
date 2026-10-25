import { type Page } from '@playwright/test';
import { type Preferences } from '../src/lib/storage/preferences';

export const PREFERENCES_KEY = 'alicetype.preferences';
export const DEFAULT_PREFERENCES: Preferences = {
  mode: 'timed', durationSeconds: 30, wordLimit: 25, wordBankTier: 200,
  punctuation: false, numbers: false, caretStyle: 'block', soundEnabled: false,
  showLiveStats: true, onboardingComplete: false
};

export async function skipOnboarding(page: Page) {
  await page.addInitScript(({ key, defaults }) => {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, JSON.stringify({ version: 1, settings: defaults }));
    }
  }, { key: PREFERENCES_KEY, defaults: { ...DEFAULT_PREFERENCES, onboardingComplete: true } });
}
