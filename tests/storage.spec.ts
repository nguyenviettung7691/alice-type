import { expect, test, type Page } from '@playwright/test';
import { type SessionRecord } from '../src/lib/storage/session-history';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, skipOnboarding } from './support';

const input = (page: Page) => page.getByRole('textbox', { name: 'Typing practice', exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Typing practice', exact: true });
const nav = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function target(page: Page) {
  const text = await page.locator('#practice-target .sr-only').textContent();
  if (!text) throw new Error('Missing target');
  return text;
}

async function records(page: Page): Promise<SessionRecord[]> {
  return page.evaluate(async () => {
    const path = '/src/lib/storage/session-history.ts';
    const { SessionHistory }: typeof import('../src/lib/storage/session-history') = await import(path);
    const history = new SessionHistory();
    try { return await history.read(); } finally { history.close(); }
  });
}

async function completeWords(page: Page, lastError = false) {
  await nav(page, 'Words').click();
  await page.getByLabel('Word limit', { exact: true }).selectOption('10');
  const exercise = await target(page);
  await nav(page, 'Start typing').click();
  await page.keyboard.type(exercise.slice(0, -1));
  await page.keyboard.type(lastError ? 'x' : exercise.slice(-1));
  await expect(panel(page)).toHaveAttribute('data-status', 'completed');
  await expect.poll(async () => (await records(page)).length).toBe(1);
  return exercise;
}

test.describe('preferences and local history', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.addInitScript(() => { Math.random = () => 0; });
    await page.goto('/');
  });

  test('persists all preferences across reload without regenerating for display changes', async ({ page }) => {
    await page.getByLabel('Duration', { exact: true }).selectOption('120');
    await nav(page, 'Words').click();
    await page.getByLabel('Word limit', { exact: true }).selectOption('100');
    await page.getByLabel('Vocabulary', { exact: true }).selectOption('5000');
    await page.getByLabel('Punctuation', { exact: true }).check();
    await page.getByLabel('Numbers', { exact: true }).check();
    const exercise = await target(page);
    await page.evaluate(() => { Math.random = () => 0.5; });
    await nav(page, 'Settings').click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeFocused();
    await page.getByLabel('Caret style').selectOption('underline');
    await page.getByLabel('Show live WPM and accuracy').uncheck();
    await page.getByLabel('Typing sound', { exact: true }).check();
    await nav(page, 'Back to practice').click();
    expect(await target(page)).toBe(exercise);
    await expect(panel(page)).toHaveAttribute('data-caret', 'underline');
    await expect(page.locator('.metric-value')).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('Word limit', { exact: true })).toHaveValue('100');
    await expect(page.getByLabel('Vocabulary', { exact: true })).toHaveValue('5000');
    await expect(page.getByLabel('Punctuation', { exact: true })).toBeChecked();
    await expect(page.getByLabel('Numbers', { exact: true })).toBeChecked();
    await nav(page, 'Timed').click();
    await expect(page.getByLabel('Duration', { exact: true })).toHaveValue('120');
    await nav(page, 'Settings').click();
    await expect(page.getByLabel('Caret style')).toHaveValue('underline');
    await expect(page.getByLabel('Typing sound', { exact: true })).toBeChecked();
    await expect(page.getByLabel('Show live WPM and accuracy')).not.toBeChecked();
  });

  test('restores defaults only after confirmation and leaves history intact', async ({ page }) => {
    await completeWords(page);
    await nav(page, 'Settings').click();
    await page.getByLabel('Caret style').selectOption('line');
    await nav(page, 'Restore defaults').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByLabel('Caret style')).toHaveValue('line');
    await nav(page, 'Restore defaults').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restore defaults', exact: true }).click();
    await expect(page.getByLabel('Caret style')).toHaveValue('block');
    expect(await records(page)).toHaveLength(1);
    await nav(page, 'Back to practice').click();
    await expect(page.getByLabel('Duration', { exact: true })).toHaveValue('30');
  });

  test('disables view/settings changes during a run and preserves completed practice across navigation', async ({ page }) => {
    await nav(page, 'Start typing').click();
    await page.keyboard.type('y');
    for (const name of ['Practice', 'Settings', 'Stats', 'Timed', 'Words']) await expect(nav(page, name)).toBeDisabled();
    await nav(page, 'Restart').click();
    await completeWords(page);
    const final = await page.locator('.metric-value').allTextContents();
    await nav(page, 'Stats').click();
    await expect(input(page)).toBeHidden();
    await nav(page, 'Practice').click();
    await expect(panel(page)).toHaveAttribute('data-status', 'completed');
    await expect(page.locator('.metric-value')).toHaveText(final);
  });

  test('saves final-key mistakes once, preserves corrected attempt counts, and stores no text/events', async ({ page }) => {
    await nav(page, 'Words').click();
    await page.getByLabel('Word limit', { exact: true }).selectOption('10');
    const exercise = await target(page);
    await nav(page, 'Start typing').click();
    await page.keyboard.type('x');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(exercise.slice(0, -1));
    await page.keyboard.type('x');
    await expect.poll(async () => (await records(page)).length).toBe(1);
    const [record] = await records(page);
    expect(record).toMatchObject({
      mode: 'words', limit: 10, wordBankTier: 200, punctuation: false, numbers: false,
      totalAttempts: exercise.length + 1, correctAttempts: exercise.length - 1, missedKeys: { KeyX: 2 }
    });
    expect(Object.keys(record).sort()).toEqual([
      'id', 'completedAt', 'mode', 'limit', 'wordBankTier', 'punctuation', 'numbers',
      'wpm', 'accuracy', 'totalAttempts', 'correctAttempts', 'missedKeys'
    ].sort());
    await page.keyboard.type('extra');
    await page.keyboard.press('Backspace');
    expect(await records(page)).toEqual([record]);
    await nav(page, 'Stats').click();
    await expect(page.getByRole('table')).toContainText(record.accuracy.toFixed(1));
    await expect(page.locator('.missed-keys')).toHaveText('KeyX: 2');
    await page.reload();
    await nav(page, 'Stats').click();
    await expect(page.getByRole('cell', { name: 'Words / 10 words', exact: true })).toBeVisible();
  });

  test('records timed deadline metrics and omits absent physical codes', async ({ page }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.getByLabel('Duration', { exact: true }).selectOption('15');
    const wallStart = await page.evaluate(() => Date.now());
    await nav(page, 'Start typing').click();
    await page.keyboard.type('y');
    await input(page).dispatchEvent('keydown', { key: 'x', code: '', bubbles: true });
    await page.clock.fastForward(60_000);
    await expect(panel(page)).toHaveAttribute('data-status', 'completed');
    await expect.poll(async () => (await records(page)).length).toBe(1);
    expect((await records(page))[0]).toMatchObject({
      mode: 'timed', limit: 15, completedAt: wallStart + 15_000, wpm: 1,
      accuracy: 50, totalAttempts: 2, correctAttempts: 1, missedKeys: {}
    });
  });

  test('does not save ready or abandoned exercises', async ({ page }) => {
    expect(await records(page)).toEqual([]);
    await nav(page, 'Restart').click();
    await nav(page, 'Start typing').click();
    await page.keyboard.type('y');
    await nav(page, 'Restart').click();
    expect(await records(page)).toEqual([]);
    await nav(page, 'Start typing').click();
    await page.keyboard.type('y');
    await page.reload();
    expect(await records(page)).toEqual([]);
  });

  test('failed preference writes keep selections in memory and retry succeeds', async ({ page }) => {
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Object.defineProperty(window, 'restorePreferenceWrites', { value: () => { Storage.prototype.setItem = original; } });
      Storage.prototype.setItem = () => { throw new DOMException('Quota exhausted', 'QuotaExceededError'); };
    });
    await page.getByLabel('Duration', { exact: true }).selectOption('60');
    await expect(page.getByRole('alert')).toContainText('Quota exhausted');
    await expect(page.getByLabel('Duration', { exact: true })).toHaveValue('60');
    await page.evaluate(() => Reflect.get(window, 'restorePreferenceWrites')());
    await nav(page, 'Retry preferences').click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('Duration', { exact: true })).toHaveValue('60');
  });

  test('failed committed-session save survives restart and retries without duplicates', async ({ page }) => {
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      Object.defineProperty(window, 'restoreHistoryWrites', { value: () => { IDBObjectStore.prototype.put = original; } });
      IDBObjectStore.prototype.put = function (...args) {
        const result = original.apply(this, args);
        result.addEventListener('success', () => this.transaction.abort());
        return result;
      };
    });
    await nav(page, 'Words').click();
    await page.getByLabel('Word limit', { exact: true }).selectOption('10');
    const exercise = await target(page);
    await nav(page, 'Start typing').click();
    await page.keyboard.type(exercise);
    await expect(panel(page)).toHaveAttribute('data-status', 'completed');
    await expect(page.getByRole('alert')).toContainText('not saved');
    expect(await records(page)).toEqual([]);
    await nav(page, 'Restart').click();
    await nav(page, 'Stats').click();
    await expect(nav(page, 'Clear history')).toBeDisabled();
    await page.evaluate(() => Reflect.get(window, 'restoreHistoryWrites')());
    await nav(page, 'Retry session save').click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('cell', { name: 'Words / 10 words', exact: true })).toBeVisible();
    expect(await records(page)).toHaveLength(1);
  });

  test('deletes only history with confirmation and reports an aborted clear', async ({ page }) => {
    await completeWords(page, true);
    await nav(page, 'Stats').click();
    await nav(page, 'Clear history').click();
    await page.keyboard.press('Escape');
    expect(await records(page)).toHaveLength(1);
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.clear;
      Object.defineProperty(window, 'restoreClear', { value: () => { IDBObjectStore.prototype.clear = original; } });
      IDBObjectStore.prototype.clear = function () {
        const result = original.call(this);
        result.addEventListener('success', () => this.transaction.abort());
        return result;
      };
    });
    await nav(page, 'Clear history').click();
    await nav(page, 'Delete history').click();
    await expect(page.getByRole('alert')).toContainText('transaction');
    expect(await records(page)).toHaveLength(1);
    await page.evaluate(() => Reflect.get(window, 'restoreClear')());
    await nav(page, 'Clear history').click();
    await nav(page, 'Delete history').click();
    await expect(page.getByRole('status')).toContainText('history deleted');
    await expect(page.getByText(/No saved sessions yet/)).toBeVisible();
    expect(await records(page)).toEqual([]);
    expect(await page.evaluate((key) => localStorage.getItem(key), PREFERENCES_KEY)).not.toBeNull();
  });

  test('real IndexedDB upgrades, idempotent writes, ordering, and versionchange close', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const path = '/src/lib/storage/session-history.ts';
      const { SessionHistory }: typeof import('../src/lib/storage/session-history') = await import(path);
      const history = new SessionHistory();
      const base = {
        id: 'one', completedAt: 1000, mode: 'words' as const, limit: 10, wordBankTier: 200,
        punctuation: false, numbers: false, wpm: 20, accuracy: 100, totalAttempts: 10, correctAttempts: 10, missedKeys: {}
      };
      await history.save(base);
      await history.save(base);
      await history.save({ ...base, id: 'two', completedAt: 2000, wpm: 40 });
      const saved = await history.read();
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('alicetype', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const schema = { version: db.version, stores: [...db.objectStoreNames] };
      db.close();
      let error = '';
      try { await history.read(); } catch (failure) { error = failure instanceof Error ? failure.message : String(failure); }
      history.close();
      return { saved, schema, error };
    });
    expect(result.saved.map((record) => record.id)).toEqual(['two', 'one']);
    expect(result.schema).toEqual({ version: 2, stores: ['sessions'] });
    expect(result.error).toContain('version');
  });

  test('malformed stored history is reported and can be cleared explicitly', async ({ page }) => {
    await records(page);
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('alicetype', 1);
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise<void>((resolve) => {
        const tx = db.transaction('sessions', 'readwrite');
        tx.objectStore('sessions').put({ id: 'broken', target: 'not valid history' });
        tx.oncomplete = () => resolve();
      });
      db.close();
    });
    await nav(page, 'Stats').click();
    await expect(page.getByRole('alert')).toContainText('invalid data');
    await nav(page, 'Clear history').click();
    await nav(page, 'Delete history').click();
    await expect(page.getByText(/No saved sessions yet/)).toBeVisible();
  });

  test('reports a real blocked upgrade, closes the late connection, and can retry', async ({ page }) => {
    await page.evaluate(async () => {
      const blocker = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('alicetype', 1);
        request.onsuccess = () => resolve(request.result);
      });
      const original = indexedDB.open.bind(indexedDB);
      indexedDB.open = (name, version) => original(name, name === 'alicetype' ? 2 : version);
      Object.defineProperty(window, 'releaseBlocker', { value: () => blocker.close() });
    });
    await nav(page, 'Stats').click();
    await expect(page.getByRole('alert')).toContainText('blocked');
    await page.evaluate(() => Reflect.get(window, 'releaseBlocker')());
    await nav(page, 'Retry loading history').click();
    await expect(page.getByText(/No saved sessions yet/)).toBeVisible();
    const schema = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('alicetype', 2);
        request.onsuccess = () => resolve(request.result);
      });
      const store = db.transaction('sessions').objectStore('sessions');
      const result = { keyPath: store.keyPath, indexes: [...store.indexNames], version: db.version };
      db.close();
      return result;
    });
    expect(schema).toEqual({ keyPath: 'id', indexes: ['completedAt'], version: 2 });
  });

  test('Stats aggregates exact session means and physical-code errors with newest-first history', async ({ page }) => {
    await page.evaluate(async () => {
      const path = '/src/lib/storage/session-history.ts';
      const { SessionHistory }: typeof import('../src/lib/storage/session-history') = await import(path);
      const history = new SessionHistory();
      const base = {
        id: 'older', completedAt: 1000, mode: 'words' as const, limit: 10, wordBankTier: 200,
        punctuation: false, numbers: false, wpm: 20, accuracy: 80, totalAttempts: 10,
        correctAttempts: 8, missedKeys: { KeyX: 1 }
      };
      try {
        await history.save(base);
        await history.save({
          ...base, id: 'newer', completedAt: 2000, wpm: 60, accuracy: 50, totalAttempts: 4,
          correctAttempts: 2, missedKeys: { KeyX: 1, IntlBackslash: 1 }
        });
      } finally { history.close(); }
    });
    await nav(page, 'Stats').click();
    await expect(page.locator('.stats-summary dd')).toHaveText(['2', '60', '40', '65.0%']);
    await expect(page.locator('.history-scroll tbody tr').first()).toContainText('60');
    await expect(page.locator('.missed-keys li')).toHaveText(['KeyX: 2', 'IntlBackslash: 1']);
  });

  test('a database closed during an open does not retain a usable connection', async ({ page }) => {
    const message = await page.evaluate(async () => {
      const path = '/src/lib/storage/session-history.ts';
      const { SessionHistory }: typeof import('../src/lib/storage/session-history') = await import(path);
      const history = new SessionHistory();
      const pendingRead = history.read();
      history.close();
      try { await pendingRead; return 'unexpected success'; }
      catch (failure) { return failure instanceof Error ? failure.message : String(failure); }
    });
    expect(message).toContain('cancelled');
  });
});

