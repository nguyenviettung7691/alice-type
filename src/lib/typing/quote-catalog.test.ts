import { describe, expect, it, vi } from 'vitest';
import notice from './QUOTE-NOTICE.txt?raw';
import footer from '../components/AppFooter.svelte?raw';
import { ExerciseGenerationError } from './exercise-generator';
import { QUOTES, selectQuote, validateQuoteCatalog, type Quote } from './quote-catalog';
import { translate } from '../i18n/messages';

function catalogWith(changes: Partial<Quote>): readonly Quote[] {
  return [{ ...QUOTES[0], ...changes }, QUOTES[1]];
}

describe('bundled literary quote catalog', () => {
  it('contains at least twelve distinct passages across three original-English works', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(QUOTES.map((quote) => quote.workTitle)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(QUOTES.map((quote) => quote.id)).size).toBe(QUOTES.length);
    expect(new Set(QUOTES.map((quote) => quote.text)).size).toBe(QUOTES.length);
    expect(() => validateQuoteCatalog(QUOTES)).not.toThrow();
    expect(Object.isFrozen(QUOTES)).toBe(true);
    for (const quote of QUOTES) {
      expect(Object.isFrozen(quote)).toBe(true);
      expect(quote.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(quote.text.length).toBeGreaterThanOrEqual(40);
      expect(quote.text.length).toBeLessThanOrEqual(1000);
      expect(quote.text).toMatch(/^[\x20-\x7e]+$/);
      expect(quote.text).toBe(quote.text.trim());
      expect(quote.text).not.toContain('  ');
    }
  });

  it('bundles specific edition, attribution, US rights, date, and adaptation evidence for every passage', () => {
    for (const quote of QUOTES) {
      expect(quote.author.trim()).not.toBe('');
      expect(quote.workTitle.trim()).not.toBe('');
      expect(new URL(quote.sourceUrl).protocol).toBe('https:');
      expect(new URL(quote.sourceUrl).hash).not.toBe('');
      expect(quote.rights).toContain('Public domain in the United States');
      expect(quote.rights).toContain('outside the United States');
      expect(quote.rights).toContain('eBook');
      expect(quote.reviewedAt).toBe('2026-10-27');
      expect(quote.adaptationNote).toContain('excerpt');
      for (const value of [quote.id, quote.author, quote.workTitle, quote.sourceUrl, quote.reviewedAt]) {
        expect(notice).toContain(value);
      }
    }
    expect(notice).toContain('original English');
    expect(notice).toContain('George Allen, London, 1894');
    expect(notice).toContain('MILLENNIUM FULCRUM EDITION 3.0');
    expect(notice).toContain('October 10, 2023');
    expect(notice).toContain('https://www.gutenberg.org/policy/license.html');
    expect(notice).toContain('Section 1.C');
    expect(notice).toContain('not universal clearance');
    expect(footer).toContain("import quoteNotice from '../typing/QUOTE-NOTICE.txt?url&no-inline'");
    expect(footer).toContain('href={quoteNotice}');
    expect(footer).toContain('text("app-footer.quote-attribution")');
    expect(translate('en', 'app-footer.quote-attribution')).toBe('Quote attribution');
    expect(translate('vi', 'app-footer.quote-attribution')).toBe('Ghi công nguồn đoạn văn');
  });

  it('preserves original spelling, punctuation, and explicitly documented typography adaptations', () => {
    expect(QUOTES.find((quote) => quote.id === 'pride-the-surrounding-families')?.text).toContain('neighbourhood');
    const opening = QUOTES.find((quote) => quote.id === 'pride-a-truth-universally-acknowledged');
    expect(opening?.text).toMatch(/^It is a truth universally acknowledged,/);
    expect(opening?.adaptationNote).toContain('drop-cap IT rendered as It');
    const dialogue = QUOTES.find((quote) => quote.id === 'pride-netherfield-park');
    expect(dialogue?.text).toBe('"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"');
    expect(dialogue?.adaptationNote).toContain('straight ASCII quotes');
  });
});

