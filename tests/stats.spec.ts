import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, skipOnboarding } from './support';

const stats = (page: Page) => page.locator('.stats-panel');
const key = (page: Page, code: string) => stats(page).locator(`.keyboard-key[data-code="${code}"]`);
const nav = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function seedHistory(page: Page, missedKeys: Record<string, number>, count = 1) {
  await page.evaluate(async ({ missedKeys, count }) => {
    const path = '/src/lib/storage/session-history.ts';
    const { SessionHistory }: typeof import('../src/lib/storage/session-history') = await import(path);
    const history = new SessionHistory();
    const misses = Object.values(missedKeys).reduce((sum, value) => sum + value, 0);
    try {
      for (let index = 0; index < count; index += 1) {
        await history.save({
          version: 2, id: `stats-${index}`, completedAt: 1000 + index * 1000,
          mode: 'words', limit: 10, wordBankTier: 200, punctuation: false, numbers: false,
          wpm: 40 + index, totalAttempts: 100 + misses, correctAttempts: 100,
          accuracy: Math.round(100 / (100 + misses) * 1000) / 10, missedKeys
        });
      }
    } finally { history.close(); }
  }, { missedKeys, count });
}

test.beforeEach(async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/');
});

test('separates sections, aligns metric cards, and bounds history with a sticky header', async ({ page }) => {
  await seedHistory(page, { KeyA: 4, KeyS: 2 }, 30);
  await nav(page, 'Stats').click();
  for (const name of ['Stats summary', 'Recent sessions', 'Most-missed physical keys']) {
    await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
  }
  const cards = await stats(page).locator('.stats-summary > div').evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      const value = element.querySelector('dd')!.getBoundingClientRect();
      return { top: box.top, bottom: value.bottom, border: getComputedStyle(element).borderTopWidth };
    }));
  expect(cards.length).toBe(6);
  for (const card of cards) {
    expect(card.border).toBe('2px');
    for (const peer of cards.filter((other) => Math.abs(other.top - card.top) < 1)) {
      expect(Math.abs(peer.bottom - card.bottom)).toBeLessThan(1);
    }
  }
  const scroll = stats(page).locator('.history-scroll');
  await expect(scroll.locator('tbody tr')).toHaveCount(30);
  await expect(scroll.locator('tbody tr').first()).toContainText('69');
  const bounds = await scroll.evaluate((element) => ({
    height: element.clientHeight, content: element.scrollHeight, overflow: getComputedStyle(element).overflowY
  }));
  expect(bounds.height).toBeLessThanOrEqual(400);
  expect(bounds.content).toBeGreaterThan(bounds.height);
  expect(bounds.overflow).toBe('auto');
  const widths = await scroll.evaluate((element) => ({
    scroll: element.clientWidth, table: element.querySelector('table')!.getBoundingClientRect().width,
    section: element.closest('.stats-section')!.clientWidth
  }));
  expect(widths.table).toBeGreaterThanOrEqual(widths.scroll - 1);
  expect(widths.scroll).toBeGreaterThan(widths.section * 0.85);
  await expect(scroll.locator('.percent-value').first()).toHaveCSS('color', /^color\(srgb 1 0\.[3-9]/);
  await scroll.getByRole('button', { name: /^WPM/ }).click();
  await expect(scroll.locator('th[aria-sort="descending"]')).toContainText('WPM');
  await scroll.getByRole('button', { name: /^WPM/ }).click();
  await expect(scroll.locator('tbody tr').first()).toContainText('40');
  const header = scroll.locator('th').first();
  await scroll.focus();
  const headerOffset = async () => (await header.boundingBox())!.y - (await scroll.boundingBox())!.y;
  const before = await headerOffset();
  await page.keyboard.press('PageDown');
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(Math.abs(await headerOffset() - before)).toBeLessThan(1);
});

