import type { ActivityWindow, SessionRecord } from './session-history';
import type { KeyboardSnapshot } from '../keyboard/user-keyboards';
import type { LanguageId } from '../i18n/languages';

export const EARLY_WINDOW_START = 0;
export const LATE_WINDOW_START = 20;
export const INSIGHT_WINDOW_MINUTES = 5;
export const MIN_INSIGHT_ATTEMPTS = 100;
export const MIN_INSIGHT_SESSIONS = 5;
export const MIN_INSIGHT_DAYS = 3;
export const MAX_SESSION_GAP_MS = 5 * 60_000;

type AnalyticsRecord = Exclude<SessionRecord, { readonly mode: 'zen' | 'command' }> & {
  readonly setupFingerprint: string;
  readonly difficultyKey: string;
  readonly deskSessionId: string;
  readonly activeMsTotal: number;
  readonly activityWindows: readonly ActivityWindow[];
  readonly keyboard: KeyboardSnapshot;
  readonly language: LanguageId;
  readonly scoringVersion: 'committed-grapheme-v1';
};

interface InsightGroup {
  readonly boardId: string;
  readonly fingerprint: string;
  readonly difficultyKey: string;
  readonly language: string;
  readonly scoringVersion: string;
  readonly records: readonly AnalyticsRecord[];
}

export interface WindowMetrics {
  readonly attempts: number;
  readonly correctAttempts: number;
  readonly correctCharacters: number;
  readonly wpm: number;
  readonly accuracy: number;
}

export interface SetupInsight {
  readonly boardId: string;
  readonly boardName: string;
  readonly fingerprint: string;
  readonly difficultyKey: string;
  readonly hardware: KeyboardSnapshot['hardware'];
  readonly language: string;
  readonly sessions: number;
  readonly days: number;
  readonly early: WindowMetrics;
  readonly late: WindowMetrics;
  readonly accuracySpread: number;
}

function isAnalyticsRecord(record: SessionRecord): record is AnalyticsRecord {
  return record.mode !== 'command' && record.mode !== 'zen'
    && record.version === 6 && !!record.keyboard
    && typeof record.setupFingerprint === 'string'
    && typeof record.difficultyKey === 'string'
    && typeof record.deskSessionId === 'string'
    && typeof record.activeMsTotal === 'number'
    && Array.isArray(record.activityWindows)
    && record.keyboard !== undefined
    && record.language !== undefined
    && record.scoringVersion === 'committed-grapheme-v1';
}

function recordsInWindow(records: readonly AnalyticsRecord[], start: number): ActivityWindow[] {
  return records.flatMap((record) => record.activityWindows.filter((window) =>
    window.minute >= start && window.minute < start + INSIGHT_WINDOW_MINUTES));
}

function metrics(windows: readonly ActivityWindow[]): WindowMetrics {
  const attempts = windows.reduce((sum, window) => sum + window.attempts, 0);
  const correctAttempts = windows.reduce((sum, window) => sum + window.correctAttempts, 0);
  const correctCharacters = windows.reduce((sum, window) => sum + window.correctCharacters, 0);
  const activeMinutes = windows.reduce((sum, window) => sum + window.activeMs, 0) / 60_000;
  return {
    attempts, correctAttempts, correctCharacters,
    wpm: activeMinutes ? correctCharacters / 5 / activeMinutes : 0,
    accuracy: attempts ? correctAttempts / attempts * 100 : 0
  };
}

function spread(values: readonly number[]): number {
  if (!values.length) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

function deskSessions(records: readonly AnalyticsRecord[]): AnalyticsRecord[] {
  const grouped = new Map<string, AnalyticsRecord[]>();
  for (const record of records) {
    grouped.set(record.deskSessionId, [...(grouped.get(record.deskSessionId) ?? []), record]);
  }
  return [...grouped.values()].flatMap((runs) => {
    const ordered = [...runs].sort((a, b) => a.completedAt - b.completedAt);
    if (ordered.some((record, index) => index > 0
      && record.completedAt - ordered[index - 1].completedAt > MAX_SESSION_GAP_MS)) return [];
    return [ordered[ordered.length - 1]];
  }).sort((a, b) => a.completedAt - b.completedAt);
}

function groupKey(record: AnalyticsRecord): string {
  return [
    record.keyboard.id, record.setupFingerprint, record.difficultyKey,
    record.language ?? 'en', record.scoringVersion ?? ''
  ].join('|');
}

function qualifyingInsight(group: InsightGroup): SetupInsight | null {
  const sessions = deskSessions(group.records).filter((record) => {
    const early = recordsInWindow([record], EARLY_WINDOW_START);
    const late = recordsInWindow([record], LATE_WINDOW_START);
    return early.length > 0 && late.length > 0;
  });
  const earlyWindows = recordsInWindow(sessions, EARLY_WINDOW_START);
  const lateWindows = recordsInWindow(sessions, LATE_WINDOW_START);
  const early = metrics(earlyWindows);
  const late = metrics(lateWindows);
  const days = new Set(sessions.map((record) => new Date(record.completedAt).toISOString().slice(0, 10)));
  if (early.attempts < MIN_INSIGHT_ATTEMPTS || late.attempts < MIN_INSIGHT_ATTEMPTS
    || sessions.length < MIN_INSIGHT_SESSIONS || days.size < MIN_INSIGHT_DAYS) return null;
  const earlyAccuracy = sessions.map((record) => metrics(recordsInWindow([record], EARLY_WINDOW_START)).accuracy);
  const lateAccuracy = sessions.map((record) => metrics(recordsInWindow([record], LATE_WINDOW_START)).accuracy);
  const representative = sessions[sessions.length - 1];
  return {
    boardId: group.boardId, boardName: representative.keyboard.name, fingerprint: group.fingerprint,
    difficultyKey: group.difficultyKey,
    hardware: representative.keyboard.hardware, language: group.language, sessions: sessions.length, days: days.size,
    early, late, accuracySpread: Math.max(spread(earlyAccuracy), spread(lateAccuracy))
  };
}

export function summarizeSetupInsights(records: readonly SessionRecord[], boardId: string): {
  readonly insights: readonly SetupInsight[];
  readonly compared: readonly { readonly first: SetupInsight; readonly second: SetupInsight }[];
} {
  const groups = new Map<string, AnalyticsRecord[]>();
  for (const record of records) {
    if (!isAnalyticsRecord(record) || record.keyboard.id !== boardId) continue;
    const key = groupKey(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const insights = [...groups.values()].flatMap((values) => {
    const first = values[0];
    const insight = qualifyingInsight({
      boardId: first.keyboard!.id, fingerprint: first.setupFingerprint,
      difficultyKey: first.difficultyKey, language: first.language ?? 'en',
      scoringVersion: first.scoringVersion ?? '', records: values
    });
    return insight ? [insight] : [];
  });
  const compared = [];
  for (let first = 0; first < insights.length; first += 1) {
    for (let second = first + 1; second < insights.length; second += 1) {
      if (insights[first].fingerprint !== insights[second].fingerprint
        && insights[first].difficultyKey === insights[second].difficultyKey
        && insights[first].language === insights[second].language) {
        compared.push({ first: insights[first], second: insights[second] });
      }
    }
  }
  return { insights, compared };
}
