import { expect, test, type Page } from '@playwright/test';
import { skipOnboarding, PREFERENCES_KEY, DEFAULT_PREFERENCES } from './support';
import type { SessionRecord } from '../src/lib/storage/session-history';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Typing practice', exact: true });
const capture = (page: Page) => page.locator('#practice-input');
const target = async (page: Page) => {
  const text = await page.locator('#practice-target .sr-only').textContent();
  if (!text) throw new Error('Missing target.');
  return text;
};

async function records(page: Page): Promise<SessionRecord[]> {
  return page.evaluate(async () => {
    const path = '/src/lib/storage/session-history.ts';
    const { SessionHistory }: typeof import('../src/lib/storage/session-history') = await import(path);
    const history = new SessionHistory();
    try { return await history.read(); } finally { history.close(); }
  });
}

test.beforeEach(async ({ page }) => {
  await skipOnboarding(page);
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/');
});

test('Quote preserves its snapshot on Restart and changes on Next, with local attribution', async ({ page, request }) => {
  const external: string[] = [];
  page.on('request', (req) => { if (!req.url().startsWith('http://127.0.0.1:4175')) external.push(req.url()); });
  await button(page, 'Quote').focus();
  await page.keyboard.press('Enter');
  await expect(button(page, 'Quote')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Vocabulary', { exact: true })).toHaveCount(0);
  const original = await target(page);
  const id = await page.locator('[data-quote-id]').getAttribute('data-quote-id');
  await button(page, 'Start typing').click();
  await page.keyboard.type('x');
  await expect(button(page, 'Next quote')).toBeDisabled();
  for (const mode of ['Timed', 'Words', 'Quote', 'Custom', 'Zen']) await expect(button(page, mode)).toBeDisabled();
  await button(page, 'Restart').click();
  expect(await target(page)).toBe(original);
  await expect(button(page, 'Restart')).toBeFocused();
  await button(page, 'Next quote').click();
  await expect(page.locator('[data-quote-id]')).not.toHaveAttribute('data-quote-id', id!);
  await expect(button(page, 'Next quote')).toBeFocused();
  const href = await page.getByRole('link', { name: 'Quote attribution', exact: true }).getAttribute('href');
  if (!href) throw new Error('No bundled quote notice.');
  const notice = await request.get(href);
  expect(notice.ok()).toBe(true);
  expect(await notice.text()).toContain('public domain');
  expect(external).toEqual([]);
});

test('Quote completes at its final position even with an error and saves exactly once', async ({ page }) => {
  await button(page, 'Quote').click();
  const text = await target(page);
  await button(page, 'Start typing').click();
  await page.keyboard.type(text.slice(0, -1));
  await page.clock.runFor(60_000);
  await page.keyboard.type(text.at(-1) === 'x' ? 'z' : 'x');
  await expect(panel(page)).toHaveAttribute('data-status', 'completed');
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', String(text.length));
  await expect.poll(async () => (await records(page)).length).toBe(1);
  const [record] = await records(page);
  expect(record).toMatchObject({ version: 3, language: 'en', scoringVersion: 'committed-grapheme-v1', mode: 'quote', targetCharacters: text.length, totalAttempts: text.length });
  await page.keyboard.type('extra');
  expect(await records(page)).toEqual([record]);
  await button(page, 'Stats').click();
  await expect(page.getByRole('table')).toContainText(`Quote / ${text.length} characters`);
});

test('Custom native editor normalizes a reviewed target without starting or capturing editor keys', async ({ page }) => {
  await button(page, 'Custom').click();
  const editor = page.getByRole('textbox', { name: 'Custom text', exact: true });
  await expect(button(page, 'Apply text')).toBeDisabled();
  await expect(page.locator('.session-note')).toHaveText('Paste your text and choose Apply text to get started.');
  await editor.fill(' \u201cHello\u201d\r\nworld\t123\u2026 ');
  await editor.press('End');
  await editor.press('Enter');
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  expect(await records(page)).toEqual([]);
  await button(page, 'Apply text').click();
  await expect(button(page, 'Apply text')).toBeFocused();
  expect(await target(page)).toBe('"Hello" world 123...');
  await expect(page.getByRole('status')).toContainText(['normalized', 'Start typing']);
  await button(page, 'Start typing').click();
  await page.keyboard.type('"');
  await expect(button(page, 'Edit text')).toBeDisabled();
  await button(page, 'Restart').click();
  expect(await target(page)).toBe('"Hello" world 123...');
  await button(page, 'Edit text').click();
  await editor.fill('unsupported 漢');
  await expect(editor).toHaveAttribute('aria-invalid', 'true');
  await expect(button(page, 'Apply text')).toBeDisabled();
  await expect(button(page, 'Start typing')).toHaveCount(0);
  await button(page, 'Cancel editing').click();
  expect(await target(page)).toBe('"Hello" world 123...');
});

test('Custom preserves draft on mode switches, clears on view exit/reload/defaults, and stores no content', async ({ page }) => {
  const marker = 'Private-custom-marker-739184';
  await button(page, 'Custom').click();
  await page.getByLabel('Custom text', { exact: true }).fill(marker);
  await button(page, 'Apply text').click();
  await button(page, 'Words').click();
  await button(page, 'Custom').click();
  expect(await target(page)).toBe(marker);
  await button(page, 'Start typing').click();
  await page.keyboard.type(marker);
  await expect.poll(async () => (await records(page)).length).toBe(1);
  const saved = await records(page);
  expect(JSON.stringify(saved)).not.toContain(marker);
  const preferences = await page.evaluate((key) => localStorage.getItem(key), PREFERENCES_KEY);
  expect(preferences).not.toContain(marker);
  await button(page, 'Stats').click();
  await button(page, 'Practice').click();
  await expect(page.getByLabel('Custom text', { exact: true })).toHaveValue('');
  await expect(button(page, 'Custom')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Custom text', { exact: true })).toHaveValue('');
  await page.getByLabel('Custom text', { exact: true }).fill(marker);
  await button(page, 'Timed').click();
  await button(page, 'Restore defaults').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restore defaults', exact: true }).click();
  await button(page, 'Custom').click();
  await expect(page.getByLabel('Custom text', { exact: true })).toHaveValue('');
});

test('Custom rejects limits/unsupported characters without silently changing the draft; Clear releases targets', async ({ page }) => {
  await button(page, 'Custom').click();
  const editor = page.getByLabel('Custom text', { exact: true });
  for (const text of ['x'.repeat(10_001), '…'.repeat(3334), 'a\u200bb', '漢']) {
    await editor.fill(text);
    await expect(editor).toHaveValue(text);
    await expect(button(page, 'Apply text')).toBeDisabled();
    await expect(editor).toHaveAttribute('aria-invalid', 'true');
  }
  await editor.fill('<b>literal</b>');
  await button(page, 'Apply text').click();
  expect(await target(page)).toBe('<b>literal</b>');
  await expect(page.locator('#practice-target b')).toHaveCount(0);
  await button(page, 'Clear text').click();
  await expect(editor).toHaveValue('');
  await expect(capture(page)).toHaveCount(0);
});

test('Zen only updates writing, installs no practice interval or audio, and stops manually', async ({ page }) => {
  await page.evaluate(({ key, defaults }) => localStorage.setItem(key, JSON.stringify({
    version: 5, settings: { ...defaults, onboardingComplete: true, mode: 'zen', soundEnabled: true, showLiveStats: true }
  })), { key: PREFERENCES_KEY, defaults: DEFAULT_PREFERENCES });
  await page.reload();
  await page.evaluate(() => {
    const counts = { intervals: 0, audio: 0 };
    const original = window.setInterval.bind(window);
    window.setInterval = (handler, timeout, ...args) => {
      if (timeout === 100) counts.intervals++;
      return original(handler, timeout, ...args);
    };
    const OriginalAudio = window.AudioContext;
    window.AudioContext = class extends OriginalAudio { constructor() { super(); counts.audio++; } };
    Object.defineProperty(window, 'zenCounts', { value: counts });
  });
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.locator('.metric-value')).toHaveCount(0);
  await expect(button(page, 'Stop')).toBeDisabled();
  await button(page, 'Focus writing').click();
  await expect(capture(page)).toHaveAccessibleName('Zen writing');
  await page.keyboard.press('Backspace');
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  await page.keyboard.type('a'.repeat(250));
  await expect(panel(page)).toHaveAttribute('data-status', 'running');
  await expect(page.locator('.metric-value')).toHaveCount(0);
  await expect(page.locator('.keyboard-visualizer')).toHaveCount(0);
  await expect(page.locator('.typing-character')).toHaveCount(0);
  await expect(page.locator('.zen-caret')).toHaveCSS('animation-name', 'none');
  const before = await panel(page).innerText();
  await page.keyboard.press('Tab');
  await page.clock.runFor(60_000);
  expect(await panel(page).innerText()).toBe(before);
  expect(await page.evaluate(() => Reflect.get(window, 'zenCounts'))).toEqual({ intervals: 0, audio: 0 });
  await button(page, 'Stop').click();
  await expect(page.getByRole('heading', { name: 'Zen stopped', exact: true })).toBeFocused();
  await expect(page.locator('.metric-value')).toHaveText(['50', 'Not applicable - free writing']);
  await expect.poll(async () => (await records(page)).length).toBe(1);
  expect((await records(page))[0]).toMatchObject({ mode: 'zen', retainedCharacters: 250, accuracy: null, correctAttempts: null, missedKeys: {}, wpm: 50 });
  await button(page, 'Stats').click();
  await expect(page.getByRole('table')).toContainText('Zen');
  await expect(page.getByRole('table')).toContainText('Not applicable');
  await button(page, 'Practice').click();
  await expect(page.getByLabel('Typing sound', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Show live WPM and accuracy')).toBeChecked();
});

test('Zen bounds rendered writing, edits across its window, saves full counts on keyboard Stop', async ({ page }) => {
  await button(page, 'Zen').click();
  await button(page, 'Focus writing').click();
  await capture(page).evaluate((element: HTMLInputElement) => {
    element.value = 'a'.repeat(2501);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: element.value }));
  });
  await expect(page.locator('.zen-writing')).toHaveText('a'.repeat(2000));
  await capture(page).evaluate((element: HTMLInputElement) => {
    element.value = element.value.slice(0, -600);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
  });
  await expect(page.locator('.zen-writing')).toHaveText('a'.repeat(1901));
  await page.clock.runFor(60_000);
  await button(page, 'Stop').focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await records(page)).length).toBe(1);
  expect((await records(page))[0]).toMatchObject({ mode: 'zen', totalAttempts: 2501, retainedCharacters: 1901, wpm: 380 });
});