describe('quote catalog validation', () => {
  it.each([[], [QUOTES[0]], null, {}, 'quotes'])('rejects insufficient or non-array data: %j', (quotes) => {
    expect(() => validateQuoteCatalog(quotes as readonly Quote[])).toThrow(ExerciseGenerationError);
  });

  it('accepts two entries without mutating input and includes both text bounds', () => {
    const quotes = Object.freeze([
      Object.freeze({ ...QUOTES[0], text: 'a'.repeat(40) }),
      Object.freeze({ ...QUOTES[1], text: 'b'.repeat(1000) })
    ]);
    expect(() => validateQuoteCatalog(quotes)).not.toThrow();
    expect(quotes[0].text).toBe('a'.repeat(40));
    expect(quotes[1].text).toBe('b'.repeat(1000));
  });

  it.each(['', 'Uppercase', '-leading', 'trailing-', 'two--hyphens', 'under_score', 'has space', 'id\n', 'café'])(
    'rejects invalid stable ID %j', (id) => {
      expect(() => validateQuoteCatalog(catalogWith({ id }))).toThrow(ExerciseGenerationError);
    }
  );

  it('rejects duplicate IDs and duplicate passages independently', () => {
    expect(() => validateQuoteCatalog(catalogWith({ id: QUOTES[1].id }))).toThrow('IDs');
    expect(() => validateQuoteCatalog(catalogWith({ text: QUOTES[1].text }))).toThrow('text');
  });

  it.each([
    '', 'a'.repeat(39), 'a'.repeat(1001),
    ` ${'a'.repeat(40)}`, `${'a'.repeat(40)} `, `${'a'.repeat(40)}  b`,
    `${'a'.repeat(40)}\n`, `${'a'.repeat(40)}\r`, `${'a'.repeat(40)}\t`,
    `${'a'.repeat(40)}\u0000`, `${'a'.repeat(40)}\u001f`, `${'a'.repeat(40)}\u007f`,
    `${'a'.repeat(40)}\u00a0`, `${'a'.repeat(40)}\u200b`, `${'a'.repeat(40)}é`,
    `${'a'.repeat(40)}“`, `${'a'.repeat(40)}😀`
  ])('rejects out-of-bounds, non-ASCII, or unnormalized text %j', (text) => {
    expect(() => validateQuoteCatalog(catalogWith({ text }))).toThrow(ExerciseGenerationError);
  });

  it('checks runtime object and field types rather than trusting TypeScript', () => {
    for (const quote of [null, 42, 'quote', {}, { ...QUOTES[0], id: null }, { ...QUOTES[0], text: 42 }]) {
      expect(() => validateQuoteCatalog([quote, QUOTES[1]] as unknown as readonly Quote[])).toThrow(ExerciseGenerationError);
    }
    for (const field of ['author', 'workTitle', 'sourceUrl', 'rights', 'reviewedAt', 'adaptationNote']) {
      for (const value of [undefined, null, 42, '', ' \n ']) {
        expect(() => validateQuoteCatalog(catalogWith({ [field]: value }))).toThrow(ExerciseGenerationError);
      }
    }
  });

  it.each(['not a URL', '/relative', '//example.org/book', 'javascript:alert(1)', 'data:text/plain,quote', 'file:///book', 'ftp://example.org/book'])(
    'rejects unsafe or invalid source URL %j', (sourceUrl) => {
      expect(() => validateQuoteCatalog(catalogWith({ sourceUrl }))).toThrow(ExerciseGenerationError);
    }
  );

  it.each(['https://example.org/book#chapter', 'http://example.org/book'])('accepts source scheme %s', (sourceUrl) => {
    expect(() => validateQuoteCatalog(catalogWith({ sourceUrl }))).not.toThrow();
  });

  it.each(['2026-2-01', '2026-02-29', '2026-04-31', '2026-13-01', '2026-10-00', 'yesterday', '2026-10-27T00:00:00Z'])(
    'rejects invalid review date %s', (reviewedAt) => {
      expect(() => validateQuoteCatalog(catalogWith({ reviewedAt }))).toThrow(ExerciseGenerationError);
    }
  );

  it('accepts a real leap day', () => {
    expect(() => validateQuoteCatalog(catalogWith({ reviewedAt: '2024-02-29' }))).not.toThrow();
  });
});

describe('uniform quote selection', () => {
  it('chooses first and last entries at the RNG bounds', () => {
    expect(selectQuote(undefined, () => 0)).toBe(QUOTES[0]);
    expect(selectQuote(undefined, () => 1 - Number.EPSILON)).toBe(QUOTES.at(-1));
  });

  it.each(QUOTES.map((quote) => quote.id))('uniformly excludes current ID %s with a single RNG draw', (currentId) => {
    const eligible = QUOTES.filter((quote) => quote.id !== currentId);
    for (const [index, expected] of eligible.entries()) {
      const random = vi.fn(() => (index + 0.5) / eligible.length);
      expect(selectQuote(currentId, random)).toBe(expected);
      expect(random).toHaveBeenCalledTimes(1);
    }
    expect(selectQuote(currentId, () => 0)).toBe(eligible[0]);
    expect(selectQuote(currentId, () => 1 - Number.EPSILON)).toBe(eligible.at(-1));
  });

  it('gives each entry an equal interval when current ID is absent or unknown', () => {
    for (const currentId of [undefined, 'removed-catalog-id']) {
      for (const [index, expected] of QUOTES.entries()) {
        expect(selectQuote(currentId, () => index / QUOTES.length)).toBe(expected);
      }
    }
  });

  it.each([-1, -Number.EPSILON, 1, 2, NaN, Infinity, -Infinity, '0', null, undefined])(
    'rejects invalid RNG result %s explicitly', (value) => {
      expect(() => selectQuote(undefined, () => value as number)).toThrow(ExerciseGenerationError);
      expect(() => selectQuote(QUOTES[0].id, () => value as number)).toThrow('random source');
    }
  );

  it('defaults to Math.random and returns the original immutable entry', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      expect(selectQuote()).toBe(QUOTES[0]);
      expect(random).toHaveBeenCalledTimes(1);
    } finally {
      random.mockRestore();
    }
  });
});
