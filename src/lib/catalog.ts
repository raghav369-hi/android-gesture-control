import type { ActionType, DeviceProfile, HandShape, MovementType } from './types';

export const SHAPES: { id: HandShape; label: string; icon: string }[] = [
  { id: 'ANY', label: 'Any hand shape', icon: '🖐️' },
  { id: 'OPEN_PALM', label: 'Open palm', icon: '👋' },
  { id: 'FIVE_FINGERS', label: 'Five fingers (spread)', icon: '🖐️' },
  { id: 'FOUR_FINGERS', label: 'Four fingers', icon: '🤚' },
  { id: 'THREE_FINGERS', label: 'Three fingers', icon: '🤟' },
  { id: 'TWO_FINGERS', label: 'Two fingers', icon: '✌️' },
  { id: 'POINTING', label: 'Pointing index finger', icon: '☝️' },
  { id: 'FIST', label: 'Closed fist', icon: '✊' },
  { id: 'THUMB_UP', label: 'Thumb up', icon: '👍' },
  { id: 'THUMB_DOWN', label: 'Thumb down', icon: '👎' },
  { id: 'OK_SIGN', label: 'OK sign', icon: '👌' },
  { id: 'PINCH', label: 'Pinch', icon: '🤏' },
  { id: 'PINCH_RELEASE', label: 'Pinch release', icon: '🫳' },
  { id: 'CUSTOM', label: 'Custom finger configuration', icon: '🛠️' },
];
export const shapeMeta = (s: HandShape) =>
  SHAPES.find((x) => x.id === s) ?? { id: s, label: s === 'UNKNOWN' ? 'Unrecognised' : s, icon: '❔' };

export const MOVEMENTS: { id: MovementType; label: string; icon: string }[] = [
  { id: 'STATIC', label: 'No movement (hold pose)', icon: '⏺' },
  { id: 'LEFT', label: 'Move left', icon: '⬅️' },
  { id: 'RIGHT', label: 'Move right', icon: '➡️' },
  { id: 'UP', label: 'Move up', icon: '⬆️' },
  { id: 'DOWN', label: 'Move down', icon: '⬇️' },
  { id: 'DIAGONAL_UL', label: 'Diagonal up-left', icon: '↖️' },
  { id: 'DIAGONAL_UR', label: 'Diagonal up-right', icon: '↗️' },
  { id: 'DIAGONAL_DL', label: 'Diagonal down-left', icon: '↙️' },
  { id: 'DIAGONAL_DR', label: 'Diagonal down-right', icon: '↘️' },
  { id: 'TOWARD', label: 'Move toward camera', icon: '🔍' },
  { id: 'AWAY', label: 'Move away from camera', icon: '🔭' },
  { id: 'CIRCLE', label: 'Circular movement', icon: '🔄' },
];
export const movementMeta = (m: MovementType) =>
  MOVEMENTS.find((x) => x.id === m) ?? { id: m, label: m === 'NONE' ? 'None' : m, icon: '•' };

export type ActionCategory =
  | 'Navigation' | 'Touch' | 'Volume' | 'Media' | 'Screen' | 'Scrolling' | 'Text' | 'System';
export const CATEGORY_ORDER: ActionCategory[] = [
  'Navigation', 'Touch', 'Scrolling', 'Volume', 'Media', 'Screen', 'Text', 'System',
];

export interface ActionMeta {
  type: ActionType;
  label: string;
  category: ActionCategory;
  icon: string;
  minApi: number;
  requires: 'a11y' | 'writeSettings' | 'none';
  /** Honest note about what Android actually permits */
  note?: string;
  params?: 'position' | 'swipe' | 'macro' | 'wait';
}

