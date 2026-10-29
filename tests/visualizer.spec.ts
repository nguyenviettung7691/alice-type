import { expect, test, type Page } from '@playwright/test';
import { ALICE_LAYOUT } from '../src/lib/keyboard/alice-layout';
import { skipOnboarding } from './support';

const input = (page: Page) => page.getByRole('textbox', { name: 'Typing practice', exact: true });
const diagram = (page: Page) => page.getByRole('img', { name: 'Generic Alice keyboard', exact: true });
const key = (page: Page, code: string) => page.locator(`.keyboard-key[data-code="${code}"]`);
const highlighted = (page: Page) => page.locator('.keyboard-key:not([data-feedback="neutral"])');
const scrollArea = (page: Page) => page.getByRole('region', { name: 'Keyboard diagram scroll area' });
const target = (page: Page) => page.locator('#practice-target .sr-only').textContent().then((text) => {
  if (!text) throw new Error('Missing exercise target.');
  return text;
});

async function start(page: Page) {
  await page.getByRole('button', { name: 'Start typing' }).click();
  await expect(input(page)).toBeFocused();
}

type KeyOptions = Pick<KeyboardEventInit, 'repeat' | 'ctrlKey' | 'altKey' | 'metaKey' | 'isComposing'>;

async function dispatchKey(page: Page, key: string, code: string, options: KeyOptions = {}) {
  return input(page).evaluate((element: HTMLInputElement, init) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    element.dispatchEvent(event);
    if (!event.defaultPrevented && !init.ctrlKey && !init.altKey && !init.metaKey && !init.isComposing
      && !init.repeat && /^[\x20-\x7e]$/.test(init.key)) {
      element.value += init.key;
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: init.key }));
    }
    return event.defaultPrevented;
  }, { key, code, ...options });
}

test.beforeEach(async ({ page }) => {
  await skipOnboarding(page);
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/');
});

test('renders the generic split profile as a named non-interactive image', async ({ page }) => {
  await expect(diagram(page)).toBeVisible();
  await expect(diagram(page)).toHaveAccessibleDescription(/not a detected device/);
  await expect(page.getByText(/Generic Alice layout/)).toBeVisible();
  await expect(page.getByText('Neutral', { exact: true })).toBeVisible();
  await expect(page.locator('.keyboard-legend')).toContainText('Correct press');
  await expect(page.locator('.keyboard-legend')).toContainText('Mismatch');
  await expect(diagram(page).locator('.keyboard-key')).toHaveCount(ALICE_LAYOUT.length);
  await expect(diagram(page).locator('[tabindex], [role="button"], [aria-live]')).toHaveCount(0);
  await expect(key(page, 'Space').locator('rect')).toHaveCount(2);
  await expect(highlighted(page)).toHaveCount(0);
  await page.keyboard.press('KeyS');
  await expect(highlighted(page)).toHaveCount(0);
});

test('shows correct input and a shifted mismatch on the physical keys with distinct markers', async ({ page }) => {
  await start(page);
  await page.keyboard.type('yX');
  await expect(key(page, 'KeyY')).toHaveAttribute('data-feedback', 'correct');
  await expect(key(page, 'KeyX')).toHaveAttribute('data-feedback', 'incorrect');
  await expect(key(page, 'KeyY').locator('.feedback-marker')).toHaveText('+');
  await expect(key(page, 'KeyX').locator('.feedback-marker')).toHaveText('!');
  await expect(key(page, 'KeyY').locator('rect')).toHaveCSS('fill', 'rgb(255, 93, 0)');
  await expect(key(page, 'KeyX').locator('rect')).toHaveCSS('fill', 'rgb(255, 100, 100)');
  await expect(key(page, 'KeyX').locator('rect')).toHaveCSS('stroke-dasharray', '4px, 2px');
  await expect(page.locator('.metric-value').nth(1)).toHaveText('50.0%');
  await page.keyboard.press('Backspace');
  await expect(key(page, 'Backspace')).toHaveAttribute('data-feedback', 'neutral');
  await page.keyboard.type('o');
  await expect(key(page, 'KeyO')).toHaveAttribute('data-feedback', 'correct');
  await expect(page.locator('.metric-value').nth(1)).toHaveText('66.7%');
  await expect(input(page)).toHaveValue('');
});

