import { CODE_LANGUAGES, ExerciseGenerationError, type CodeLanguage, type RandomSource } from './exercise-generator';
import { PYTHON_SNIPPETS } from './code-snippets/python';
import { JAVASCRIPT_SNIPPETS } from './code-snippets/javascript';
import { RUST_SNIPPETS } from './code-snippets/rust';

export interface CodeSnippet {
  readonly id: string;
  readonly codeLanguage: CodeLanguage;
  readonly text: string;
}

export const MINIMUM_SNIPPETS = 15;
export const REQUIRED_CODE_SYMBOLS = ['{', '}', '[', ']', '|', '`'] as const;

export function validateSnippets(codeLanguage: CodeLanguage, entries: readonly CodeSnippet[]): void {
  const fail = (message: string) => { throw new ExerciseGenerationError(`${codeLanguage} snippets: ${message}`); };
  if (entries.length < MINIMUM_SNIPPETS) fail(`at least ${MINIMUM_SNIPPETS} snippets are required.`);
  const ids = new Set<string>();
  for (const { id, text, codeLanguage: language } of entries) {
    if (language !== codeLanguage) fail(`${id} has the wrong language.`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) fail(`${id} is not a unique kebab-case identifier.`);
    ids.add(id);
    if (!/^[\x20-\x7e]+$/.test(text) || text !== text.trim() || text.includes('  ')
      || text.length < 30 || text.length > 160) fail(`${id} must be 30-160 single-spaced printable ASCII characters.`);
  }
  const all = entries.map((entry) => entry.text).join('\n');
  for (const symbol of REQUIRED_CODE_SYMBOLS) if (!all.includes(symbol)) fail(`the set must include ${symbol}.`);
  if (!/\d/.test(all)) fail('the set must include a digit.');
}

function build(codeLanguage: CodeLanguage, rows: readonly (readonly [string, string])[]): readonly CodeSnippet[] {
  const entries = Object.freeze(rows.map(([id, text]) => Object.freeze({ id, codeLanguage, text })));
  validateSnippets(codeLanguage, entries);
  return entries;
}

export const CODE_SNIPPETS: Readonly<Record<CodeLanguage, readonly CodeSnippet[]>> = Object.freeze({
  python: build('python', PYTHON_SNIPPETS),
  javascript: build('javascript', JAVASCRIPT_SNIPPETS),
  rust: build('rust', RUST_SNIPPETS)
});

export function getCodeSnippets(codeLanguage: CodeLanguage): readonly CodeSnippet[] {
  if (!CODE_LANGUAGES.includes(codeLanguage)) throw new ExerciseGenerationError('Unsupported code language.');
  return CODE_SNIPPETS[codeLanguage];
}

export function findCodeSnippet(codeLanguage: CodeLanguage, id: string): CodeSnippet {
  const snippet = getCodeSnippets(codeLanguage).find((entry) => entry.id === id);
  if (!snippet) throw new ExerciseGenerationError('Unsupported code snippet identifier.');
  return snippet;
}

/** Picks a random snippet, never repeating `previousId` immediately. */
export function selectCodeSnippet(codeLanguage: CodeLanguage, previousId: string | undefined, random: RandomSource = Math.random): CodeSnippet {
  const pool = getCodeSnippets(codeLanguage).filter((entry) => entry.id !== previousId);
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new ExerciseGenerationError('The exercise random source must return a finite number in [0, 1).');
  }
  return pool[Math.floor(value * pool.length)];
}
