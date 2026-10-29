import { getContext, setContext } from 'svelte';
import { DEFAULT_LANGUAGE, type LanguageId } from './languages';
import { translate } from './messages';
import type { MessageArguments, MessageKey } from './message-contract';

export interface Localization {
  readonly language: LanguageId;
  text<K extends MessageKey>(key: K, ...args: MessageArguments<K>): string;
}

const LOCALIZATION = Symbol('AliceType localization');

function localization(getLanguage: () => LanguageId): Localization {
  return {
    get language() { return getLanguage(); },
    text(key, ...args) { return translate(getLanguage(), key, ...args); }
  };
}

export function provideLocalization(getLanguage: () => LanguageId): Localization {
  return setContext(LOCALIZATION, localization(getLanguage));
}

export function useLocalization(): Localization {
  return getContext<Localization | undefined>(LOCALIZATION) ?? localization(() => DEFAULT_LANGUAGE);
}
