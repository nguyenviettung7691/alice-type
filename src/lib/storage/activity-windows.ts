import type { ActivityWindow } from './session-history';

export const ACTIVITY_WINDOW_MS = 60_000;
export const MAX_IDLE_GAP_MS = 30_000;
export const MAX_DESK_SESSION_GAP_MS = 5 * 60_000;
export const MAX_ACTIVITY_MINUTES = 60;

interface MutableWindow {
  minute: number;
  attempts: number;
  correctAttempts: number;
  correctCharacters: number;
  activeMs: number;
}

export class ActiveTimeRecorder {
  private activeMs = 0;
  private lastActivity: number | null = null;
  private lastSample: number | null = null;
  private seriesKey = '';
  private groupId = '';
  private readonly windows = new Map<number, MutableWindow>();

  startSeries(seriesKey: string, timestamp: number): void {
    if (!seriesKey || !Number.isFinite(timestamp)) throw new Error('Active-time series need a key and timestamp.');
    if (seriesKey !== this.seriesKey
      || (this.lastSample !== null && timestamp - this.lastSample > MAX_DESK_SESSION_GAP_MS)) {
      this.reset();
      this.seriesKey = seriesKey;
      this.groupId = crypto.randomUUID();
    } else if (!this.groupId) {
      this.groupId = crypto.randomUUID();
    }
  }

  record(timestamp: number, attempts: number, correctAttempts: number, correctCharacters = correctAttempts): void {
    if (!Number.isFinite(timestamp) || (this.lastActivity !== null && timestamp < this.lastActivity)
      || (this.lastSample !== null && timestamp < this.lastSample)
      || !Number.isSafeInteger(attempts) || attempts < 1
      || !Number.isSafeInteger(correctAttempts) || correctAttempts < 0 || correctAttempts > attempts
      || !Number.isSafeInteger(correctCharacters) || correctCharacters < 0 || correctCharacters > correctAttempts) {
      throw new Error('Active-time samples require monotonic timestamps and valid correct-character counts.');
    }
    if (this.lastSample !== null && timestamp - this.lastSample > MAX_DESK_SESSION_GAP_MS) {
      const currentSeries = this.seriesKey;
      this.reset();
      this.seriesKey = currentSeries;
      this.groupId = crypto.randomUUID();
    }
    if (this.lastActivity !== null) {
      const gap = timestamp - this.lastActivity;
      if (gap <= MAX_IDLE_GAP_MS) this.advance(gap);
    }
    this.lastActivity = timestamp;
    this.lastSample = timestamp;
    const minute = Math.floor(this.activeMs / ACTIVITY_WINDOW_MS);
    if (minute >= MAX_ACTIVITY_MINUTES) return;
    const window = this.getWindow(minute);
    window.attempts += attempts;
    window.correctAttempts += correctAttempts;
    window.correctCharacters += correctCharacters;
  }

  pause(): void {
    this.lastActivity = null;
  }

  reset(): void {
    this.activeMs = 0;
    this.lastActivity = null;
    this.lastSample = null;
    this.seriesKey = '';
    this.groupId = '';
    this.windows.clear();
  }

  get deskSessionId(): string {
    return this.groupId;
  }

  get activeMsTotal(): number {
    return this.activeMs;
  }

  get currentSeriesKey(): string {
    return this.seriesKey;
  }

  snapshot(): readonly ActivityWindow[] {
    const completedMinutes = Math.min(MAX_ACTIVITY_MINUTES, Math.floor(this.activeMs / ACTIVITY_WINDOW_MS));
    return [...this.windows.values()]
      .filter((window) => window.minute < completedMinutes && window.attempts > 0)
      .sort((a, b) => a.minute - b.minute)
      .map((window) => ({ ...window }));
  }

  private advance(duration: number): void {
    let remaining = duration;
    while (remaining > 0 && this.activeMs < MAX_ACTIVITY_MINUTES * ACTIVITY_WINDOW_MS) {
      const minute = Math.floor(this.activeMs / ACTIVITY_WINDOW_MS);
      const offset = this.activeMs % ACTIVITY_WINDOW_MS;
      const segment = Math.min(remaining, ACTIVITY_WINDOW_MS - offset);
      this.getWindow(minute).activeMs += segment;
      this.activeMs += segment;
      remaining -= segment;
    }
  }

  private getWindow(minute: number): MutableWindow {
    let window = this.windows.get(minute);
    if (!window) {
      window = { minute, attempts: 0, correctAttempts: 0, correctCharacters: 0, activeMs: 0 };
      this.windows.set(minute, window);
    }
    return window;
  }
}
