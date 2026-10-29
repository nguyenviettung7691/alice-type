import { getLanguage, type LanguageId } from './languages';

function finite(value: number): void {
  if (!Number.isFinite(value)) throw new Error('A formatted value must be finite.');
}

export function formatNumber(language: LanguageId, value: number, fractionDigits = 0): string {
  finite(value);
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 20) {
    throw new Error('Unsupported number precision.');
  }
  return new Intl.NumberFormat(getLanguage(language).locale, {
    minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits
  }).format(value);
}

export function formatAccuracy(language: LanguageId, percent: number): string {
  finite(percent);
  if (percent < 0 || percent > 100) throw new Error('Accuracy must be between zero and one hundred.');
  return new Intl.NumberFormat(getLanguage(language).locale, {
    style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1
  }).format(percent / 100);
}

export function formatDate(language: LanguageId, timestamp: number): string {
  finite(timestamp);
  if (!Number.isFinite(new Date(timestamp).getTime())) throw new Error('Unsupported date.');
  return new Intl.DateTimeFormat(getLanguage(language).locale, {
    dateStyle: 'medium', timeStyle: 'short'
  }).format(timestamp);
}

export function compareLabels(language: LanguageId, left: string, right: string): number {
  return new Intl.Collator(getLanguage(language).locale).compare(left, right);
}
