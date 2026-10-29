import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PREFERENCES, disableDeviceAccess } from './support';

async function setup(page: Page, language: 'en' | 'vi' = 'vi') {
  await disableDeviceAccess(page);
  await page.addInitScript(({ defaults, language }) => {
    localStorage.setItem('alicetype.preferences', JSON.stringify({
      version: 6, settings: { ...defaults, language, onboardingComplete: true }
    }));
    Math.random = () => 0;
  }, { defaults: DEFAULT_PREFERENCES, language });
  await page.goto('/');
}

async function commit(page: Page, value: string) {
  await page.locator('#practice-input').evaluate((element: HTMLInputElement, value) => {
    element.value = value;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  }, value);
}

test('switches language, persists on reload and keeps the selector at the right edge', async ({ page }) => {
  await disableDeviceAccess(page);
  await page.addInitScript(({ defaults }) => {
    if (!localStorage.getItem('alicetype.preferences')) localStorage.setItem('alicetype.preferences', JSON.stringify({
      version: 5, settings: { ...defaults, onboardingComplete: true }
    }));
  }, { defaults: DEFAULT_PREFERENCES });
  await page.goto('/');
  await page.getByLabel('Language', { exact: true }).selectOption('vi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('button', { name: 'Kiểm tra bàn phím', exact: true })).toBeVisible();
  await expect(page.locator('#practice-target')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('#practice-target')).toContainText(/[^\x00-\x7f]/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alicetype.preferences')!));
  expect(saved).toMatchObject({ version: 6, settings: { language: 'vi', durationSeconds: 30 } });
  await page.reload();
  await expect(page.getByLabel('Ngôn ngữ', { exact: true })).toHaveValue('vi');
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    const select = await page.locator('#app-language').boundingBox();
    expect(select).not.toBeNull();
    expect(select!.x + select!.width).toBeGreaterThan(width - 70);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('Vietnamese Custom commits NFC composition once, permits final tone correction and explicitly finishes', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Văn bản riêng', exact: true }).click();
  await page.getByLabel('Văn bản riêng', { exact: true }).fill('á');
  await page.getByRole('button', { name: 'Áp dụng văn bản', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu gõ', exact: true }).click();
  await commit(page, 'a');
  await expect(page.getByLabel('Ngôn ngữ', { exact: true })).toBeDisabled();
  await page.locator('#practice-input').evaluate((element: HTMLInputElement) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    element.value = 'a\u0301';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, data: 'a\u0301', inputType: 'insertCompositionText' }));
  });
  await expect(page.getByRole('button', { name: 'Hoàn tất', exact: true })).toBeDisabled();
  await expect(page.locator('.metric-value').nth(1)).toHaveText('0,0%');
  await expect(page.locator('.preedit')).toHaveText('á');
  await expect(page.locator('.preedit')).toHaveCSS('position', 'absolute');
  await expect(page.locator('.preedit')).toHaveAttribute('aria-hidden', 'true');
  await expect.poll(async () => {
    const preview = await page.locator('.preedit').boundingBox();
    const character = await page.locator('.typing-character[data-position="0"]').boundingBox();
    return preview && character ? Math.abs(preview.x - character.x) < 1 && Math.abs(preview.y - character.y) < 1 : false;
  }).toBe(true);
  await page.locator('#practice-input').evaluate((element: HTMLInputElement) => {
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'á' }));
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'á', inputType: 'insertText' }));
  });
  await expect(page.locator('.metric-value').nth(1)).toHaveText('50,0%');
  await expect(page.locator('#practice-input')).toHaveValue('á');
  await expect(page.locator('.preedit')).toHaveCount(0);
  await expect.poll(async () => {
    const capture = await page.locator('#practice-input').boundingBox();
    const end = await page.locator('.typing-end-anchor').boundingBox();
    return capture && end ? Math.abs(capture.x - end.x) < 1 && Math.abs(capture.y - end.y) < 1 : false;
  }).toBe(true);
  await expect(page.locator('.practice-panel').first()).toHaveAttribute('data-status', 'running');
  await page.getByRole('button', { name: 'Hoàn tất', exact: true }).click();
  await expect(page.locator('.practice-panel').first()).toHaveAttribute('data-status', 'completed');
  const records = await page.evaluate(async () => {
    const request = indexedDB.open('alicetype', 1);
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const read = db.transaction('sessions').objectStore('sessions').getAll();
    const result = await new Promise<unknown[]>((resolve) => { read.onsuccess = () => resolve(read.result); });
    db.close(); return result;
  });
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    version: 3, language: 'vi', scoringVersion: 'committed-grapheme-v1',
    totalAttempts: 2, correctAttempts: 1, accuracy: 50, targetCharacters: 1, missedKeys: {}
  });
  expect(records[0]).not.toHaveProperty('input');
});

test('Vietnamese Custom under English UI supports native rewrites and blocks pasted answers', async ({ page }) => {
  await setup(page, 'en');
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.getByLabel('Custom text', { exact: true }).fill('xin chào');
  await page.getByRole('button', { name: 'Apply text', exact: true }).click();
  await page.getByRole('button', { name: 'Start typing', exact: true }).click();
  await commit(page, 'xin chao');
  await commit(page, 'xin chào');
  await expect(page.locator('.typing-character.incorrect')).toHaveCount(0);
  await page.locator('#practice-input').evaluate((element) => {
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }));
  });
  await expect(page.locator('#practice-input')).toHaveValue('xin chào');
  await expect(page.getByRole('button', { name: 'Finish', exact: true })).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(page.locator('.practice-panel').first()).toHaveAttribute('data-status', 'completed');
});

