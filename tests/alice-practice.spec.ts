import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, disableDeviceAccess } from './support';
import type { SessionRecord } from '../src/lib/storage/session-history';
import aliceProfile from '../src/lib/keyboard/layout-data/profiles/projectkb-alice.json' with { type: 'json' };

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Typing practice', exact: true });
const practiceVisualizer = (page: Page) => page.locator('section[aria-labelledby="practice-panel-heading"] .keyboard-visualizer');
const target = async (page: Page) => {
  const text = await page.locator('#practice-target .sr-only').textContent();
  if (!text) throw new Error('Missing target.');
  return text;
};
const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), PREFERENCES_KEY);

async function records(page: Page): Promise<SessionRecord[]> {
  return page.evaluate(async () => {
    const path = '/src/lib/storage/session-history.ts';
    const { SessionHistory }: typeof import('../src/lib/storage/session-history') = await import(path);
    const history = new SessionHistory();
    try { return await history.read(); } finally { history.close(); }
  });
}

/** Node's Buffer, reached without depending on @types/node. */
const bytes = (value: string) => (globalThis as unknown as { Buffer: { from(text: string): never } }).Buffer.from(value);

const CONFIRMATION = {
  profileId: 'projectkb-alice', variant: { 0: 0, 1: 0 }, confirmedFor: { vendorId: 0x0159, productId: 0xa71c },
  catalogRevision: 'test'
};

async function start(page: Page, extra: Record<string, unknown> = {}) {
  await disableDeviceAccess(page);
  await page.addInitScript(({ key, value }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    Math.random = () => 0;
  }, { key: PREFERENCES_KEY, value: JSON.stringify({ version: 7, settings: { ...DEFAULT_PREFERENCES, onboardingComplete: true, ...extra } }) });
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol !== 'data:') external.push(request.url());
  });
  await page.goto('/');
  return external;
}

/** A VIA saved layout for the ProjectKB Alice built from the bundled catalog, with Esc remapped to Grave. */
function viaFile(): string {
  const profile = aliceProfile as { keys: { row: number; col: number; kc?: string }[] };
  const base: string[] = Array.from({ length: 5 * 16 }, () => 'KC_NO');
  for (const key of profile.keys) {
    const index = key.row * 16 + key.col;
    if (key.kc && base[index] === 'KC_NO') base[index] = key.kc;
  }
  base[base.indexOf('KC_ESC')] = 'KC_GRV';
  const layer1 = base.map(() => 'KC_TRNS');
  return JSON.stringify({ name: 'Alice', vendorProductId: 0x0159 * 65536 + 0xa71c, macros: ['hello'], layers: [base, layer1] });
}

test('Drills generate a hand-alternation target, attribute direct keystrokes, and show hand load in Stats', async ({ page }) => {
  const external = await start(page);
  await button(page, 'Drills').click();
  await expect(button(page, 'Drills')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Vocabulary', { exact: true })).toHaveCount(0);
  await page.getByLabel('Drill', { exact: true }).selectOption('hand-alternation');
  await page.getByLabel('Word limit', { exact: true }).selectOption('10');
  await expect(page.getByText(/cannot see which hand or keycap you use/)).toBeVisible();
  const text = await target(page);
  expect(text.split(' ')).toHaveLength(10);
  expect(text).toMatch(/^[a-z ]+$/);
  await button(page, 'Start typing').click();
  await page.keyboard.type(text.slice(0, 5));
  const balance = page.getByRole('region', { name: 'Hand balance (this session)' });
  await expect(balance).toBeVisible();
  await expect(balance).toContainText('Left hand');
  await page.keyboard.type(text.slice(5));
  await expect(panel(page)).toHaveAttribute('data-status', 'completed');
  await expect.poll(async () => (await records(page)).length).toBe(1);
  const [record] = await records(page);
  expect(record).toMatchObject({ version: 4, mode: 'drills', drillType: 'hand-alternation', limit: 10, bKeyHand: 'left' });
  const hands = record.handAttempts!;
  expect(hands.left + hands.right + hands.thumb + hands.unattributed).toBe(record.totalAttempts);
  expect(hands.thumb).toBe(9);
  expect(Object.values(record.keyAttempts!).reduce((sum, count) => sum + count, 0)).toBe(text.length);
  await button(page, 'Stats').click();
  await expect(page.getByRole('table').first()).toContainText('Drills / Hand alternation / 10 words');
  await expect(page.getByRole('heading', { name: 'Hand load and key accuracy' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Hand balance (saved sessions)' })).toContainText('Right hand');
  await expect(page.getByText(/reach keys are a layout convention/i)).toBeVisible();
  expect(external).toEqual([]);
});

test('Code mode types a single-line snippet, offers Next snippet, and completes without Finish', async ({ page }) => {
  await start(page);
  await button(page, 'Code').click();
  await page.getByLabel('Programming language', { exact: true }).selectOption('rust');
  const snippet = page.locator('[data-snippet-id]');
  await expect(snippet).toHaveAttribute('data-snippet-id', /^rs-/);
  const id = await snippet.getAttribute('data-snippet-id');
  const before = await target(page);
  await button(page, 'Next snippet').click();
  await expect(snippet).not.toHaveAttribute('data-snippet-id', id!);
  await expect.poll(() => target(page)).not.toBe(before);
  const text = await target(page);
  expect(text).toMatch(/^[\x20-\x7e]+$/);
  await button(page, 'Start typing').click();
  await page.keyboard.type(text);
  await expect(panel(page)).toHaveAttribute('data-status', 'completed');
  await expect(button(page, 'Finish')).toHaveCount(0);
  await expect.poll(async () => (await records(page)).length).toBe(1);
  const [record] = await records(page);
  expect(record).toMatchObject({ version: 4, mode: 'code', codeLanguage: 'rust', targetCharacters: text.length });
  await button(page, 'Stats').click();
  await expect(page.getByRole('table').first()).toContainText('Code / Rust');
});

test('Finger guide marks the next key on the preferred B side with a text caption, and is saved', async ({ page }) => {
  await start(page);
  await page.getByLabel('Finger guide', { exact: true }).check();
  expect((await saved(page)).settings.fingerGuide).toBe(true);
  await button(page, 'Zen').click();
  await expect(page.getByLabel('Finger guide', { exact: true })).toHaveCount(0);
  await expect(page.locator('.guide-caption')).toHaveCount(0);
  await button(page, 'Custom').click();
  await page.locator('#custom-draft').fill('Bob b');
  await button(page, 'Apply text').click();
  const caption = page.locator('.guide-caption');
  await expect(caption).toContainText('Next: B — left index, with Shift on the other hand');
  await expect(caption).toContainText('US-QWERTY reference layout');
  const visualizer = practiceVisualizer(page);
  await expect(visualizer.locator('[data-code="KeyB"][data-guide="expected"]')).toHaveCount(1);
  await expect(visualizer.locator('[data-code="KeyB"] .guide-cap')).toHaveCount(1);
  await expect(visualizer.locator('[data-code="ShiftRight"][data-guide="expected"]')).toHaveCount(1);
  await expect(visualizer).toContainText('Next key (finger guide)');
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'Next: B' })).toHaveCount(1);
  await button(page, 'Start typing').click();
  await page.keyboard.type('B');
  await expect(caption).toContainText('Next: o — right ring');
  await expect(visualizer.locator('[data-code="KeyO"][data-guide="expected"]')).toHaveCount(1);
  await page.keyboard.type('ob');
  await expect(caption).toContainText('Next: Space — thumb');
  await page.keyboard.type(' ');
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'Next: b — left index' })).toHaveCount(1);
});