test('Zen ready/restarted/reloaded runs never save and mode changes release writing', async ({ page }) => {
  await button(page, 'Zen').click();
  await button(page, 'Focus writing').click();
  await page.keyboard.type('private-zen-marker');
  await button(page, 'Restart').click();
  await expect(page.locator('.zen-writing')).toHaveText('');
  expect(await records(page)).toEqual([]);
  await button(page, 'Words').click();
  await button(page, 'Zen').click();
  await expect(page.locator('.zen-writing')).toHaveText('');
  await button(page, 'Focus writing').click();
  await page.keyboard.type('another-private-marker');
  await page.reload();
  await expect(page.locator('.zen-writing')).toHaveText('');
  expect(await records(page)).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('private-marker');
});

test('new modes reject capture paste/composition/repeat/shortcuts and remain responsive at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  for (const mode of ['Quote', 'Custom', 'Zen']) {
    await button(page, mode).click();
    if (mode === 'Custom') {
      await page.getByLabel('Custom text', { exact: true }).fill('target');
      await button(page, 'Apply text').click();
    }
    await button(page, mode === 'Zen' ? 'Focus writing' : 'Start typing').click();
    await capture(page).evaluate((element) => {
      for (const options of [{ repeat: true }, { isComposing: true }, { ctrlKey: true }]) {
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true, ...options }));
      }
      element.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertFromPaste', data: 'paste', bubbles: true, cancelable: true }));
    });
    await expect(panel(page)).toHaveAttribute('data-status', 'ready');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.keyboard.press('Tab');
    await expect(capture(page)).not.toBeFocused();
  }
});

