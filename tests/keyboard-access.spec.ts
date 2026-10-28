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
        Reflect.set(window, 'deviceRequestCount', (Reflect.get(window, 'deviceRequestCount') ?? 0) + 1);
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
      getLayoutMap: async () => {
        Reflect.set(window, 'layoutRequestCount', (Reflect.get(window, 'layoutRequestCount') ?? 0) + 1);
        return new Map([['KeyQ', 'a'], ['KeyA', 'q']]);
      }
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
const connect = (page: Page) => page.getByRole('button', { name: 'Connect keyboard & start', exact: true });
const legend = (page: Page) => page.locator('.keyboard-key[data-code="KeyQ"] .key-legend').filter({ visible: true });

test('automatically prompts, opens the chooser on activation, and shares browser legends across both views', async ({ page }) => {
  await mockAccess(page, 'grant');
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start practicing', exact: true })).toBeFocused();
  await page.getByRole('dialog').locator('summary').click();
  await expect(page.getByRole('dialog')).toContainText('never uploaded to a server');
  await connect(page).click();
  expect(await page.evaluate(() => Reflect.get(window, 'chooserHadActivation'))).toBe(true);
  await expect(page.getByRole('textbox', { name: 'Typing practice', exact: true })).toBeFocused();
  await expect(connection(page)).toContainText('Example Alice HID');
  await expect(connection(page).locator('details')).toHaveAttribute('open', '');
  await expect(connection(page).getByRole('status').filter({ hasText: 'Selected device:' })).toBeVisible();
  await expect(connection(page)).toContainText('No layout is confirmed yet');
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

test('default Enter action requests key labels without opening the device picker or starting a session', async ({ page }) => {
  await mockAccess(page, 'grant');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start practicing', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Typing practice', exact: true })).toBeFocused();
  await expect(page.getByRole('region', { name: 'Typing practice', exact: true })).toHaveAttribute('data-status', 'ready');
  await expect(legend(page)).toHaveText('a');
  expect(await page.evaluate(() => Reflect.get(window, 'deviceRequestCount') ?? 0)).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, 'layoutRequestCount'))).toBe(1);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '').settings, PREFERENCES_KEY);
  expect(saved.onboardingComplete).toBe(true);
});

test('Start practicing focuses the Custom editor when no target is ready', async ({ page }) => {
  await mockAccess(page, 'grant');
  await page.addInitScript(({ key, defaults }) => {
    localStorage.setItem(key, JSON.stringify({
      version: 5, settings: { ...defaults, mode: 'custom' }
    }));
  }, { key: PREFERENCES_KEY, defaults: DEFAULT_PREFERENCES });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start practicing', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Custom text', exact: true })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Typing practice', exact: true })).toHaveCount(0);
});

