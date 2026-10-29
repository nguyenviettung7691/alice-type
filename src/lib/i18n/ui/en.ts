import type { MessageCatalog } from '../message-contract';

export const en = {
  'header.language': 'Language',
  'header.languageLocked': 'Restart or stop practice before changing language.',
  'header.views': 'App views',
  'view.practice': 'Practice',
  'view.keyboardTest': 'Keyboard Test',
  'view.keyboardDetails': 'Keyboard Details',
  'view.stats': 'Stats',
  'practice.start': 'Start typing',
  'practice.resume': 'Resume typing',
  'practice.restart': 'Restart',
  'practice.finish': 'Finish',
  'practice.stop': 'Stop',
  'practice.compositionCancelled': 'Uncommitted input was cancelled. Your accepted text is unchanged.',
  'practice.editRejected': 'This edit is not supported. Continue typing at the end of the text.',
  'practice.inputOverrun': 'This input exceeds the target length. Shorten it before trying again.',
  'practice.committedAccuracyHelp': 'Accuracy measures committed text edits, not physical input-method keystrokes.',
  'text.unsupportedBrowser': 'This browser cannot segment practice text safely. Update your browser to use Practice.',
  'text.unsupportedCharacter': 'Unsupported character at position {position} (U+{codePoint}). Use English or Vietnamese text.',
  'text.empty': 'Enter at least one supported character.',
  'storage.languageNotSaved': 'Your language choice works for this visit but was not saved. Reloading may restore the previous language.',
  'storage.retryPreferences': 'Retry preferences',
  'stats.allLanguages': 'All languages',
  'stats.committedAccuracy': 'Committed-text accuracy',
  'stats.legacyAccuracy': 'Historical keystroke accuracy',
  'stats.language': 'Language'
} as const satisfies MessageCatalog;
