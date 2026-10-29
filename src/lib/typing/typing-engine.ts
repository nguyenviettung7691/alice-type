import {
  validateConfiguration,
  type Exercise,
  type CopyConfiguration
} from './exercise-generator';
import { preparePracticeText } from './text';
import { reconcilePracticeInput, scoreCommittedEdit } from './practice-input';
import { DEFAULT_LANGUAGE, getLanguage, type LanguageId } from '../i18n/languages';

export const PRACTICE_TEXT =
  'Slow down, take a breath, and let steady hands find their way across the keys.';

interface SessionData {
  readonly target: string;
  readonly input: string;
  readonly totalAttempts: number;
  readonly correctAttempts: number;
  readonly configuration?: CopyConfiguration;
  readonly wordEnds?: readonly number[];
}

type Lifecycle =
  | { readonly status: 'ready'; readonly startedAt: null; readonly endedAt: null }
  | { readonly status: 'running'; readonly startedAt: number; readonly endedAt: null }
  | { readonly status: 'completed'; readonly startedAt: number; readonly endedAt: number };
export type TypingSession = SessionData & Lifecycle;

interface WritingChunk {
  readonly text: string;
  readonly previous: WritingChunk | null;
}

export type ZenSession = Lifecycle & {
  readonly kind: 'zen';
  readonly configuration: { readonly mode: 'zen'; readonly language?: LanguageId };
  readonly writing: WritingChunk | null;
  readonly retainedCharacters: number;
  readonly totalAttempts: number;
};
export type PracticeSession = TypingSession | ZenSession;

export function isZenSession(session: PracticeSession): session is ZenSession {
  return 'kind' in session && session.kind === 'zen';
}

export function createZenSession(language: LanguageId = DEFAULT_LANGUAGE): ZenSession {
  validateConfiguration({ mode: 'zen', language });
  return {
    kind: 'zen', configuration: { mode: 'zen', language }, writing: null,
    retainedCharacters: 0, totalAttempts: 0, status: 'ready', startedAt: null, endedAt: null
  };
}

export function getWritingWindow(session: ZenSession): string {
  let chunk = session.writing;
  let remaining = 2000;
  const parts: string[] = [];
  while (chunk && remaining > 0) {
    const text = chunk.text.slice(-remaining);
    parts.push(text);
    remaining -= text.length;
    chunk = chunk.previous;
  }
  return parts.reverse().join('');
}

export function stopSession(session: PracticeSession, now: number): ZenSession {
  if (!isZenSession(session)) throw new Error('Only Zen sessions can be stopped manually.');
  return session.status !== 'running' ? session : { ...session, status: 'completed', endedAt: Math.max(session.startedAt, now) };
}

export type TypingAction =
  | { readonly type: 'character'; readonly character: string }
  | { readonly type: 'backspace' };

export interface TypingKey {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  readonly isComposing: boolean;
  readonly repeat: boolean;
}

export function createSession(
  target: string,
  configuration?: CopyConfiguration,
  wordEnds?: readonly number[]
): TypingSession {
  target = preparePracticeText(target).text;

  let metadata: Pick<SessionData, 'configuration' | 'wordEnds'> = {};
  if (configuration) {
    if (!['timed', 'words', 'quote', 'custom', 'drills', 'code'].includes(configuration.mode)) {
      throw new Error('Only target-copying modes can create a finite exercise.');
    }
    validateConfiguration(configuration);
    const generated = configuration.mode === 'timed' || configuration.mode === 'words' || configuration.mode === 'drills';
    if (generated && (!wordEnds || wordEnds.length === 0
      || (configuration.mode !== 'timed' && wordEnds.length !== configuration.wordLimit)
      || wordEnds[wordEnds.length - 1] !== target.length
      || wordEnds.some((end, index) => !Number.isInteger(end) || end <= (wordEnds[index - 1] ?? 0)
        || end > target.length || (index < wordEnds.length - 1 && target[end - 1] !== ' ')))) {
      throw new Error('Exercise word boundaries must match the configured target.');
    }
    metadata = {
      configuration: Object.freeze({ ...configuration }),
      ...(wordEnds ? { wordEnds: Object.freeze([...wordEnds]) } : {})
    };
  }

  return {
    target,
    input: '',
    status: 'ready',
    startedAt: null,
    endedAt: null,
    totalAttempts: 0,
    correctAttempts: 0,
    ...metadata
  };
}

export function expireSession(session: TypingSession, now: number): TypingSession {
  if (session.status !== 'running' || session.configuration?.mode !== 'timed') return session;
  const deadline = session.startedAt + session.configuration.durationSeconds * 1000;
  return now >= deadline ? { ...session, status: 'completed', endedAt: deadline } : session;
}

