import { describe, expect, it } from 'vitest';
import { CODE_SNIPPETS, findCodeSnippet, selectCodeSnippet, validateSnippets, REQUIRED_CODE_SYMBOLS } from './code-snippets';
import { CODE_LANGUAGES, ExerciseGenerationError } from './exercise-generator';
import { applyCommittedInput, createSession, requiresFinish } from './typing-engine';

describe('code snippets', () => {
  it('validates every language set', () => {
    for (const language of CODE_LANGUAGES) {
      const entries = CODE_SNIPPETS[language];
      expect(entries.length).toBeGreaterThanOrEqual(15);
      const all = entries.map((entry) => entry.text).join('');
      for (const symbol of REQUIRED_CODE_SYMBOLS) expect(all).toContain(symbol);
      expect(all).toMatch(/\d/);
      for (const entry of entries) {
        expect(entry.text).toMatch(/^[\x20-\x7e]{30,160}$/);
        expect(entry.text).not.toContain('  ');
      }
    }
    const ids = CODE_LANGUAGES.flatMap((language) => CODE_SNIPPETS[language].map((entry) => entry.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rejects invalid sets', () => {
    const base = CODE_SNIPPETS.python;
    expect(() => validateSnippets('python', base.slice(0, 3))).toThrow(ExerciseGenerationError);
    expect(() => validateSnippets('python', [...base.slice(1), { ...base[0], text: 'too short' }])).toThrow(ExerciseGenerationError);
    expect(() => validateSnippets('python', [...base, base[0]])).toThrow(ExerciseGenerationError);
    expect(() => validateSnippets('python', base.map((entry) => ({ ...entry, text: entry.text.replaceAll('|', '/') }))))
      .toThrow(ExerciseGenerationError);
  });

  it('never repeats the previous snippet', () => {
    for (const language of CODE_LANGUAGES) {
      let previous: string | undefined;
      for (let step = 0; step < 50; step += 1) {
        const next = selectCodeSnippet(language, previous, () => (step * 0.137) % 1);
        expect(next.id).not.toBe(previous);
        previous = next.id;
      }
    }
    expect(() => selectCodeSnippet('rust', undefined, () => 1)).toThrow(ExerciseGenerationError);
    expect(() => findCodeSnippet('rust', 'py-walrus')).toThrow(ExerciseGenerationError);
  });

  it('completes without Finish in either language', () => {
    for (const language of ['en', 'vi'] as const) {
      const snippet = CODE_SNIPPETS.rust[0];
      const session = createSession(snippet.text, { mode: 'code', language, codeLanguage: 'rust', snippetId: snippet.id });
      expect(requiresFinish(session)).toBe(false);
      expect(applyCommittedInput(session, snippet.text, 5).status).toBe('completed');
    }
  });
});
