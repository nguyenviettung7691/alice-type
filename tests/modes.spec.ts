import { expect, test, type Page } from '@playwright/test';
import { skipOnboarding } from './support';

const input = (page: Page) => page.getByRole('textbox', { name: 'Typing practice', exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Typing practice', exact: true });
const target = async (page: Page) => {
  const text = await page.locator('#practice-target .sr-only').textContent();
  if (!text) throw new Error('Missing generated target.');
  return text;
};
const start = (page: Page) => page.getByRole('button', { name: 'Start typing', exact: true }).click();
const progress = (page: Page) => page.getByRole('progressbar');
const intervalCount = (page: Page) => page.evaluate(() => Reflect.get(window, 'phase4IntervalCount'));

test.beforeEach(async ({ page }) => {
  await skipOnboarding(page);
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/');
  await page.evaluate(() => {
    const intervals = new Set<number>();
    const originalSet = window.setInterval.bind(window);
    const originalClear = window.clearInterval.bind(window);
    window.setInterval = (handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const id = originalSet(handler, timeout, ...args);
      if (timeout === 100) intervals.add(id);
      return id;
    };
    window.clearInterval = (id?: number) => {
      if (id !== undefined) intervals.delete(id);
      originalClear(id);
    };
    Object.defineProperty(window, 'phase4IntervalCount', { get: () => intervals.size });
  });
});

test('defaults to ready Timed 30/200, exposes exact limits, and keeps future modes unavailable', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Timed', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Duration', { exact: true })).toHaveValue('30');
  await expect(page.getByLabel('Vocabulary', { exact: true })).toHaveValue('200');
  await expect(page.getByRole('checkbox', { name: 'Punctuation', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Numbers', exact: true })).not.toBeChecked();
  expect(await page.getByLabel('Duration', { exact: true }).locator('option').evaluateAll(
    (options) => options.map((option) => option.getAttribute('value'))
  )).toEqual(['15', '30', '60', '120']);
  await expect(progress(page)).toHaveAccessibleName('Elapsed time');
  await expect(progress(page)).toHaveAttribute('value', '0');
  await page.clock.runFor(60_000);
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('.metric-value')).toHaveText(['—', '—']);
  await expect(input(page)).not.toBeFocused();
  for (const mode of ['Quote', 'Custom', 'Zen']) {
    await expect(page.getByRole('button', { name: mode, exact: true })).toHaveCount(0);
    await expect(page.getByText(`${mode}, coming soon`, { exact: true })).toHaveAttribute('aria-disabled', 'true');
  }
});

test('keeps connection above every view and mode selection inside Practice', async ({ page }) => {
  const modes = page.getByRole('navigation', { name: 'Practice modes', exact: true });
  await expect(page.locator('header').getByRole('navigation', { name: 'Practice modes' })).toHaveCount(0);
  await expect(panel(page).getByRole('navigation', { name: 'Practice modes' })).toBeVisible();
  await expect(page.locator('.intro')).toHaveCount(0);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const header = await page.locator('header').boundingBox();
    const connection = await page.locator('.keyboard-connection').boundingBox();
    const selector = await modes.boundingBox();
    const settings = await page.getByRole('group', { name: 'Exercise settings' }).boundingBox();
    if (!header || !connection || !selector || !settings) throw new Error('Missing app layout');
    expect(connection.y - (header.y + header.height)).toBeGreaterThanOrEqual(0);
    expect(connection.y - (header.y + header.height)).toBeLessThanOrEqual(24);
    expect(selector.y).toBeGreaterThanOrEqual(connection.y + connection.height);
    expect(settings.y).toBeGreaterThanOrEqual(selector.y + selector.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  for (const name of ['Settings', 'Stats', 'Keyboard Test', 'Keyboard Details']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(modes).toBeHidden();
    await expect(page.locator('main > .keyboard-connection')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(modes).toBeVisible();
  await modes.getByRole('button', { name: 'Words', exact: true }).click();
  await expect(page.getByLabel('Word limit', { exact: true })).toBeVisible();
});

test('bundled data attribution and license are readable without an external request', async ({ page, request }) => {
  const noticeUrl = await page.getByRole('link', { name: 'Vocabulary attribution', exact: true }).getAttribute('href');
  const licenseUrl = await page.getByRole('link', { name: 'CC BY-SA 4.0 data', exact: true }).getAttribute('href');
  if (!noticeUrl || !licenseUrl) throw new Error('Missing vocabulary license links.');
  const notice = await request.get(noticeUrl);
  const license = await request.get(licenseUrl);
  expect(notice.ok()).toBe(true);
  expect(license.ok()).toBe(true);
  expect(await notice.text()).toContain('072bbed282316a23651aa7068c7173aa7898cf80');
  expect(await license.text()).toContain('Attribution-ShareAlike 4.0 International');
});

test('mode selection is keyboard-operable, preserves inactive choices, and locks running configuration', async ({ page }) => {
  await page.getByLabel('Duration', { exact: true }).selectOption('120');
  await page.getByRole('button', { name: 'Words', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Words', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Words', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Word limit', { exact: true })).toHaveValue('25');
  expect(await page.getByLabel('Word limit', { exact: true }).locator('option').evaluateAll(
    (options) => options.map((option) => option.getAttribute('value'))
  )).toEqual(['10', '25', '50', '100']);
  await page.getByLabel('Word limit', { exact: true }).selectOption('50');
  await page.getByRole('button', { name: 'Timed', exact: true }).click();
  await expect(page.getByLabel('Duration', { exact: true })).toHaveValue('120');
  await page.getByRole('button', { name: 'Words', exact: true }).click();
  await expect(page.getByLabel('Word limit', { exact: true })).toHaveValue('50');
  await start(page);
  await page.keyboard.press('Backspace');
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  await page.keyboard.type('y');
  for (const name of ['Timed', 'Words']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  for (const name of ['Word limit', 'Vocabulary']) await expect(page.getByLabel(name, { exact: true })).toBeDisabled();
  for (const name of ['Punctuation', 'Numbers']) await expect(page.getByRole('checkbox', { name, exact: true })).toBeDisabled();
  await expect(page.getByText('Restart to change mode or settings.')).toBeVisible();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.getByLabel('Word limit', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('Word limit', { exact: true })).toHaveValue('50');
});

for (const seconds of [15, 30, 60, 120]) {
  test(`Timed ${seconds}s measures progress, expires while unfocused, and freezes exact final metrics`, async ({ page }) => {
    await page.getByLabel('Duration', { exact: true }).selectOption(String(seconds));
    await start(page);
    await page.keyboard.type('you ');
    await expect.poll(() => intervalCount(page)).toBe(1);
    await page.clock.runFor(seconds * 500);
    await expect(progress(page)).toHaveAttribute('value', String(seconds / 2));
    await expect(progress(page)).toHaveAttribute('max', String(seconds));
    await expect(progress(page)).toHaveAccessibleDescription(`${Math.floor(seconds / 2)} / ${seconds} seconds`);
    await page.keyboard.press('Tab');
    await page.clock.fastForward(seconds * 1000);
    await expect(panel(page)).toHaveAttribute('data-status', 'completed');
    await expect.poll(() => intervalCount(page)).toBe(0);
    await expect(progress(page)).toHaveAttribute('value', String(seconds));
    const metrics = await page.locator('.metric-value').allTextContents();
    expect(metrics).toEqual([String(Math.round((4 / 5) / (seconds / 60))), '100.0%']);
    await input(page).focus();
    await page.keyboard.type('extra');
    await page.keyboard.press('Backspace');
    await page.clock.fastForward(100_000);
    await expect(page.locator('.metric-value')).toHaveText(metrics);
    await expect(page.locator('.typing-character.correct')).toHaveCount(4);
    await expect(page.locator('.keyboard-key:not([data-feedback="neutral"])')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Time is up');
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    await expect(panel(page)).toHaveAttribute('data-status', 'ready');
    await expect(progress(page)).toHaveAttribute('value', '0');
    await expect(page.getByLabel('Duration', { exact: true })).toHaveValue(String(seconds));
  });
}

test('a key at the exact timed deadline cannot count even before the refresh callback', async ({ page }) => {
  await page.getByLabel('Duration', { exact: true }).selectOption('15');
  await start(page);
  const startedAt = await page.evaluate(() => performance.now());
  await page.keyboard.type('y');
  // Keep interval callbacks from running so the input path must enforce expiry.
  await page.evaluate((deadline) => { performance.now = () => deadline; }, startedAt + 15_000);
  await page.keyboard.type('o');
  await expect(panel(page)).toHaveAttribute('data-status', 'completed');
  await expect(page.locator('.typing-character.correct')).toHaveCount(1);
  await expect(progress(page)).toHaveAttribute('value', '15');
});

test('timed refill preserves target prefix, input, progress, and active-character visibility', async ({ page }) => {
  await page.getByLabel('Duration', { exact: true }).selectOption('15');
  const original = await target(page);
  await start(page);
  await page.keyboard.type(original);
  const extended = await target(page);
  expect(extended.startsWith(`${original} `)).toBe(true);
  expect(extended.length).toBeGreaterThan(original.length);
  await expect(panel(page)).toHaveAttribute('data-status', 'running');
  await expect(page.locator('.typing-character.correct')).toHaveCount(original.length);
  await expect(page.locator('.metric-value').nth(1)).toHaveText('100.0%');
  await expect(progress(page)).toHaveAttribute('value', '0');
  await page.keyboard.type(' you');
  await expect(page.locator('.typing-character.correct')).toHaveCount(original.length + 4);
  const visible = await page.locator('#practice-target').evaluate((element) => {
    const active = element.querySelector('.typing-character.active');
    if (!active) return false;
    const bounds = element.getBoundingClientRect();
    const caret = active.getBoundingClientRect();
    return element.scrollTop > 0 && caret.top >= bounds.top && caret.bottom <= bounds.bottom;
  });
  expect(visible).toBe(true);
  await page.clock.runFor(15_000);
  await expect(panel(page)).toHaveAttribute('data-status', 'completed');
});

for (const limit of [10, 25, 50, 100]) {
  test(`Words ${limit} completes the full modified target and counts only base words`, async ({ page }) => {
    await page.getByRole('button', { name: 'Words', exact: true }).click();
    await page.getByLabel('Word limit', { exact: true }).selectOption(String(limit));
    await page.getByRole('checkbox', { name: 'Punctuation', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Numbers', exact: true }).check();
    const exercise = await target(page);
    expect(exercise.split(' ').filter((word) => /[a-z]/.test(word))).toHaveLength(limit);
    expect(exercise).toMatch(/^you, 0 you,/);
    await start(page);
    await page.keyboard.type('you, ');
    await expect(progress(page)).toHaveAttribute('value', '1');
    await page.keyboard.press('Backspace');
    await expect(progress(page)).toHaveAttribute('value', '0');
    await page.keyboard.type(' 0 ');
    await expect(progress(page)).toHaveAttribute('value', '1');
    await page.keyboard.type(exercise.slice(7, -1));
    await expect(progress(page)).toHaveAttribute('value', String(limit - 1));
    await page.keyboard.type('x');
    await expect(panel(page)).toHaveAttribute('data-status', 'completed');
    await expect(progress(page)).toHaveAccessibleName('Completed words');
    await expect(progress(page)).toHaveAttribute('value', String(limit));
    await expect(progress(page)).toHaveAccessibleDescription(`${limit} / ${limit} words`);
    await expect(page.locator('.typing-character.incorrect')).toHaveCount(1);
  });
}

test('vocabulary tiers and independent modifiers regenerate a valid ready exercise', async ({ page }) => {
  await page.getByRole('button', { name: 'Words', exact: true }).click();
  await page.getByLabel('Word limit', { exact: true }).selectOption('10');
  for (const tier of ['200', '1000', '5000']) {
    await page.getByLabel('Vocabulary', { exact: true }).selectOption(tier);
    await expect(panel(page)).toHaveAttribute('data-status', 'ready');
    expect((await target(page)).split(' ')).toHaveLength(10);
  }
  await page.getByRole('checkbox', { name: 'Numbers', exact: true }).check();
  expect(await target(page)).toMatch(/^you 0 you/);
  expect(await target(page)).not.toMatch(/[,"]/);
  await page.getByRole('checkbox', { name: 'Punctuation', exact: true }).check();
  expect(await target(page)).toMatch(/^you, 0 you,/);
  await page.getByRole('checkbox', { name: 'Numbers', exact: true }).uncheck();
  expect(await target(page)).toMatch(/^you, you,/);
  expect(await target(page)).not.toMatch(/\d/);
});

test('restart generates a fresh exercise with the same frozen settings and resets metrics', async ({ page }) => {
  await page.getByLabel('Vocabulary', { exact: true }).selectOption('1000');
  const original = await target(page);
  await start(page);
  await page.keyboard.type('y');
  await page.evaluate(() => { Math.random = () => 0.5; });
  await page.getByRole('button', { name: 'Restart', exact: true }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(input(page)).toBeFocused();
  expect(await target(page)).not.toBe(original);
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('.metric-value')).toHaveText(['—', '—']);
  await expect(page.getByLabel('Vocabulary', { exact: true })).toHaveValue('1000');
  await expect(page.getByLabel('Duration', { exact: true })).toHaveValue('30');
});

test('generation errors are explicit and recoverable without success-shaped completion', async ({ page }) => {
  await page.evaluate(() => { Math.random = () => NaN; });
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('random source');
  await expect(panel(page)).toHaveAttribute('data-status', 'error');
  await expect(page.getByRole('button', { name: 'Start typing', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Words', exact: true })).toBeEnabled();
  await page.evaluate(() => { Math.random = () => 0; });
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  await start(page);
  await page.keyboard.type('you');
  await expect(page.locator('.metric-value').nth(1)).toHaveText('100.0%');
});

test('refill errors stop capture and timers without claiming completion', async ({ page }) => {
  await page.getByLabel('Duration', { exact: true }).selectOption('15');
  const original = await target(page);
  await start(page);
  await page.evaluate(() => { Math.random = () => NaN; });
  await page.keyboard.type(original);
  await expect(panel(page)).toHaveAttribute('data-status', 'error');
  await expect(page.getByRole('alert')).toContainText('random source');
  const count = await page.locator('.typing-character.correct').count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(original.length);
  const metrics = await page.locator('.metric-value').allTextContents();
  await page.keyboard.type('extra');
  await page.clock.runFor(60_000);
  await expect(page.locator('.typing-character.correct')).toHaveCount(count);
  await expect(page.locator('.metric-value')).toHaveText(metrics);
  await expect(page.getByRole('status')).toContainText('Practice stopped');
  await expect(input(page)).toBeDisabled();
  await expect(page.locator('.typing-character.active')).toHaveCount(0);
  await expect.poll(() => intervalCount(page)).toBe(0);
  await expect(page.locator('.keyboard-key:not([data-feedback="neutral"])')).toHaveCount(0);
});