test.describe('onboarding and preference recovery', () => {
  test('first use is a keyboard-accessible dialog, skip/Escape work, and no typing starts', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Make room for your rhythm.');
    await expect(nav(page, 'Start practicing')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(nav(page, 'Continue without layout access')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(nav(page, 'Start practicing')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(nav(page, 'Practice')).toBeFocused();
    await expect(panel(page)).toHaveAttribute('data-status', 'ready');
    await page.reload();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('primary activation focuses typing before optional API resolves and shows sourced legend samples', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'keyboard', { value: {
        getLayoutMap: () => new Promise((resolve) => {
          Object.defineProperty(window, 'finishLayoutMap', { value: () => resolve(new Map([['KeyQ', 'a']])) });
        })
      } });
    });
    await page.goto('/');
    await page.keyboard.press('Enter');
    await expect(input(page)).toBeFocused();
    await expect(panel(page)).toHaveAttribute('data-status', 'ready');
    await page.evaluate(() => Reflect.get(window, 'finishLayoutMap')());
    await expect(page.getByRole('status')).toContainText(['Browser layout sample', 'Select the text']);
    await expect(page.getByText(/Browser layout sample/)).toContainText('KeyQ: a');
    await expect(page.getByRole('img', { name: 'Generic Alice keyboard', exact: true })).toHaveAccessibleDescription(/not a detected device/);
  });

  test('denied layout access never blocks typing', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'keyboard', { value: {
        getLayoutMap: () => Promise.reject(new DOMException('Denied', 'NotAllowedError'))
      } });
    });
    await page.goto('/');
    await nav(page, 'Start practicing').click();
    await expect(input(page)).toBeFocused();
    await expect(page.getByText(/Optional layout access was unavailable/)).toContainText('Denied');
    await page.keyboard.type('a');
    await expect(panel(page)).toHaveAttribute('data-status', 'running');
  });

  for (const capability of ['missing', 'throws']) {
    test(`optional layout API ${capability} still focuses the input`, async ({ page }) => {
      await page.addInitScript((state) => {
        Object.defineProperty(navigator, 'keyboard', { value: state === 'missing' ? undefined : {
          getLayoutMap: () => { throw new DOMException('Layout access failed', 'SecurityError'); }
        } });
      }, capability);
      await page.goto('/');
      await nav(page, 'Start practicing').click();
      await expect(input(page)).toBeFocused();
      await expect(page.getByText(/Optional layout access/)).toContainText(
        capability === 'missing' ? 'not supported' : 'Layout access failed'
      );
      await page.keyboard.type('a');
      await expect(panel(page)).toHaveAttribute('data-status', 'running');
    });
  }

  test('retrying preference reads from Stats reopens onboarding and Start returns to practice', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, '{broken'), PREFERENCES_KEY);
    await page.goto('/');
    await nav(page, 'Continue without layout access').click();
    await nav(page, 'Stats').click();
    await page.evaluate(({ key, defaults }) => localStorage.setItem(key, JSON.stringify({
      version: 1, settings: defaults
    })), { key: PREFERENCES_KEY, defaults: DEFAULT_PREFERENCES });
    await nav(page, 'Retry preferences').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await nav(page, 'Start practicing').click();
    await expect(input(page)).toBeVisible();
    await expect(input(page)).toBeFocused();
  });

  for (const raw of ['{broken', JSON.stringify({ version: 2, settings: DEFAULT_PREFERENCES })]) {
    test(`does not overwrite invalid/future data during onboarding: ${raw.slice(0, 14)}`, async ({ page }) => {
      await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: PREFERENCES_KEY, value: raw });
      await page.goto('/');
      await nav(page, 'Continue without layout access').click();
      await expect(page.getByRole('alert')).toContainText(/could not be loaded|unsupported schema/);
      expect(await page.evaluate((key) => localStorage.getItem(key), PREFERENCES_KEY)).toBe(raw);
      await nav(page, 'Dismiss preference warning').click();
      await page.getByLabel('Duration', { exact: true }).selectOption('60');
      expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '').settings.durationSeconds, PREFERENCES_KEY)).toBe(60);
    });
  }

  test('denied localStorage loads defaults with a warning and still dismisses onboarding', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get: () => { throw new DOMException('Storage denied', 'SecurityError'); } });
    });
    await page.goto('/');
    await nav(page, 'Continue without layout access').click();
    await expect(page.getByRole('alert')).toContainText('Storage denied');
    await expect(page.getByLabel('Duration', { exact: true })).toHaveValue('30');
    await nav(page, 'Start typing').click();
    await page.keyboard.type('a');
    await expect(panel(page)).toHaveAttribute('data-status', 'running');
  });
});

