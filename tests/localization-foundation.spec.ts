import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/fixtures/localization.html');
});

test('translates header visible and accessible names without resetting its selected view', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'App views' });
  await expect(nav.getByRole('button')).toHaveText(['Practice', 'Keyboard Test', 'Keyboard Details', 'Stats']);
  await nav.getByRole('button', { name: 'Stats', exact: true }).click();
  await page.getByRole('button', { name: 'Vietnamese fixture' }).click();
  const vietnameseNav = page.getByRole('navigation', { name: 'Các mục của ứng dụng' });
  await expect(vietnameseNav.getByRole('button')).toHaveText([
    'Luyện gõ', 'Kiểm tra bàn phím', 'Thông tin bàn phím', 'Thống kê'
  ]);
  await expect(vietnameseNav.getByRole('button', { name: 'Thống kê' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('fixture-view')).toHaveText('stats');
  await expect(page.getByRole('heading', { name: 'AliceType' })).toBeVisible();
  await page.getByRole('button', { name: 'English fixture' }).click();
  await expect(nav.getByRole('button', { name: 'Stats', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('preserves keyboard navigation and the existing disabled guard in Vietnamese', async ({ page }) => {
  await page.getByRole('button', { name: 'Vietnamese fixture' }).click();
  const practice = page.getByRole('button', { name: 'Luyện gõ', exact: true });
  await practice.focus();
  await page.keyboard.press('Tab');
  const keyboardTest = page.getByRole('button', { name: 'Kiểm tra bàn phím', exact: true });
  await expect(keyboardTest).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('fixture-view')).toHaveText('keyboard-test');
  await page.getByRole('button', { name: 'Toggle fixture lock' }).click();
  for (const button of await page.getByRole('navigation').getByRole('button').all()) {
    await expect(button).toBeDisabled();
  }
});

test('allows Vietnamese header labels to wrap without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.getByRole('button', { name: 'Vietnamese fixture' }).click();
  await expect(page.getByRole('button', { name: 'Thông tin bàn phím', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
