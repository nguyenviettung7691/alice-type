import { getLanguage, type LanguageId } from './languages';
import {
  MESSAGE_PARAMETERS, type MessageArguments, type MessageCatalog, type MessageKey
} from './message-contract';
import { en } from './ui/en';
import { vi } from './ui/vi';

const catalogs: Readonly<Record<LanguageId, MessageCatalog>> = { en, vi };

export function validateMessageCatalog(catalog: MessageCatalog): void {
  const keys = Object.keys(MESSAGE_PARAMETERS);
  if (Object.keys(catalog).length !== keys.length) {
    throw new Error('A message catalog must contain exactly the required keys.');
  }
  for (const key of keys as MessageKey[]) {
    if (!Object.hasOwn(catalog, key) || typeof catalog[key] !== 'string' || !catalog[key].trim()) {
      throw new Error(`Missing or empty message: ${key}.`);
    }
    const expected = Object.keys(MESSAGE_PARAMETERS[key]).sort();
    const template = catalog[key];
    const actual = [...new Set(Array.from(template.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g), (match) => match[1]))].sort();
    if (expected.join(',') !== actual.join(',') || /[{}]/.test(template.replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, ''))) {
      throw new Error(`Invalid message placeholders: ${key}.`);
    }
  }
}

for (const catalog of Object.values(catalogs)) validateMessageCatalog(catalog);

export function translate<K extends MessageKey>(
  language: LanguageId, key: K, ...args: MessageArguments<K>
): string {
  const { locale } = getLanguage(language);
  if (!Object.hasOwn(MESSAGE_PARAMETERS, key)) throw new Error('Unsupported message key.');
  const parameters = args[0] ?? {};
  const specification = MESSAGE_PARAMETERS[key];
  const expectedParameters = Object.keys(specification).length;
  if (args.length !== (expectedParameters === 0 ? 0 : 1)
    || typeof parameters !== 'object' || Array.isArray(parameters)
    || Object.keys(parameters).length !== expectedParameters) {
    throw new Error(`Invalid message parameters: ${key}.`);
  }
  const values = new Map<string, string>();
  for (const [name, type] of Object.entries(specification)) {
    const value: unknown = Reflect.get(parameters, name);
    if (!Object.hasOwn(parameters, name) || typeof value !== type
      || (typeof value === 'number' && !Number.isFinite(value))) {
      throw new Error(`Invalid message parameter: ${key}.${name}.`);
    }
    values.set(name, typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : String(value));
  }
  return catalogs[language][key].replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_match, name: string) => {
    const value = values.get(name);
    if (value === undefined) throw new Error(`Missing message parameter: ${key}.${name}.`);
    return value;
  });
}
