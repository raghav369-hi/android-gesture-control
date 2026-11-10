import { actionMeta, runtimeBlocker, supportStatus } from './catalog';
import { emitSim, getSim, simSet, simToast } from './simStore';
import type { ActionType, ConfiguredAction, DeviceProfile, Macro } from './types';

export interface ExecResult { ok: boolean; message: string; ms: number }
export interface ActionContext {
  macros: Macro[];
  device: DeviceProfile;
  deactivate: () => void;
  depth?: number;
}
/** Anything that can perform a configured action. A real Android build would implement this with the AccessibilityService. */
export interface ActionExecutor {
  execute(action: ConfiguredAction, ctx: ActionContext): Promise<ExecResult>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const TRACKS = ['Lo-fi Beats', 'Morning Run Mix', 'Quiet Piano', 'Road Trip'];

type Handler = (a: ConfiguredAction, ctx: ActionContext) => Promise<string | void> | string | void;

const swipe = (x1: number, y1: number, x2: number, y2: number, ms = 250): Handler => () => {
  emitSim({ type: 'swipe', x1, y1, x2, y2, ms });
  return 'Swiped';
};

const needsTextField = () => {
  const s = getSim();
  if (s.screen !== 'app') throw new Error('No focused text field on screen.');
};

const HANDLERS: Record<ActionType, Handler> = {
  NONE: () => 'No action',
  HOME: () => { simSet({ screen: 'home', shade: 'none', powerMenu: false }); return 'Went Home'; },
  BACK: () => {
    const s = getSim();
    if (s.powerMenu) simSet({ powerMenu: false });
    else if (s.shade !== 'none') simSet({ shade: 'none' });
    else if (s.screen === 'recents') simSet({ screen: 'home' });
    else if (s.screen === 'app') simSet({ screen: 'home' });
    else simToast('Back (nothing to go back to)');
    return 'Pressed Back';
  },
  RECENTS: () => { simSet((s) => ({ screen: s.screen === 'recents' ? 'home' : 'recents', shade: 'none' })); return 'Toggled recents'; },
  NOTIFICATIONS: () => { simSet((s) => ({ shade: s.shade === 'notifications' ? 'none' : 'notifications' })); return 'Toggled notifications'; },
  QUICK_SETTINGS: () => { simSet((s) => ({ shade: s.shade === 'quick' ? 'none' : 'quick' })); return 'Toggled quick settings'; },
  POWER_MENU: () => { simSet({ powerMenu: true }); return 'Opened power menu'; },

  TAP: () => { emitSim({ type: 'tap', x: 50, y: 50 }); return 'Tapped centre'; },
  DOUBLE_TAP: async () => { emitSim({ type: 'tap', x: 50, y: 50 }); await sleep(110); emitSim({ type: 'tap', x: 50, y: 50 }); return 'Double-tapped'; },
  LONG_PRESS: () => { emitSim({ type: 'tap', x: 50, y: 50, long: true }); return 'Long-pressed'; },
  TAP_POSITION: (a) => { emitSim({ type: 'tap', x: a.params.x ?? 50, y: a.params.y ?? 50 }); return `Tapped ${a.params.x ?? 50}%, ${a.params.y ?? 50}%`; },
  SWIPE_UP: swipe(50, 75, 50, 25),
  SWIPE_DOWN: swipe(50, 25, 50, 75),
  SWIPE_LEFT: swipe(80, 50, 20, 50),
  SWIPE_RIGHT: swipe(20, 50, 80, 50),
  SWIPE_CUSTOM: (a) => {
    const p = a.params;
    emitSim({ type: 'swipe', x1: p.x ?? 50, y1: p.y ?? 70, x2: p.x2 ?? 50, y2: p.y2 ?? 30, ms: p.durationMs ?? 250 });
    return 'Custom swipe';
  },
  SCROLL_UP: () => { emitSim({ type: 'scroll', dir: -1 }); return 'Scrolled up'; },
  SCROLL_DOWN: () => { emitSim({ type: 'scroll', dir: 1 }); return 'Scrolled down'; },

  VOLUME_UP: () => { simSet((s) => ({ volume: clamp(s.volume + 1, 0, 15), muted: false, hud: { kind: 'volume', at: Date.now() } })); return 'Volume up'; },
  VOLUME_DOWN: () => { simSet((s) => ({ volume: clamp(s.volume - 1, 0, 15), hud: { kind: 'volume', at: Date.now() } })); return 'Volume down'; },
  MUTE: () => { simSet((s) => ({ muted: !s.muted, hud: { kind: 'volume', at: Date.now() } })); return 'Toggled mute'; },
  MEDIA_PLAY_PAUSE: () => { simSet((s) => ({ playing: !s.playing })); return getSim().playing ? 'Playing' : 'Paused'; },
  MEDIA_NEXT: () => { simSet((s) => ({ track: (s.track + 1) % TRACKS.length })); return 'Next track'; },
  MEDIA_PREV: () => { simSet((s) => ({ track: (s.track + TRACKS.length - 1) % TRACKS.length })); return 'Previous track'; },

  LOCK_SCREEN: () => { simSet({ power: false, locked: true, shade: 'none', powerMenu: false }); return 'Locked'; },
  WAKE_SCREEN: () => { simSet({ power: true }); return getSim().locked ? 'Display on (still locked - Android never bypasses the lock)' : 'Display on'; },
  BRIGHTNESS_UP: () => { simSet((s) => ({ brightness: clamp(s.brightness + 15, 5, 100), hud: { kind: 'brightness', at: Date.now() } })); return 'Brightness up'; },
  BRIGHTNESS_DOWN: () => { simSet((s) => ({ brightness: clamp(s.brightness - 15, 5, 100), hud: { kind: 'brightness', at: Date.now() } })); return 'Brightness down'; },

  BACKSPACE: () => { needsTextField(); simSet((s) => ({ text: s.selected ? '' : s.text.slice(0, -1), selected: false })); return 'Backspace'; },
  ENTER: () => { needsTextField(); simSet((s) => ({ text: s.text + '\n' })); return 'Enter'; },
  COPY: () => { needsTextField(); simSet((s) => ({ clip: s.selected ? s.text : s.clip })); simToast('Copied'); return 'Copied'; },
  PASTE: () => { needsTextField(); simSet((s) => ({ text: s.text + s.clip, selected: false })); return 'Pasted'; },
  SELECT_ALL: () => { needsTextField(); simSet({ selected: true }); return 'Selected all'; },

  WAIT: async (a) => { await sleep(a.params.durationMs ?? 300); return `Waited ${a.params.durationMs ?? 300} ms`; },
  DEACTIVATE: (_a, ctx) => { ctx.deactivate(); return 'Deactivating'; },
  MACRO: async (a, ctx) => {
    const m = ctx.macros.find((x) => x.id === a.params.macroId);
    if (!m) throw new Error('Macro not found (was it deleted?).');
    if ((ctx.depth ?? 0) >= 3) throw new Error('Macros are nested too deeply.');
    for (const step of m.steps) {
      const r = await exec.execute(step, { ...ctx, depth: (ctx.depth ?? 0) + 1 });
      if (!r.ok) throw new Error(`Step "${actionMeta(step.type).label}" failed: ${r.message}`);
      if (step.delayAfterMs > 0) await sleep(step.delayAfterMs);
    }
    return `Macro "${m.name}" finished`;
  },
};

const BLOCKED_WHEN_OFF: ActionType[] = ['WAKE_SCREEN', 'NONE', 'DEACTIVATE', 'WAIT', 'MACRO', 'VOLUME_UP', 'VOLUME_DOWN', 'MUTE', 'MEDIA_PLAY_PAUSE', 'MEDIA_NEXT', 'MEDIA_PREV'];

export class SimulatedAndroidExecutor implements ActionExecutor {
  async execute(action: ConfiguredAction, ctx: ActionContext): Promise<ExecResult> {
    const t0 = performance.now();
    const done = (ok: boolean, message: string): ExecResult => ({ ok, message, ms: Math.round(performance.now() - t0) });
    const sup = supportStatus(action.type, ctx.device);
    if (!sup.supported) return done(false, sup.reason!);
    const block = runtimeBlocker(action.type, ctx.device);
    if (block) return done(false, block);
    const s = getSim();
    if (!BLOCKED_WHEN_OFF.includes(action.type) && (!s.power || s.locked))
      return done(false, s.power ? 'Device is locked - Android does not allow bypassing the lock screen.' : 'Screen is off.');
    try {
      const msg = await HANDLERS[action.type](action, ctx);
      return done(true, msg ?? 'Done');
    } catch (e) {
      return done(false, e instanceof Error ? e.message : String(e));
    }
  }
}
const exec = new SimulatedAndroidExecutor();
export const executor: ActionExecutor = exec;