for (const viewport of [{ width: 320, height: 740 }, { width: 667, height: 320 }]) {
  test(`optional setup and privacy remain usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockAccess(page, 'grant');
    await page.goto('/');
    const dialog = page.getByRole('dialog');
    await dialog.locator('summary').click();
    await expect(dialog.getByText(/never uploaded to a server/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Explore first', exact: true }).scrollIntoViewIfNeeded();
    expect(await dialog.evaluate((element) => element.scrollWidth)).toBe(await dialog.evaluate((element) => element.clientWidth));
    await dialog.locator('summary').click();
    await connect(page).click();
    await expect(dialog).toHaveCount(0);
    await expect(connection(page).getByRole('status').filter({ hasText: 'Selected device:' })).toBeVisible();
  });
}

for (const action of ['Explore first', 'Escape'] as const) {
  test(`${action} dismisses without requesting access and keeps keyboard focus outside the exercise`, async ({ page }) => {
    await mockAccess(page, 'grant');
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Start practicing', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(connect(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('dialog').locator('summary')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Explore first', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('dialog').locator('summary')).toBeFocused();
    if (action === 'Escape') await page.keyboard.press('Escape');
    else await page.getByRole('button', { name: action, exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Practice', exact: true })).toBeFocused();
    await expect(page.getByRole('region', { name: 'Typing practice', exact: true })).toHaveAttribute('data-status', 'ready');
    expect(await page.evaluate(() => Reflect.get(window, 'deviceRequestCount') ?? 0)).toBe(0);
    expect(await page.evaluate(() => Reflect.get(window, 'layoutRequestCount') ?? 0)).toBe(0);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '').settings, PREFERENCES_KEY);
    expect(saved.onboardingComplete).toBe(true);
  });
}

test('connecting with Enter retains user activation and focuses practice while the chooser is pending', async ({ page }) => {
  await mockAccess(page, 'grant');
  await page.addInitScript(() => {
    Reflect.set(Reflect.get(navigator, 'hid'), 'requestDevice', () => {
      Reflect.set(window, 'chooserHadActivation', navigator.userActivation.isActive);
      return new Promise((resolve) => {
        Reflect.set(window, 'cancelDevicePicker', () => resolve([]));
      });
    });
  });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(connect(page)).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => Reflect.get(window, 'chooserHadActivation'))).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Typing practice', exact: true })).toBeFocused();
  await expect(connection(page).getByRole('button', { name: 'Connecting...' })).toBeDisabled();
  await page.evaluate(() => Reflect.get(window, 'cancelDevicePicker')());
  await expect(connection(page).getByText(/No device was selected/)).toBeVisible();
  await expect(connection(page).getByRole('button', { name: 'Connect a device', exact: true })).toBeEnabled();
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
  await expect(connection(page)).toContainText('No device is available right now');
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
      scenario === 'denied' ? 'Permission denied' : scenario === 'empty' ? 'No device was selected' : 'Example Alice HID'
    );
    if (scenario !== 'failed') {
      await expect(connection(page).getByText(/browser could not connect|No device was selected/)).toBeVisible();
    }
    await page.getByRole('textbox', { name: 'Typing practice', exact: true }).press('a');
    await expect(page.getByRole('region', { name: 'Typing practice', exact: true })).toHaveAttribute('data-status', 'running');
  });
}

test('requires explicit device selection when multiple previously authorized devices are connected', async ({ page }) => {
  await mockAccess(page, 'multiple', true);
  await page.goto('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(connection(page)).toContainText('Several devices are available');
  await expect(connection(page)).not.toContainText('Selected device:');
  await connection(page).locator('summary').click();
  await page.getByLabel('Choose a device', { exact: true }).selectOption('1');
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
  await page.getByRole('button', { name: 'Explore first' }).click();
  await page.evaluate(() => Reflect.get(window, 'finishDeviceDiscovery')());
  await expect(connection(page)).toContainText('No device is available right now');
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
  await expect(page.getByRole('dialog')).toContainText("Device connection isn't available");
  await page.keyboard.press('Escape');
  await expect(connection(page)).toContainText('No problem. You can practice');
  await connection(page).locator('summary').click();
  await page.getByRole('button', { name: 'Refresh key labels' }).click();
  await expect(connection(page)).toContainText('not available here');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.reload();
  await expect(connection(page)).toContainText('Device access is not available in this browser');
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
    await expect(connection(page).getByRole('button', { name: 'Connect a device', exact: true })).toBeHidden();
    await summary.focus();
    await summary.press('Enter');
    await expect(connection(page).locator('details')).toHaveAttribute('open', '');
    await expect(connection(page)).toContainText('Device access is optional.');
    await expect(connection(page)).toContainText('practice and test keys without connecting anything');
    await expect(connection(page)).toContainText('Your information stays private.');
    await expect(connection(page)).toContainText('does not upload them to a server');
    await expect(connection(page).getByRole('button', { name: 'Connect a device', exact: true })).toBeVisible();
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

test('collapsed summary shows a yellow device prompt and green selected-device badge', async ({ page }) => {
  await mockAccess(page, 'multiple', true);
  await page.goto('/');
  const summary = connection(page).locator('summary');
  const badge = summary.locator('.connection-badge');
  await expect(badge).toHaveText('Choose a device');
  await expect(badge).toHaveCSS('color', 'rgb(245, 206, 114)');
  await expect(summary).toContainText('No device selected');
  await summary.click();
  await page.getByLabel('Choose a device', { exact: true }).selectOption('1');
  await summary.click();
  await expect(badge).toHaveText('Device selected');
  await expect(badge).toHaveCSS('color', 'rgb(140, 219, 172)');
  await expect(summary).toContainText('Second HID device');
  await page.getByRole('button', { name: 'Keyboard Details', exact: true }).click();
  await expect(connection(page).locator('details')).not.toHaveAttribute('open');
});
