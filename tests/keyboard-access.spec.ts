import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY } from './support';

type Scenario = 'grant' | 'restore' | 'denied' | 'empty' | 'multiple' | 'failed';

async function mockAccess(page: Page, scenario: Scenario, returning = false) {
  await page.addInitScript(({ scenario, returning, key, defaults }) => {
    if (returning) localStorage.setItem(key, JSON.stringify({
      version: 4, settings: { ...defaults, onboardingComplete: true }
    }));
    const device = { productName: 'Example Alice HID', vendorId: 0x1234, productId: 0xabcd };
    const other = { productName: 'Second HID device', vendorId: 0x5678, productId: 0x0001 };
    let granted = scenario === 'restore' ? [device] : scenario === 'multiple' ? [device, other] : [];
    const hid = Object.assign(new EventTarget(), {
      getDevices: async () => {
        if (scenario === 'failed') throw new DOMException('Device policy blocked', 'SecurityError');
        return granted;
      },
      requestDevice: async () => {
        Reflect.set(window, 'chooserHadActivation', navigator.userActivation.isActive);
        if (scenario === 'denied') throw new DOMException('Permission denied', 'NotAllowedError');
        if (scenario === 'empty') return [];
        granted = [device];
        return granted;
      }
    });
    Reflect.set(window, 'disconnectKeyboard', () => {
      granted = [];
      const event = new Event('disconnect');
      Object.defineProperty(event, 'device', { value: device });
      hid.dispatchEvent(event);
    });
    Reflect.set(window, 'reconnectKeyboard', () => {
      granted = [device];
      hid.dispatchEvent(new Event('connect'));
    });
    const keyboard = Object.assign(new EventTarget(), {
      getLayoutMap: async () => new Map([['KeyQ', 'a'], ['KeyA', 'q']])
    });
    Object.defineProperty(navigator, 'hid', { configurable: true, value: hid });
    Object.defineProperty(navigator, 'keyboard', { configurable: true, value: keyboard });
    Reflect.set(window, 'changeKeyboardLayout', () => {
      keyboard.getLayoutMap = async () => new Map([['KeyQ', 'z']]);
      keyboard.dispatchEvent(new Event('layoutchange'));
    });
  }, { scenario, returning, key: PREFERENCES_KEY, defaults: DEFAULT_PREFERENCES });
}

const connection = (page: Page) => page.getByRole('region', { name: 'Keyboard connection', exact: true });
const connect = (page: Page) => page.getByRole('button', { name: 'Connect Keyboard & Start', exact: true });
const legend = (page: Page) => page.locator('.keyboard-key[data-code="KeyQ"] .key-legend').filter({ visible: true });

