export const KEYBOARD_TEST_EFFECTS = [
  { id: 'default', label: 'Default' }, { id: 'bubble', label: 'Bubble' },
  { id: 'horn', label: 'Horn' }, { id: 'cartoon', label: 'Cartoon' },
  { id: 'coin', label: 'Coin' }, { id: 'dog-bark', label: 'Dog bark' },
  { id: 'glass', label: 'Glass' }, { id: 'donkey', label: 'Donkey' },
  { id: 'phone', label: 'Phone' }, { id: 'punch', label: 'Punch' },
  { id: 'plastic-toy', label: 'Plastic Toy' }, { id: 'sneeze', label: 'Sneeze' },
  { id: 'plastic-chicken', label: 'Plastic chicken' }
] as const;
export type KeyboardTestEffect = typeof KEYBOARD_TEST_EFFECTS[number]['id'];

interface Tone {
  start: number;
  duration: number;
  from: number;
  to: number;
  gain: number;
  wave?: 'sine' | 'triangle' | 'noise';
}

// Original AliceType synthesized effects, distributed under the application license.
// Animal/toy names describe stylized interpretations, not sampled recordings.
const RECIPES: Readonly<Record<KeyboardTestEffect, readonly Tone[]>> = {
  default: [{ start: 0, duration: 0.035, from: 220, to: 80, gain: 1, wave: 'triangle' }],
  bubble: [{ start: 0, duration: 0.14, from: 280, to: 1400, gain: 1 }],
  horn: [
    { start: 0, duration: 0.24, from: 185, to: 165, gain: 0.6, wave: 'triangle' },
    { start: 0, duration: 0.24, from: 277, to: 247, gain: 0.4, wave: 'triangle' }
  ],
  cartoon: [
    { start: 0, duration: 0.12, from: 700, to: 160, gain: 0.7 },
    { start: 0.12, duration: 0.2, from: 160, to: 1000, gain: 0.8 }
  ],
  coin: [
    { start: 0, duration: 0.09, from: 988, to: 988, gain: 0.8 },
    { start: 0.09, duration: 0.22, from: 1319, to: 1319, gain: 0.8 }
  ],
  'dog-bark': [
    { start: 0, duration: 0.11, from: 210, to: 80, gain: 0.75, wave: 'triangle' },
    { start: 0, duration: 0.09, from: 0, to: 0, gain: 0.25, wave: 'noise' },
    { start: 0.15, duration: 0.12, from: 250, to: 90, gain: 0.75, wave: 'triangle' }
  ],
  glass: [
    { start: 0, duration: 0.3, from: 1700, to: 1700, gain: 0.45 },
    { start: 0, duration: 0.23, from: 2317, to: 2317, gain: 0.3 },
    { start: 0, duration: 0.16, from: 3071, to: 3071, gain: 0.25 }
  ],
  donkey: [
    { start: 0, duration: 0.23, from: 170, to: 420, gain: 0.8, wave: 'triangle' },
    { start: 0.25, duration: 0.27, from: 340, to: 110, gain: 0.9, wave: 'triangle' }
  ],
  phone: [
    { start: 0, duration: 0.16, from: 440, to: 440, gain: 0.5 },
    { start: 0, duration: 0.16, from: 480, to: 480, gain: 0.5 },
    { start: 0.23, duration: 0.16, from: 440, to: 440, gain: 0.5 },
    { start: 0.23, duration: 0.16, from: 480, to: 480, gain: 0.5 }
  ],
  punch: [
    { start: 0, duration: 0.15, from: 150, to: 35, gain: 0.8 },
    { start: 0, duration: 0.055, from: 0, to: 0, gain: 0.2, wave: 'noise' }
  ],
  'plastic-toy': [
    { start: 0, duration: 0.16, from: 1200, to: 480, gain: 0.8, wave: 'triangle' },
    { start: 0.16, duration: 0.1, from: 480, to: 1000, gain: 0.6, wave: 'triangle' }
  ],
  sneeze: [
    { start: 0, duration: 0.12, from: 0, to: 0, gain: 0.3, wave: 'noise' },
    { start: 0.14, duration: 0.22, from: 0, to: 0, gain: 0.85, wave: 'noise' },
    { start: 0.14, duration: 0.16, from: 350, to: 100, gain: 0.15 }
  ],
  'plastic-chicken': [
    { start: 0, duration: 0.3, from: 650, to: 180, gain: 0.8, wave: 'triangle' },
    { start: 0.31, duration: 0.12, from: 360, to: 130, gain: 0.7, wave: 'triangle' }
  ]
};

