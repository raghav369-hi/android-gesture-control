import { useSyncExternalStore } from 'react';

export interface SimState {
  power: boolean;
  locked: boolean;
  screen: 'home' | 'app' | 'recents';
  page: number;
  shade: 'none' | 'notifications' | 'quick';
  powerMenu: boolean;
  volume: number; // 0..15
  muted: boolean;
  brightness: number; // 5..100
  playing: boolean;
  track: number;
  text: string;
  clip: string;
  selected: boolean;
  carousel: number;
  hud: { kind: 'volume' | 'brightness'; at: number } | null;
  toast: { msg: string; at: number } | null;
}

let sim: SimState = {
  power: true, locked: false, screen: 'home', page: 0, shade: 'none', powerMenu: false,
  volume: 7, muted: false, brightness: 60, playing: false, track: 0, text: 'Hello gestures', clip: '',
  selected: false, carousel: 0, hud: null, toast: null,
};
const ls = new Set<() => void>();
export const getSim = () => sim;
export function simSet(p: Partial<SimState> | ((s: SimState) => Partial<SimState>)) {
  sim = { ...sim, ...(typeof p === 'function' ? p(sim) : p) };
  ls.forEach((l) => l());
}
export const useSim = () => useSyncExternalStore((l) => { ls.add(l); return () => { ls.delete(l); }; }, () => sim);
export const simToast = (msg: string) => simSet({ toast: { msg, at: Date.now() } });

export type SimEvent =
  | { type: 'tap'; x: number; y: number; long?: boolean }
  | { type: 'swipe'; x1: number; y1: number; x2: number; y2: number; ms: number }
  | { type: 'scroll'; dir: 1 | -1 };
const bus = new Set<(e: SimEvent) => void>();
export const onSimEvent = (f: (e: SimEvent) => void) => { bus.add(f); return () => { bus.delete(f); }; };
export const emitSim = (e: SimEvent) => bus.forEach((f) => f(e));
