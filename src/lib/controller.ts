import { useSyncExternalStore } from 'react';
import { actionMeta } from './catalog';
import { ClapDetector } from './clapDetector';
import { executor, type ExecResult } from './actionExecutor';
import { GestureEngine, type DetectedGesture, type EngineStatus } from './gestureEngine';
import type { HandData } from './handData';
import { HandTracker } from './handTracker';
import { getState, setPerm, subscribeStore } from './store';
import type { ActionMapping, HandShape, MovementType } from './types';

export type Mode = 'IDLE' | 'ACTIVE' | 'TEST';
export interface LogEntry { id: number; t: number; kind: 'gesture' | 'action' | 'system' | 'error' | 'clap' | 'debug'; msg: string; ok?: boolean }
export interface FrameEvent {
  t: number;
  hands: HandData[];
  status: EngineStatus;
  detections: { gesture: DetectedGesture; mapping?: ActionMapping }[];
}
export interface CtrlSnapshot {
  mode: Mode;
  phase: 'idle' | 'starting' | 'running';
  error: string | null;
  stream: MediaStream | null;
  trackerState: 'none' | 'loading' | 'ready';
  delegate: string;
  sleeping: boolean;
  activeSince: number;
  camFps: number; procFps: number;
  hand: boolean; handScore: number;
  shape: HandShape | null; shapeConf: number; movement: MovementType;
  lastGesture: string; lastGestureAt: number;
  lastAction: string; lastActionMs: number; lastActionOk: boolean;
  clapLevel: number; clapListening: boolean; clapError: string | null; lastClapAt: number;
  executeInTest: boolean;
  log: LogEntry[];
}

const RES = { LOW: [320, 240], MEDIUM: [640, 480], HIGH: [1280, 720] } as const;

function friendlyError(e: unknown, what: 'camera' | 'mic' | 'tracker'): string {
  const name = (e as { name?: string })?.name;
  const msg = e instanceof Error ? e.message : String(e);
  if (what === 'tracker') return `Hand tracking could not start (${msg}). The MediaPipe model is downloaded on first use, so check your connection - or switch the input source to "Simulator" in Settings.`;
  const thing = what === 'camera' ? 'Camera' : 'Microphone';
  if (name === 'NotAllowedError' || name === 'SecurityError') return `${thing} permission was denied. Allow ${thing.toLowerCase()} access in the browser/site settings and try again.`;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return `No ${thing.toLowerCase()} was found on this device.`;
  if (name === 'NotReadableError' || name === 'AbortError') return `${thing} is unavailable - another app may be using it.`;
  return `${thing} error: ${msg}`;
}

class Controller {
  private snap: CtrlSnapshot = {
    mode: 'IDLE', phase: 'idle', error: null, stream: null, trackerState: 'none', delegate: '', sleeping: false, activeSince: 0,
    camFps: 0, procFps: 0, hand: false, handScore: 0, shape: null, shapeConf: 0, movement: 'NONE',
    lastGesture: '-', lastGestureAt: 0, lastAction: '-', lastActionMs: 0, lastActionOk: true,
    clapLevel: 0, clapListening: false, clapError: null, lastClapAt: 0, executeInTest: false, log: [],
  };
  private subs = new Set<() => void>();
  private frameSubs = new Set<(e: FrameEvent) => void>();
  private pend: Partial<CtrlSnapshot> | null = null;
  private flushTimer = 0;
  private logId = 0;

  readonly engine = new GestureEngine(
    () => getState().gestures,
    () => {
      const s = getState().settings;
      return { handMode: s.handMode, confidenceFloor: s.gestureConfidence, requireVisibleMs: s.requireVisibleMs, zoneInset: s.zoneInset };
    },
  );
  readonly clap = new ClapDetector(() => getState().settings);

  private token = 0;
  private video: HTMLVideoElement | null = null;
  private tracker: HandTracker | null = null;
  private running = false;
  private vfc = 0; private raf = 0;
  private lastProc = 0; private camCount = 0; private procCount = 0;
  private lastHandAt = 0; private lastGestureAt = 0;
  private statTimer = 0; private watchTimer = 0; private clapPoll = 0;
  private executing = false;
  private clapKey = '';
  private audio: AudioContext | null = null;

