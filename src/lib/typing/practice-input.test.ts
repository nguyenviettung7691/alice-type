import { describe, expect, it } from 'vitest';
import {
  PracticeEditError, reconcilePracticeInput, scoreCommittedEdit, type ReconciledInput
} from './practice-input';

describe('committed native text reconciliation', () => {
  it('accepts direct input and intentional repeated letters without event metadata', () => {
    expect(reconcilePracticeInput('', 'a')).toEqual({
      text: 'a', edit: { start: 0, deleteCount: 0, inserted: ['a'] }
    });
    expect(reconcilePracticeInput('a', 'aa')).toEqual({
      text: 'aa', edit: { start: 1, deleteCount: 0, inserted: ['a'] }
    });
    expect(reconcilePracticeInput('aa', 'aa')).toEqual({ text: 'aa', edit: null });
  });

  it('normalizes committed composition once, with canonical no-op deduplication', () => {
    expect(reconcilePracticeInput('', 'a\u0302\u0301')).toEqual({
      text: 'ấ', edit: { start: 0, deleteCount: 0, inserted: ['ấ'] }
    });
    expect(reconcilePracticeInput('ấ', 'a\u0302\u0301')).toEqual({ text: 'ấ', edit: null });
    expect(reconcilePracticeInput('a\u0302\u0301', 'ấ')).toEqual({ text: 'ấ', edit: null });
  });

  it('reconciles an accent rewrite inside the active syllable and reuses the unchanged suffix', () => {
    expect(reconcilePracticeInput('xin chao', 'xin chào')).toEqual({
      text: 'xin chào', edit: { start: 6, deleteCount: 1, inserted: ['à'] }
    });
    expect(reconcilePracticeInput('tie', 'tiế')).toEqual({
      text: 'tiế', edit: { start: 2, deleteCount: 1, inserted: ['ế'] }
    });
    expect(reconcilePracticeInput('tieng', 'tiếng')).toEqual({
      text: 'tiếng', edit: { start: 2, deleteCount: 1, inserted: ['ế'] }
    });
  });

  it('supports backward delete/reinsert sequences inside an active token', () => {
    const deletion = reconcilePracticeInput('xin chao', 'xin ch');
    expect(deletion.edit).toEqual({ start: 6, deleteCount: 2, inserted: [] });
    const insertion = reconcilePracticeInput(deletion.text, 'xin chào');
    expect(insertion.edit).toEqual({ start: 6, deleteCount: 0, inserted: ['à', 'o'] });
  });

  it('allows one end backspace across a token boundary but not deletion of earlier tokens', () => {
    expect(reconcilePracticeInput('xin ', 'xin')).toEqual({
      text: 'xin', edit: { start: 3, deleteCount: 1, inserted: [] }
    });
    expect(reconcilePracticeInput('ấ', '')).toEqual({
      text: '', edit: { start: 0, deleteCount: 1, inserted: [] }
    });
    expect(() => reconcilePracticeInput('xin chào', 'xi')).toThrow(PracticeEditError);
    expect(() => reconcilePracticeInput('xin ', '')).toThrow('trailing token');
  });

  it.each([
    ['xin chào', 'xín chào'],
    ['xin chào', 'xinchào'],
    ['xin chào', 'chào'],
    ['xin chào', 'thêm xin chào'],
    ['xin ', 'xín ']
  ])('rejects earlier passage editing: %s -> %s', (previous, next) => {
    expect(() => reconcilePracticeInput(previous, next)).toThrow('trailing token');
  });

  it('supports multi-grapheme commits and spaces without assuming one key per character', () => {
    expect(reconcilePracticeInput('xin ', 'xin chào bạn')).toEqual({
      text: 'xin chào bạn',
      edit: { start: 4, deleteCount: 0, inserted: ['c', 'h', 'à', 'o', ' ', 'b', 'ạ', 'n'] }
    });
  });

  it('enforces finite-target limits on normalized graphemes without truncating', () => {
    expect(reconcilePracticeInput('', 'a\u0302\u0301', 1).text).toBe('ấ');
    expect(() => reconcilePracticeInput('', 'ấb', 1)).toThrow('exceeds the target length');
    expect(reconcilePracticeInput('', '', 0)).toEqual({ text: '', edit: null });
    const decomposed = 'ấ'.normalize('NFD').repeat(10_000);
    expect(reconcilePracticeInput('', decomposed, 10_000).edit?.inserted).toHaveLength(10_000);
    expect(() => reconcilePracticeInput('', `${decomposed}b`, 10_000)).toThrow('exceeds the target length');
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid limits %s', (limit) => {
    expect(() => reconcilePracticeInput('', '', limit)).toThrow('non-negative safe integer');
  });

  it.each(['😀', 'line\nbreak', '\ud800', '\u0301'])('rejects unsupported commits %j', (value) => {
    expect(() => reconcilePracticeInput('', value)).toThrow();
  });
});

