import { expect, test } from '@playwright/test';
import { disableDeviceAccess, PREFERENCES_KEY, skipOnboarding } from './support';

test.beforeEach(async ({ page }) => {
  await disableDeviceAccess(page);
  await skipOnboarding(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
});

test('checkboxes share accessible targets, native toggling, persistence, and disabled states', async ({ page }) => {
  const checkBoxes = async () => {
    const boxes = await page.getByRole('checkbox').evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element);
      const label = element.closest('label')!;
      const bounds = label.getBoundingClientRect();
      return {
        size: [style.width, style.height],
        labelHeight: bounds.height,
        fits: bounds.right <= innerWidth + 1,
        label: label.textContent?.trim()
      };
    }));
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.size).toEqual(['20px', '20px']);
      expect(box.labelHeight).toBeGreaterThanOrEqual(40);
      expect(box.fits).toBe(true);
      expect(box.label).toBeTruthy();
    }
  };
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ['Timed', 'Words', 'Drills', 'Code', 'Zen']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      await checkBoxes();
    }
    await page.getByRole('button', { name: 'Keyboard Test', exact: true }).click();
    await checkBoxes();
    await page.getByRole('button', { name: 'Practice', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Timed', exact: true }).click();
  const liveStats = page.getByRole('checkbox', { name: 'Show live WPM and accuracy', exact: true });
  await expect(liveStats).toBeChecked();
  await expect(liveStats).toHaveCSS('background-color', 'rgb(255, 93, 0)');
  await expect(liveStats).not.toHaveCSS('background-image', 'none');
  await page.keyboard.press('Tab');
  await liveStats.focus();
  await expect(liveStats).toHaveCSS('outline-color', 'rgb(255, 93, 0)');
  await page.keyboard.press('Space');
  await expect(liveStats).not.toBeChecked();
  await expect(liveStats).toHaveCSS('background-image', 'none');
  await page.reload();
  await expect(liveStats).not.toBeChecked();
  await page.locator('.preferences label').filter({ has: liveStats }).click();
  await expect(liveStats).toBeChecked();
  await page.getByRole('checkbox', { name: 'Finger guide', exact: true }).check();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).settings.fingerGuide, PREFERENCES_KEY)).toBe(true);
  await page.getByRole('button', { name: 'Drills', exact: true }).click();
  await page.getByRole('combobox', { name: 'Drill', exact: true }).selectOption('cross-boundary');
  const numbers = page.getByRole('checkbox', { name: 'Numbers', exact: true });
  await expect(numbers).toBeChecked();
  await expect(numbers).toBeDisabled();
  await expect(numbers).toHaveCSS('cursor', 'not-allowed');
  await page.getByRole('button', { name: 'Start typing', exact: true }).click();
  await page.keyboard.type('a');
  await expect(liveStats).toBeDisabled();
  await expect(liveStats).toHaveCSS('opacity', '0.55');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(liveStats).toHaveCSS('appearance', 'auto');
  await expect(liveStats).toHaveCSS('background-image', 'none');
  await expect(liveStats).toHaveCSS('opacity', '1');
});

