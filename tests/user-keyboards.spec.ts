import { expect, test, type Page } from '@playwright/test';
import { PREFERENCES_KEY, skipOnboarding } from './support';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const switcher = (page: Page) => page.getByLabel('Active keyboard', { exact: true });
const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? ''), PREFERENCES_KEY);

async function create(page: Page, name: string, duplicate = false) {
  await button(page, 'Keyboard Details').click();
  await button(page, duplicate ? 'Duplicate keyboard' : 'Add keyboard').click();
  await page.getByLabel('Profile name', { exact: true }).fill(name);
  await button(page, 'Save keyboard').click();
  await expect(switcher(page).locator('option:checked')).toHaveText(name);
  return await switcher(page).inputValue();
}

async function history(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/lib/storage/session-history.ts';
    const { SessionHistory }: typeof import('../src/lib/storage/session-history') = await import(path);
    const store = new SessionHistory();
    try { return await store.read(); } finally { store.close(); }
  });
}

async function complete(page: Page, wrong = false) {
  await button(page, 'Practice').click();
  await button(page, 'Custom').click();
  await page.getByLabel('Custom text', { exact: true }).fill('ab');
  await button(page, 'Apply text').click();
  await button(page, 'Start typing').click();
  await page.keyboard.type(wrong ? 'xb' : 'ab');
  await expect(page.locator('[aria-labelledby="practice-panel-heading"]')).toHaveAttribute('data-status', 'completed');
}

test.beforeEach(async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/');
});

test('creates, edits, duplicates and reloads distinct board hardware profiles', async ({ page }) => {
  const id = await create(page, 'Desk Arisu');
  await button(page, 'Edit keyboard').click();
  await page.getByLabel('Layout family (description only)').selectOption('arisu');
  await page.getByLabel('Switch type', { exact: true }).selectOption('tactile');
  await page.getByLabel('Actuation force (g, not bottom-out)').fill('62');
  await page.getByLabel('Keycap profile', { exact: true }).fill('MT3');
  await page.getByLabel('Tenting angle (degrees)').fill('12');
  await page.getByLabel('Left thumb role').selectOption('layer-1');
  await page.getByLabel('Right thumb role').selectOption('space');
  await button(page, 'Save keyboard').click();
  const duplicate = await create(page, 'Travel Arisu', true);
  expect(duplicate).not.toBe(id);
  await button(page, 'Edit keyboard').click();
  await page.getByLabel('Actuation force (g, not bottom-out)').fill('45');
  await button(page, 'Save keyboard').click();
  await switcher(page).selectOption(id);
  await expect(page.getByRole('region', { name: 'Your keyboards' })).toContainText('62');
  const stored = await saved(page);
  expect(stored.version).toBe(8);
  expect(stored.settings.keyboardBoards).toHaveLength(3);
  expect(stored.settings.keyboardBoards.find((board: { id: string }) => board.id === id)).toMatchObject({
    hardware: { family: 'arisu', switchType: 'tactile', actuationForce: 62, keycapProfile: 'MT3', tentingAngle: 12 },
    thumbs: { left: 'layer-1', right: 'space' }
  });
  await page.reload();
  await expect(switcher(page)).toHaveValue(id);
  await expect(page.locator('[aria-labelledby="practice-panel-heading"] .keyboard-visualizer')).toHaveAttribute('data-layout-source', 'generic');
  await button(page, 'Restore defaults').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restore defaults', exact: true }).click();
  expect((await saved(page)).settings.keyboardBoards).toEqual(stored.settings.keyboardBoards);
});