test('new-mode failed saves retain only numeric records across restart/navigation and retry once', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/src/lib/storage/session-history.ts';
    const errors = '/src/lib/storage/errors.ts';
    const { SessionHistory }: typeof import('../src/lib/storage/session-history') = await import(path);
    const { StorageError }: typeof import('../src/lib/storage/errors') = await import(errors);
    const original = SessionHistory.prototype.save;
    let fail = true;
    const submitted: unknown[] = [];
    SessionHistory.prototype.save = function (record) {
      submitted.push(record);
      if (fail) return Promise.reject(new StorageError('Synthetic save denial.'));
      return original.call(this, record);
    };
    Object.defineProperty(window, 'submittedRecords', { value: submitted });
    Object.defineProperty(window, 'allowSaves', { value: () => { fail = false; } });
  });
  const marker = 'Private-pending-marker-348923';
  await button(page, 'Custom').click();
  await page.getByLabel('Custom text', { exact: true }).fill(marker);
  await button(page, 'Apply text').click();
  await button(page, 'Start typing').click();
  await page.keyboard.type(marker);
  await expect(page.getByRole('alert')).toContainText('Synthetic save denial');
  await button(page, 'Restart').click();
  await button(page, 'Zen').click();
  await button(page, 'Focus writing').click();
  await page.keyboard.type(marker);
  await page.clock.runFor(60_000);
  await button(page, 'Stop').click();
  await expect(page.getByRole('alert')).toHaveCount(2);
  await button(page, 'Stats').click();
  await expect(button(page, 'Clear history')).toBeDisabled();
  expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'submittedRecords')))).not.toContain(marker);
  expect(await records(page)).toEqual([]);
  await page.evaluate(() => Reflect.get(window, 'allowSaves')());
  await page.getByRole('button', { name: 'Retry session save', exact: true }).first().click();
  await page.getByRole('button', { name: 'Retry session save', exact: true }).click();
  await expect.poll(async () => (await records(page)).length).toBe(2);
  expect((await records(page)).map((record) => record.mode).sort()).toEqual(['custom', 'zen']);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