test('switching languages preserves Custom drafts and Keyboard Test counts', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Văn bản riêng', exact: true }).click();
  await page.getByLabel('Văn bản riêng', { exact: true }).fill('Tiếng Việt');
  await page.getByLabel('Ngôn ngữ', { exact: true }).selectOption('en');
  await expect(page.getByLabel('Custom text', { exact: true })).toHaveValue('Tiếng Việt');
  await page.getByRole('button', { name: 'Keyboard Test', exact: true }).click();
  await page.getByRole('button', { name: 'Freestyle', exact: true }).click();
  await page.getByRole('region', { name: 'Keyboard test input', exact: true }).focus();
  await page.keyboard.press('a');
  const key = page.locator('.keyboard-test-panel .keyboard-key[data-code="KeyA"]');
  const count = await key.getAttribute('data-count');
  await page.getByLabel('Language', { exact: true }).selectOption('vi');
  await expect(key).toHaveAttribute('data-count', count!);
});

test('composition candidate Enter does not finish, and input-before-compositionend scores once', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Văn bản riêng', exact: true }).click();
  await page.getByLabel('Văn bản riêng', { exact: true }).fill('á');
  await page.getByRole('button', { name: 'Áp dụng văn bản', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu gõ', exact: true }).click();
  await page.locator('#practice-input').evaluate((element: HTMLInputElement) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    element.value = 'a\u0301';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText' }));
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', isComposing: true, keyCode: 229 }));
  });
  await expect(page.locator('.practice-panel').first()).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('.metric-value').nth(1)).toHaveText('—');
  await page.locator('#practice-input').dispatchEvent('compositionend', { data: 'á' });
  await expect(page.locator('#practice-input')).toHaveValue('á');
  await expect(page.locator('.practice-panel').first()).toHaveAttribute('data-status', 'running');
  await expect(page.locator('.metric-value').nth(1)).toHaveText('100,0%');
  await page.locator('#practice-input').dispatchEvent('keydown', { key: 'Enter', keyCode: 229 });
  await expect(page.locator('.practice-panel').first()).toHaveAttribute('data-status', 'running');
  await page.keyboard.press('Enter');
  await expect(page.locator('.practice-panel').first()).toHaveAttribute('data-status', 'completed');
});

test('blur cancels preedit and rejects late events without changing accepted text', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Bắt đầu gõ', exact: true }).click();
  await commit(page, 't');
  await page.locator('#practice-input').evaluate((element: HTMLInputElement) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    element.value = 'tô';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText' }));
    element.blur();
    element.value = 'tôi';
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText' }));
  });
  await expect(page.locator('#practice-input')).toHaveValue('t');
  await expect(page.locator('.preedit')).toHaveCount(0);
  await expect(page.locator('.typing-character.correct')).toHaveCount(1);
  await expect(page.getByText('Đã hủy nội dung đang nhập chưa xác nhận.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bắt đầu lại', exact: true }).click();
  await expect(page.locator('#practice-input')).toHaveValue('');
  await expect(page.getByLabel('Ngôn ngữ', { exact: true })).toBeEnabled();
});

test('timed deadline discards provisional composition and freezes the committed score', async ({ page }) => {
  await page.clock.install();
  await setup(page);
  await page.getByLabel('Thời lượng', { exact: true }).selectOption('15');
  await page.getByRole('button', { name: 'Bắt đầu gõ', exact: true }).click();
  await commit(page, 't');
  await page.locator('#practice-input').evaluate((element: HTMLInputElement) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    element.value = 'tôi';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText' }));
  });
  await page.clock.fastForward(15_000);
  await expect(page.locator('.practice-panel').first()).toHaveAttribute('data-status', 'completed');
  await expect(page.locator('#practice-input')).toHaveValue('t');
  await expect(page.locator('.preedit')).toHaveCount(0);
  await page.locator('#practice-input').dispatchEvent('compositionend', { data: 'tôi' });
  await expect(page.locator('.typing-character.correct')).toHaveCount(1);
  await expect(page.getByLabel('Ngôn ngữ', { exact: true })).toBeEnabled();
});

test('missing grapheme capability shows an actionable message without crashing the app', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true }));
  await setup(page);
  await expect(page.getByText('Hãy cập nhật trình duyệt để luyện gõ Unicode.', { exact: true })).toBeVisible();
  await expect(page.locator('.practice-panel').first()).toHaveAttribute('data-status', 'error');
  await expect(page.locator('#app-language')).toBeEnabled();
  await page.getByRole('button', { name: 'Kiểm tra bàn phím', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tự do', exact: true })).toBeVisible();
});

test('Zen capture follows the writing caret without duplicating accepted text during composition', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Zen', exact: true }).click();
  await page.getByRole('button', { name: 'Đặt con trỏ để viết', exact: true }).click();
  await commit(page, 'xin ');
  await expect(page.locator('.zen-writing')).toHaveText('xin ');
  await expect.poll(async () => {
    const capture = await page.locator('#practice-input').boundingBox();
    const caret = await page.locator('.zen-caret').boundingBox();
    return capture && caret ? Math.abs(capture.x - caret.x) < 1 && Math.abs(capture.y - caret.y) < 1 : false;
  }).toBe(true);
  await page.locator('#practice-input').evaluate((element: HTMLInputElement) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    element.value = 'xin cha\u0300o';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText' }));
  });
  await expect(page.locator('.preedit')).toHaveText('chào');
  await expect(page.locator('.zen-writing')).toHaveText('xin ');
  await page.locator('#practice-input').dispatchEvent('compositionend', { data: 'chào' });
  await expect(page.locator('.zen-writing')).toHaveText('xin chào');
  await expect(page.locator('.preedit')).toHaveCount(0);
});
