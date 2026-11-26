export type TimeSignature = '4/4' | '3/4' | '6/8';

export const TIME_SIGNATURE_BEATS: Record<TimeSignature, number> = {
  '4/4': 4,
  '3/4': 3,
  '6/8': 6,
};

interface MetronomeCallbacks {
  onBeat: (beatIndex: number, totalBeats: number) => void;
}

/**
 * Sample-accurate Web Audio studio click metronome using lookahead scheduling.
 */
export class StudioMetronome {
  private ctx: AudioContext | null = null;
  private isRunning = false;
  private bpm = 110;
  private timeSignature: TimeSignature = '4/4';
  private muted = false;
  private volume = 0.75;

  private currentBeat = 0;
  private nextNoteTime = 0;
  private timerId: number | null = null;
  private visualTimers: number[] = [];
  private callbacks: MetronomeCallbacks;

  private readonly lookaheadMs = 25;
  private readonly scheduleAheadSec = 0.1;

  constructor(callbacks: MetronomeCallbacks) {
    this.callbacks = callbacks;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setBpm(nextBpm: number): void {
    this.bpm = Math.max(40, Math.min(240, Math.round(nextBpm) || 100));
  }

  public setTimeSignature(sig: TimeSignature): void {
    this.timeSignature = sig;
    const total = TIME_SIGNATURE_BEATS[sig];
    if (this.currentBeat >= total) {
      this.currentBeat = 0;
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public start(bpm?: number, sig?: TimeSignature): void {
    if (typeof bpm === 'number') this.setBpm(bpm);
    if (sig) this.setTimeSignature(sig);

    const ctx = this.ensureContext();
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentBeat = 0;
    this.nextNoteTime = ctx.currentTime + 0.04;
    this.scheduler();
    this.timerId = window.setInterval(() => this.scheduler(), this.lookaheadMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    for (const id of this.visualTimers) {
      window.clearTimeout(id);
    }
    this.visualTimers = [];
    this.currentBeat = 0;
  }

  public dispose(): void {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }

  private scheduler(): void {
    if (!this.isRunning || !this.ctx) return;
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadSec) {
      const beatIndex = this.currentBeat;
      const totalBeats = TIME_SIGNATURE_BEATS[this.timeSignature];
      this.scheduleClick(beatIndex, this.nextNoteTime);
      this.scheduleVisualBeat(beatIndex, totalBeats, this.nextNoteTime);
      this.advanceBeat(totalBeats);
    }
  }

  private scheduleClick(beatIndex: number, time: number): void {
    if (!this.ctx || this.muted || this.volume <= 0.001) return;

    const isAccent = beatIndex === 0;
    const isSecondaryAccent = this.timeSignature === '6/8' && beatIndex === 3;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Crisp studio woodblock-style click (high pitch on Beat 1, warm mid click on sub-beats)
    osc.type = 'triangle';
    const baseFreq = isAccent ? 1480 : isSecondaryAccent ? 1120 : 920;
    osc.frequency.setValueAtTime(baseFreq, time);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.55, time + 0.028);

    const peakGain = (isAccent ? 0.52 : isSecondaryAccent ? 0.34 : 0.26) * this.volume;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.042);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  private scheduleVisualBeat(beatIndex: number, totalBeats: number, noteTime: number): void {
    if (!this.ctx) return;
    const delayMs = Math.max(0, (noteTime - this.ctx.currentTime) * 1000);
    const id = window.setTimeout(() => {
      this.visualTimers = this.visualTimers.filter((t) => t !== id);
      if (this.isRunning) {
        this.callbacks.onBeat(beatIndex, totalBeats);
      }
    }, delayMs);
    this.visualTimers.push(id);
  }

  private advanceBeat(totalBeats: number): void {
    // For 6/8, treat BPM as dotted-quarter or eighth pulse cleanly; standard practice uses eighth-note subdivision at 2x speed if BPM < 95, or direct beat at BPM.
    // Using quarter-note pulse directly matches user's song BPM intuitively.
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.currentBeat = (this.currentBeat + 1) % totalBeats;
  }
}