export function extendTarget(session: TypingSession, exercise: Exercise): TypingSession {
  if (session.configuration?.mode !== 'timed' || exercise.configuration.mode !== 'timed'
    || session.status === 'completed') {
    throw new Error('Only an unfinished timed session can extend its target.');
  }
  const configuration = session.configuration;
  if (configuration.durationSeconds !== exercise.configuration.durationSeconds
    || configuration.wordBankTier !== exercise.configuration.wordBankTier
    || configuration.punctuation !== exercise.configuration.punctuation
    || configuration.numbers !== exercise.configuration.numbers) {
    throw new Error('An appended exercise must use the same session configuration.');
  }
  if ((configuration.language ?? 'en') !== (exercise.configuration.language ?? 'en')) {
    throw new Error('An appended exercise must use the same session language.');
  }
  createSession(exercise.target, exercise.configuration, exercise.wordEnds);
  const offset = session.target.length + 1;
  return {
    ...session,
    target: `${session.target} ${exercise.target}`,
    wordEnds: [
      ...(session.wordEnds ?? []).map((end, index, ends) => index === ends.length - 1 ? end + 1 : end),
      ...exercise.wordEnds.map((end) => end + offset)
    ]
  };
}

export function getTypingAction(event: TypingKey): TypingAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.repeat) {
    return null;
  }

  if (event.key === 'Backspace') {
    return { type: 'backspace' };
  }

  return /^[\x20-\x7e]$/.test(event.key)
    ? { type: 'character', character: event.key }
    : null;
}

export function applyAction(session: TypingSession, action: TypingAction, now: number): TypingSession;
export function applyAction(session: ZenSession, action: TypingAction, now: number): ZenSession;
export function applyAction(session: PracticeSession, action: TypingAction, now: number): PracticeSession;
export function applyAction(
  session: PracticeSession,
  action: TypingAction,
  now: number
): PracticeSession {
  if (isZenSession(session)) {
    if (session.status === 'completed') return session;
    if (action.type === 'backspace') {
      if (!session.writing) return session;
      const { text, previous } = session.writing;
      return {
        ...session, retainedCharacters: session.retainedCharacters - 1,
        writing: text.length === 1 ? previous : { text: text.slice(0, -1), previous }
      };
    }
    const character = preparePracticeText(action.character);
    if (character.graphemes.length !== 1) throw new Error('A typing action must contain one supported character.');
    action = { type: 'character', character: character.text };
    const last = session.writing;
    const writing = last && last.text.length < 256
      ? { text: last.text + action.character, previous: last.previous }
      : { text: action.character, previous: last };
    return {
      ...session, writing, retainedCharacters: session.retainedCharacters + 1,
      totalAttempts: session.totalAttempts + 1, status: 'running',
      startedAt: session.startedAt ?? now, endedAt: null
    };
  }
  session = expireSession(session, now);
  if (session.status === 'completed') {
    return session;
  }

  if (action.type === 'backspace') {
    return session.input.length === 0
      ? session
      : { ...session, input: session.input.slice(0, -1) };
  }

  const character = preparePracticeText(action.character);
  if (character.graphemes.length !== 1) throw new Error('A typing action must contain one supported character.');
  action = { type: 'character', character: character.text };

  const input = session.input + action.character;
  if (input.length > session.target.length) {
    throw new Error('The timed exercise must be extended before accepting more input.');
  }
  const startedAt = session.startedAt ?? now;
  const data: SessionData = {
    ...session,
    input,
    totalAttempts: session.totalAttempts + 1,
    correctAttempts: session.correctAttempts
      + Number(action.character === session.target[session.input.length])
  };

  return input.length === session.target.length && session.configuration?.mode !== 'timed' && !requiresFinish(session)
    ? { ...data, status: 'completed', startedAt, endedAt: now }
    : { ...data, status: 'running', startedAt, endedAt: null };
}

export function requiresFinish(session: TypingSession): boolean {
  const mode = session.configuration?.mode;
  return mode !== 'timed' && mode !== 'code'
    && (getLanguage(session.configuration?.language ?? DEFAULT_LANGUAGE).explicitFinish
      || (mode === 'custom' && /[^\x20-\x7e]/.test(session.target)));
}

export function finishSession(session: TypingSession, now: number): TypingSession {
  if (session.status !== 'running' || session.input.length !== session.target.length || !requiresFinish(session)) {
    throw new Error('Only a fully consumed explicit-finish session can be finished.');
  }
  return { ...session, status: 'completed', endedAt: Math.max(session.startedAt, now) };
}