test('selects share responsive styling, native keyboard selection, and high-contrast support', async ({ page }) => {
  const checkSelects = async () => {
    const styles = await page.locator('select:visible').evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return {
        name: element.getAttribute('aria-label') ?? (element instanceof HTMLSelectElement ? element.labels?.[0]?.textContent?.trim() : undefined),
        background: style.backgroundColor,
        height: style.minHeight,
        radius: style.borderRadius,
        arrow: style.backgroundImage,
        fits: bounds.right <= innerWidth + 1 && bounds.width <= element.parentElement!.getBoundingClientRect().width + 1
      };
    }));
    expect(styles.length).toBeGreaterThan(0);
    for (const style of styles) {
      expect(style.name).toBeTruthy();
      expect(style.background).toBe('rgb(36, 36, 36)');
      expect(style.height).toBe('40px');
      expect(style.radius).toBe('9.6px');
      expect(style.arrow).not.toBe('none');
      expect(style.fits, JSON.stringify(style)).toBe(true);
    }
  };
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Practice', exact: true }).click();
    for (const mode of ['Timed', 'Words', 'Drills', 'Code']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      await checkSelects();
    }
    await page.getByRole('button', { name: 'Keyboard Test', exact: true }).click();
    await checkSelects();
    await page.getByRole('button', { name: 'Keyboard Details', exact: true }).click();
    await checkSelects();
  }
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Timed', exact: true }).click();
  const duration = page.getByRole('combobox', { name: 'Duration', exact: true });
  await duration.selectOption('30');
  await page.keyboard.press('Tab');
  await duration.focus();
  await expect(duration).toHaveCSS('outline-color', 'rgb(255, 93, 0)');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(duration).toHaveValue('60');
  await page.getByRole('button', { name: 'Start typing', exact: true }).click();
  await page.keyboard.type('a');
  await expect(duration).toBeDisabled();
  await expect(duration).toHaveCSS('cursor', 'not-allowed');
  await expect(duration).toHaveCSS('opacity', '0.55');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(duration).toHaveCSS('appearance', 'auto');
  await expect(duration).toHaveCSS('background-image', 'none');
  await expect(duration).toHaveCSS('opacity', '1');
});

test('Practice keeps the text and keyboard full-width with actions before the diagram', async ({ page }) => {
  const panel = page.locator('section[aria-labelledby="practice-panel-heading"]');
  const geometry = await panel.evaluate((element) => {
    const text = element.querySelector('.practice-text')!.getBoundingClientRect();
    const keyboard = element.querySelector('.keyboard-visualizer')!.getBoundingClientRect();
    const actions = element.querySelector('.practice-bottom')!.getBoundingClientRect();
    return { textWidth: text.width, keyboardWidth: keyboard.width, keyboardTop: keyboard.top, actionsBottom: actions.bottom };
  });
  expect(Math.abs(geometry.textWidth - geometry.keyboardWidth)).toBeLessThan(1);
  expect(geometry.keyboardWidth).toBeGreaterThan(950);
  expect(geometry.keyboardTop).toBeLessThan(650);
  expect(geometry.actionsBottom).toBeLessThanOrEqual(geometry.keyboardTop);
  await page.getByRole('button', { name: 'Start typing', exact: true }).click();
  await page.keyboard.type('a');
  await expect(panel).toHaveAttribute('data-status', 'running');
});

test('Keyboard Test leads with controls and a full-width diagram; details and mobile remain usable', async ({ page }) => {
  await page.getByRole('button', { name: 'Keyboard Test', exact: true }).click();
  const panel = page.locator('.keyboard-test-panel');
  const geometry = await panel.evaluate((element) => {
    const keyboard = element.querySelector('.keyboard-visualizer')!.getBoundingClientRect();
    const capture = element.querySelector('.test-input')!.getBoundingClientRect();
    return { width: keyboard.width, top: keyboard.top, captureWidth: capture.width };
  });
  expect(geometry.width).toBeGreaterThan(950);
  expect(Math.abs(geometry.width - geometry.captureWidth)).toBeLessThan(1);
  expect(geometry.top).toBeLessThan(450);
  await expect(panel.locator('.test-help')).not.toHaveAttribute('open', '');
  await panel.locator('.test-help summary').click();
  await expect(panel.locator('#keyboard-test-instructions')).toContainText('Browser shortcuts');
  await page.getByRole('button', { name: 'Focus keyboard test' }).click();
  await expect(panel.locator('.test-input')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(panel.locator('.test-input')).not.toBeFocused();
  await page.setViewportSize({ width: 375, height: 812 });
  const language = page.getByRole('combobox', { name: 'Language', exact: true });
  await language.selectOption('vi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
