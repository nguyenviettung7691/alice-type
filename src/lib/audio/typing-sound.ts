export class TypingSoundError extends Error {}

export class TypingSound {
  private context: AudioContext | undefined;
  private disposed = false;

  async play(): Promise<void> {
    if (this.disposed) return;
    try {
      if (!window.AudioContext) throw new TypingSoundError('Web Audio is unavailable in this browser.');
      const context = this.context ??= new AudioContext();
      if (context.state === 'suspended') await context.resume();
      if (this.disposed) return;
      if (context.state !== 'running') throw new TypingSoundError('The browser could not start typing audio.');
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(180, context.currentTime);
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.025);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start();
      oscillator.stop(context.currentTime + 0.025);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      throw new TypingSoundError(`Typing sound is unavailable: ${error.message}`, { cause: error });
    }
  }

  async close(): Promise<void> {
    this.disposed = true;
    if (this.context && this.context.state !== 'closed') await this.context.close();
  }
}
