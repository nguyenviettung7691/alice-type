import {
  validateConfiguration,
  type Exercise,
  type CopyConfiguration
} from './exercise-generator';

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
  readonly configuration: { readonly mode: 'zen' };
  readonly writing: WritingChunk | null;
  readonly retainedCharacters: number;
  readonly totalAttempts: number;
};
export type PracticeSession = TypingSession | ZenSession;

export function isZenSession(session: PracticeSession): session is ZenSession {
  return 'kind' in session && session.kind === 'zen';
}

export function createZenSession(): ZenSession {
  return {
    kind: 'zen', configuration: { mode: 'zen' }, writing: null,
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
  if (target.length === 0 || /[^\x20-\x7e]/.test(target)) {
    throw new Error('Typing exercises must contain non-empty printable ASCII text.');
  }

  let metadata: Pick<SessionData, 'configuration' | 'wordEnds'> = {};
  if (configuration) {
    if (!['timed', 'words', 'quote', 'custom'].includes(configuration.mode)) {
      throw new Error('Only target-copying modes can create a finite exercise.');
    }
    validateConfiguration(configuration);
    if ((configuration.mode === 'timed' || configuration.mode === 'words') && (!wordEnds || wordEnds.length === 0
      || (configuration.mode === 'words' && wordEnds.length !== configuration.wordLimit)
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
    if (!/^[\x20-\x7e]$/.test(action.character)) {
      throw new Error('A typing action must contain one printable ASCII character.');
    }
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

  if (!/^[\x20-\x7e]$/.test(action.character)) {
    throw new Error('A typing action must contain one printable ASCII character.');
  }

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

  return input.length === session.target.length && session.configuration?.mode !== 'timed'
    ? { ...data, status: 'completed', startedAt, endedAt: now }
    : { ...data, status: 'running', startedAt, endedAt: null };
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
    : configuration.mode === 'words' ? configuration.wordLimit : session.target.length;
  const value = configuration.mode === 'timed'
    ? getMetrics(session, now).elapsedMs / 1000
    : configuration.mode === 'words'
      ? (session.wordEnds ?? []).filter((end) => session.input.length >= end).length
      : session.input.length;
  return { value, maximum, percent: Math.min(100, Math.max(0, value / maximum * 100)) };
}