export const ACTIONS: ActionMeta[] = [
  { type: 'HOME', label: 'Home', category: 'Navigation', icon: '🏠', minApi: 16, requires: 'a11y', note: 'GLOBAL_ACTION_HOME' },
  { type: 'BACK', label: 'Back', category: 'Navigation', icon: '◀️', minApi: 16, requires: 'a11y', note: 'GLOBAL_ACTION_BACK' },
  { type: 'RECENTS', label: 'Recent apps', category: 'Navigation', icon: '🗂️', minApi: 16, requires: 'a11y', note: 'GLOBAL_ACTION_RECENTS' },
  { type: 'NOTIFICATIONS', label: 'Notifications', category: 'Navigation', icon: '🔔', minApi: 16, requires: 'a11y', note: 'GLOBAL_ACTION_NOTIFICATIONS' },
  { type: 'QUICK_SETTINGS', label: 'Quick settings', category: 'Navigation', icon: '⚙️', minApi: 17, requires: 'a11y', note: 'GLOBAL_ACTION_QUICK_SETTINGS' },
  { type: 'POWER_MENU', label: 'Power menu', category: 'Navigation', icon: '⏻', minApi: 21, requires: 'a11y', note: 'GLOBAL_ACTION_POWER_DIALOG' },

  { type: 'TAP', label: 'Tap (screen centre)', category: 'Touch', icon: '👆', minApi: 24, requires: 'a11y', note: 'dispatchGesture()' },
  { type: 'DOUBLE_TAP', label: 'Double tap', category: 'Touch', icon: '👆👆', minApi: 24, requires: 'a11y', note: 'dispatchGesture()' },
  { type: 'LONG_PRESS', label: 'Long press', category: 'Touch', icon: '⏳', minApi: 24, requires: 'a11y', note: 'dispatchGesture()' },
  { type: 'TAP_POSITION', label: 'Tap at position', category: 'Touch', icon: '🎯', minApi: 24, requires: 'a11y', params: 'position', note: 'dispatchGesture()' },
  { type: 'SWIPE_UP', label: 'Swipe up', category: 'Touch', icon: '⬆️', minApi: 24, requires: 'a11y', note: 'dispatchGesture()' },
  { type: 'SWIPE_DOWN', label: 'Swipe down', category: 'Touch', icon: '⬇️', minApi: 24, requires: 'a11y', note: 'dispatchGesture()' },
  { type: 'SWIPE_LEFT', label: 'Swipe left', category: 'Touch', icon: '⬅️', minApi: 24, requires: 'a11y', note: 'dispatchGesture()' },
  { type: 'SWIPE_RIGHT', label: 'Swipe right', category: 'Touch', icon: '➡️', minApi: 24, requires: 'a11y', note: 'dispatchGesture()' },
  { type: 'SWIPE_CUSTOM', label: 'Custom swipe', category: 'Touch', icon: '↔️', minApi: 24, requires: 'a11y', params: 'swipe', note: 'dispatchGesture()' },

  { type: 'SCROLL_UP', label: 'Scroll up', category: 'Scrolling', icon: '🔼', minApi: 21, requires: 'a11y', note: 'ACTION_SCROLL_BACKWARD on a scrollable node' },
  { type: 'SCROLL_DOWN', label: 'Scroll down', category: 'Scrolling', icon: '🔽', minApi: 21, requires: 'a11y', note: 'ACTION_SCROLL_FORWARD on a scrollable node' },

  { type: 'VOLUME_UP', label: 'Volume up', category: 'Volume', icon: '🔊', minApi: 1, requires: 'none', note: 'AudioManager.adjustStreamVolume' },
  { type: 'VOLUME_DOWN', label: 'Volume down', category: 'Volume', icon: '🔉', minApi: 1, requires: 'none', note: 'AudioManager.adjustStreamVolume' },
  { type: 'MUTE', label: 'Mute / unmute', category: 'Volume', icon: '🔇', minApi: 23, requires: 'none', note: 'ADJUST_TOGGLE_MUTE (may need Do-Not-Disturb access on some devices)' },

  { type: 'MEDIA_PLAY_PAUSE', label: 'Play / pause', category: 'Media', icon: '⏯️', minApi: 19, requires: 'none', note: 'AudioManager.dispatchMediaKeyEvent' },
  { type: 'MEDIA_NEXT', label: 'Next track', category: 'Media', icon: '⏭️', minApi: 19, requires: 'none', note: 'AudioManager.dispatchMediaKeyEvent' },
  { type: 'MEDIA_PREV', label: 'Previous track', category: 'Media', icon: '⏮️', minApi: 19, requires: 'none', note: 'AudioManager.dispatchMediaKeyEvent' },

  { type: 'LOCK_SCREEN', label: 'Lock screen', category: 'Screen', icon: '🔒', minApi: 28, requires: 'a11y', note: 'GLOBAL_ACTION_LOCK_SCREEN (Android 9+)' },
  { type: 'WAKE_SCREEN', label: 'Wake screen', category: 'Screen', icon: '💡', minApi: 21, requires: 'none', note: 'Turns the display on; Android never lets an app bypass the lock screen' },
  { type: 'BRIGHTNESS_UP', label: 'Brightness up', category: 'Screen', icon: '🔆', minApi: 23, requires: 'writeSettings', note: 'Needs the user to grant "Modify system settings"' },
  { type: 'BRIGHTNESS_DOWN', label: 'Brightness down', category: 'Screen', icon: '🔅', minApi: 23, requires: 'writeSettings', note: 'Needs the user to grant "Modify system settings"' },

  { type: 'BACKSPACE', label: 'Backspace', category: 'Text', icon: '⌫', minApi: 21, requires: 'a11y', note: 'ACTION_SET_TEXT on the focused editable field' },
  { type: 'ENTER', label: 'Enter', category: 'Text', icon: '⏎', minApi: 30, requires: 'a11y', note: 'ACTION_IME_ENTER (Android 11+)' },
  { type: 'COPY', label: 'Copy', category: 'Text', icon: '📋', minApi: 21, requires: 'a11y', note: 'ACTION_COPY on the focused node' },
  { type: 'PASTE', label: 'Paste', category: 'Text', icon: '📥', minApi: 21, requires: 'a11y', note: 'ACTION_PASTE on the focused node' },
  { type: 'SELECT_ALL', label: 'Select all', category: 'Text', icon: '🔠', minApi: 21, requires: 'a11y', note: 'ACTION_SET_SELECTION on the focused node' },

  { type: 'MACRO', label: 'Custom macro', category: 'System', icon: '🧩', minApi: 1, requires: 'none', params: 'macro', note: 'Runs several actions in sequence' },
  { type: 'DEACTIVATE', label: 'Deactivate gesture control', category: 'System', icon: '⛔', minApi: 1, requires: 'none', note: 'Stops tracking and releases the camera' },
  { type: 'NONE', label: 'Do nothing', category: 'System', icon: '∅', minApi: 1, requires: 'none' },
  { type: 'WAIT', label: 'Wait (macro only)', category: 'System', icon: '⏱️', minApi: 1, requires: 'none', params: 'wait' },
];

export const actionMeta = (t: ActionType): ActionMeta =>
  ACTIONS.find((a) => a.type === t) ?? ACTIONS[ACTIONS.length - 2];

export function supportStatus(t: ActionType, d: DeviceProfile): { supported: boolean; reason?: string } {
  const m = actionMeta(t);
  if (d.api < m.minApi) return { supported: false, reason: 'Not supported on this device/version.' };
  return { supported: true };
}

/** Run-time blockers (permissions) as opposed to static OS-version support. */
export function runtimeBlocker(t: ActionType, d: DeviceProfile): string | null {
  const m = actionMeta(t);
  if (m.requires === 'a11y' && !d.a11yEnabled) return 'Accessibility service is disabled. Enable it in Android Settings.';
  if (m.requires === 'writeSettings' && !d.writeSettings) return 'Needs the "Modify system settings" permission.';
  return null;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