export function synthesizeTestEffect(effect: KeyboardTestEffect, sampleRate: number): Float32Array {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new Error('Unsupported audio sample rate.');
  }
  const tones = RECIPES[effect];
  if (!tones) throw new Error('Unsupported keyboard test effect.');
  const duration = Math.max(...tones.map((tone) => tone.start + tone.duration));
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  let seed = 17;
  for (const tone of tones) {
    let phase = 0;
    const offset = Math.round(tone.start * sampleRate);
    const length = Math.floor(tone.duration * sampleRate);
    for (let i = 0; i < length && offset + i < samples.length; i += 1) {
      const time = i / sampleRate;
      const fraction = time / tone.duration;
      phase += 2 * Math.PI * (tone.from + (tone.to - tone.from) * fraction) / sampleRate;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const wave = tone.wave === 'noise' ? seed / 0x80000000 - 1
        : tone.wave === 'triangle' ? 2 / Math.PI * Math.asin(Math.sin(phase)) : Math.sin(phase);
      const envelope = Math.min(time / 0.005, 1) * (1 - fraction) ** 2;
      samples[offset + i] += wave * envelope * tone.gain;
    }
  }
  const peak = samples.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 1);
  for (let i = 0; i < samples.length; i += 1) samples[i] = samples[i] / peak * 0.075;
  return samples;
}

export class KeyboardTestSoundError extends Error {}

export class KeyboardTestSound {
  private context: AudioContext | undefined;
  private buffers = new Map<KeyboardTestEffect, AudioBuffer>();
  private sources = new Set<AudioBufferSourceNode>();
  private generation = 0;
  private disposed = false;

  async play(effect: KeyboardTestEffect): Promise<void> {
    if (this.disposed) return;
    const generation = this.generation;
    try {
      if (!window.AudioContext) throw new Error('Web Audio is unavailable in this browser.');
      const context = this.context ??= new AudioContext();
      if (context.state === 'suspended') await context.resume();
      if (this.disposed || generation !== this.generation) return;
      if (context.state !== 'running') throw new Error('The browser could not start test audio.');
      let buffer = this.buffers.get(effect);
      if (!buffer) {
        const samples = synthesizeTestEffect(effect, context.sampleRate);
        buffer = context.createBuffer(1, samples.length, context.sampleRate);
        buffer.getChannelData(0).set(samples);
        this.buffers.set(effect, buffer);
      }
      if (this.sources.size >= 4) {
        const oldest = this.sources.values().next().value;
        if (oldest) { oldest.stop(); oldest.disconnect(); this.sources.delete(oldest); }
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => { this.sources.delete(source); source.disconnect(); };
      try { source.start(); } catch (error) {
        source.disconnect();
        throw error;
      }
      this.sources.add(source);
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      if (!(error instanceof Error)) throw error;
      throw new KeyboardTestSoundError(`Keyboard test sound is unavailable: ${error.message}`, { cause: error });
    }
  }

  stop(): void {
    this.generation += 1;
    for (const source of this.sources) { source.stop(); source.disconnect(); }
    this.sources.clear();
  }

  async close(): Promise<void> {
    this.disposed = true;
    this.stop();
    this.buffers.clear();
    if (this.context && this.context.state !== 'closed') await this.context.close();
  }
}
