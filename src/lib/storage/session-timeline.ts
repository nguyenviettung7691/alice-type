import type { LanguageId } from '../i18n/languages';
import type { SessionRecord } from './session-history';

export const TIMELINE_LIMIT = 10;
export const ACCURACY_FLOOR = 50;
export const ACCURACY_CEILING = 100;
const MIN_WPM_AXIS = 20;

export type TimelineMode = 'timed' | 'words' | 'quote' | 'custom';

export interface TimelinePoint {
  readonly id: string;
  /** 1-based chronological position inside the window (#1 is the oldest). */
  readonly order: number;
  readonly completedAt: number;
  readonly wpm: number;
  readonly accuracy: number;
  readonly accuracyBelowFloor: boolean;
  readonly language: LanguageId;
  readonly mode: TimelineMode;
  readonly scoring: 'committed' | 'legacy';
  readonly record: Exclude<SessionRecord, { mode: 'zen' }>;
}

/**
 * Latest target-copying sessions in chronological order (oldest left, newest right).
 * Zen is excluded because it has no accuracy and measures free writing.
 */
export function buildSessionTimeline(records: readonly SessionRecord[], limit = TIMELINE_LIMIT): TimelinePoint[] {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Timeline limit must be a positive integer.');
  const latest = records
    .filter((record): record is Exclude<SessionRecord, { mode: 'zen' }> => record.mode !== 'zen')
    .sort((a, b) => b.completedAt - a.completedAt || a.id.localeCompare(b.id))
    .slice(0, limit)
    .reverse();
  return latest.map((record, index) => ({
    id: record.id,
    order: index + 1,
    completedAt: record.completedAt,
    wpm: Math.round(record.wpm),
    accuracy: record.accuracy,
    accuracyBelowFloor: record.accuracy < ACCURACY_FLOOR,
    language: record.language ?? 'en',
    mode: record.mode,
    scoring: record.scoringVersion === 'committed-grapheme-v1' ? 'committed' : 'legacy',
    record
  }));
}

/** Gridline intervals shared by both axes: accuracy ticks are 50, 60, ..., 100%. */
export const AXIS_INTERVALS = 5;

/** WPM axis ceiling with headroom; an even step keeps all five WPM ticks integers. */
export function wpmAxisMax(points: readonly Pick<TimelinePoint, 'wpm'>[]): number {
  const highest = Math.max(0, ...points.map((point) => point.wpm));
  const step = Math.max(MIN_WPM_AXIS / AXIS_INTERVALS, Math.ceil((highest * 1.1) / AXIS_INTERVALS / 2) * 2);
  return step * AXIS_INTERVALS;
}

export function clampAccuracy(accuracy: number): number {
  return Math.min(ACCURACY_CEILING, Math.max(ACCURACY_FLOOR, accuracy));
}