test('locks switching while typing, focuses the switcher by hotkey, and resets idle test state', async ({ page }) => {
  const id = await create(page, 'Second');
  await button(page, 'Practice').click();
  await page.keyboard.press('Control+Shift+K');
  await expect(switcher(page)).toBeFocused();
  await button(page, 'Start typing').click();
  await page.keyboard.type('a');
  await expect(switcher(page)).toBeDisabled();
  await page.keyboard.press('Control+Shift+K');
  await expect(page.getByRole('textbox', { name: 'Typing practice', exact: true })).toBeFocused();
  await button(page, 'Restart').click();
  await switcher(page).selectOption('default-board');
  await button(page, 'Keyboard Test').click();
  await button(page, 'Focus keyboard test').click();
  await page.keyboard.press('Backquote');
  await expect(page.getByRole('progressbar', { name: 'Keyboard test progress' })).toHaveAttribute('value', '1');
  await switcher(page).selectOption(id);
  await expect(page.getByRole('progressbar', { name: 'Keyboard test progress' })).toHaveAttribute('value', '0');
});

test('scopes history and heatmaps to stable board IDs, keeps snapshots after rename and deletion', async ({ page }) => {
  await complete(page, true);
  await expect.poll(async () => (await history(page)).length).toBe(1);
  const first = (await history(page))[0];
  expect(first).toMatchObject({ version: 5, keyboard: { id: 'default-board', name: 'My keyboard' }, missedKeys: { KeyX: 1 } });
  const id = await create(page, 'Second');
  await complete(page);
  await expect.poll(async () => (await history(page)).length).toBe(2);
  await button(page, 'Stats').click();
  await expect(page.locator('.stats-panel .keyboard-key[data-code="KeyX"]')).toHaveAttribute('data-count', '0');
  await expect(page.getByRole('region', { name: 'Session history table' }).locator('table')).toHaveAttribute('aria-rowcount', '2');
  await switcher(page).selectOption('default-board');
  await expect(page.locator('.stats-panel .keyboard-key[data-code="KeyX"]')).toHaveAttribute('data-count', '1');
  await page.getByLabel('Keyboard history').selectOption('all');
  await expect(page.getByRole('region', { name: 'Session history table' }).locator('table')).toHaveAttribute('aria-rowcount', '3');
  await page.getByLabel('Keyboard history').selectOption('unassigned');
  await expect(page.getByRole('region', { name: 'Session history table' })).toHaveCount(0);
  await switcher(page).selectOption(id);
  await button(page, 'Keyboard Details').click();
  await button(page, 'Edit keyboard').click();
  await page.getByLabel('Profile name').fill('Renamed');
  await button(page, 'Save keyboard').click();
  await button(page, 'Delete keyboard').click();
  await page.keyboard.press('Control+Shift+K');
  await expect(switcher(page)).not.toBeFocused();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete keyboard', exact: true }).click();
  await expect(switcher(page)).toHaveValue('default-board');
  await expect(button(page, 'Delete keyboard')).toBeDisabled();
  await button(page, 'Stats').click();
  await expect(page.getByLabel('Keyboard history').locator(`option[value="board:${id}"]`)).toHaveText('Second (deleted profile)');
  await page.getByLabel('Keyboard history').selectOption(`board:${id}`);
  await expect(page.getByRole('region', { name: 'Session history table' })).toContainText('Second');
  expect((await history(page)).map((record) => record.keyboard?.name).sort()).toEqual(['My keyboard', 'Second']);
});