test('renders exact miss counts and proportional heat, shared spacebars, and unmapped codes', async ({ page }) => {
  await seedHistory(page, { KeyA: 4, KeyS: 2, Space: 1, IntlBackslash: 8 });
  await nav(page, 'Stats').click();
  await expect(page.getByRole('img', { name: 'Generic Alice missed-key heatmap' })).toBeVisible();
  for (const [code, count, heat] of [['KeyA', '4', '0.5'], ['KeyS', '2', '0.25'], ['Space', '1', '0.125'], ['KeyD', '0', '0']]) {
    await expect(key(page, code)).toHaveAttribute('data-count', count);
    await expect(key(page, code)).toHaveAttribute('data-heat', heat);
    for (const label of await key(page, code).locator('.key-count').all()) await expect(label).toHaveText(count);
  }
  expect(await key(page, 'Space').locator('rect').count()).toBe(2);
  const fills = await Promise.all(['KeyA', 'KeyS', 'KeyD'].map((code) =>
    key(page, code).locator('rect').first().evaluate((element) => getComputedStyle(element).fill)));
  expect(new Set(fills).size).toBe(3);
  await expect(stats(page).locator('.heat-scale')).toContainText('8 max');
  await expect(stats(page).locator('.unmapped-misses')).toContainText('IntlBackslash: 8 misses');
  await stats(page).getByText('Text key results', { exact: true }).click();
  await expect(stats(page).locator('.key-results')).toContainText('A (KeyA): 4 misses');
  await nav(page, 'Clear history').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete history' }).click();
  await expect(stats(page).getByText(/No saved sessions yet/)).toBeVisible();
  await expect(stats(page).locator('.keyboard-visualizer')).toHaveCount(0);
});

test('zero-miss heatmap stays neutral and remains usable on a narrow screen', async ({ page }) => {
  await seedHistory(page, {});
  await page.setViewportSize({ width: 375, height: 812 });
  await nav(page, 'Stats').click();
  await expect(stats(page).getByText(/No physical-key errors recorded/)).toBeVisible();
  await expect(key(page, 'KeyA')).toHaveAttribute('data-heat', '0');
  await expect(key(page, 'KeyA').locator('.key-count')).toHaveText('0');
  const scroll = stats(page).getByRole('region', { name: 'Keyboard diagram scroll area' });
  await expect(scroll).toHaveAttribute('tabindex', '0');
  await scroll.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('uses the confirmed layout geometry and browser key legends in Stats', async ({ page }) => {
  await page.evaluate(({ key, defaults }) => {
    localStorage.setItem(key, JSON.stringify({ version: 5, settings: {
      ...defaults, onboardingComplete: true, keyboardProfileId: 'keychron-q8-ansi',
      keyboardLayoutConfirmation: {
        profileId: 'keychron-q8-ansi', variant: {}, confirmedFor: null, catalogRevision: 'test'
      }
    } }));
  }, { key: PREFERENCES_KEY, defaults: DEFAULT_PREFERENCES });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'keyboard', { configurable: true, value: {
      getLayoutMap: async () => new Map([['KeyA', '\u03b1']])
    } });
  });
  await page.reload();
  await expect(page.locator('.practice-panel .keyboard-visualizer')).toHaveAttribute('data-layout-source', 'confirmed');
  await page.locator('.keyboard-connection summary').click();
  await nav(page, 'Refresh key labels').click();
  await expect(page.locator('.practice-panel .keyboard-key[data-code="KeyA"] .key-legend')).toHaveText('\u03b1');
  const caps = await page.locator('.practice-panel .keyboard-key rect').count();
  await seedHistory(page, { KeyA: 4 });
  await nav(page, 'Stats').click();
  await expect(stats(page).locator('.keyboard-visualizer')).toHaveAttribute('data-layout-source', 'confirmed');
  await expect(page.getByRole('img', { name: 'Keychron Q8 ANSI missed-key heatmap' })).toBeVisible();
  await expect(key(page, 'KeyA').locator('.key-legend')).toHaveText('\u03b1');
  await expect(stats(page).locator('.keyboard-key rect')).toHaveCount(caps);
  await expect(stats(page).locator('.inert-key').first()).toBeAttached();
  await expect(stats(page).locator('.inert-key .key-count')).toHaveCount(0);
  await expect(key(page, 'KeyA')).toHaveAttribute('data-heat', '1');
});

async function seedRecords(page: Page, records: Record<string, unknown>[]) {
  await page.evaluate(async (records) => {
    const path = '/src/lib/storage/session-history.ts';
    const { SessionHistory }: typeof import('../src/lib/storage/session-history') = await import(path);
    const history = new SessionHistory();
    try {
      for (const record of records) await history.save(record as never);
    } finally { history.close(); }
  }, records);
}