test('automatically prompts, opens the chooser on activation, and shares browser legends across both views', async ({ page }) => {
  await mockAccess(page, 'grant');
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(connect(page)).toBeFocused();
  await expect(page.getByRole('dialog')).toContainText('never uploaded to a server');
  await connect(page).click();
  expect(await page.evaluate(() => Reflect.get(window, 'chooserHadActivation'))).toBe(true);
  await expect(page.getByRole('textbox', { name: 'Typing practice', exact: true })).toBeFocused();
  await expect(connection(page)).toContainText('Example Alice HID');
  await expect(connection(page)).toContainText('No layout is confirmed for this device');
  await expect(legend(page)).toHaveText('a');
  await page.getByRole('button', { name: 'Keyboard Test', exact: true }).click();
  await expect(legend(page)).toHaveText('a');
  await page.getByRole('button', { name: 'Keyboard Details', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Browser-reported device' })).toContainText('0x1234');
  await expect(page.getByRole('group', { name: 'Browser-reported device' })).toContainText('0xABCD');
  await expect(page.getByRole('group', { name: 'Browser-reported device' })).toContainText('Example Alice HID');
  const saved = await page.evaluate((key) => localStorage.getItem(key), PREFERENCES_KEY);
  expect(saved).not.toContain('Example Alice HID');
  expect(saved).not.toContain('vendorId');
});

test('restores previously granted access without prompting and clears stale device details on disconnect', async ({ page }) => {
  await mockAccess(page, 'restore', true);
  await page.goto('/');
  await expect(connection(page)).toContainText('Example Alice HID');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(legend(page)).toHaveText('a');
  await page.evaluate(() => Reflect.get(window, 'changeKeyboardLayout')());
  await expect(legend(page)).toHaveText('z');
  await page.evaluate(() => Reflect.get(window, 'disconnectKeyboard')());
  await expect(connection(page)).toContainText('No accessible keyboard detected');
  await expect(connection(page)).not.toContainText('Selected device:');
  await expect(legend(page)).toHaveText('Q');
  await page.getByRole('button', { name: 'Keyboard Details', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Browser-reported device' })).toContainText('No device selected');
  await page.evaluate(() => Reflect.get(window, 'reconnectKeyboard')());
  await expect(connection(page)).toContainText('Example Alice HID');
});

for (const scenario of ['denied', 'empty', 'failed'] as const) {
  test(`${scenario} access shows a warning without blocking ordinary typing`, async ({ page }) => {
    await mockAccess(page, scenario, true);
    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible();
    if (scenario === 'failed') await expect(connection(page)).toContainText('Device policy blocked');
    await connect(page).click();
    await expect(connection(page)).toContainText(
      scenario === 'denied' ? 'Permission denied' : scenario === 'empty' ? 'not granted' : 'Example Alice HID'
    );
    await page.getByRole('textbox', { name: 'Typing practice', exact: true }).press('a');
    await expect(page.getByRole('region', { name: 'Typing practice', exact: true })).toHaveAttribute('data-status', 'running');
  });
}

test('requires explicit device selection when multiple previously authorized devices are connected', async ({ page }) => {
  await mockAccess(page, 'multiple', true);
  await page.goto('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(connection(page)).toContainText('Multiple authorized devices');
  await expect(connection(page)).not.toContainText('Selected device:');
  await connection(page).locator('summary').click();
  await page.getByLabel('Choose your keyboard', { exact: true }).selectOption('1');
  await expect(connection(page)).toContainText('Selected device: Second HID device');
});

test('late startup discovery cannot reopen a skipped dialog, but reload without a grant prompts again', async ({ page }) => {
  await page.addInitScript(() => {
    const hid = Object.assign(new EventTarget(), {
      getDevices: () => new Promise((resolve) => {
        Reflect.set(window, 'finishDeviceDiscovery', () => resolve([]));
      }),
      requestDevice: async () => []
    });
    Object.defineProperty(navigator, 'hid', { value: hid });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue without layout access' }).click();
  await page.evaluate(() => Reflect.get(window, 'finishDeviceDiscovery')());
  await expect(connection(page)).toContainText('No accessible keyboard detected');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await page.evaluate(() => Reflect.get(window, 'finishDeviceDiscovery')());
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('unsupported detection, skip, and cancelled access remain recoverable and responsive', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hid', { value: undefined });
    Object.defineProperty(navigator, 'keyboard', { value: undefined });
  });
  await page.goto('/');
  await expect(page.getByRole('dialog')).toContainText('Device detection is unavailable');
  await page.keyboard.press('Escape');
  await expect(connection(page)).toContainText('Keyboard access was skipped');
  await connection(page).locator('summary').click();
  await page.getByRole('button', { name: 'Refresh key labels' }).click();
  await expect(connection(page)).toContainText('not supported');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.reload();
  await expect(connection(page)).toContainText('Keyboard device detection is not supported');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const width of [320, 1440]) {
  test(`connection and browser-reported details remain readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAccess(page, 'restore', true);
    await page.goto('/');
    const summary = connection(page).locator('summary');
    await expect(summary).toContainText('Keyboard connection');
    await expect(summary).toContainText('Example Alice HID');
    await expect(connection(page).locator('details')).not.toHaveAttribute('open');
    await expect(connection(page).getByRole('button', { name: 'Connect keyboard', exact: true })).toBeHidden();
    await summary.focus();
    await summary.press('Enter');
    await expect(connection(page).locator('details')).toHaveAttribute('open', '');
    await expect(connection(page)).toContainText('Private by design.');
    await expect(connection(page)).toContainText('Nothing is uploaded to a server.');
    await expect(connection(page).getByRole('button', { name: 'Connect keyboard', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Keyboard Details', exact: true }).click();
    const device = page.getByRole('group', { name: 'Browser-reported device' });
    await expect(device).toContainText('Shared by your browser');
    await expect(device.locator('dt')).toHaveText(['Product name', 'Vendor ID', 'Product ID', 'VID:PID (VPID)']);
    await expect(device.locator('dd')).toHaveText(['Example Alice HID', '0x1234', '0xABCD', '1234:ABCD']);
    await expect(device).toContainText('Reference layout only.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await summary.focus();
    await summary.press('Space');
    await expect(connection(page).locator('details')).not.toHaveAttribute('open');
    await expect(summary).toContainText('Example Alice HID');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test('collapsed summary shows yellow selection-needed and green selected-device badges', async ({ page }) => {
  await mockAccess(page, 'multiple', true);
  await page.goto('/');
  const summary = connection(page).locator('summary');
  const badge = summary.locator('.connection-badge');
  await expect(badge).toHaveText('Selection needed');
  await expect(badge).toHaveCSS('color', 'rgb(245, 206, 114)');
  await expect(summary).toContainText('No keyboard selected');
  await summary.click();
  await page.getByLabel('Choose your keyboard', { exact: true }).selectOption('1');
  await summary.click();
  await expect(badge).toHaveText('Device selected');
  await expect(badge).toHaveCSS('color', 'rgb(140, 219, 172)');
  await expect(summary).toContainText('Second HID device');
  await page.getByRole('button', { name: 'Keyboard Details', exact: true }).click();
  await expect(connection(page).locator('details')).not.toHaveAttribute('open');
});