test('restores separate keymaps and B-hand for two boards sharing a catalog layout', async ({ page }) => {
  const id = await page.evaluate(async () => {
    const preferencesPath = '/src/lib/storage/preferences.ts';
    const catalogPath = '/src/lib/keyboard/layout-catalog.ts';
    const keymapPath = '/src/lib/keyboard/keymap-import.ts';
    const prefs: typeof import('../src/lib/storage/preferences') = await import(preferencesPath);
    const catalog: typeof import('../src/lib/keyboard/layout-catalog') = await import(catalogPath);
    const keymaps: typeof import('../src/lib/keyboard/keymap-import') = await import(keymapPath);
    const entry = catalog.findCatalogEntry('projectkb-alice')!;
    const profile = await catalog.loadLayoutProfile(entry.id);
    const variant = catalog.defaultVariant(entry);
    const confirmation = { profileId: entry.id, variant, catalogRevision: catalog.LAYOUT_CATALOG.revision, confirmedFor: null };
    const layer: string[] = Array.from({ length: entry.matrix.rows * entry.matrix.cols }, () => 'KC_NO');
    for (const key of profile.keys) if (key.kc) layer[key.row * entry.matrix.cols + key.col] = key.kc;
    layer[layer.indexOf('KC_ESC')] = 'KC_GRV';
    const first = prefs.validatePreferences({
      ...prefs.loadPreferences(), keyboardProfileId: entry.id, keyboardLayoutConfirmation: confirmation, bKeyHand: 'right',
      keyboardKeymapImport: {
        profileId: entry.id, catalogRevision: catalog.LAYOUT_CATALOG.revision, variantKey: keymaps.keymapVariantKey(variant),
        format: 'via', fileName: 'first.json', importedAt: Date.now(), layers: [layer]
      }
    });
    const second = prefs.addKeyboard(first, 'Same layout', false, 'second-board');
    prefs.savePreferences({ ...second, keyboardProfileId: entry.id, keyboardLayoutConfirmation: confirmation });
    return second.activeKeyboardId;
  });
  await page.reload();
  const diagram = page.locator('[aria-labelledby="practice-panel-heading"] .keyboard-visualizer');
  await expect(diagram).toHaveAttribute('data-layout-source', 'confirmed');
  await expect(diagram.locator('.keyboard-key[data-code="Escape"]')).toHaveCount(1);
  await switcher(page).selectOption('default-board');
  await expect(diagram).toHaveAttribute('data-layout-source', 'confirmed');
  await expect(diagram.locator('.keyboard-key[data-code="Escape"]')).toHaveCount(0);
  expect((await saved(page)).settings.bKeyHand).toBe('right');
  await switcher(page).selectOption(id);
  await expect(diagram.locator('.keyboard-key[data-code="Escape"]')).toHaveCount(1);
  expect((await saved(page)).settings.bKeyHand).toBe('left');
  expect((await saved(page)).settings.keyboardBoards[0].settings.keyboardKeymapImport.fileName).toBe('first.json');
});

test('surfaces validation and quota failures without losing the prior persisted collection', async ({ page }) => {
  await button(page, 'Keyboard Details').click();
  await button(page, 'Edit keyboard').click();
  await page.getByLabel('Profile name').fill('   ');
  await button(page, 'Save keyboard').click();
  await expect(page.getByRole('alert')).toContainText('Could not save');
  await page.getByLabel('Profile name').fill('Edited');
  await page.getByLabel('Tenting angle (degrees)').fill('91');
  await button(page, 'Save keyboard').click();
  expect(await page.getByLabel('Tenting angle (degrees)').evaluate((element: HTMLInputElement) => element.validity.rangeOverflow)).toBe(true);
  await page.getByLabel('Tenting angle (degrees)').fill('0');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Reflect.set(window, 'restoreBoardWrites', () => { Storage.prototype.setItem = original; });
    Storage.prototype.setItem = function () { throw new DOMException('Full', 'QuotaExceededError'); };
  });
  await button(page, 'Save keyboard').click();
  await expect(page.getByRole('alert')).toContainText('not saved');
  await expect(switcher(page).locator('option:checked')).toHaveText('Edited');
  expect((await saved(page)).settings.keyboardBoards[0].name).toBe('My keyboard');
  await page.evaluate(() => Reflect.get(window, 'restoreBoardWrites')());
  await button(page, 'Retry preferences').click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await saved(page)).settings.keyboardBoards[0].name).toBe('Edited');
});

