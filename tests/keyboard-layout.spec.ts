import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY } from './support';
import { type KeyboardLayoutConfirmation, type Preferences } from '../src/lib/storage/preferences';

interface Device { productName: string; vendorId: number; productId: number }

const Q8: Device = { productName: 'Keychron Q8', vendorId: 0x3434, productId: 0x0180 };
const UNKNOWN: Device = { productName: 'Example Alice HID', vendorId: 0x1234, productId: 0xabcd };

async function setup(page: Page, options: { device?: Device; stored?: unknown } = {}) {
  const stored = options.stored ?? { version: 6, settings: { ...DEFAULT_PREFERENCES, onboardingComplete: true } };
  await page.addInitScript(({ device, key, value }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    const hid = device ? Object.assign(new EventTarget(), {
      getDevices: async () => [device],
      requestDevice: async () => [device]
    }) : undefined;
    Object.defineProperty(navigator, 'hid', { configurable: true, value: hid });
    Object.defineProperty(navigator, 'keyboard', { configurable: true, value: undefined });
  }, { device: options.device ?? null, key: PREFERENCES_KEY, value: JSON.stringify(stored) });
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol !== 'data:') external.push(request.url());
  });
  await page.goto('/');
  return external;
}

const nav = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const matchPanel = (page: Page) => page.locator('.layout-match');
const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), PREFERENCES_KEY);
const practiceVisualizer = (page: Page) => page.locator('section[aria-labelledby="practice-panel-heading"] .keyboard-visualizer');

function confirmation(overrides: Partial<KeyboardLayoutConfirmation> = {}): KeyboardLayoutConfirmation {
  return {
    profileId: 'projectkb-alice', variant: { 0: 0, 1: 0 }, confirmedFor: { vendorId: 0x0159, productId: 0xa71c },
    catalogRevision: 'test', ...overrides
  };
}

function storedWith(layout: KeyboardLayoutConfirmation, extra: Partial<Preferences> = {}) {
  return { version: 6, settings: {
    ...DEFAULT_PREFERENCES, onboardingComplete: true, keyboardProfileId: layout.profileId, keyboardLayoutConfirmation: layout, ...extra
  } };
}

