import { expect, test, type Page } from '@playwright/test';
import { ALICE_LAYOUT } from '../src/lib/keyboard/alice-layout';
import { KEYBOARD_TEST_EFFECTS } from '../src/lib/audio/keyboard-test-sound';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, skipOnboarding } from './support';

const panel = (page: Page) => page.locator('.keyboard-test-panel');
const capture = (page: Page) => page.getByRole('region', { name: 'Keyboard test input', exact: true });
const nav = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const cell = (page: Page, code: string) => panel(page).locator(`.keyboard-key[data-code="${code}"]`);
const soundToggle = (page: Page) => page.getByLabel('Keyboard test sound', { exact: true });
const effectSelect = (page: Page) => page.getByLabel('Test sound effect', { exact: true });
const progress = (page: Page) => page.getByRole('progressbar', { name: 'Keyboard test progress' });

async function focusTest(page: Page) {
  await nav(page, 'Focus keyboard test').click();
  await expect(capture(page)).toBeFocused();
}

type KeyInit = Pick<KeyboardEventInit, 'key' | 'code' | 'repeat' | 'isComposing' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'>;

async function dispatch(page: Page, init: KeyInit, release = true) {
  return capture(page).evaluate((element, { init, release }) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    element.dispatchEvent(event);
    if (release) element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, ...init }));
    return event.defaultPrevented;
  }, { init, release });
}

async function history(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/lib/storage/session-history.ts';
    const { SessionHistory }: typeof import('../src/lib/storage/session-history') = await import(path);
    const history = new SessionHistory();
    try { return await history.read(); } finally { history.close(); }
  });
}

async function installAudioSpy(page: Page) {
  await page.addInitScript(() => {
    const calls = { contexts: 0, plays: 0, stopped: 0, closed: 0, buffers: 0, resumes: 0 };
    Object.defineProperty(window, 'testAudioCalls', { value: calls });
    class AudioContextSpy {
      state = 'suspended';
      sampleRate = 48000;
      destination = {};
      constructor() { calls.contexts += 1; }
      resume() { calls.resumes += 1; this.state = 'running'; return Promise.resolve(); }
      close() { calls.closed += 1; this.state = 'closed'; return Promise.resolve(); }
      createBuffer(_channels: number, length: number) {
        calls.buffers += 1;
        const data = new Float32Array(length);
        return { getChannelData: () => data };
      }
      createBufferSource() {
        return {
          buffer: null, onended: null, connect() {}, disconnect() {},
          start() { calls.plays += 1; }, stop() { calls.stopped += 1; }
        };
      }
    }
    Object.defineProperty(window, 'AudioContext', { value: AudioContextSpy, configurable: true });
  });
}