test('localizes the manager and fits a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Language', { exact: true }).selectOption('vi');
  await button(page, 'Thông tin bàn phím').click();
  await expect(page.getByRole('heading', { name: 'Bàn phím của bạn', exact: true })).toBeVisible();
  await button(page, 'Sửa bàn phím').click();
  await expect(page.getByLabel('Vai trò ngón cái trái')).toBeVisible();
  await page.getByLabel('Góc nâng hai nửa (độ)').fill('12.5');
  await button(page, 'Lưu bàn phím').click();
  await expect(page.getByRole('region', { name: 'Bàn phím của bạn' })).toContainText('12,5');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('keeps old results unassigned and filters direct-key accuracy by board before language', async ({ page }) => {
  const secondId = await create(page, 'Second');
  await page.evaluate(async ({ secondId }) => {
    const historyPath = '/src/lib/storage/session-history.ts';
    const preferencesPath = '/src/lib/storage/preferences.ts';
    const boardsPath = '/src/lib/keyboard/user-keyboards.ts';
    const { SessionHistory }: typeof import('../src/lib/storage/session-history') = await import(historyPath);
    const prefs: typeof import('../src/lib/storage/preferences') = await import(preferencesPath);
    const boards: typeof import('../src/lib/keyboard/user-keyboards') = await import(boardsPath);
    const value = prefs.loadPreferences();
    const store = new SessionHistory();
    const base = {
      version: 4 as const, language: 'en' as const, scoringVersion: 'committed-grapheme-v1' as const,
      mode: 'words' as const, limit: 10, wordBankTier: 200, punctuation: false, numbers: false,
      wpm: 40, totalAttempts: 20, correctAttempts: 18, accuracy: 90, missedKeys: { KeyB: 2 },
      keyAttempts: { KeyB: 20 }, handAttempts: { left: 20, right: 0, thumb: 0, unattributed: 0 }, bKeyHand: 'left' as const
    };
    try {
      await store.save({ ...base, id: 'old', completedAt: 1000 });
      for (const [index, id] of ['default-board', secondId].entries()) {
        const keyboard = boards.snapshotKeyboard(prefs.activeKeyboard(prefs.switchKeyboard(value, id)));
        await store.save({
          ...base, version: 5, id: `board-${index}`, completedAt: 2000 + index,
          language: index ? 'vi' : 'en', keyboard
        });
      }
    } finally { store.close(); }
  }, { secondId });
  await button(page, 'Stats').click();
  const accuracy = page.getByRole('region', { name: 'Per-key accuracy', exact: true });
  await expect(accuracy.locator('tbody')).toContainText('20');
  await page.locator('.stats-panel').getByLabel('Language', { exact: true }).selectOption('en');
  await expect(accuracy).toHaveCount(0);
  await switcher(page).selectOption('default-board');
  await expect(accuracy.locator('tbody')).toContainText('20');
  await page.getByLabel('Keyboard history', { exact: true }).selectOption('unassigned');
  await expect(page.getByRole('region', { name: 'Session history table' })).toContainText('Unassigned');
  await expect(page.getByRole('region', { name: 'Session history table' }).locator('table')).toHaveAttribute('aria-rowcount', '2');
  await page.getByLabel('Keyboard history', { exact: true }).selectOption('all');
  await page.locator('.stats-panel').getByLabel('Language', { exact: true }).selectOption('all');
  await expect(accuracy.locator('tbody')).toContainText('60');
});

test('retrying a failed score save after switching boards retains the original snapshot', async ({ page }) => {
  const id = await create(page, 'Second');
  await switcher(page).selectOption('default-board');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    Reflect.set(window, 'restoreBoardHistory', () => { IDBObjectStore.prototype.put = original; });
    IDBObjectStore.prototype.put = function () { throw new DOMException('Full', 'QuotaExceededError'); };
  });
  await complete(page, true);
  await expect(page.getByRole('alert')).toContainText('not saved');
  await switcher(page).selectOption(id);
  await page.evaluate(() => Reflect.get(window, 'restoreBoardHistory')());
  await button(page, 'Retry session save').click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect.poll(async () => (await history(page)).length).toBe(1);
  expect((await history(page))[0].keyboard?.id).toBe('default-board');
  await button(page, 'Stats').click();
  await expect(page.getByRole('region', { name: 'Session history table' })).toHaveCount(0);
  await switcher(page).selectOption('default-board');
  await expect(page.getByRole('region', { name: 'Session history table' })).toContainText('My keyboard');
});
