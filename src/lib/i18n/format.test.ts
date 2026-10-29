import { describe, expect, it } from 'vitest';
import { compareLabels, formatAccuracy, formatDate, formatNumber, formatShortDay, formatTime } from './format';

describe('locale-aware presentation', () => {
  it('formats numbers without modifying their numeric values', () => {
    const number = 1234.56;
    expect(formatNumber('en', number, 1)).toBe('1,234.6');
    expect(formatNumber('vi', number, 1)).toBe('1.234,6');
    expect(formatNumber('en', number)).toBe('1,235');
    expect(formatNumber('vi', 0, 2)).toBe('0,00');
    expect(number).toBe(1234.56);
  });

  it('accepts accuracy percentages rather than treating 99.9 as a fraction', () => {
    for (const language of ['en', 'vi'] as const) {
      const locale = language === 'en' ? 'en-US' : 'vi-VN';
      for (const value of [0, 99.9, 100]) {
        expect(formatAccuracy(language, value)).toBe(new Intl.NumberFormat(locale, {
          style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1
        }).format(value / 100));
      }
    }
  });

  it('formats dates in the current local time zone', () => {
    const timestamp = Date.UTC(2026, 9, 29, 8, 30);
    expect(formatDate('vi', timestamp)).toBe(new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium', timeStyle: 'short'
    }).format(timestamp));
    expect(formatDate('en', timestamp)).toBe(new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium', timeStyle: 'short'
    }).format(timestamp));
  });

  it('formats short chart times and days in the selected locale', () => {
    const timestamp = Date.UTC(2026, 9, 29, 8, 30);
    expect(formatTime('en', timestamp)).toBe(new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(timestamp));
    expect(formatTime('vi', timestamp)).toBe(new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short' }).format(timestamp));
    expect(formatShortDay('vi', timestamp)).toBe(new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short' }).format(timestamp));
    expect(() => formatTime('en', NaN)).toThrow('finite');
    expect(() => formatShortDay('en', 8.64e15 + 1)).toThrow('Unsupported date');
  });

  it('compares localized labels with the selected language collator', () => {
    expect(compareLabels('vi', 'Đất', 'Gió')).toBeLessThan(0);
    expect(compareLabels('vi', 'Thống kê', 'Thống kê')).toBe(0);
    expect(Math.sign(compareLabels('en', 'Keyboard', 'Practice'))).toBe(-1);
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite values %s explicitly', (value) => {
    expect(() => formatNumber('en', value)).toThrow('finite');
    expect(() => formatAccuracy('vi', value)).toThrow('finite');
    expect(() => formatDate('vi', value)).toThrow('finite');
  });

  it.each([-1, 21, 1.5, NaN, Infinity])('rejects invalid fraction precision %s', (value) => {
    expect(() => formatNumber('en', 1, value)).toThrow('precision');
  });

  it.each([-0.1, 100.1])('rejects out-of-range accuracy %s', (value) => {
    expect(() => formatAccuracy('vi', value)).toThrow('between');
  });

  it('rejects dates outside the Date range', () => {
    expect(() => formatDate('en', 8.64e15 + 1)).toThrow('Unsupported date');
  });
});