test.describe('Keyboard layout profiles', () => {
  test('suggests an exact ID match without activating it, then confirms, persists, and drives both views', async ({ page }) => {
    const external = await setup(page, { device: Q8 });
    await expect(practiceVisualizer(page)).toHaveAttribute('data-layout-source', 'generic');
    await page.locator('.keyboard-connection summary').click();
    await expect(page.locator('.keyboard-connection')).toContainText('No layout is confirmed yet');
    await nav(page, 'Find my layout').click();
    await expect(page.locator('#layout-match-heading')).toBeFocused();

    const candidate = matchPanel(page).locator('[data-candidate="keychron-q8-ansi"]');
    await expect(candidate).toContainText('Keychron Q8 ANSI');
    await expect(candidate).toContainText('Suggested — not confirmed');
    await expect(candidate).toContainText('USB ID 0x3434:0x0180 matches');
    await expect(matchPanel(page)).not.toContainText(/\bdetected (?!hardware|device)/i);
    await expect(matchPanel(page)).toContainText('Active layout: Generic Alice');
    const preview = matchPanel(page).locator('.keyboard-visualizer');
    await expect(preview).toHaveAttribute('data-layout-source', 'preview');
    await expect(preview).toContainText('Preview, not confirmed');
    await expect(preview.getByText('Correct press', { exact: true })).toHaveCount(0);
    await expect(preview.getByText('Mismatch', { exact: true })).toHaveCount(0);
    await expect(preview.locator('g[transform^="rotate"]').first()).toBeAttached();
    expect(await saved(page)).toEqual({ version: 6, settings: { ...DEFAULT_PREFERENCES, onboardingComplete: true } });

    await nav(page, 'Confirm this layout').click();
    await expect(matchPanel(page).locator('.layout-status')).toContainText('Keychron Q8 ANSI Confirmed by you');
    await expect(nav(page, 'Layout confirmed')).toBeDisabled();
    const stored = await saved(page);
    expect(stored.version).toBe(6);
    expect(stored.settings.keyboardProfileId).toBe('keychron-q8-ansi');
    expect(stored.settings.keyboardLayoutConfirmation).toEqual({
      profileId: 'keychron-q8-ansi', variant: {}, confirmedFor: { vendorId: 0x3434, productId: 0x0180 },
      catalogRevision: expect.stringMatching(/^via-[0-9a-f]+\.qmk-[0-9a-f]+$/)
    });

    await page.reload();
    await expect(practiceVisualizer(page)).toHaveAttribute('data-layout-source', 'confirmed');
    await expect(practiceVisualizer(page)).toContainText('Keychron Q8 ANSI layout · Confirmed by you');
    await nav(page, 'Keyboard Test').click();
    await expect(page.getByRole('img', { name: 'Keychron Q8 ANSI keyboard test matrix' })).toBeVisible();
    const progress = page.getByRole('progressbar', { name: 'Keyboard test progress' });
    await expect(progress).not.toHaveAttribute('max', '60');
    await expect(page.locator('.keyboard-test-panel .keyboard-key[data-code="Escape"]')).toHaveAttribute('data-test-state', 'expected');
    await expect(page.locator('.key-results')).toContainText('Esc (Escape): expected');
    await expect(page.locator('.keyboard-test-panel .inert-key').first()).toBeAttached();
    const expectedCode = (await page.locator('.test-status span').textContent())!.replace(/[()]/g, '');
    await page.getByRole('region', { name: 'Keyboard test input' }).focus();
    await page.keyboard.press(expectedCode);
    await expect(progress).toHaveAttribute('value', '1');

    const testPanel = page.locator('.keyboard-test-panel');
    await testPanel.getByRole('button', { name: 'Freestyle', exact: true }).click();
    await expect(progress).toHaveAttribute('value', '0');
    await expect(testPanel.locator('.keyboard-key[data-code="Escape"] .key-count')).toHaveText('0');
    await expect(testPanel.locator('.inert-key .key-count')).toHaveCount(0);
    const region = page.getByRole('region', { name: 'Keyboard test input' });
    await region.focus();
    await region.evaluate((element) => {
      for (const code of ['Escape', 'Space', 'Space']) {
        element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code }));
        element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, code }));
      }
    });
    const space = testPanel.locator('.keyboard-key[data-code="Space"]');
    await expect(space).toHaveAttribute('data-count', '2');
    const spaceCounts = await space.locator('.key-count').count();
    expect(spaceCounts).toBeGreaterThan(0);
    await expect(space.locator('.key-count')).toHaveText(Array(spaceCounts).fill('2'));
    await expect(testPanel.locator('.keyboard-key[data-code="F1"]')).toHaveCount(0);
    await expect(testPanel.locator('.keyboard-key[data-code="Escape"]')).toHaveAttribute('data-count', '1');
    await expect(page.locator('.key-results')).toContainText('Esc (Escape): 1 press');
    await expect(progress).toHaveAttribute('value', '2');
    expect(external).toEqual([]);
  });

  test('reports no match, browses the catalog, eliminates variants by key presses, and clears', async ({ page }) => {
    await setup(page, { device: UNKNOWN });
    await nav(page, 'Keyboard Details').click();
    await expect(matchPanel(page)).toContainText('No match for this device');
    await expect(matchPanel(page).locator('.candidate')).toHaveCount(0);
    await page.getByLabel('Browse catalog layouts', { exact: true }).selectOption('projectkb-alice');
    const longBackspace = page.getByRole('group', { name: 'Long Backspace', exact: true });
    await expect(longBackspace.getByRole('radio', { name: 'Off' })).toBeChecked();
    await matchPanel(page).getByText('Key check & layout sources', { exact: true }).click();
    await expect(matchPanel(page)).toContainText('Distinguishing keys: Delete.');

    await page.getByLabel('Check with key presses (optional)', { exact: true }).focus();
    await page.keyboard.press('Delete');
    await expect(matchPanel(page)).toContainText('Checked: Delete.');
    await expect(longBackspace).toContainText('On — ruled out by your key presses');
    await expect(longBackspace.getByRole('radio', { name: 'Off' })).toBeChecked();

    await page.getByRole('group', { name: 'Long RShift', exact: true }).getByRole('radio', { name: /^On/ }).check();
    await expect(matchPanel(page).locator('.keyboard-key[data-code="MetaRight"]')).toHaveCount(0);
    await nav(page, 'Confirm this layout').click();
    expect((await saved(page)).settings.keyboardLayoutConfirmation).toMatchObject({
      profileId: 'projectkb-alice', variant: { 0: 0, 1: 1 }, confirmedFor: { vendorId: 0x1234, productId: 0xabcd }
    });
    await expect(matchPanel(page).locator('.layout-status')).toContainText('Long Backspace: Off, Long RShift: On');
    const stored = await saved(page);
    expect(stored.settings).not.toHaveProperty('observedCodes');
    expect(JSON.stringify(stored)).not.toContain('Delete');

    await nav(page, 'Clear confirmation').click();
    await expect(matchPanel(page).locator('.layout-status')).toContainText('Active layout: Generic Alice');
    expect((await saved(page)).settings.keyboardLayoutConfirmation).toBeNull();
    await nav(page, 'Practice').click();
    await expect(practiceVisualizer(page)).toHaveAttribute('data-layout-source', 'generic');
  });

  test('keeps a confirmation but notices a different connected device', async ({ page }) => {
    await setup(page, { device: UNKNOWN, stored: storedWith(confirmation()) });
    await expect(practiceVisualizer(page)).toHaveAttribute('data-layout-source', 'confirmed');
    await nav(page, 'Keyboard Details').click();
    await expect(matchPanel(page).getByRole('alert')).toContainText('differs from the device this layout was confirmed for (0x0159:0xA71C)');
    await expect(matchPanel(page).locator('.layout-status')).toContainText('ProjectKB Alice Confirmed by you');
  });

  test('selecting a different reference profile clears the confirmation', async ({ page }) => {
    await setup(page, { stored: storedWith(confirmation()) });
    await nav(page, 'Keyboard Details').click();
    await page.locator('.details-disclosure > summary').click();
    await expect(page.getByLabel('Reference profile', { exact: true })).toHaveValue('projectkb-alice');
    await page.getByLabel('Reference profile', { exact: true }).selectOption('generic-alice');
    const stored = await saved(page);
    expect(stored.settings.keyboardProfileId).toBe('generic-alice');
    expect(stored.settings.keyboardLayoutConfirmation).toBeNull();
  });

  test('surfaces a stale variant without rewriting the stored confirmation', async ({ page }) => {
    const stale = storedWith(confirmation({ variant: { 0: 0, 1: 7 } }));
    await setup(page, { stored: stale });
    await expect(page.getByRole('alert').filter({ hasText: 'no longer available' })).toBeVisible();
    await expect(practiceVisualizer(page)).toHaveAttribute('data-layout-source', 'generic');
    expect(await saved(page)).toEqual(stale);
    await nav(page, 'Open Find my layout').click();
    await expect(page.locator('#layout-match-heading')).toBeFocused();
  });

  test('migrates version 3 preferences to version 6 with no confirmation', async ({ page }) => {
    const { keyboardLayoutConfirmation: _omit, ...v3 } = { ...DEFAULT_PREFERENCES, onboardingComplete: true, keyboardProfileId: 'generic-alice' };
    await setup(page, { stored: { version: 3, settings: v3 } });
    await expect(page.getByRole('textbox', { name: 'Typing practice', exact: true })).toBeVisible();
    expect(await saved(page)).toEqual({ version: 6, settings: { ...v3, language: 'en', keyboardLayoutConfirmation: null } });
  });

  test('links the layout data attribution and GPL license in the footer', async ({ page }) => {
    await setup(page);
    const footer = page.locator('.app-footer');
    for (const [name, text] of [['Keyboard layout attribution', 'the-via/keyboards'], ['GPL-3.0 layout data', 'GNU GENERAL PUBLIC LICENSE']]) {
      const href = await footer.getByRole('link', { name, exact: true }).getAttribute('href');
      const response = await page.request.get(href!);
      expect(response.ok()).toBe(true);
      expect(await response.text()).toContain(text);
    }
  });

  test('finds layouts by board name without a device and keeps review and activation explicit', async ({ page }) => {
    const external = await setup(page);
    await nav(page, 'Keyboard Details').click();
    const before = await saved(page);
    await expect(page.locator('.details-disclosure')).not.toHaveAttribute('open');
    await expect(page.locator('.device-disclosure')).not.toHaveAttribute('open');
    await page.getByRole('searchbox', { name: 'Board name', exact: true }).fill('Keychron Q8 ISO');
    const candidates = matchPanel(page).locator('.candidate');
    await expect(candidates).toHaveCount(4);
    await expect(candidates.first()).toHaveAttribute('data-candidate', 'keychron-q8-iso');
    await expect(candidates.first()).toContainText('Name match only');
    await expect(matchPanel(page).locator('.keyboard-visualizer')).toHaveCount(0);
    await nav(page, 'Review Keychron Q8 ISO').click();
    await expect(matchPanel(page).locator('.keyboard-visualizer')).toHaveAttribute('data-layout-source', 'preview');
    await expect(matchPanel(page).locator('.layout-status')).toContainText('Generic Alice');

    await page.getByRole('searchbox', { name: 'Board name', exact: true }).fill('Chalice');
    await expect(candidates).toHaveCount(1);
    await expect(matchPanel(page).getByRole('heading', { name: 'Review Keychron Q8 ISO', exact: true })).toBeVisible();
    expect(await saved(page)).toEqual(before);
    await nav(page, 'Confirm this layout').click();
    expect((await saved(page)).settings.keyboardLayoutConfirmation).toMatchObject({
      profileId: 'keychron-q8-iso', confirmedFor: null
    });
    expect(external).toEqual([]);
  });

  test('suggests from a browser name even when its USB IDs are not in the catalog', async ({ page }) => {
    await setup(page, { device: { ...UNKNOWN, productName: 'Keychron Q8' } });
    await nav(page, 'Keyboard Details').click();
    await expect(matchPanel(page).locator('.candidate')).toHaveCount(4);
    await expect(matchPanel(page).locator('.candidate').first()).toContainText('Device name "Keychron Q8"');
    await expect(matchPanel(page).locator('.layout-status')).toContainText('Generic Alice');
    expect((await saved(page)).settings.keyboardLayoutConfirmation).toBeNull();
  });

  for (const hint of [
    { details: { name: 'My board', model: 'Keychron Q8 ISO' }, id: 'keychron-q8-iso', matchedName: 'Keychron Q8 ISO' },
    { details: { name: 'My board', brand: 'ProjectKB', model: 'Alice' }, id: 'projectkb-alice', matchedName: 'ProjectKB Alice' }
  ]) {
  test(`uses saved notes for ${hint.matchedName} without requiring a connection`, async ({ page }) => {
    await setup(page, { stored: { version: 5, settings: {
      ...DEFAULT_PREFERENCES, onboardingComplete: true, keyboardUserDetails: hint.details
    } } });
    await nav(page, 'Keyboard Details').click();
    await expect(matchPanel(page).locator('.candidate').first()).toHaveAttribute('data-candidate', hint.id);
    await expect(matchPanel(page).locator('.candidate').first()).toContainText(`Your board name "${hint.matchedName}"`);
    expect((await saved(page)).settings.keyboardLayoutConfirmation).toBeNull();
  });
  }

  test('keeps selection and preview side by side with bounded scrolling on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await setup(page, { device: Q8 });
    await nav(page, 'Keyboard Details').click();
    await expect(matchPanel(page).locator('.keyboard-visualizer')).toBeVisible();
    const choices = await matchPanel(page).locator('.layout-choices').boundingBox();
    const review = await matchPanel(page).locator('.layout-review').boundingBox();
    expect(review!.x).toBeGreaterThan(choices!.x + choices!.width);
    expect(Math.abs(review!.y - choices!.y)).toBeLessThan(2);
    const finder = await matchPanel(page).boundingBox();
    expect(finder!.height).toBeLessThan(650);
    await page.getByRole('searchbox', { name: 'Board name', exact: true }).fill('Keychron Q8');
    const listHeight = await matchPanel(page).locator('.candidate-list').evaluate((element) => element.clientHeight);
    expect(listHeight).toBeLessThanOrEqual(310);
  });

  test('supports name search, preview, variants, and confirmation at mobile widths', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await setup(page);
    await nav(page, 'Keyboard Details').click();
    const search = page.getByRole('searchbox', { name: 'Board name', exact: true });
    await search.fill('ProjectKB Alice');
    await search.press('Tab');
    await expect(nav(page, 'Review ProjectKB Alice')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Review ProjectKB Alice', exact: true })).toBeFocused();
    await expect(matchPanel(page).locator('.keyboard-visualizer')).toBeVisible();
    await page.getByRole('group', { name: 'Long RShift', exact: true }).getByRole('radio', { name: 'On', exact: true }).check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await nav(page, 'Confirm this layout').click();
    await expect(matchPanel(page).locator('.layout-status')).toContainText('ProjectKB Alice Confirmed by you');
    await search.fill('a board not in the catalog');
    await expect(matchPanel(page)).toContainText('No suggestions for');
    await expect(page.getByLabel('Browse catalog layouts', { exact: true })).toBeVisible();
  });
});