test.describe('display, sound, and responsive views', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.addInitScript(() => { Math.random = () => 0; });
    await page.goto('/');
  });

  test('caret variants are visible and hidden live metrics return for final results', async ({ page }) => {
    for (const style of ['line', 'underline', 'block']) {
      await nav(page, 'Settings').click();
      await page.getByLabel('Caret style').selectOption(style);
      await page.getByLabel('Show live WPM and accuracy').uncheck();
      await nav(page, 'Back to practice').click();
      await expect(panel(page)).toHaveAttribute('data-caret', style);
      await expect(page.locator('.typing-character.active')).toHaveCSS('box-shadow', style === 'line'
        ? 'rgb(255, 93, 0) -2px 0px 0px 0px' : style === 'underline'
          ? 'rgb(255, 93, 0) 0px 2px 0px 0px' : 'rgb(255, 93, 0) -2px 0px 0px 0px');
    }
    await completeWords(page);
    await expect(page.locator('.metric-value').nth(1)).toHaveText('100.0%');
  });

  test('audio clicks only for accepted characters, reuses context, and closes on teardown', async ({ page }) => {
    await page.addInitScript(() => {
      const calls = { contexts: 0, clicks: 0, closed: 0, resumes: 0, gains: [] as number[], stops: [] as number[] };
      Object.defineProperty(window, 'audioCalls', { value: calls });
      class FakeAudioContext {
        state = 'suspended';
        currentTime = 0;
        destination = {};
        constructor() { calls.contexts += 1; }
        resume() { calls.resumes += 1; this.state = 'running'; return Promise.resolve(); }
        close() { calls.closed += 1; this.state = 'closed'; return Promise.resolve(); }
        createOscillator() {
          return {
            type: '', frequency: { setValueAtTime() {} }, connect() {}, disconnect() {},
            start() { calls.clicks += 1; }, stop(time: number) { calls.stops.push(time); }, onended: null
          };
        }
        createGain() {
          return {
            gain: { setValueAtTime(value: number) { calls.gains.push(value); }, exponentialRampToValueAtTime() {} },
            connect() {}, disconnect() {}
          };
        }
      }
      Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext });
    });
    await page.reload();
    await nav(page, 'Start typing').click();
    await page.keyboard.type('y');
    expect(await page.evaluate(() => Reflect.get(window, 'audioCalls').clicks)).toBe(0);
    await nav(page, 'Restart').click();
    await nav(page, 'Settings').click();
    await page.getByLabel('Typing sound', { exact: true }).check();
    await nav(page, 'Back to practice').click();
    await nav(page, 'Start typing').click();
    await page.keyboard.type('yx');
    await page.keyboard.press('Backspace');
    await input(page).dispatchEvent('keydown', { key: 'y', code: 'KeyY', repeat: true });
    await input(page).dispatchEvent('keydown', { key: 's', ctrlKey: true });
    await page.keyboard.press('Tab');
    await page.keyboard.type('ignored');
    expect(await page.evaluate(() => Reflect.get(window, 'audioCalls'))).toMatchObject({ contexts: 1, clicks: 2, resumes: 1 });
    expect(await page.evaluate(() => Reflect.get(window, 'audioCalls').gains)).toEqual([0.035, 0.035]);
    expect(await page.evaluate(() => Reflect.get(window, 'audioCalls').stops)).toEqual([0.025, 0.025]);
    await nav(page, 'Restart').click();
    await nav(page, 'Words').click();
    await page.getByLabel('Word limit', { exact: true }).selectOption('10');
    const exercise = await target(page);
    await nav(page, 'Start typing').click();
    await page.keyboard.type(exercise);
    await page.keyboard.type('extra');
    expect(await page.evaluate(() => Reflect.get(window, 'audioCalls').clicks)).toBe(exercise.length + 2);
    const closed = await page.evaluate(async () => {
      const path = '/src/lib/audio/typing-sound.ts';
      const { TypingSound }: typeof import('../src/lib/audio/typing-sound') = await import(path);
      const sound = new TypingSound();
      await sound.play();
      await sound.close();
      await sound.play();
      return Reflect.get(window, 'audioCalls');
    });
    expect(closed).toMatchObject({ contexts: 2, clicks: exercise.length + 3, closed: 1 });
    await page.goto('/tests/fixtures/app.html');
    await nav(page, 'Start typing').click();
    await page.keyboard.type('y');
    await page.evaluate(() => window.dispatchEvent(new Event('unmount-app')));
    await expect(panel(page)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'audioCalls').closed)).toBe(1);
  });

  test('audio failure disables sound in memory, reports it, and preserves typing', async ({ page }) => {
    await page.evaluate(() => { Object.defineProperty(window, 'AudioContext', { value: undefined }); });
    await nav(page, 'Settings').click();
    await page.getByLabel('Typing sound', { exact: true }).check();
    await nav(page, 'Back to practice').click();
    await nav(page, 'Start typing').click();
    await page.keyboard.type('y');
    await expect(page.getByRole('alert')).toContainText('Web Audio is unavailable');
    await expect(page.locator('.typing-character.correct')).toHaveCount(1);
    await nav(page, 'Restart').click();
    await nav(page, 'Settings').click();
    await expect(page.getByLabel('Typing sound', { exact: true })).not.toBeChecked();
  });

  for (const width of [1440, 768, 320]) {
    test(`Settings, Stats, and confirmations fit ${width}px without page overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await completeWords(page);
      for (const view of ['Settings', 'Stats']) {
        await nav(page, view).click();
        await expect(page.getByRole('heading', { name: view, exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await nav(page, 'Clear history').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
});