test('expires feedback at 300 ms and keeps independent key lifetimes', async ({ page }) => {
  await start(page);
  await page.keyboard.type('y');
  await page.clock.runFor(200);
  await page.keyboard.type('o');
  await page.clock.runFor(99);
  await expect(key(page, 'KeyY')).toHaveAttribute('data-feedback', 'correct');
  await page.clock.runFor(1);
  await expect(key(page, 'KeyY')).toHaveAttribute('data-feedback', 'neutral');
  await expect(key(page, 'KeyO')).toHaveAttribute('data-feedback', 'correct');
  await page.clock.runFor(199);
  await expect(key(page, 'KeyO')).toHaveAttribute('data-feedback', 'correct');
  await page.clock.runFor(1);
  await expect(highlighted(page)).toHaveCount(0);
});

test('replaces same-code feedback without an old timer clearing the newer state', async ({ page }) => {
  await start(page);
  await page.keyboard.type('y');
  await page.clock.runFor(200);
  await page.keyboard.type('y');
  await expect(key(page, 'KeyY')).toHaveAttribute('data-feedback', 'incorrect');
  await page.clock.runFor(100);
  await expect(key(page, 'KeyY')).toHaveAttribute('data-feedback', 'incorrect');
  await page.clock.runFor(199);
  await expect(key(page, 'KeyY')).toHaveAttribute('data-feedback', 'incorrect');
  await page.clock.runFor(1);
  await expect(key(page, 'KeyS')).toHaveAttribute('data-feedback', 'neutral');
});

test('uses code for position, character for correctness, and accepts unmapped or absent codes', async ({ page }) => {
  await start(page);
  expect(await dispatchKey(page, 'y', 'KeyQ')).toBe(false);
  await expect(key(page, 'KeyQ')).toHaveAttribute('data-feedback', 'correct');
  await expect(key(page, 'KeyY')).toHaveAttribute('data-feedback', 'neutral');
  await page.clock.runFor(300);
  expect(await dispatchKey(page, 'o', 'Unidentified')).toBe(false);
  expect(await dispatchKey(page, 'u', '')).toBe(false);
  await expect(highlighted(page)).toHaveCount(0);
  await expect(page.locator('.typing-character.correct')).toHaveCount(3);
  await expect(page.locator('.metric-value').nth(1)).toHaveText('100.0%');
});

test('maps spaces and punctuation and lights both spacebar shapes', async ({ page }) => {
  await start(page);
  await page.keyboard.type('you ');
  await expect(key(page, 'Space')).toHaveAttribute('data-feedback', 'correct');
  await expect(key(page, 'Space').locator('.feedback-marker')).toHaveText(['+', '+']);
  await page.getByRole('button', { name: 'Restart' }).click();
  await page.getByRole('checkbox', { name: 'Punctuation', exact: true }).check();
  await start(page);
  await page.keyboard.type('you,');
  await expect(key(page, 'Comma')).toHaveAttribute('data-feedback', 'correct');
});

test('ignores repeat, shortcuts, non-printable keys, and composition without extending feedback', async ({ page }) => {
  await start(page);
  await page.keyboard.type('y');
  await page.clock.runFor(200);
  for (const options of [
    { repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }
  ]) {
    expect(await dispatchKey(page, 'y', 'KeyY', options)).toBe(Boolean(options.repeat));
  }
  for (const code of ['ShiftLeft', 'Enter', 'Escape', 'ArrowLeft', 'Tab']) {
    expect(await dispatchKey(page, code, code)).toBe(false);
  }
  await input(page).dispatchEvent('compositionstart');
  expect(await dispatchKey(page, 'y', 'KeyY', { isComposing: true })).toBe(false);
  await input(page).dispatchEvent('compositionend', { data: 'y' });
  await page.clock.runFor(100);
  await expect(highlighted(page)).toHaveCount(0);
  await expect(page.locator('.typing-character.correct')).toHaveCount(1);
  await expect(page.locator('.metric-value').nth(1)).toHaveText('100.0%');
});

