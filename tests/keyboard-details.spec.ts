import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, skipOnboarding } from './support';

const nav = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const panel = (page: Page) => page.locator('.keyboard-details-panel');
const row = (page: Page, label: string) => panel(page).locator('.detail-row').filter({
  has: page.locator('.detail-name', { hasText: new RegExp(`^${label}$`) })
});

test.describe('Keyboard Details', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
    await nav(page, 'Keyboard Details').click();
  });

  test('starts unselected and distinguishes unknown data from the generic layout reference', async ({ page }) => {
    await expect(nav(page, 'Keyboard Details')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: 'Keyboard Details', exact: true })).toBeFocused();
    await expect(page.getByLabel('Reference profile', { exact: true })).toHaveValue('');
    await expect(panel(page)).toContainText('No catalog profile is selected');
    await expect(row(page, 'Brand')).toContainText('Unknown');
    await expect(panel(page)).toContainText('AliceType cannot detect your connected keyboard');

    await page.getByLabel('Reference profile', { exact: true }).selectOption('generic-alice');
    await expect(panel(page)).toContainText('Generic Alice layout');
    await expect(panel(page)).toContainText('Catalog revision 1.0.0');
    await expect(panel(page)).toContainText('src/lib/keyboard/alice-layout.ts');
    await expect(row(page, 'RGB / backlighting')).toContainText('Unknown');
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? ''), PREFERENCES_KEY);
    expect(saved).toEqual({
      version: 3,
      settings: { ...DEFAULT_PREFERENCES, onboardingComplete: true, keyboardProfileId: 'generic-alice' }
    });
  });

  test('edits, persists, reloads, and clears personal details without clearing profile selection', async ({ page }) => {
    await page.getByLabel('Reference profile', { exact: true }).selectOption('generic-alice');
    await nav(page, 'Edit device details').click();
    await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
    await page.getByLabel('Name', { exact: true }).pressSequentially('  My Alice board  ');
    await page.getByLabel('Brand', { exact: true }).fill('Example');
    await page.getByLabel('RGB / backlighting', { exact: true }).selectOption('no');
    await page.getByRole('button', { name: 'Save details', exact: true }).click();
    await expect(nav(page, 'Edit device details')).toBeFocused();

    await expect(row(page, 'Name')).toContainText('My Alice board');
    await expect(row(page, 'Name')).toContainText('You provided this');
    await expect(row(page, 'Brand')).toContainText('Example');
    await expect(row(page, 'RGB / backlighting')).toContainText('No');
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? ''), PREFERENCES_KEY);
    expect(stored.settings.keyboardUserDetails).toEqual({
      name: 'My Alice board', brand: 'Example', rgbBacklighting: false
    });

    await page.reload();
    await nav(page, 'Keyboard Details').click();
    await expect(row(page, 'Name')).toContainText('My Alice board');
    await expect(page.getByLabel('Reference profile', { exact: true })).toHaveValue('generic-alice');
    await nav(page, 'Clear my details').click();
    await expect(page.getByRole('dialog')).toContainText('Your selected catalog profile stays selected');
    await page.getByRole('dialog').getByRole('button', { name: 'Clear my details', exact: true }).click();
    await expect(row(page, 'Name')).toContainText('Unknown');
    await expect(page.getByLabel('Reference profile', { exact: true })).toHaveValue('generic-alice');
    const cleared = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? ''), PREFERENCES_KEY);
    expect(cleared.settings.keyboardUserDetails).toEqual({});
    expect(cleared.settings.keyboardProfileId).toBe('generic-alice');
  });

  test('keeps the generic Alice test map when no device profile is selected', async ({ page }) => {
    await expect(page.getByLabel('Reference profile', { exact: true })).toHaveValue('');
    await nav(page, 'Keyboard Test').click();
    await expect(page.getByRole('img', { name: 'Generic Alice keyboard test matrix' })).toBeVisible();
    await expect(page.locator('.keyboard-test-panel')).toContainText('Generic Alice layout');
    await expect(page.getByRole('progressbar', { name: 'Keyboard test progress' })).toHaveAttribute('max', '60');
    await nav(page, 'Keyboard Details').click();
    await page.getByLabel('Reference profile', { exact: true }).selectOption('generic-alice');
    await nav(page, 'Keyboard Test').click();
    await expect(page.locator('.keyboard-test-panel')).toContainText('Generic Alice layout');
    await expect(page.getByRole('progressbar', { name: 'Keyboard test progress' })).toHaveAttribute('max', '60');
  });

  test('remains usable at narrow widths with keyboard-operable detail editing', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await nav(page, 'Edit device details').click();
    const name = page.getByLabel('Name', { exact: true });
    await expect(name).toBeVisible();
    await name.focus();
    await expect(name).toBeFocused();
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  });
});
