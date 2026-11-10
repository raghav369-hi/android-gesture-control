import { uid } from './catalog';
import type {
  ActionMapping, ActionParams, ActionType, ConfiguredAction, DeviceProfile, FingerConfig,
  GestureKind, GestureProfile, HandShape, Macro, MovementType, Settings,
} from './types';

export const defaultSettings: Settings = {
  clapEnabled: false, clapCount: 2, clapMaxIntervalMs: 800, clapSensitivity: 'MEDIUM',
  clapCustomThreshold: 0.15, clapCooldownSec: 2, clapDeactivates: true,
  cameraResolution: 'MEDIUM', cameraFps: 15, inputSource: 'camera',
  gestureConfidence: 0.7, gestureTimeoutMs: 1500, stabilityMs: 250, requireVisibleMs: 150,
  zoneInset: 0, handMode: 'EITHER',
  batteryOptimization: true, autoDeactivateSec: 60, noHandSleepSec: 10,
  showOverlay: true, soundFeedback: false, vibrationFeedback: true,
  developerMode: false, debugLogs: false,
};

export const defaultDevice: DeviceProfile = { api: 34, a11yEnabled: false, writeSettings: false };

export const anyFingers: FingerConfig = { thumb: 'any', index: 'any', middle: 'any', ring: 'any', pinky: 'any' };

export function newAction(type: ActionType = 'HOME', params: ActionParams = {}, delayAfterMs = 300): ConfiguredAction {
  return { id: uid(), type, params, delayAfterMs };
}

export function newGesture(over: Partial<GestureProfile> = {}): GestureProfile {
  const now = Date.now();
  const g: GestureProfile = {
    id: uid(), name: 'New gesture', description: '', icon: '✋', enabled: true,
    gestureType: 'SHAPE', step: { shape: 'FIST', movement: 'STATIC' }, followedBy: null,
    sequenceWindowMs: 1500, twoHand: null, hand: 'ANY', fingerConfiguration: { ...anyFingers },
    movementThreshold: 120, maxDurationMs: 800, holdMs: 0, repeatCount: 1, repeatWindowMs: 1500,
    confidence: 0.7, cooldownMs: 800, stabilityMs: 250, createdAt: now, updatedAt: now, ...over,
  };
  g.gestureType = deriveKind(g);
  return g;
}

export function deriveKind(g: GestureProfile): GestureKind {
  if (g.twoHand) return 'TWO_HAND';
  if (g.followedBy) return 'SEQUENCE';
  return g.step.movement === 'STATIC' ? 'SHAPE' : 'MOVEMENT';
}

function mk(
  name: string, icon: string, shape: HandShape, movement: MovementType, action: ActionType,
  over: Partial<GestureProfile> = {}, params: ActionParams = {},
): { g: GestureProfile; m: ActionMapping } {
  const g = newGesture({ name, icon, step: { shape, movement }, ...over });
  return { g, m: { id: uid(), gestureId: g.id, action: newAction(action, params, 0), enabled: true } };
}

export function buildDefaults() {
  const macro: Macro = {
    id: uid(), name: 'Home, then notifications',
    steps: [newAction('HOME', {}, 300), newAction('NOTIFICATIONS', {}, 0)],
  };
  const swipe = { cooldownMs: 700, movementThreshold: 110, maxDurationMs: 800 };
  const list = [
    mk('Open Palm + Swipe Up', '👋', 'OPEN_PALM', 'UP', 'SCROLL_UP', { description: 'Hand moves up with palm open', ...swipe }),
    mk('Open Palm + Swipe Down', '👋', 'OPEN_PALM', 'DOWN', 'SCROLL_DOWN', swipe),
    mk('Open Palm + Swipe Left', '👋', 'OPEN_PALM', 'LEFT', 'SWIPE_LEFT', swipe),
    mk('Open Palm + Swipe Right', '👋', 'OPEN_PALM', 'RIGHT', 'SWIPE_RIGHT', swipe),
    mk('Fist', '✊', 'FIST', 'STATIC', 'BACK', { cooldownMs: 1200 }),
    mk('Two Fingers', '✌️', 'TWO_FINGERS', 'STATIC', 'HOME', { cooldownMs: 1200 }),
    mk('Thumb Up', '👍', 'THUMB_UP', 'STATIC', 'VOLUME_UP', { cooldownMs: 500 }),
    mk('Thumb Down', '👎', 'THUMB_DOWN', 'STATIC', 'VOLUME_DOWN', { cooldownMs: 500 }),
    mk('Pinch', '🤏', 'PINCH', 'STATIC', 'TAP', { cooldownMs: 900 }),
    mk('Three Fingers + Swipe Right', '🤟', 'THREE_FINGERS', 'RIGHT', 'MACRO', { ...swipe, description: 'Runs a macro: Home, wait, notifications' }, { macroId: macro.id }),
    mk('Open Palm Circle', '🔄', 'OPEN_PALM', 'CIRCLE', 'DEACTIVATE', { description: 'Draw a circle in the air to stop gesture control', movementThreshold: 100, maxDurationMs: 1500, cooldownMs: 1500 }),
  ];
  return { gestures: list.map((x) => x.g), mappings: list.map((x) => x.m), macros: [macro] };
}
