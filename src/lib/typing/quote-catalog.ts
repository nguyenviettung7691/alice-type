import { ExerciseGenerationError } from './exercise-generator';
import { isLanguageId, type LanguageId } from '../i18n/languages';
import { isSupportedResourceText } from './text';
import { VI_QUOTES } from './quotes/vi';

export interface Quote {
  readonly language?: LanguageId;
  readonly id: string;
  readonly text: string;
  readonly author: string;
  readonly workTitle: string;
  readonly sourceUrl: string;
  readonly rights: string;
  readonly reviewedAt: string;
  readonly adaptationNote: string;
}

const reviewedAt = '2026-10-27';
const jurisdiction = 'Public domain in the United States; original English text only, not modern annotations or illustrations. Check local copyright law before redistribution outside the United States.';
const alice = {
  author: 'Lewis Carroll',
  workTitle: "Alice's Adventures in Wonderland",
  sourceUrl: 'https://www.gutenberg.org/cache/epub/11/pg11-images.html#chap01',
  rights: `Original work published 1865; reviewed eBook 11, Millennium Fulcrum Edition 3.0, updated June 26, 2025. ${jurisdiction}`,
  reviewedAt,
  adaptationNote: 'Chapter I sentence excerpt; source line wrapping collapsed to single spaces; wording and punctuation unchanged.'
};
const pride = {
  author: 'Jane Austen',
  workTitle: 'Pride and Prejudice',
  sourceUrl: 'https://www.gutenberg.org/cache/epub/1342/pg1342-images.html#Chapter_I',
  rights: `Original work published 1813; reviewed eBook 1342, George Allen 1894 edition. Only Austen's narrative, excluding Saintsbury's preface and Thomson's illustrations. ${jurisdiction}`,
  reviewedAt,
  adaptationNote: 'Chapter I excerpt; curly quotation marks changed to straight ASCII quotes; source line wrapping collapsed and page markers omitted; wording unchanged.'
};
const holmes = {
  author: 'Arthur Conan Doyle',
  workTitle: 'The Adventures of Sherlock Holmes',
  sourceUrl: 'https://www.gutenberg.org/cache/epub/1661/pg1661-images.html#chap01',
  rights: `Original collection published 1892; reviewed eBook 1661, English transcription updated October 10, 2023, anonymous volunteer and Jose Menendez. ${jurisdiction}`,
  reviewedAt,
  adaptationNote: 'A Scandal in Bohemia sentence excerpt; source line wrapping collapsed to single spaces; wording and punctuation unchanged.'
};

export const QUOTES: readonly Quote[] = Object.freeze([
  {
    ...alice,
    id: 'alice-down-the-rabbit-hole',
    text: 'In another moment down went Alice after it, never once considering how in the world she was to get out again.'
  },
  {
    ...alice,
    id: 'alice-the-deep-well',
    text: 'The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.'
  },
  {
    ...alice,
    id: 'alice-time-to-wonder',
    text: 'Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her and to wonder what was going to happen next.'
  },
  {
    ...alice,
    id: 'alice-locked-doors',
    text: 'There were doors all round the hall, but they were all locked; and when Alice had been all the way down one side and up the other, trying every door, she walked sadly down the middle, wondering how she was ever to get out again.'
  },
  {
    ...pride,
    id: 'pride-a-truth-universally-acknowledged',
    text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune must be in want of a wife.',
    adaptationNote: 'Chapter I opening sentence excerpt; drop-cap IT rendered as It; source line wrapping collapsed; wording and punctuation unchanged.'
  },
  {
    ...pride,
    id: 'pride-the-surrounding-families',
    text: 'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.'
  },
  {
    ...pride,
    id: 'pride-netherfield-park',
    text: '"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"'
  },
  {
    ...pride,
    id: 'pride-mrs-long',
    text: '"But it is," returned she; "for Mrs. Long has just been here, and she told me all about it."'
  },
  {
    ...holmes,
    id: 'holmes-the-lit-rooms',
    text: 'His rooms were brilliantly lit, and, even as I looked up, I saw his tall, spare figure pass twice in a dark silhouette against the blind.'
  },
  {
    ...holmes,
    id: 'holmes-pacing-the-room',
    text: 'He was pacing the room swiftly, eagerly, with his head sunk upon his chest and his hands clasped behind him.'
  },
  {
    ...holmes,
    id: 'holmes-long-nervous-hands',
    text: 'He chuckled to himself and rubbed his long, nervous hands together.'
  },
  {
    ...holmes,
    id: 'holmes-the-process-of-deduction',
    text: 'I could not help laughing at the ease with which he explained his process of deduction.'
  }
].map((quote) => Object.freeze(quote)));