export function getAcceptedText(session: PracticeSession): string {
  if (!isZenSession(session)) return session.input;
  const parts: string[] = [];
  let chunk = session.writing;
  while (chunk) { parts.push(chunk.text); chunk = chunk.previous; }
  return parts.reverse().join('');
}

export function applyCommittedInput(session: TypingSession, nativeValue: string, now: number): TypingSession;
export function applyCommittedInput(session: ZenSession, nativeValue: string, now: number): ZenSession;
export function applyCommittedInput(session: PracticeSession, nativeValue: string, now: number): PracticeSession;
export function applyCommittedInput(session: PracticeSession, nativeValue: string, now: number): PracticeSession {
  if (!isZenSession(session)) session = expireSession(session, now);
  if (session.status === 'completed') return session;
  const accepted = getAcceptedText(session);
  const result = reconcilePracticeInput(accepted, nativeValue, isZenSession(session) ? undefined : session.target.length);
  if (!result.edit) return session;
  if (isZenSession(session)) {
    let writing = session.writing;
    let removed = session.retainedCharacters - result.edit.start;
    while (writing && removed > 0) {
      if (removed >= writing.text.length) {
        removed -= writing.text.length;
        writing = writing.previous;
      } else {
        writing = { text: writing.text.slice(0, -removed), previous: writing.previous };
        removed = 0;
      }
    }
    const tail = result.text.slice(result.edit.start);
    for (let index = 0; index < tail.length; index += 256) {
      writing = { text: tail.slice(index, index + 256), previous: writing };
    }
    const inserted = result.edit.inserted.length;
    if (session.status === 'ready' && !inserted) return session;
    return {
      ...session, writing, retainedCharacters: result.text.length,
      totalAttempts: session.totalAttempts + inserted, status: 'running',
      startedAt: session.startedAt ?? now, endedAt: null
    };
  }
  const score = scoreCommittedEdit(session.target, accepted, result);
  if (session.status === 'ready' && score.attempts === 0) return session;
  const data = {
    ...session, input: result.text, totalAttempts: session.totalAttempts + score.attempts,
    correctAttempts: session.correctAttempts + score.correctAttempts, startedAt: session.startedAt ?? now
  };
  return result.text.length === session.target.length && session.configuration?.mode !== 'timed' && !requiresFinish(session)
    ? { ...data, status: 'completed', endedAt: now }
    : { ...data, status: 'running', endedAt: null };
}

export function getMetrics(session: PracticeSession, now: number) {
  if (isZenSession(session)) {
    const elapsedMs = session.status !== 'completed' ? 0 : Math.max(0, session.endedAt - session.startedAt);
    return {
      correctCharacters: null, elapsedMs, accuracy: null,
      wpm: session.status !== 'completed' ? null
        : elapsedMs === 0 ? 0 : Math.round((session.retainedCharacters / 5) / (elapsedMs / 60_000))
    };
  }
  const correctCharacters = Array.from(session.input).reduce(
    (count, character, index) => count + Number(character === session.target[index]),
    0
  );
  const measuredElapsed = session.startedAt === null
    ? 0
    : Math.max(0, (session.endedAt ?? now) - session.startedAt);
  const elapsedMs = session.configuration?.mode === 'timed'
    ? Math.min(measuredElapsed, session.configuration.durationSeconds * 1000)
    : measuredElapsed;

  return {
    correctCharacters,
    elapsedMs,
    wpm: session.status === 'ready'
      ? null
      : elapsedMs === 0 ? 0 : Math.round((correctCharacters / 5) / (elapsedMs / 60_000)),
    accuracy: session.totalAttempts === 0
      ? null
      : Math.round((session.correctAttempts / session.totalAttempts) * 1000) / 10
  };
}

export function getProgress(session: TypingSession, now: number): { value: number; maximum: number; percent: number };
export function getProgress(session: PracticeSession, now: number): { value: number; maximum: number; percent: number } | null;
export function getProgress(session: PracticeSession, now: number) {
  if (isZenSession(session)) return null;
  const configuration = session.configuration;
  if (!configuration) return { value: 0, maximum: 1, percent: 0 };
  const maximum = configuration.mode === 'timed' ? configuration.durationSeconds
    : configuration.mode === 'words' || configuration.mode === 'drills' ? configuration.wordLimit : session.target.length;
  const value = configuration.mode === 'timed'
    ? getMetrics(session, now).elapsedMs / 1000
    : configuration.mode === 'words' || configuration.mode === 'drills'
      ? (session.wordEnds ?? []).filter((end) => session.input.length >= end).length
      : session.input.length;
  return { value, maximum, percent: Math.min(100, Math.max(0, value / maximum * 100)) };
}
