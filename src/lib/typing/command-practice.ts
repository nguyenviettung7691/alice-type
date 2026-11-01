import { COMMAND_OUTPUT_CODES, type KeyboardLayerBinding, type KeyboardSnapshot } from '../keyboard/user-keyboards';
import { StorageError } from '../storage/errors';
import type { SessionRecord } from '../storage/session-history';
import type { LanguageId } from '../i18n/languages';

export const COMMAND_DRILL_LENGTH = 10;

export interface CommandDrillResult {
  readonly attempts: number;
  readonly correct: number;
  readonly misses: Readonly<Record<string, number>>;
  readonly outputAttempts: Readonly<Record<string, number>>;
}

export function isCommandOutputCode(code: string): boolean {
  return COMMAND_OUTPUT_CODES.some((candidate) => candidate === code);
}

export function commandMatches(binding: KeyboardLayerBinding, event: Pick<KeyboardEvent,
  'code' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'>): boolean {
  return event.code === binding.outputCode
    && event.shiftKey === binding.modifiers.includes('shift')
    && !event.ctrlKey && !event.altKey && !event.metaKey;
}

export function commandRecord(
  keyboard: KeyboardSnapshot,
  bindings: readonly KeyboardLayerBinding[],
  result: CommandDrillResult,
  language: LanguageId,
  startedAt: number,
  completedAt = Date.now(),
  id = crypto.randomUUID()
): SessionRecord {
  if (!bindings.length || result.attempts < 1 || result.correct < 0 || result.correct > result.attempts
    || !Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) {
    throw new StorageError('A command drill needs valid bindings, attempts and timestamps.');
  }
  const accuracy = Math.round(result.correct / result.attempts * 1000) / 10;
  const uniqueBindings = [...new Map(bindings.map((binding) => [binding.id, binding])).values()];
  return {
    version: 6, mode: 'command', id, completedAt, wpm: 0,
    totalAttempts: result.attempts, correctAttempts: result.correct, accuracy,
    missedKeys: result.misses, outputAttempts: result.outputAttempts,
    elapsedMs: completedAt - startedAt,
    bindings: uniqueBindings.map((binding) => ({ ...binding, modifiers: [...binding.modifiers] })),
    keyboard, language
  };
}
