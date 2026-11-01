import { describe, expect, it } from 'vitest';
import { ActiveTimeRecorder } from './activity-windows';

describe('bounded active-time windows', () => {
  it('records only completed minute windows and attributes attempts to active time', () => {
    const recorder = new ActiveTimeRecorder();
    recorder.startSeries('setup:difficulty', 0);
    recorder.record(0, 1, 1);
    for (let timestamp = 10_000; timestamp <= 70_000; timestamp += 10_000) {
      recorder.record(timestamp, 1, 1);
    }
    expect(recorder.activeMsTotal).toBe(70_000);
    expect(recorder.snapshot()).toEqual([{
      minute: 0, attempts: 6, correctAttempts: 6, correctCharacters: 6, activeMs: 60_000
    }]);
  });

  it('pauses on blur and excludes idle gaps longer than 30 seconds', () => {
    const recorder = new ActiveTimeRecorder();
    recorder.startSeries('setup:difficulty', 0);
    recorder.record(0, 1, 1);
    recorder.record(10_000, 1, 1);
    recorder.pause();
    recorder.record(100_000, 1, 1);
    expect(recorder.activeMsTotal).toBe(10_000);
    recorder.record(131_000, 1, 1);
    expect(recorder.activeMsTotal).toBe(10_000);
  });

  it('starts a new desk-session group after a gap over five minutes', () => {
    const recorder = new ActiveTimeRecorder();
    recorder.startSeries('setup:difficulty', 0);
    recorder.record(0, 1, 1);
    const previousGroup = recorder.deskSessionId;
    recorder.startSeries('setup:difficulty', 300_001);
    expect(recorder.deskSessionId).not.toBe(previousGroup);
    expect(recorder.activeMsTotal).toBe(0);
    expect(recorder.snapshot()).toEqual([]);
  });

  it('keeps the existing desk-session group at an exact five-minute gap', () => {
    const recorder = new ActiveTimeRecorder();
    recorder.startSeries('setup:difficulty', 0);
    recorder.record(0, 1, 1);
    const previousGroup = recorder.deskSessionId;
    recorder.startSeries('setup:difficulty', 300_000);
    expect(recorder.deskSessionId).toBe(previousGroup);
  });
});
