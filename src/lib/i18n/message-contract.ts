export const MESSAGE_PARAMETERS = {
  'header.language': {},
  'header.languageLocked': {},
  'header.views': {},
  'view.practice': {},
  'view.keyboardTest': {},
  'view.keyboardDetails': {},
  'view.stats': {},
  'practice.start': {},
  'practice.resume': {},
  'practice.restart': {},
  'practice.finish': {},
  'practice.stop': {},
  'practice.compositionCancelled': {},
  'practice.editRejected': {},
  'practice.inputOverrun': {},
  'practice.committedAccuracyHelp': {},
  'text.unsupportedBrowser': {},
  'text.unsupportedCharacter': { position: 'number', codePoint: 'string' },
  'text.empty': {},
  'storage.languageNotSaved': {},
  'storage.retryPreferences': {},
  'stats.allLanguages': {},
  'stats.committedAccuracy': {},
  'stats.legacyAccuracy': {},
  'stats.language': {}
} as const;

export type MessageKey = keyof typeof MESSAGE_PARAMETERS;
export type MessageCatalog = Readonly<Record<MessageKey, string>>;
export type MessageParameters<K extends MessageKey> = {
  readonly [P in keyof typeof MESSAGE_PARAMETERS[K]]:
    typeof MESSAGE_PARAMETERS[K][P] extends 'number' ? number : string;
};
export type MessageArguments<K extends MessageKey> =
  keyof MessageParameters<K> extends never ? [] : [parameters: MessageParameters<K>];