export function validateQuoteCatalog(quotes: readonly Quote[], language: LanguageId = 'en'): void {
  if (!isLanguageId(language)) throw new ExerciseGenerationError('Unsupported language identifier.');
  if (!Array.isArray(quotes) || quotes.length < 2) {
    throw new ExerciseGenerationError('The quote catalog must contain at least two entries.');
  }
  const ids = new Set<string>();
  const texts = new Set<string>();
  const provenance = ['author', 'workTitle', 'sourceUrl', 'rights', 'reviewedAt', 'adaptationNote'] as const;
  for (const quote of quotes) {
    if (!quote || typeof quote !== 'object'
      || typeof quote.id !== 'string' || quote.id !== quote.id.trim()
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(quote.id) || ids.has(quote.id)) {
      throw new ExerciseGenerationError('Quote catalog IDs must be unique stable lowercase slugs.');
    }
    if ((quote.language ?? 'en') !== language || (language === 'vi' && !quote.id.startsWith('vi-'))) {
      throw new ExerciseGenerationError('Quote catalog language or ID prefix does not match.');
    }
    if (typeof quote.text !== 'string' || !isSupportedResourceText(quote.text) || quote.text.length < 40 || quote.text.length > 1000
      || (language === 'en' && !/^[\x20-\x7e]+$/.test(quote.text))
      || quote.text !== quote.text.normalize('NFC') || quote.text !== quote.text.trim()
      || quote.text.includes('  ') || texts.has(quote.text)) {
      throw new ExerciseGenerationError('Quote catalog text must be unique supported NFC text, 40-1000 graphemes, with single interior spaces.');
    }
    if (provenance.some((field) => typeof quote[field] !== 'string' || !quote[field].trim())) {
      throw new ExerciseGenerationError('Quote catalog entries require complete provenance.');
    }
    let url: URL;
    try {
      url = new URL(quote.sourceUrl);
    } catch {
      throw new ExerciseGenerationError('Quote catalog source URLs must use HTTP or HTTPS.');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new ExerciseGenerationError('Quote catalog source URLs must use HTTP or HTTPS.');
    }
    const date = new Date(`${quote.reviewedAt}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(quote.reviewedAt)
      || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== quote.reviewedAt) {
      throw new ExerciseGenerationError('Quote catalog review dates must be valid YYYY-MM-DD dates.');
    }
    ids.add(quote.id);
    texts.add(quote.text);
  }
}

validateQuoteCatalog(QUOTES);
validateQuoteCatalog(VI_QUOTES, 'vi');

const catalogs: Readonly<Record<LanguageId, readonly Quote[]>> = Object.freeze({ en: QUOTES, vi: VI_QUOTES });

export function getQuoteCatalog(language: LanguageId = 'en'): readonly Quote[] {
  if (!isLanguageId(language)) throw new ExerciseGenerationError('Unsupported language identifier.');
  return catalogs[language];
}

export function selectQuote(currentId?: string, random: () => number = Math.random, language: LanguageId = 'en'): Quote {
  const eligible = getQuoteCatalog(language).filter((quote) => quote.id !== currentId);
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new ExerciseGenerationError('The quote random source must return a finite number in [0, 1).');
  }
  return eligible[Math.floor(value * eligible.length)];
}