test.describe('guided keyboard test', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
    await nav(page, 'Keyboard Test').click();
  });

  test('renders the one supported profile with counts, physical guidance, and accessible results', async ({ page }) => {
    await expect(nav(page, 'Keyboard Test')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: 'Keyboard Test', exact: true })).toBeFocused();
    const diagram = page.getByRole('img', { name: 'Generic Alice keyboard test matrix' });
    await expect(diagram).toHaveAccessibleDescription(/not a detected device/);
    await expect(diagram.locator('.keyboard-key')).toHaveCount(ALICE_LAYOUT.length);
    await expect(cell(page, 'Backquote')).toHaveAttribute('data-test-state', 'expected');
    await expect(cell(page, 'Backquote').locator('.feedback-marker')).toHaveText('>');
    await expect(cell(page, 'Space').locator('rect')).toHaveCount(2);
    await expect(cell(page, 'Space').locator('.key-count')).toHaveText(['0', '0']);
    await expect(progress(page)).toHaveAttribute('value', '0');
    await expect(effectSelect(page).locator('option')).toHaveText(KEYBOARD_TEST_EFFECTS.map((effect) => effect.label));
    await expect(soundToggle(page)).not.toBeChecked();
    await page.getByText('Text key results', { exact: true }).click();
    await expect(panel(page).getByRole('listitem')).toHaveCount(ALICE_LAYOUT.length);
    await expect(panel(page).getByRole('listitem').first()).toHaveText('` (Backquote): 0 correct, expected');
    await expect(page.getByRole('region', { name: 'Typing practice', exact: true })).toBeHidden();
  });

  test('completes the full real-key sequence once, shares Space counts, and resets', async ({ page }) => {
    expect(await history(page)).toEqual([]);
    await focusTest(page);
    for (const key of ALICE_LAYOUT) {
      await page.keyboard.press(key.code);
      await expect(cell(page, key.code)).toHaveAttribute('data-count', '1');
    }
    await expect(progress(page)).toHaveAttribute('value', String(ALICE_LAYOUT.length));
    await expect(panel(page).getByRole('status')).toContainText('Test complete');
    await expect(cell(page, 'Space').locator('.key-count')).toHaveText(['1', '1']);
    await page.keyboard.press('Escape');
    await expect(nav(page, 'Focus keyboard test')).toBeFocused();
    await focusTest(page);
    await page.keyboard.press('Backquote');
    await expect(cell(page, 'Backquote')).toHaveAttribute('data-count', '1');
    expect(await history(page)).toEqual([]);
    await nav(page, 'Restart test').click();
    await expect(capture(page)).toBeFocused();
    await expect(progress(page)).toHaveAttribute('value', '0');
    await expect(panel(page).locator('.keyboard-key[data-count="1"]')).toHaveCount(0);
    await expect(cell(page, 'Backquote')).toHaveAttribute('data-test-state', 'expected');
    await nav(page, 'Stats').click();
    await expect(page.locator('.empty-state')).toContainText('No saved sessions yet.');
  });

  test('wrong and unknown physical codes do not count; error expires without clearing tested state', async ({ page }) => {
    await page.clock.install();
    await focusTest(page);
    await page.keyboard.press('Backquote');
    await page.keyboard.press('Backquote');
    await expect(cell(page, 'Backquote')).toHaveAttribute('data-test-state', 'unexpected');
    await expect(cell(page, 'Digit1')).toHaveAttribute('data-test-state', 'expected');
    await expect(progress(page)).toHaveAttribute('value', '1');
    await expect(cell(page, 'Backquote')).toHaveAttribute('data-count', '1');
    await page.clock.runFor(600);
    await expect(cell(page, 'Backquote')).toHaveAttribute('data-test-state', 'tested');
    await expect(panel(page).getByRole('status')).not.toContainText('Unexpected');
    for (const code of ['', 'Unidentified', 'IntlBackslash']) {
      await dispatch(page, { key: '1', code });
      await expect(progress(page)).toHaveAttribute('value', '1');
      await expect(panel(page).getByRole('status')).toContainText('Unexpected key');
    }
    await dispatch(page, { key: 'not the displayed legend', code: 'Digit1' });
    await expect(progress(page)).toHaveAttribute('value', '2');
    await expect(panel(page).getByRole('status')).not.toContainText('Unexpected');
    await nav(page, 'Restart test').click();
    await page.clock.runFor(1000);
    await expect(cell(page, 'Backquote')).toHaveAttribute('data-test-state', 'expected');
  });

  test('ignores repeat, duplicate held keydowns, composition, and shortcut combinations', async ({ page }) => {
    await focusTest(page);
    for (const options of [
      { repeat: true }, { isComposing: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }
    ]) expect(await dispatch(page, { code: 'Backquote', key: '`', ...options })).toBe(false);
    await capture(page).dispatchEvent('compositionstart');
    await dispatch(page, { code: 'Backquote', key: '`' });
    await capture(page).dispatchEvent('compositionend');
    await expect(progress(page)).toHaveAttribute('value', '0');
    await dispatch(page, { code: 'Backquote', key: '`' }, false);
    await dispatch(page, { code: 'Backquote', key: '`' }, false);
    await expect(progress(page)).toHaveAttribute('value', '1');
    await expect(panel(page).getByRole('status')).not.toContainText('Unexpected');
    await capture(page).dispatchEvent('keyup', { code: 'Backquote' });
    await dispatch(page, { code: 'Backquote', key: '`' });
    await expect(panel(page).getByRole('status')).toContainText('Unexpected');
  });

  test('Tab, Shift+Tab, Escape, controls, and unfocused input remain keyboard safe', async ({ page }) => {
    expect(await dispatch(page, { code: 'Backquote', key: '`' })).toBe(false);
    await focusTest(page);
    await page.keyboard.press('Tab');
    await expect(capture(page)).not.toBeFocused();
    await expect(progress(page)).toHaveAttribute('value', '0');
    await page.keyboard.press('Backquote');
    await expect(progress(page)).toHaveAttribute('value', '0');
    await focusTest(page);
    await page.keyboard.press('Shift+Tab');
    await expect(nav(page, 'Focus keyboard test')).toBeFocused();
    await focusTest(page);
    await page.keyboard.press('Escape');
    await expect(nav(page, 'Focus keyboard test')).toBeFocused();
    await focusTest(page);
    for (const key of ALICE_LAYOUT.slice(0, ALICE_LAYOUT.findIndex((key) => key.code === 'Tab'))) {
      await page.keyboard.press(key.code);
    }
    expect(await dispatch(page, { code: 'Tab', key: 'Tab', shiftKey: true })).toBe(false);
    await expect(cell(page, 'Tab')).toHaveAttribute('data-count', '0');
    await page.keyboard.press('Tab');
    await expect(capture(page)).toBeFocused();
    await expect(cell(page, 'Tab')).toHaveAttribute('data-count', '1');
    await page.keyboard.press('Tab');
    await expect(capture(page)).not.toBeFocused();
  });

  test('blur preserves progress but clears errors, teardown discards it, and practice is unchanged', async ({ page }) => {
    const original = await page.locator('#practice-target .sr-only').textContent();
    await focusTest(page);
    await page.keyboard.press('Backquote');
    await page.keyboard.press('KeyX');
    await nav(page, 'Focus keyboard test').focus();
    await expect(panel(page).getByRole('status')).not.toContainText('Unexpected');
    await focusTest(page);
    await expect(progress(page)).toHaveAttribute('value', '1');
    await page.keyboard.press('Digit1');
    await expect(progress(page)).toHaveAttribute('value', '2');
    await nav(page, 'Practice').click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Typing practice', exact: true })).toHaveAttribute('data-status', 'ready');
    expect(await page.locator('#practice-target .sr-only').textContent()).toBe(original);
    await nav(page, 'Start typing').click();
    await page.keyboard.press('KeyA');
    await expect(nav(page, 'Keyboard Test')).toBeDisabled();
    await nav(page, 'Restart').click();
    await nav(page, 'Keyboard Test').click();
    await expect(progress(page)).toHaveAttribute('value', '0');
  });

  test('window focus loss clears held keys and temporary feedback without losing progress', async ({ page }) => {
    await focusTest(page);
    await dispatch(page, { code: 'Backquote', key: '`' }, false);
    await dispatch(page, { code: 'Digit1', key: '1', ctrlKey: true }, false);
    await dispatch(page, { code: 'KeyX', key: 'x' }, false);
    await expect(panel(page).getByRole('status')).toContainText('Unexpected');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(panel(page).getByRole('status')).not.toContainText('Unexpected');
    await expect(progress(page)).toHaveAttribute('value', '1');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(panel(page).getByText('Listening for physical keys')).toBeVisible();
    await dispatch(page, { code: 'Backquote', key: '`' });
    await expect(panel(page).getByRole('status')).toContainText('Unexpected key: Backquote');
    await dispatch(page, { code: 'Digit1', key: '1' });
    await expect(progress(page)).toHaveAttribute('value', '2');
  });

  for (const width of [1440, 320]) {
    test(`matrix, controls, and keyboard scroll fit ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await focusTest(page);
      await page.keyboard.press('KeyX');
      await expect(cell(page, 'KeyX').locator('.feedback-marker')).toHaveText('!');
      if (width === 320) {
        const scroll = panel(page).getByRole('region', { name: 'Keyboard diagram scroll area' });
        await expect(scroll).toHaveAttribute('tabindex', '0');
        await scroll.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
        await expect(progress(page)).toHaveAttribute('value', '0');
      }
    });
  }
});

test.describe('test sound and local preferences', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await installAudioSpy(page);
    await page.goto('/');
    await nav(page, 'Keyboard Test').click();
  });

  test('effects preview only when enabled, key playback is filtered, and teardown closes audio', async ({ page }) => {
    await effectSelect(page).selectOption('bubble');
    await focusTest(page);
    await page.keyboard.press('KeyX');
    expect(await page.evaluate(() => Reflect.get(window, 'testAudioCalls').contexts)).toBe(0);
    await soundToggle(page).check();
    expect(await page.evaluate(() => Reflect.get(window, 'testAudioCalls').plays)).toBe(0);
    let plays = 0;
    for (const effect of KEYBOARD_TEST_EFFECTS) {
      await effectSelect(page).selectOption(effect.id);
      plays += 1;
      await expect.poll(() => page.evaluate(() => Reflect.get(window, 'testAudioCalls').plays)).toBe(plays);
    }
    await focusTest(page);
    await page.keyboard.press('Backquote');
    await page.keyboard.press('KeyX');
    await dispatch(page, { key: '1', code: 'Digit1', repeat: true });
    await dispatch(page, { key: '1', code: 'Digit1', ctrlKey: true });
    await dispatch(page, { key: '1', code: 'Digit1', isComposing: true });
    await dispatch(page, { key: '?', code: 'Unidentified' });
    plays += 3;
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'testAudioCalls').plays)).toBe(plays);
    await page.keyboard.press('Tab');
    await page.keyboard.press('KeyX');
    expect(await page.evaluate(() => Reflect.get(window, 'testAudioCalls').plays)).toBe(plays);
    await nav(page, 'Restart test').click();
    for (const key of ALICE_LAYOUT) await page.keyboard.press(key.code);
    plays += ALICE_LAYOUT.length;
    await page.keyboard.press('KeyX');
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'testAudioCalls').plays)).toBe(plays);
    await soundToggle(page).uncheck();
    await effectSelect(page).selectOption('coin');
    expect(await page.evaluate(() => Reflect.get(window, 'testAudioCalls').plays)).toBe(plays);
    await nav(page, 'Practice').click();
    expect(await page.evaluate(() => Reflect.get(window, 'testAudioCalls'))).toMatchObject({ contexts: 1, closed: 1, buffers: 13 });
  });

  test('persists only sound preferences, keeps practice sound independent, and resets only run state', async ({ page }) => {
    await soundToggle(page).check();
    await effectSelect(page).selectOption('dog-bark');
    await focusTest(page);
    await page.keyboard.press('Backquote');
    await nav(page, 'Restart test').click();
    await expect(soundToggle(page)).toBeChecked();
    await expect(effectSelect(page)).toHaveValue('dog-bark');
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? ''), PREFERENCES_KEY);
    expect(saved).toEqual({ version: 2, settings: {
      ...DEFAULT_PREFERENCES, onboardingComplete: true, keyboardTestSoundEnabled: true, keyboardTestSoundEffect: 'dog-bark'
    } });
    await page.reload();
    await nav(page, 'Keyboard Test').click();
    await expect(soundToggle(page)).toBeChecked();
    await expect(effectSelect(page)).toHaveValue('dog-bark');
    expect(await page.evaluate(() => Reflect.get(window, 'testAudioCalls').contexts)).toBe(0);
    await expect(progress(page)).toHaveAttribute('value', '0');
    await nav(page, 'Settings').click();
    await expect(page.getByLabel('Typing sound', { exact: true })).not.toBeChecked();
    await page.getByLabel('Typing sound', { exact: true }).check();
    await nav(page, 'Keyboard Test').click();
    await soundToggle(page).uncheck();
    await nav(page, 'Settings').click();
    await expect(page.getByLabel('Typing sound', { exact: true })).toBeChecked();
    await nav(page, 'Restore defaults').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restore defaults', exact: true }).click();
    await nav(page, 'Keyboard Test').click();
    await expect(soundToggle(page)).not.toBeChecked();
    await expect(effectSelect(page)).toHaveValue('default');
  });

  test('reports unavailable audio, disables only test sound in memory, and allows retry', async ({ page }) => {
    await page.evaluate(() => Object.defineProperty(window, 'AudioContext', { value: undefined }));
    await soundToggle(page).check();
    await focusTest(page);
    await page.keyboard.press('Backquote');
    await expect(panel(page).getByRole('alert')).toContainText('Web Audio is unavailable');
    await expect(soundToggle(page)).not.toBeChecked();
    await expect(progress(page)).toHaveAttribute('value', '1');
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '').settings, PREFERENCES_KEY);
    expect(saved.keyboardTestSoundEnabled).toBe(true);
    await nav(page, 'Dismiss test sound warning').click();
    await expect(panel(page).getByRole('alert')).toHaveCount(0);
    await soundToggle(page).check();
    await expect(soundToggle(page)).toBeChecked();
    await expect(progress(page)).toHaveAttribute('value', '1');
  });

  test('reports failed preference writes and retries the current selection', async ({ page }) => {
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new DOMException('Test quota', 'QuotaExceededError'); };
      Object.defineProperty(window, 'restoreWrites', { value: () => { Storage.prototype.setItem = original; } });
    });
    await effectSelect(page).selectOption('horn');
    await expect(page.getByRole('alert')).toContainText('Test quota');
    await expect(effectSelect(page)).toHaveValue('horn');
    await page.evaluate(() => Reflect.get(window, 'restoreWrites')());
    await nav(page, 'Retry preferences').click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '').settings, PREFERENCES_KEY);
    expect(saved.keyboardTestSoundEffect).toBe('horn');
  });
});

test('migration write failure retains existing values and retry saves v2 without losing them', async ({ page }) => {
  await page.addInitScript(({ key, defaults }) => {
    const { keyboardTestSoundEnabled, keyboardTestSoundEffect, ...previous } = defaults;
    localStorage.setItem(key, JSON.stringify({ version: 1, settings: {
      ...previous, durationSeconds: 120, soundEnabled: true, caretStyle: 'underline', onboardingComplete: true
    } }));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('Migration quota', 'QuotaExceededError'); };
    Object.defineProperty(window, 'restoreWrites', { value: () => { Storage.prototype.setItem = original; } });
  }, { key: PREFERENCES_KEY, defaults: DEFAULT_PREFERENCES });
  await page.goto('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Duration', { exact: true })).toHaveValue('120');
  await expect(page.getByRole('alert')).toContainText('migrated in memory');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '').version, PREFERENCES_KEY)).toBe(1);
  await page.evaluate(() => Reflect.get(window, 'restoreWrites')());
  await nav(page, 'Retry preferences').click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? ''), PREFERENCES_KEY);
  expect(saved.version).toBe(2);
  expect(saved.settings).toMatchObject({
    durationSeconds: 120, soundEnabled: true, caretStyle: 'underline', onboardingComplete: true,
    keyboardTestSoundEnabled: false, keyboardTestSoundEffect: 'default'
  });
  await nav(page, 'Keyboard Test').click();
  await expect(soundToggle(page)).not.toBeChecked();
});

test('all effects play through native Web Audio without external requests or runtime errors', async ({ page }) => {
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).hostname !== '127.0.0.1') externalRequests.push(request.url());
  });
  await skipOnboarding(page);
  await page.addInitScript(() => {
    const contexts: AudioContext[] = [];
    const plays: { duration: number; peak: number }[] = [];
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor() { super(); contexts.push(this); }
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: Parameters<typeof start>) {
      if (!this.buffer) throw new Error('Missing native test audio buffer.');
      const samples = this.buffer.getChannelData(0);
      const peak = samples.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 0);
      plays.push({ duration: this.buffer.duration, peak });
      start.apply(this, args);
    };
    Object.defineProperty(window, 'nativeTestAudio', { value: { contexts, plays } });
  });
  await page.goto('/');
  await nav(page, 'Keyboard Test').click();
  await soundToggle(page).check();
  await focusTest(page);
  await page.keyboard.press('Backquote');
  for (const effect of KEYBOARD_TEST_EFFECTS.slice(1)) await effectSelect(page).selectOption(effect.id);
  const audio = await page.evaluate(() => {
    const observed = Reflect.get(window, 'nativeTestAudio');
    return { contexts: observed.contexts.length, plays: observed.plays };
  });
  expect(audio.contexts).toBe(1);
  expect(audio.plays).toHaveLength(13);
  for (const play of audio.plays) {
    expect(play.duration).toBeGreaterThanOrEqual(0.025);
    expect(play.duration).toBeLessThanOrEqual(0.6);
    expect(play.peak).toBeGreaterThan(0.01);
    expect(play.peak).toBeLessThanOrEqual(0.075001);
  }
  await expect(panel(page).getByRole('alert')).toHaveCount(0);
  await nav(page, 'Practice').click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'nativeTestAudio').contexts[0].state)).toBe('closed');
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('pending audio resumes cannot play after blur, reset, sound-off, or app teardown', async ({ page }) => {
  await skipOnboarding(page);
  await installAudioSpy(page);
  await page.addInitScript(() => {
    let finish: (() => void) | undefined;
    window.AudioContext.prototype.resume = function (this: AudioContext) {
      return new Promise<void>((resolve) => {
        finish = () => {
          if (this.state === 'suspended') Reflect.set(this, 'state', 'running');
          resolve();
        };
      });
    };
    Object.defineProperty(window, 'finishTestResume', { value: () => {
      if (!finish) throw new Error('No pending audio resume.');
      finish();
    } });
  });
  await page.goto('/tests/fixtures/app.html');
  for (const action of ['blur', 'reset', 'off', 'unmount']) {
    await nav(page, 'Keyboard Test').click();
    await soundToggle(page).check();
    await focusTest(page);
    await page.keyboard.press('Backquote');
    if (action === 'blur') await page.keyboard.press('Tab');
    if (action === 'reset') await nav(page, 'Restart test').click();
    if (action === 'off') await soundToggle(page).uncheck();
    if (action === 'unmount') await page.evaluate(() => window.dispatchEvent(new Event('unmount-app')));
    await page.evaluate(() => Reflect.get(window, 'finishTestResume')());
    expect(await page.evaluate(() => Reflect.get(window, 'testAudioCalls').plays)).toBe(0);
    if (action !== 'unmount') await nav(page, 'Practice').click();
  }
  await expect(panel(page)).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, 'testAudioCalls').closed)).toBe(4);
});
