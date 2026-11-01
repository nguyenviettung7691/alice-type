import { expect, test, type Page } from '@playwright/test';
import { PREFERENCES_KEY, skipOnboarding } from './support';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function history(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/lib/storage/session-history.ts';
    const { SessionHistory }: typeof import('../src/lib/storage/session-history') =
      await import(path);
    const store = new SessionHistory();
    try { return await store.read(); } finally { store.close(); }
  });
}

test.beforeEach(async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/');
});

test('previews a sourced geometry, stores a layer binding, and scores only observable output', async ({ page }) => {
  await button(page, 'Keyboard Details').click();
  await page.getByLabel('Preset family', { exact: true }).selectOption('alice75');
  const preview = page.locator('.preset-preview .keyboard-visualizer');
  await expect(preview).toHaveAttribute('data-layout-source', 'preview');
  await button(page, 'Apply this reference geometry').click();
  await page.getByLabel('Hold cue', { exact: true }).fill('Hold Fn1 + H');
  await page.getByLabel('Source position label', { exact: true }).fill('H');
  await page.getByLabel('Source browser code', { exact: true }).fill('KeyH');
  await button(page, 'Add layer binding').click();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? ''), PREFERENCES_KEY);
  expect(saved).toMatchObject({
    version: 9,
    settings: {
      keyboardProfileId: 'keychron-q10-ansi-encoder',
      keyboardLayerBindings: [{ layer: 1, holdCue: 'Hold Fn1 + H', sourcePosition: 'H', sourceCode: 'KeyH', outputCode: 'ArrowLeft', modifiers: [] }]
    }
  });

  await button(page, 'Practice').click();
  await page.locator('.practice-tools > summary').click();
  await button(page, 'Layer command practice').click();
  await button(page, 'Start 10 prompts').click();
  const capture = page.getByRole('button', { name: 'Focused command-output practice area' });
  await expect(capture).toContainText('Expected browser output: ArrowLeft');
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('status')).toContainText('10 of 10 supported outputs matched.');
  await expect.poll(async () => (await history(page)).length).toBe(1);
  expect((await history(page))[0]).toMatchObject({
    version: 6, mode: 'command', correctAttempts: 10, outputAttempts: { ArrowLeft: 10 }
  });

  await button(page, 'Start 10 prompts').click();
  await expect(page.getByText('Prompt 1 of 10')).toBeVisible();
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.up('ArrowLeft');
  await expect(page.getByText('Prompt 2 of 10')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(button(page, 'Stop command practice')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByText('Prompt 2 of 10')).toBeVisible();
  await capture.click();
  await page.keyboard.press('Escape');
  await expect(button(page, 'Layer command practice')).toBeVisible();
  expect(await history(page)).toHaveLength(1);
});

test('shows explicit adaptive insufficiency and keeps mod-tap outcomes local to the visit', async ({ page }) => {
  await button(page, 'Practice').click();
  await button(page, 'Drills').click();
  await button(page, 'Build a weak-key drill for this board').click();
  await expect(page.getByText('Not enough data yet', { exact: false })).toBeVisible();

  await page.locator('.practice-tools > summary').click();
  await button(page, 'Mod-tap guide').click();
  await button(page, 'Try a tap').click();
  await page.keyboard.press('Space');
  await expect(page.getByText(/Browser reported Space; keydown\/up interval \d+ ms\./)).toBeVisible();
  await button(page, 'It matched').click();
  await expect(page.locator('.modtap-guide [role="status"]')).toContainText('1 trial outcomes reported in this visit.');
  expect(await history(page)).toEqual([]);
});