describe('committed-edit scoring', () => {
  it('counts attempts only for inserted/replacement graphemes', () => {
    const target = 'xin chào';
    const accepted = 'xin chao';
    const result = reconcilePracticeInput(accepted, target);
    expect(scoreCommittedEdit(target, accepted, result)).toEqual({
      attempts: 1, correctAttempts: 1, correctCharacters: 8
    });
  });

  it('distinguishes committed correction from provisional composition', () => {
    const first = scoreCommittedEdit('áb', '', reconcilePracticeInput('', 'a'));
    const correction = scoreCommittedEdit('áb', 'a', reconcilePracticeInput('a', 'á'));
    expect(first).toEqual({ attempts: 1, correctAttempts: 0, correctCharacters: 0 });
    expect(correction).toEqual({ attempts: 1, correctAttempts: 1, correctCharacters: 1 });
    expect(scoreCommittedEdit('áb', '', reconcilePracticeInput('', 'á'))).toEqual({
      attempts: 1, correctAttempts: 1, correctCharacters: 1
    });
  });

  it('does not score deletions or duplicate final events as attempts', () => {
    expect(scoreCommittedEdit('abc', 'ab', reconcilePracticeInput('ab', 'a'))).toEqual({
      attempts: 0, correctAttempts: 0, correctCharacters: 1
    });
    expect(scoreCommittedEdit('ấb', 'ấ', reconcilePracticeInput('ấ', 'a\u0302\u0301'))).toEqual({
      attempts: 0, correctAttempts: 0, correctCharacters: 1
    });
  });

  it('compares canonical equivalents but distinguishes tone and case', () => {
    expect(scoreCommittedEdit('ấB', '', reconcilePracticeInput('', 'a\u0302\u0301b'))).toEqual({
      attempts: 2, correctAttempts: 1, correctCharacters: 1
    });
    expect(scoreCommittedEdit('á', '', reconcilePracticeInput('', 'à'))).toEqual({
      attempts: 1, correctAttempts: 0, correctCharacters: 0
    });
  });

  it('preserves direct English append/backspace attempt semantics', () => {
    let accepted = '';
    let attempts = 0;
    let correctAttempts = 0;
    for (const value of ['a', 'ax', 'a', 'ab', 'abc']) {
      const result = reconcilePracticeInput(accepted, value);
      const score = scoreCommittedEdit('abc', accepted, result);
      attempts += score.attempts;
      correctAttempts += score.correctAttempts;
      accepted = result.text;
    }
    expect({ attempts, correctAttempts, accepted }).toEqual({ attempts: 4, correctAttempts: 3, accepted: 'abc' });
  });

  it('rejects invalid edit ranges, noncanonical graphemes and mismatched output', () => {
    const invalid: ReconciledInput[] = [
      { text: 'ab', edit: { start: -1, deleteCount: 0, inserted: ['b'] } },
      { text: 'ab', edit: { start: 0.5, deleteCount: 0, inserted: ['b'] } },
      { text: 'ab', edit: { start: 1, deleteCount: 2, inserted: ['b'] } },
      { text: 'ab', edit: { start: 1, deleteCount: -1, inserted: ['b'] } },
      { text: 'ab', edit: { start: 1, deleteCount: 0, inserted: ['ab'] } },
      { text: 'ab', edit: { start: 1, deleteCount: 0, inserted: [''] } },
      { text: 'aá', edit: { start: 1, deleteCount: 0, inserted: ['a\u0301'] } },
      { text: 'ab', edit: { start: 1, deleteCount: 0, inserted: ['c'] } },
      { text: 'ab', edit: null }
    ];
    for (const result of invalid) expect(() => scoreCommittedEdit('abc', 'a', result)).toThrow();
    expect(() => scoreCommittedEdit('a', '', reconcilePracticeInput('', 'ab'))).toThrow('exceeds');
  });
});
