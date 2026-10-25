export const PRACTICE_TEXT =
  'Slow down, take a breath, and let steady hands find their way across the keys.';

interface SessionData {
  readonly target: string;
  readonly input: string;
  readonly totalAttempts: number;
  readonly correctAttempts: number;
}

export type TypingSession = SessionData & (
  | { readonly status: 'ready'; readonly startedAt: null; readonly endedAt: null }
  | { readonly status: 'running'; readonly startedAt: number; readonly endedAt: null }
  | { readonly status: 'completed'; readonly startedAt: number; readonly endedAt: number }
);

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

export function createSession(target: string): TypingSession {
  if (target.length === 0 || /[^\x20-\x7e]/.test(target)) {
    throw new Error('Typing exercises must contain non-empty printable ASCII text.');
  }

  return {
    target,
    input: '',
    status: 'ready',
    startedAt: null,
    endedAt: null,
    totalAttempts: 0,
    correctAttempts: 0
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

export function applyAction(
  session: TypingSession,
  action: TypingAction,
  now: number
): TypingSession {
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
  const startedAt = session.startedAt ?? now;
  const data: SessionData = {
    target: session.target,
    input,
    totalAttempts: session.totalAttempts + 1,
    correctAttempts: session.correctAttempts
      + Number(action.character === session.target[session.input.length])
  };

  return input.length === session.target.length
    ? { ...data, status: 'completed', startedAt, endedAt: now }
    : { ...data, status: 'running', startedAt, endedAt: null };
}

export function getMetrics(session: TypingSession, now: number) {
  const correctCharacters = Array.from(session.input).reduce(
    (count, character, index) => count + Number(character === session.target[index]),
    0
  );
  const elapsedMs = session.startedAt === null
    ? 0
    : Math.max(0, (session.endedAt ?? now) - session.startedAt);

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