test('clears feedback on blur and restart without stale callbacks or focus changes', async ({ page }) => {
  await start(page);
  await page.keyboard.type('yo');
  await expect(highlighted(page)).toHaveCount(2);
  await page.keyboard.press('Tab');
  await expect(highlighted(page)).toHaveCount(0);
  await expect(input(page)).not.toBeFocused();
  await page.keyboard.type('x');
  await expect(highlighted(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume typing' }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('u');
  await expect(key(page, 'KeyU')).toHaveAttribute('data-feedback', 'correct');
  await page.getByRole('button', { name: 'Restart' }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(input(page)).toBeFocused();
  await expect(highlighted(page)).toHaveCount(0);
  await page.clock.runFor(100);
  await page.keyboard.type('y');
  await page.clock.runFor(200);
  await expect(key(page, 'KeyY')).toHaveAttribute('data-feedback', 'correct');
  await page.clock.runFor(100);
  await expect(highlighted(page)).toHaveCount(0);
});

test('completion clears all feedback immediately and further editing cannot flash keys', async ({ page }) => {
  await page.getByRole('button', { name: 'Words', exact: true }).click();
  const exercise = await target(page);
  await start(page);
  await page.keyboard.type(exercise.slice(0, -1));
  await expect(highlighted(page)).not.toHaveCount(0);
  await page.keyboard.type(exercise.slice(-1));
  await expect(highlighted(page)).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText(/Session complete/);
  await page.keyboard.type('extra');
  await page.keyboard.press('Backspace');
  await expect(highlighted(page)).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(highlighted(page)).toHaveCount(0);
  await expect(page.locator('.metric-value').nth(1)).toHaveText('100.0%');
});

test('cancels feedback timeouts on replacement, blur, restart, completion, and teardown', async ({ page }) => {
  await page.addInitScript(() => {
    const timers = new Set<number>();
    const originalSet = window.setTimeout.bind(window);
    const originalClear = window.clearTimeout.bind(window);
    window.setTimeout = (handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const id = originalSet(handler, timeout, ...args);
      if (timeout === 300) timers.add(id);
      return id;
    };
    window.clearTimeout = (id?: number) => {
      if (id !== undefined) timers.delete(id);
      originalClear(id);
    };
    Object.defineProperty(window, 'feedbackTimeoutCount', { get: () => timers.size });
  });
  await page.goto('/tests/fixtures/practice.html');
  const timeoutCount = () => page.evaluate(() => Reflect.get(window, 'feedbackTimeoutCount'));
  await start(page);
  await page.keyboard.type('yy');
  expect(await timeoutCount()).toBe(1);
  await page.keyboard.type('u');
  expect(await timeoutCount()).toBe(2);
  await page.keyboard.press('Tab');
  expect(await timeoutCount()).toBe(0);
  await page.getByRole('button', { name: 'Resume typing' }).click();
  await page.keyboard.type(' ');
  expect(await timeoutCount()).toBe(1);
  await page.getByRole('button', { name: 'Restart' }).evaluate((button: HTMLButtonElement) => button.click());
  expect(await timeoutCount()).toBe(0);
  await page.keyboard.type(await target(page));
  expect(await timeoutCount()).toBe(0);
  await page.getByRole('button', { name: 'Restart' }).evaluate((button: HTMLButtonElement) => button.click());
  await page.keyboard.type('y');
  expect(await timeoutCount()).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('unmount-practice')));
  await expect(diagram(page)).toHaveCount(0);
  expect(await timeoutCount()).toBe(0);
});

for (const width of [1440, 768, 320]) {
  test(`keeps readable keys and contained keyboard-accessible scrolling at ${width}px`, async ({ page }) => {
    await page.clock.resume();
    await page.setViewportSize({ width, height: 900 });
    await expect(diagram(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('.practice-panel').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await diagram(page).evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(640);
    if (width >= 768) {
      await expect(scrollArea(page)).not.toHaveAttribute('tabindex');
    } else {
      await expect(scrollArea(page)).toHaveAttribute('tabindex', '0');
      await scrollArea(page).focus();
      await expect(scrollArea(page)).toHaveCSS('outline-style', 'solid');
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => scrollArea(page).evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      await expect(page.getByRole('status')).toHaveText(/Press Start typing/);
    }
  });
}

test('removes the scroll focus stop when resizing to desktop and respects reduced motion', async ({ page }) => {
  await page.clock.resume();
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(scrollArea(page)).toHaveAttribute('tabindex', '0');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(scrollArea(page)).not.toHaveAttribute('tabindex');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page);
  await page.keyboard.type('x');
  await expect(key(page, 'KeyX').locator('.feedback-marker')).toHaveText('!');
  await expect(key(page, 'KeyX').locator('rect')).toHaveCSS('animation-name', 'none');
});
