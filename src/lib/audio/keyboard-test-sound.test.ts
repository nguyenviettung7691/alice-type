import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KEYBOARD_TEST_EFFECTS, KeyboardTestSound, KeyboardTestSoundError, synthesizeTestEffect
} from './keyboard-test-sound';

class AudioSource {
  buffer: unknown;
  onended?: () => void;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class AudioContextDouble {
  static instances: AudioContextDouble[] = [];
  state = 'suspended';
  sampleRate = 48000;
  destination = {};
  sources: AudioSource[] = [];
  resume = vi.fn(async () => { this.state = 'running'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  createBuffer = vi.fn((_channels: number, length: number) => {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  });
  createBufferSource = vi.fn(() => {
    const source = new AudioSource();
    this.sources.push(source);
    return source;
  });

  constructor() { AudioContextDouble.instances.push(this); }
}

function installAudio() {
  AudioContextDouble.instances = [];
  vi.stubGlobal('window', { AudioContext: AudioContextDouble });
  vi.stubGlobal('AudioContext', AudioContextDouble);
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('original keyboard test effects', () => {
  it.each(KEYBOARD_TEST_EFFECTS)('$label is finite, audible, short, bounded, and deterministic', ({ id }) => {
    const rate = 48000;
    const data = synthesizeTestEffect(id, rate);
    expect(data.length / rate).toBeGreaterThanOrEqual(0.025);
    expect(data.length / rate).toBeLessThanOrEqual(0.6);
    expect(data.every(Number.isFinite)).toBe(true);
    const peak = data.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
    expect(peak).toBeGreaterThan(0.01);
    expect(peak).toBeLessThanOrEqual(0.075001);
    expect(data[0]).toBe(0);
    expect(Math.abs(data[data.length - 1])).toBeLessThan(0.001);
    expect(synthesizeTestEffect(id, rate)).toEqual(data);
  });

  it('provides exactly 13 distinct effects and rejects invalid sample rates', () => {
    expect(KEYBOARD_TEST_EFFECTS).toHaveLength(13);
    const signatures = KEYBOARD_TEST_EFFECTS.map(({ id }) => {
      const data = synthesizeTestEffect(id, 8000);
      return `${data.length}:${Array.from(data.slice(1, 100)).join(',')}`;
    });
    expect(new Set(signatures).size).toBe(13);
    for (const rate of [0, -1, NaN, Infinity, 7999, 192001]) {
      expect(() => synthesizeTestEffect('default', rate)).toThrow(/sample rate/);
    }
  });
});

describe('keyboard test audio lifecycle', () => {
  it('creates audio lazily, reuses buffers/context, bounds polyphony, and releases resources', async () => {
    installAudio();
    const sound = new KeyboardTestSound();
    expect(AudioContextDouble.instances).toHaveLength(0);
    for (let i = 0; i < 6; i += 1) await sound.play('bubble');
    const [context] = AudioContextDouble.instances;
    expect(AudioContextDouble.instances).toHaveLength(1);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.createBuffer).toHaveBeenCalledTimes(1);
    expect(context.sources[0].stop).toHaveBeenCalledOnce();
    expect(context.sources[1].stop).toHaveBeenCalledOnce();
    expect(context.sources[2].stop).not.toHaveBeenCalled();
    context.sources[2].onended?.();
    expect(context.sources[2].disconnect).toHaveBeenCalledOnce();
    await sound.play('coin');
    expect(context.createBuffer).toHaveBeenCalledTimes(2);
    sound.stop();
    expect(context.sources.at(-1)?.stop).toHaveBeenCalledOnce();
    await sound.close();
    expect(context.close).toHaveBeenCalledOnce();
    await sound.play('horn');
    expect(context.sources).toHaveLength(7);
  });

  it('cancels a pending resume on stop and teardown without late playback', async () => {
    installAudio();
    const sound = new KeyboardTestSound();
    await sound.play('default');
    const [context] = AudioContextDouble.instances;
    context.state = 'suspended';
    let resume: (() => void) | undefined;
    context.resume.mockImplementation(() => new Promise<void>((resolve) => { resume = resolve; }));
    const pending = sound.play('horn');
    sound.stop();
    context.state = 'running';
    resume?.();
    await pending;
    expect(context.sources).toHaveLength(1);
    context.state = 'suspended';
    const pendingClose = sound.play('phone');
    await sound.close();
    resume?.();
    await pendingClose;
    expect(context.sources).toHaveLength(1);
  });

  it('reports unavailable audio, resume rejection, nonrunning context, and start failures', async () => {
    vi.stubGlobal('window', {});
    await expect(new KeyboardTestSound().play('default')).rejects.toThrow(KeyboardTestSoundError);
    installAudio();
    const sound = new KeyboardTestSound();
    await sound.play('default');
    const [context] = AudioContextDouble.instances;
    context.state = 'suspended';
    context.resume.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
    await expect(sound.play('default')).rejects.toThrow(/Denied/);
    context.state = 'closed';
    await expect(sound.play('default')).rejects.toThrow(/could not start/);
    context.state = 'running';
    const failed = new AudioSource();
    failed.start.mockImplementation(() => { throw new Error('Start failed'); });
    context.createBufferSource.mockReturnValueOnce(failed);
    await expect(sound.play('default')).rejects.toThrow(/Start failed/);
    expect(failed.disconnect).toHaveBeenCalledOnce();
    sound.stop();
    expect(failed.stop).not.toHaveBeenCalled();
    await sound.close();
  });
});