function timelineRecord(index: number, language: 'en' | 'vi', mode: 'timed' | 'words' | 'quote' | 'custom',
  wpm: number, correct: number, total = 100) {
  const branch = {
    timed: { limit: 30, wordBankTier: 200, punctuation: false, numbers: false },
    words: { limit: 10, wordBankTier: 200, punctuation: false, numbers: false },
    quote: { quoteId: 'chart-quote', targetCharacters: 50, elapsedMs: 20_000 },
    custom: { targetCharacters: 20, elapsedMs: 10_000 }
  }[mode];
  return {
    version: 3, language, scoringVersion: 'committed-grapheme-v1', id: `chart-${index}`,
    completedAt: Date.UTC(2026, 9, 29, 4, 33) + index * 60_000, mode, ...branch, wpm,
    totalAttempts: total, correctAttempts: correct, accuracy: Math.round(correct / total * 1000) / 10, missedKeys: {}
  };
}

test('charts the latest ten target-copying sessions above the history table', async ({ page }) => {
  const modes = ['timed', 'words', 'quote', 'custom'] as const;
  const records = Array.from({ length: 12 }, (_, index) =>
    timelineRecord(index, index % 3 === 2 ? 'vi' : 'en', modes[index % 4], 30 + index, index === 11 ? 40 : 95));
  await seedRecords(page, [...records, {
    version: 3, language: 'en', scoringVersion: 'committed-grapheme-v1', id: 'chart-zen',
    completedAt: Date.UTC(2026, 9, 29, 5, 0), mode: 'zen', elapsedMs: 5000, retainedCharacters: 10,
    totalAttempts: 10, wpm: 99, accuracy: null, correctAttempts: null, missedKeys: {}
  }]);
  await nav(page, 'Stats').click();
  const section = page.getByRole('region', { name: 'Recent sessions', exact: true });
  const chart = section.locator('.progress-chart');
  await expect(chart.getByRole('heading', { name: 'Progress: last 10 target-copying sessions' })).toBeVisible();
  const chartBox = (await chart.boundingBox())!;
  const tableBox = (await section.locator('.history-scroll').boundingBox())!;
  expect(chartBox.y + chartBox.height).toBeLessThanOrEqual(tableBox.y);

  const nodes = chart.locator('.timeline-chart .timeline-node');
  await expect(nodes).toHaveCount(10);
  const data = await nodes.evaluateAll((elements) => elements.map((element) => ({
    order: Number(element.getAttribute('data-order')), wpm: Number(element.getAttribute('data-wpm')),
    accuracy: Number(element.getAttribute('data-accuracy')), language: element.getAttribute('data-language'),
    mode: element.getAttribute('data-mode'), below: element.getAttribute('data-below-floor'),
    x: element.querySelector('.wpm-node')!.getBoundingClientRect().x
  })));
  expect(data.map((point) => point.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(data.map((point) => point.wpm)).toEqual([32, 33, 34, 35, 36, 37, 38, 39, 40, 41]);
  expect(data.every((point, index) => index === 0 || point.x > data[index - 1].x)).toBe(true);
  expect(data[0]).toMatchObject({ language: 'vi', mode: 'quote', accuracy: 95 });
  expect(data[9]).toMatchObject({ language: 'vi', mode: 'custom', accuracy: 40, below: 'true' });
  expect(data.filter((point) => point.below === 'true')).toHaveLength(1);
  await expect(chart.locator('.timeline-chart .below-floor-marker')).toHaveCount(1);
  await expect(chart.getByText('Below 50.0%: drawn at the axis floor')).toBeVisible();
  await expect(chart.locator('.timeline-chart .wpm-line')).toHaveCSS('stroke', 'rgb(255, 93, 0)');
  await expect(chart.locator('.timeline-chart .accuracy-line')).toHaveCSS('stroke-dasharray', /6/);
  await expect(chart.locator('.timeline-chart .x-tick').first()).toHaveText('#1');
  await expect(chart.locator('.timeline-chart .accuracy-tick').first()).toHaveText('50.0%');
  await expect(chart.locator('.timeline-chart .accuracy-tick').last()).toHaveText('100.0%');
  const colors = await chart.locator('.timeline-chart .wpm-node').evaluateAll((elements) =>
    elements.map((element) => `${element.getAttribute('data-language')}:${getComputedStyle(element).fill}`));
  expect(new Set(colors)).toEqual(new Set(['en:rgb(77, 163, 255)', 'vi:rgb(46, 196, 166)']));
  await expect(chart.getByRole('img', { name: /^10 sessions charted\. WPM from 32 to 41\. Accuracy from 40\.0% to 95\.0%\.$/ })).toBeAttached();
  await expect(chart.getByRole('list', { name: 'Charted sessions, oldest first' }).locator('li').first())
    .toContainText('#1, ');

  const vietnamese = chart.getByRole('button', { name: 'Vietnamese' });
  await expect(vietnamese).toHaveAttribute('aria-pressed', 'true');
  const firstEnglish = chart.locator('.timeline-chart .timeline-node[data-language="en"] .wpm-node').first();
  const firstEnglishPath = await firstEnglish.getAttribute('d');
  await vietnamese.click();
  await expect(vietnamese).toHaveAttribute('aria-pressed', 'false');
  await expect(nodes).toHaveCount(6);
  await expect(chart.locator('.timeline-chart .timeline-node[data-language="vi"]')).toHaveCount(0);
  await expect(chart.locator('.timeline-chart .wpm-node').first()).toHaveAttribute('d', firstEnglishPath!);
  await expect(chart.getByText('Below 50.0%: drawn at the axis floor')).toHaveCount(0);
  await chart.getByRole('button', { name: 'English' }).click();
  await expect(nodes).toHaveCount(0);
  await expect(chart.getByText('All languages are hidden.', { exact: false })).toBeVisible();
  await expect(section.locator('.history-scroll tbody tr')).toHaveCount(13);
});

test('explains an empty chart for Zen-only history and keeps the chart usable on narrow screens', async ({ page }) => {
  await seedRecords(page, [{
    version: 3, language: 'vi', scoringVersion: 'committed-grapheme-v1', id: 'only-zen',
    completedAt: 5000, mode: 'zen', elapsedMs: 5000, retainedCharacters: 10,
    totalAttempts: 10, wpm: 30, accuracy: null, correctAttempts: null, missedKeys: {}
  }]);
  await nav(page, 'Stats').click();
  await expect(stats(page).getByText(/No target-copying sessions to chart yet/)).toBeVisible();
  await expect(stats(page).locator('.timeline-chart')).toHaveCount(0);

  await seedRecords(page, [timelineRecord(1, 'en', 'timed', 50, 98)]);
  await page.setViewportSize({ width: 375, height: 812 });
  await nav(page, 'Refresh history').click();
  await expect(stats(page).locator('.timeline-chart .timeline-node')).toHaveCount(1);
  const scroll = stats(page).getByRole('region', { name: 'Progress: last 10 target-copying sessions' });
  await expect(scroll).toHaveAttribute('tabindex', '0');
  await scroll.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('destructive actions use error colors without changing confirmation behavior', async ({ page }) => {
  const expectDanger = async (button: ReturnType<Page['getByRole']>, filled = false) => {
    await expect(button).toHaveClass(/danger-button/);
    await expect(button).toHaveCSS(filled ? 'background-color' : 'color', 'rgb(255, 77, 79)');
    await expect(button).toHaveCSS('border-top-color', 'rgb(255, 77, 79)');
  };
  await expectDanger(nav(page, 'Restart'));
  await nav(page, 'Custom').click();
  await expectDanger(nav(page, 'Clear text'));
  await nav(page, 'Practice').click();
  await expectDanger(nav(page, 'Restore defaults'));
  await nav(page, 'Restore defaults').click();
  await expectDanger(page.getByRole('dialog').getByRole('button', { name: 'Restore defaults' }), true);
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Cancel' })).not.toHaveClass(/danger-button/);
  await page.keyboard.press('Escape');
  await nav(page, 'Stats').click();
  await expectDanger(nav(page, 'Clear history'));
  await nav(page, 'Clear history').click();
  await expectDanger(nav(page, 'Delete history'), true);
  await page.keyboard.press('Escape');
  await nav(page, 'Keyboard Test').click();
  await expectDanger(nav(page, 'Restart test'), true);
  await nav(page, 'Keyboard Details').click();
  await page.locator('.details-disclosure > summary').click();
  await expectDanger(nav(page, 'Clear my details'));
});
