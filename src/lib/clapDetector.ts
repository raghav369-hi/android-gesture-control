import type { Sensitivity, Settings } from './types';

const PRESETS: Record<Exclude<Sensitivity, 'CUSTOM'>, { abs: number; ratio: number }> = {
  LOW: { abs: 0.3, ratio: 8 },
  MEDIUM: { abs: 0.18, ratio: 5 },
  HIGH: { abs: 0.08, ratio: 3 },
};

export type ClapSettings = Pick<Settings,
  'clapCount' | 'clapMaxIntervalMs' | 'clapSensitivity' | 'clapCustomThreshold' | 'clapCooldownSec'>;

/**
 * Lightweight energy-onset clap detector (no speech recognition).
 * Polls an AnalyserNode every ~25 ms; no audio is stored or transmitted.
 */
export class ClapDetector {
  level = 0;
  lastClapAt = 0;
  onPattern: () => void = () => {};
  onClap: () => void = () => {};
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private timer = 0;
  private floor = 0.01;
  private prev = 0;
  private claps: number[] = [];
  private lastTrigger = -1e9;
  get running() { return !!this.stream; }

  constructor(private getSettings: () => ClapSettings) {}

  async start() {
    if (this.stream) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.stream = stream;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const src = this.ctx.createMediaStreamSource(stream);
    const an = this.ctx.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    this.timer = window.setInterval(() => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      this.feed(Math.sqrt(sum / buf.length), performance.now());
    }, 25);
  }

  /** Public so the UI can inject a simulated clap (for devices without a mic). */
  feed(rms: number, now: number) {
    const s = this.getSettings();
    const pre = s.clapSensitivity === 'CUSTOM' ? { abs: s.clapCustomThreshold, ratio: 4 } : PRESETS[s.clapSensitivity];
    this.level = this.level * 0.6 + rms * 0.4;
    const onset = rms > pre.abs && rms > this.floor * pre.ratio && rms > this.prev * 1.6 && now - this.lastClapAt > 120;
    if (!onset) this.floor = Math.max(0.003, this.floor * 0.97 + rms * 0.03);
    this.prev = rms;
    if (onset) this.registerClap(now, s);
  }

  registerClap(now: number, s = this.getSettings()) {
    this.lastClapAt = now;
    this.onClap();
    if (this.claps.length && now - this.claps[this.claps.length - 1] > s.clapMaxIntervalMs) this.claps = [];
    this.claps.push(now);
    if (this.claps.length >= s.clapCount) {
      this.claps = [];
      if (now - this.lastTrigger >= s.clapCooldownSec * 1000) {
        this.lastTrigger = now;
        this.onPattern();
      }
    }
  }

  stop() {
    window.clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.level = 0; this.claps = []; this.prev = 0;
  }
}