test('VIA keymap import previews, applies to Practice, offers a read-only layer viewer, and clears', async ({ page }) => {
  const external = await start(page, { keyboardProfileId: 'projectkb-alice', keyboardLayoutConfirmation: CONFIRMATION });
  await expect(practiceVisualizer(page).locator('[data-code="Escape"]')).toHaveCount(1);
  await button(page, 'Keyboard Details').click();
  const section = page.getByRole('region', { name: 'Import keymap' });
  await expect(section).toContainText('never uploaded');
  await expect(section).toContainText('not what your keyboard currently runs');
  const input = section.getByLabel('Keymap file');

  await input.setInputFiles({ name: 'wrong.json', mimeType: 'application/json', buffer: bytes('{broken') });
  await expect(section.getByRole('alert')).toHaveText('The file is not valid JSON.');
  const wrong = JSON.parse(viaFile());
  wrong.vendorProductId = 1;
  await input.setInputFiles({ name: 'other.json', mimeType: 'application/json', buffer: bytes(JSON.stringify(wrong)) });
  await expect(section.getByRole('alert')).toContainText('different keyboard');

  await input.setInputFiles({ name: 'alice.layout.json', mimeType: 'application/json', buffer: bytes(viaFile()) });
  const preview = section.getByRole('group', { name: 'Keymap preview' });
  await expect(preview).toContainText('alice.layout.json (VIA, 2 layers)');
  await expect(preview).toContainText('Esc →');
  await expect(preview).toContainText('Not imported: macros.');
  expect((await saved(page)).settings.keyboardKeymapImport).toBeNull();
  await button(page, 'Apply keymap').click();
  await expect(section).toContainText('Applied keymap: alice.layout.json (VIA, 2 layers)');
  const stored = (await saved(page)).settings.keyboardKeymapImport;
  expect(stored).toMatchObject({ profileId: 'projectkb-alice', format: 'via', fileName: 'alice.layout.json' });
  expect(stored.layers).toHaveLength(2);

  await section.getByRole('combobox', { name: 'Layer viewer' }).selectOption('1');
  await expect(section.locator('.keyboard-visualizer')).toContainText('▽');

  await button(page, 'Practice').click();
  await expect(practiceVisualizer(page).locator('[data-code="Escape"]')).toHaveCount(0);
  await expect(practiceVisualizer(page).locator('[data-code="Backquote"]')).toHaveCount(1);

  await page.reload();
  await expect(practiceVisualizer(page).locator('[data-code="Backquote"]')).toHaveCount(1);
  await button(page, 'Keyboard Details').click();
  await button(page, 'Clear keymap').click();
  expect((await saved(page)).settings.keyboardKeymapImport).toBeNull();
  await button(page, 'Practice').click();
  await expect(practiceVisualizer(page).locator('[data-code="Escape"]')).toHaveCount(1);
  expect(external).toEqual([]);
});

test('A saved keymap for a different variant is dropped on load with a notice', async ({ page }) => {
  await start(page, {
    keyboardProfileId: 'projectkb-alice', keyboardLayoutConfirmation: CONFIRMATION,
    keyboardKeymapImport: {
      profileId: 'projectkb-alice', catalogRevision: 'stale', variantKey: '[]', format: 'via',
      fileName: 'old.json', importedAt: 1, layers: [Array.from({ length: 80 }, () => 'KC_A')]
    }
  });
  await expect(page.getByRole('status').filter({ hasText: 'imported keymap was removed' })).toBeVisible();
  await expect.poll(async () => (await saved(page)).settings.keyboardKeymapImport).toBeNull();
});