  constructor() {
    this.clap.onPattern = () => this.onClapPattern();
    this.clap.onClap = () => {
      this.touch({ lastClapAt: Date.now() });
      if (getState().settings.developerMode) this.log('clap', 'Clap detected');
    };
    const key = () => { const s = getState().settings; return `${s.clapEnabled}|${s.clapDeactivates}`; };
    this.clapKey = key();
    subscribeStore(() => {
      const k = key();
      if (k !== this.clapKey) { this.clapKey = k; void this.syncClap(); }
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.snap.mode !== 'IDLE') this.stop('emergency (Esc)'); });
    window.addEventListener('pagehide', () => this.teardown());
    void this.syncClap();
  }

  // ----- store plumbing -----
  subscribe = (l: () => void) => { this.subs.add(l); return () => { this.subs.delete(l); }; };
  getSnapshot = () => this.snap;
  onFrame(cb: (e: FrameEvent) => void) { this.frameSubs.add(cb); return () => { this.frameSubs.delete(cb); }; }
  private set(p: Partial<CtrlSnapshot>) {
    this.snap = { ...this.snap, ...p };
    this.subs.forEach((l) => l());
  }
  /** throttled updates for high-frequency stats */
  private touch(p: Partial<CtrlSnapshot>) {
    this.pend = { ...this.pend, ...p };
    if (this.flushTimer) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = 0;
      const q = this.pend; this.pend = null;
      if (q) this.set(q);
    }, 200);
  }
  log(kind: LogEntry['kind'], msg: string, ok?: boolean) {
    if (kind === 'debug' && !getState().settings.debugLogs) return;
    const e: LogEntry = { id: ++this.logId, t: Date.now(), kind, msg, ok };
    this.set({ log: [e, ...this.snap.log].slice(0, 120) });
  }
  clearLog() { this.set({ log: [] }); }
  setExecuteInTest(v: boolean) { this.set({ executeInTest: v }); }
  clearError() { this.set({ error: null }); }

  // ----- lifecycle -----
  async start(mode: 'ACTIVE' | 'TEST', reason = 'button') {
    if (this.snap.phase === 'starting') return;
    if (this.snap.mode === mode) return;
    if (this.snap.mode === 'ACTIVE' && mode === 'TEST') return;
    if (this.snap.mode !== 'IDLE') this.stop('switching mode');
    const token = ++this.token;
    this.set({ mode, phase: 'starting', error: null, trackerState: 'none' });
    this.engine.reset();
    const s = getState().settings;
    try {
      if (s.inputSource === 'camera') {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('Camera API is unavailable in this context (requires HTTPS).'), { name: 'NotFoundError' });
        const [w, h] = RES[s.cameraResolution];
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: s.cameraFps, max: 30 } }, audio: false,
          });
        } catch (e) {
          setPerm('camera', (e as { name?: string }).name === 'NotAllowedError' ? 'denied' : 'unknown');
          throw Object.assign(new Error(friendlyError(e, 'camera')), { friendly: true });
        }
        if (token !== this.token) { stream.getTracks().forEach((t) => t.stop()); return; }
        setPerm('camera', 'granted');
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          if (this.snap.mode !== 'IDLE') {
            this.stop('camera lost');
            this.set({ error: 'The camera became unavailable (disconnected or taken by another app). Gesture control was switched off.' });
          }
        });
        this.video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, srcObject: stream });
        await this.video.play();
        this.set({ stream, trackerState: 'loading' });
        try {
          this.tracker = await HandTracker.create(s.handMode === 'BOTH' ? 2 : 1);
        } catch (e) {
          throw Object.assign(new Error(friendlyError(e, 'tracker')), { friendly: true });
        }
        if (token !== this.token) { this.tracker.close(); this.tracker = null; return; }
        this.set({ trackerState: 'ready', delegate: this.tracker.delegate });
        this.startLoop();
      } else {
        this.set({ trackerState: 'ready', delegate: 'simulator' });
      }
      this.lastHandAt = this.lastGestureAt = performance.now();
      this.set({ phase: 'running', activeSince: Date.now(), sleeping: false });
      this.statTimer = window.setInterval(() => {
        this.touch({ camFps: this.camCount, procFps: this.procCount });
        this.camCount = 0; this.procCount = 0;
      }, 1000);
      this.watchTimer = window.setInterval(() => this.watchdog(), 1000);
      this.feedback('on');
      this.log('system', `${mode === 'ACTIVE' ? 'Gesture control ACTIVE' : 'Test session started'} (${reason})`);
      void this.syncClap();
    } catch (e) {
      if (token !== this.token) return;
      const msg = (e as { friendly?: boolean }).friendly ? (e as Error).message : friendlyError(e, 'camera');
      this.teardown();
      this.set({ mode: 'IDLE', phase: 'idle', error: msg, stream: null, trackerState: 'none' });
      this.log('error', msg);
      void this.syncClap();
    }
  }

  stop(reason = 'button') {
    if (this.snap.mode === 'IDLE' && this.snap.phase === 'idle') return;
    const was = this.snap.mode;
    this.token++;
    this.teardown();
    this.engine.reset();
    this.set({
      mode: 'IDLE', phase: 'idle', stream: null, trackerState: 'none', sleeping: false, delegate: '',
      camFps: 0, procFps: 0, hand: false, handScore: 0, shape: null, shapeConf: 0, movement: 'NONE',
    });
    this.log('system', `${was === 'ACTIVE' ? 'Gesture control OFF' : 'Test stopped'} - camera released (${reason})`);
    if (was === 'ACTIVE') this.feedback('off');
    void this.syncClap();
  }

  /** Releases camera + ML immediately. */
  private teardown() {
    this.running = false;
    const v = this.video;
    if (v) {
      if (this.vfc && 'cancelVideoFrameCallback' in v) (v as HTMLVideoElement & { cancelVideoFrameCallback: (n: number) => void }).cancelVideoFrameCallback(this.vfc);
      (v.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
      v.pause(); v.srcObject = null;
    }
    this.snap.stream?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(this.raf);
    this.vfc = 0; this.raf = 0;
    this.video = null;
    this.tracker?.close(); this.tracker = null;
    window.clearInterval(this.statTimer); window.clearInterval(this.watchTimer);
    this.statTimer = this.watchTimer = 0;
  }

  private watchdog() {
    const s = getState().settings, now = performance.now();
    if (this.snap.mode === 'ACTIVE') {
      if (s.autoDeactivateSec > 0 && now - this.lastGestureAt > s.autoDeactivateSec * 1000) { this.stop('auto-deactivate after inactivity'); return; }
    }
    if (s.noHandSleepSec > 0 && !this.snap.sleeping && s.inputSource === 'camera' && now - this.lastHandAt > s.noHandSleepSec * 1000) {
      this.set({ sleeping: true });
      this.log('system', 'No hand visible - low-power scanning (3 fps)');
    }
  }

  private procFps() {
    const s = getState().settings;
    return s.batteryOptimization ? Math.min(15, s.cameraFps) : s.cameraFps;
  }

  private startLoop() {
    const v = this.video!;
    this.running = true;
    const useVfc = 'requestVideoFrameCallback' in v;
    const step = () => {
      if (!this.running || !this.tracker) return;
      this.camCount++;
      const now = performance.now();
      const interval = this.snap.sleeping ? 333 : 1000 / this.procFps();
      // Only the newest frame is analysed; older frames are simply dropped (no queue).
      if (now - this.lastProc >= interval - 2 && v.readyState >= 2) {
        this.lastProc = now;
        try {
          const hands = this.tracker.detect(v, now);
          this.procCount++;
          this.handleFrame(now, hands);
        } catch (e) {
          this.log('error', `Frame processing failed: ${e instanceof Error ? e.message : e}`);
        }
      }
      schedule();
    };
    const schedule = () => {
      if (!this.running) return;
      if (useVfc) this.vfc = (v as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => number }).requestVideoFrameCallback(step);
      else this.raf = requestAnimationFrame(step);
    };
    schedule();
  }

  /** Feed frames from the on-screen hand simulator. */
  pushFrame(hands: HandData[]) {
    if (this.snap.phase !== 'running' || getState().settings.inputSource !== 'simulator') return;
    this.procCount++; this.camCount++;
    this.handleFrame(performance.now(), hands);
  }

  private handleFrame(now: number, hands: HandData[]) {
    const detections = this.engine.process({ t: now, hands });
    const st = this.engine.status;
    if (st.handDetected) {
      this.lastHandAt = now;
      if (this.snap.sleeping) { this.set({ sleeping: false }); this.log('system', 'Hand seen - full-rate tracking resumed'); }
    }
    const { mappings } = getState();
    const packed = detections.map((d) => ({ gesture: d, mapping: mappings.find((m) => m.gestureId === d.profileId) }));
    for (const p of packed) {
      this.lastGestureAt = now;
      this.touch({ lastGesture: p.gesture.name, lastGestureAt: Date.now() });
      void this.dispatch(p.gesture, p.mapping);
    }
    this.touch({
      hand: st.handDetected, handScore: hands[0]?.handScore ?? 0, shape: st.shape,
      shapeConf: st.shapeConfidence, movement: st.movement,
    });
    const ev: FrameEvent = { t: now, hands, status: st, detections: packed };
    this.frameSubs.forEach((f) => f(ev));
  }

  private async dispatch(g: DetectedGesture, mapping?: ActionMapping) {
    this.log('gesture', `${g.name} (${Math.round(g.confidence * 100)}%)`);
    if (!mapping || !mapping.enabled || mapping.action.type === 'NONE') { this.log('system', 'No action assigned to this gesture'); return; }
    const label = actionMeta(mapping.action.type).label;
    if (this.snap.mode === 'TEST' && !this.snap.executeInTest) {
      this.touch({ lastAction: `${label} (test - not executed)`, lastActionMs: 0, lastActionOk: true });
      return;
    }
    if (this.executing) { this.log('debug', `Skipped ${label}: previous action still running`); return; }
    this.executing = true;
    this.feedback('action');
    let r: ExecResult;
    try {
      const { macros, device } = getState();
      r = await executor.execute(mapping.action, { macros, device, deactivate: () => this.stop('gesture') });
    } finally { this.executing = false; }
    this.touch({ lastAction: `${label}: ${r.message}`, lastActionMs: r.ms, lastActionOk: r.ok });
    this.log('action', `${label} - ${r.message} (${r.ms} ms)`, r.ok);
  }

  /** Run an action manually (e.g. "Try" button). */
  async runAction(a: Parameters<typeof executor.execute>[0]) {
    const { macros, device } = getState();
    const r = await executor.execute(a, { macros, device, deactivate: () => this.stop('action') });
    this.log('action', `${actionMeta(a.type).label} - ${r.message} (${r.ms} ms)`, r.ok);
    this.touch({ lastAction: `${actionMeta(a.type).label}: ${r.message}`, lastActionMs: r.ms, lastActionOk: r.ok });
    return r;
  }

  // ----- clap -----
  private onClapPattern() {
    const s = getState().settings;
    if (this.snap.mode === 'IDLE' && s.clapEnabled) void this.start('ACTIVE', 'clap');
    else if (this.snap.mode === 'ACTIVE' && s.clapDeactivates) this.stop('clap');
  }
  simulateClap() { this.clap.registerClap(performance.now()); }

  async syncClap() {
    const want = () => {
      const s = getState().settings;
      return s.clapEnabled && (this.snap.mode === 'IDLE' || (this.snap.mode === 'ACTIVE' && s.clapDeactivates));
    };
    if (want() && !this.clap.running) {
      try {
        await this.clap.start();
        setPerm('mic', 'granted');
        this.set({ clapListening: true, clapError: null });
        window.clearInterval(this.clapPoll);
        this.clapPoll = window.setInterval(() => this.touch({ clapLevel: this.clap.level }), 120);
        this.log('system', 'Clap listener on (camera stays off)');
      } catch (e) {
        setPerm('mic', (e as { name?: string }).name === 'NotAllowedError' ? 'denied' : 'unknown');
        this.set({ clapListening: false, clapError: friendlyError(e, 'mic') });
      }
      if (!want() && this.clap.running) this.stopClap();
    } else if (!want() && this.clap.running) this.stopClap();
  }
  private stopClap() {
    this.clap.stop();
    window.clearInterval(this.clapPoll);
    this.set({ clapListening: false, clapLevel: 0 });
    this.log('system', 'Clap listener off - microphone released');
  }

  // ----- feedback -----
  private feedback(kind: 'on' | 'off' | 'action') {
    const s = getState().settings;
    if (s.vibrationFeedback && 'vibrate' in navigator) navigator.vibrate(kind === 'action' ? 25 : kind === 'on' ? [30, 40, 30] : 60);
    if (s.soundFeedback) {
      try {
        this.audio ??= new AudioContext();
        const o = this.audio.createOscillator(), g = this.audio.createGain();
        o.frequency.value = kind === 'on' ? 880 : kind === 'off' ? 440 : 660;
        g.gain.value = 0.05;
        o.connect(g).connect(this.audio.destination);
        o.start(); o.stop(this.audio.currentTime + 0.09);
      } catch { /* audio blocked */ }
    }
  }
}

export const controller = new Controller();
export const useController = () => useSyncExternalStore(controller.subscribe, controller.getSnapshot);
