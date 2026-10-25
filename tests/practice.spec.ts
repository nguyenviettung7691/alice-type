import { expect, test, type Page } from '@playwright/test';
import { PRACTICE_TEXT } from '../src/lib/typing/typing-engine';

const input = (page: Page) => page.getByRole('textbox', { name: 'Typing practice', exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Typing practice', exact: true });
const characters = (page: Page) => page.locator('.typing-character');
const values = (page: Page) => page.locator('.metric-value');

async function start(page: Page) {
  await page.getByRole('button', { name: 'Start typing' }).click();
  await expect(input(page)).toBeFocused();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('starts without autofocus and supports keyboard-only entry, correction, and Tab escape', async ({ page }) => {
  await expect(input(page)).not.toBeFocused();
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  await expect(values(page)).toHaveText(['—', '—']);
  await page.keyboard.press('s');
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  await page.keyboard.press('Tab');
  await expect(input(page)).toBeFocused();
  await page.keyboard.press('Backspace');
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  await page.keyboard.type('Sx');
  await expect(characters(page).nth(0)).toHaveClass(/correct/);
  await expect(characters(page).nth(1)).toHaveClass(/incorrect/);
  await expect(characters(page).nth(2)).toHaveClass(/active/);
  await expect(values(page).nth(1)).toHaveText('50.0%');
  await page.keyboard.press('Backspace');
  await expect(characters(page).nth(1)).toHaveClass(/active/);
  await expect(characters(page).nth(1)).not.toHaveClass(/incorrect/);
  await page.keyboard.type('l');
  await expect(values(page).nth(1)).toHaveText('66.7%');
  await expect(input(page)).toHaveValue('');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Resume typing' })).toBeFocused();
  await page.keyboard.type('ow');
  await expect(characters(page).nth(2)).toHaveClass(/active/);
  await page.keyboard.press('Enter');
  await expect(input(page)).toBeFocused();
  await page.keyboard.type('ow');
  await expect(characters(page).nth(4)).toHaveClass(/active/);
});

test('pointer text selection focuses input and shows non-color feedback', async ({ page }) => {
  await page.locator('label.practice-text').click();
  await expect(input(page)).toBeFocused();
  await page.keyboard.type('x');
  await expect(characters(page).first()).toHaveCSS('text-decoration-line', 'underline');
  await expect(characters(page).nth(1)).toHaveCSS('background-color', 'rgb(255, 93, 0)');
  await expect(page.locator('label.practice-text')).toHaveCSS('outline-style', 'solid');
  await expect(page.getByRole('status')).toHaveText(/Session started/);
});

test('supports keyboard activation of the explicit start control', async ({ page }) => {
  await page.getByRole('button', { name: 'Start typing' }).focus();
  await page.keyboard.press('Enter');
  await expect(input(page)).toBeFocused();
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
});

test('preserves existing input focus when restart is invoked without moving focus', async ({ page }) => {
  await start(page);
  await page.keyboard.type('Sx');
  await page.getByRole('button', { name: 'Restart' }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(input(page)).toBeFocused();
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  await expect(values(page)).toHaveText(['—', '—']);
  await page.keyboard.type('S');
  await expect(values(page).nth(1)).toHaveText('100.0%');
});

test('ignores shortcuts, repeat, composition, and native edits without corrupting the buffer', async ({ page }) => {
  await start(page);
  const result = await input(page).evaluate((element) => {
    const dispatchKey = (key: string, options: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const ignored = [
      dispatchKey('s', { ctrlKey: true }),
      dispatchKey('s', { metaKey: true }),
      dispatchKey('s', { altKey: true }),
      dispatchKey('S', { repeat: true }),
      dispatchKey('S', { isComposing: true }),
      dispatchKey('Tab'),
      dispatchKey('Escape'),
      dispatchKey('ArrowLeft'),
      dispatchKey('Enter')
    ];
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    ignored.push(dispatchKey('S'));
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'S' }));
    const edits = ['insertFromPaste', 'insertFromDrop', 'insertText', 'deleteContentBackward'].map((inputType) => {
      const event = new InputEvent('beforeinput', { inputType, data: 'paste', bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
    return { ignored, edits };
  });
  expect(result.ignored).toEqual(Array(10).fill(false));
  expect(result.edits).toEqual(Array(4).fill(true));
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  await input(page).fill('unsupported native edit');
  await expect(input(page)).toHaveValue('');
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  await page.keyboard.type('S');
  await expect(characters(page).first()).toHaveClass(/correct/);
  await expect(values(page).nth(1)).toHaveText('100.0%');
});

test('refreshes WPM while running, including time away from the input', async ({ page }) => {
  await page.clock.install();
  await start(page);
  await page.keyboard.type('Slow ');
  await page.clock.fastForward(60_000);
  await expect(values(page)).toHaveText(['1', '100.0%']);
  await page.keyboard.press('Tab');
  await page.clock.fastForward(120_000);
  await expect(values(page).nth(0)).toHaveText('0');
  await page.getByRole('button', { name: 'Resume typing' }).click();
  await expect(input(page)).toBeFocused();
  await expect(characters(page).nth(5)).toHaveClass(/active/);
});

test('completes with an error, freezes metrics, ignores further editing, and restarts', async ({ page }) => {
  await page.clock.install();
  await start(page);
  await page.keyboard.type(PRACTICE_TEXT.slice(0, -1));
  await page.clock.fastForward(60_000);
  await page.keyboard.type('x');
  await expect(panel(page)).toHaveAttribute('data-status', 'completed');
  await expect(page.getByRole('status')).toHaveText(/Session complete/);
  await expect(page.locator('.typing-character.active')).toHaveCount(0);
  await expect(characters(page).last()).toHaveClass(/incorrect/);
  const finalValues = await values(page).allTextContents();
  expect(finalValues).toEqual(['15', '98.7%']);
  await page.keyboard.type('extra');
  await page.keyboard.press('Backspace');
  await page.clock.fastForward(120_000);
  await expect(values(page)).toHaveText(finalValues);
  await expect(input(page)).toHaveValue('');
  await page.getByRole('button', { name: 'Restart' }).click();
  await expect(page.getByRole('button', { name: 'Restart' })).toBeFocused();
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  await expect(values(page)).toHaveText(['—', '—']);
  await expect(page.locator('.typing-character.correct, .typing-character.incorrect')).toHaveCount(0);
  await expect(characters(page).first()).toHaveClass(/active/);
  await expect(page.locator('label.practice-text .sr-only')).toHaveText(PRACTICE_TEXT);
  await page.clock.fastForward(10_000);
  await expect(values(page)).toHaveText(['—', '—']);
  await start(page);
  await page.keyboard.type(PRACTICE_TEXT);
  await expect(panel(page)).toHaveAttribute('data-status', 'completed');
  await expect(values(page).nth(1)).toHaveText('100.0%');
});

test('clears its refresh interval on restart, completion, and component teardown', async ({ page }) => {
  await page.addInitScript(() => {
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
    Object.defineProperty(window, 'practiceIntervalCount', { get: () => intervals.size });
  });
  await page.goto('/tests/fixtures/practice.html');
  const intervalCount = () => page.evaluate(() => Reflect.get(window, 'practiceIntervalCount'));
  await expect.poll(intervalCount).toBe(0);
  await start(page);
  await page.keyboard.type('S');
  await expect.poll(intervalCount).toBe(1);
  await page.getByRole('button', { name: 'Restart' }).click();
  await expect.poll(intervalCount).toBe(0);
  await start(page);
  await page.keyboard.type(PRACTICE_TEXT);
  await expect.poll(intervalCount).toBe(0);
  await page.getByRole('button', { name: 'Restart' }).click();
  await start(page);
  await page.keyboard.type('S');
  await expect.poll(intervalCount).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('unmount-practice')));
  await expect(panel(page)).toHaveCount(0);
  await expect.poll(intervalCount).toBe(0);
});

for (const width of [1440, 768, 320]) {
  test(`preserves accessible controls and avoids overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'AliceType', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start typing' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible();
    await start(page);
    await page.keyboard.type('Slow ');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await panel(page).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(input(page)).toHaveAccessibleName('Typing practice');
    await expect(input(page)).toHaveAccessibleDescription(/Time continues when focus moves away/);
  });
}

test('does not emit runtime errors, use persistence, or make external requests', async ({ page }) => {
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4175') externalRequests.push(request.url());
  });
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error('Unexpected persistence'); };
    indexedDB.open = () => { throw new Error('Unexpected database access'); };
  });
  await page.reload();
  await start(page);
  await page.keyboard.type(PRACTICE_TEXT);
  await page.getByRole('button', { name: 'Restart' }).click();
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});
