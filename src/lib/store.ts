import { useSyncExternalStore } from 'react';
import { uid } from './catalog';
import { buildDefaults, defaultDevice, defaultSettings, deriveKind, newAction } from './defaults';
import type { ActionMapping, ConfiguredAction, DeviceProfile, GestureProfile, Macro, Settings } from './types';

export interface AppState {
  gestures: GestureProfile[];
  mappings: ActionMapping[];
  macros: Macro[];
  settings: Settings;
  device: DeviceProfile;
  onboarded: boolean;
  perms: { camera: 'unknown' | 'granted' | 'denied'; mic: 'unknown' | 'granted' | 'denied' };
}

const KEY = 'gesture-controller.v1';

function load(): AppState {
  const d = buildDefaults();
  const base: AppState = {
    ...d, settings: { ...defaultSettings }, device: { ...defaultDevice }, onboarded: false,
    perms: { camera: 'unknown', mic: 'unknown' },
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw);
      return {
        ...base, ...j,
        settings: { ...defaultSettings, ...j.settings },
        device: { ...defaultDevice, ...j.device },
        perms: base.perms,
      };
    }
  } catch { /* corrupt storage -> defaults */ }
  return base;
}

let state: AppState = load();
const listeners = new Set<() => void>();

export const getState = () => state;
export function setState(fn: (s: AppState) => Partial<AppState>) {
  state = { ...state, ...fn(state) };
  try {
    const { perms: _p, ...persist } = state;
    void _p;
    localStorage.setItem(KEY, JSON.stringify(persist));
  } catch { /* storage full / unavailable */ }
  listeners.forEach((l) => l());
}
export const subscribeStore = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export function useStore<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(subscribeStore, () => sel(state));
}

// ---------- mutations ----------
export const patchSettings = (p: Partial<Settings>) => setState((s) => ({ settings: { ...s.settings, ...p } }));
export const patchDevice = (p: Partial<DeviceProfile>) => setState((s) => ({ device: { ...s.device, ...p } }));
export const setPerm = (k: 'camera' | 'mic', v: 'unknown' | 'granted' | 'denied') =>
  setState((s) => ({ perms: { ...s.perms, [k]: v } }));

export function saveGesture(g: GestureProfile, action: ConfiguredAction) {
  const next = { ...g, gestureType: deriveKind(g), updatedAt: Date.now() };
  setState((s) => {
    const exists = s.gestures.some((x) => x.id === g.id);
    const gestures = exists ? s.gestures.map((x) => (x.id === g.id ? next : x)) : [...s.gestures, next];
    const has = s.mappings.some((m) => m.gestureId === g.id);
    const mappings = has
      ? s.mappings.map((m) => (m.gestureId === g.id ? { ...m, action } : m))
      : [...s.mappings, { id: uid(), gestureId: g.id, action, enabled: true }];
    return { gestures, mappings };
  });
}
export const toggleGesture = (id: string) =>
  setState((s) => ({ gestures: s.gestures.map((g) => (g.id === id ? { ...g, enabled: !g.enabled } : g)) }));
export const deleteGesture = (id: string) =>
  setState((s) => ({ gestures: s.gestures.filter((g) => g.id !== id), mappings: s.mappings.filter((m) => m.gestureId !== id) }));
export function duplicateGesture(id: string) {
  setState((s) => {
    const g = s.gestures.find((x) => x.id === id);
    if (!g) return {};
    const ng = { ...g, id: uid(), name: g.name + ' (copy)', createdAt: Date.now(), updatedAt: Date.now() };
    const m = s.mappings.find((x) => x.gestureId === id);
    const i = s.gestures.findIndex((x) => x.id === id);
    const gestures = [...s.gestures]; gestures.splice(i + 1, 0, ng);
    const mappings = m ? [...s.mappings, { ...m, id: uid(), gestureId: ng.id, action: { ...m.action, id: uid() } }] : s.mappings;
    return { gestures, mappings };
  });
}
export function moveGesture(id: string, dir: -1 | 1) {
  setState((s) => {
    const i = s.gestures.findIndex((g) => g.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= s.gestures.length) return {};
    const gestures = [...s.gestures];
    [gestures[i], gestures[j]] = [gestures[j], gestures[i]];
    return { gestures };
  });
}
export function saveMacro(m: Macro) {
  setState((s) => ({ macros: s.macros.some((x) => x.id === m.id) ? s.macros.map((x) => (x.id === m.id ? m : x)) : [...s.macros, m] }));
}
export const deleteMacro = (id: string) => setState((s) => ({ macros: s.macros.filter((m) => m.id !== id) }));
export const newMacro = (): Macro => ({ id: uid(), name: 'New macro', steps: [newAction('HOME', {}, 300)] });
export function resetEverything() {
  const d = buildDefaults();
  setState(() => ({ ...d, settings: { ...defaultSettings }, device: { ...defaultDevice }, onboarded: false }));
}
export function restoreDefaultGestures() {
  const d = buildDefaults();
  setState((s) => ({ gestures: d.gestures, mappings: d.mappings, macros: d.macros, settings: s.settings }));
}
