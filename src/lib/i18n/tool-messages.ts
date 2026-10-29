import type { MessageKey } from './message-contract';
import type { LanguageId } from './languages';
import type { KeyboardTestEffect } from '../audio/keyboard-test-sound';
import { translate } from './messages';
import type { LayoutCandidateReason } from '../keyboard/layout-matching';

export const TOOL_MESSAGES = {
  testIntro: "tool-messages.check-your-keys-one-at-a-time",
  freestyleInstructions: "tool-messages.focus-the-test-area-then-press-any",
  guidedInstructions: "tool-messages.focus-the-test-area-then-press-the",
  guidedTab: "tool-messages.if-tab-is-highlighted-press-it-to",
  soundHelp: "tool-messages.sound-is-off-by-default-when-on",
  heatmapHelp: "tool-messages.numbers-show-miss-counts-heat-key-misses",
  previewHelp: "tool-messages.preview-not-confirmed-default-key-labels-may",
  importedKeysHelp: "tool-messages.dashed-keys-have-no-standard-key-code",
  freestyleDescription: "tool-messages.each-countable-cell-shows-how-many-times",
  guidedDescription: "tool-messages.an-arrow-marks-the-expected-key-a",
  practiceDescription: "tool-messages.recent-accepted-printable-presses-briefly-show-an"
} as const;

const EFFECT_LABELS = {
  default: "tool-messages.default", bubble: "tool-messages.bubble",
  horn: "tool-messages.horn", cartoon: "tool-messages.cartoon",
  coin: "tool-messages.coin", 'dog-bark': "tool-messages.dog-bark",
  glass: "tool-messages.glass", donkey: "tool-messages.donkey",
  phone: "tool-messages.phone", punch: "tool-messages.punch",
  'plastic-toy': "tool-messages.plastic-toy", sneeze: "tool-messages.sneeze",
  'plastic-chicken': "tool-messages.plastic-chicken"
} as const satisfies Record<KeyboardTestEffect, MessageKey>;

export function testEffectLabel(language: LanguageId, effect: KeyboardTestEffect): string {
  return translate(language, EFFECT_LABELS[effect]);
}

export function keyPressMessage(language: LanguageId, legend: string, count: number): string {
  return count === 1
    ? translate(language, "tool-messages.was-pressed-time", { p0: String(legend), p1: String(count) })
    : translate(language, "tool-messages.was-pressed-times", { p0: String(legend), p1: String(count) });
}

export function testProgressMessage(language: LanguageId, tested: number, total: number, presses?: number): string {
  if (presses === undefined) return translate(language, "tool-messages.of-keys-checked", { p0: String(tested), p1: String(total) });
  return presses === 1
    ? translate(language, "tool-messages.of-keys-tried-key-press", { p0: String(tested), p1: String(total), p2: String(presses) })
    : translate(language, "tool-messages.of-keys-tried-key-presses", { p0: String(tested), p1: String(total), p2: String(presses) });
}

export function testModeLabel(language: LanguageId, mode: 'guided' | 'freestyle'): string {
  return mode === 'guided' ? translate(language, "tool-messages.one-key-at-a-time")
    : translate(language, "tool-messages.freestyle");
}

export function testModeMessage(language: LanguageId, mode: 'guided' | 'freestyle'): string {
  return translate(language, "tool-messages.switched-to-test-reset", { p0: String(testModeLabel(language, mode)) });
}

export function keyResultMessage(language: LanguageId, legend: string, code: string, count: number, kind: 'miss' | 'press'): string {
  if (kind === 'miss') return count === 1
    ? translate(language, "tool-messages.miss", { p0: String(legend), p1: String(code), p2: String(count) })
    : translate(language, "tool-messages.misses", { p0: String(legend), p1: String(code), p2: String(count) });
  return count === 1
    ? translate(language, "tool-messages.press", { p0: String(legend), p1: String(code), p2: String(count) })
    : translate(language, "tool-messages.presses", { p0: String(legend), p1: String(code), p2: String(count) });
}

export function candidateReason(language: LanguageId, reason: LayoutCandidateReason): string {
  switch (reason.code) {
    case 'usb-id': return translate(language, 'tool-messages.usb-id-matches', { p0: reason.id });
    case 'shared-id': return translate(language, 'tool-messages.id-shared-by-keyboards-check-the-preview', { p0: String(reason.count) });
    case 'device-name': return translate(language, 'tool-messages.device-name-matches-the-board-name', { p0: reason.name });
    case 'board-name': return translate(language, 'tool-messages.your-board-name-matches', { p0: reason.name });
    case 'name-only': return translate(language, 'tool-messages.name-match-only-check-the-preview');
  }
}
