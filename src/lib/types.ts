// Core domain types. Gesture detection and Android actions only meet through
// user-editable data (GestureProfile -> ActionMapping -> ConfiguredAction).

export type HandShape =
  | 'ANY' | 'CUSTOM'
  | 'OPEN_PALM' | 'FIVE_FINGERS' | 'FOUR_FINGERS' | 'THREE_FINGERS' | 'TWO_FINGERS' | 'POINTING'
  | 'FIST' | 'THUMB_UP' | 'THUMB_DOWN' | 'OK_SIGN' | 'PINCH' | 'PINCH_RELEASE'
  | 'UNKNOWN';

export type MovementType =
  | 'STATIC' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'
  | 'DIAGONAL_UL' | 'DIAGONAL_UR' | 'DIAGONAL_DL' | 'DIAGONAL_DR'
  | 'TOWARD' | 'AWAY' | 'CIRCLE' | 'NONE';

export type FingerReq = 'any' | 'extended' | 'curled';
export interface FingerConfig {
  thumb: FingerReq; index: FingerReq; middle: FingerReq; ring: FingerReq; pinky: FingerReq;
}
export interface Fingers { thumb: boolean; index: boolean; middle: boolean; ring: boolean; pinky: boolean }

export interface GestureStep { shape: HandShape; movement: MovementType }

export type GestureKind = 'SHAPE' | 'MOVEMENT' | 'SEQUENCE' | 'TWO_HAND';

export interface GestureProfile {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  gestureType: GestureKind;
  step: GestureStep;
  followedBy: GestureStep | null;
  sequenceWindowMs: number;
  twoHand: { left: HandShape; right: HandShape } | null;
  hand: 'ANY' | 'LEFT' | 'RIGHT';
  fingerConfiguration: FingerConfig;
  movementThreshold: number; // px on a 640x480 reference frame
  maxDurationMs: number;
  holdMs: number;
  repeatCount: number;
  repeatWindowMs: number;
  confidence: number; // 0..1
  cooldownMs: number;
  stabilityMs: number;
  createdAt: number;
  updatedAt: number;
}

export type ActionType =
  | 'NONE' | 'HOME' | 'BACK' | 'RECENTS' | 'NOTIFICATIONS' | 'QUICK_SETTINGS' | 'POWER_MENU'
  | 'TAP' | 'DOUBLE_TAP' | 'LONG_PRESS' | 'TAP_POSITION'
  | 'SWIPE_UP' | 'SWIPE_DOWN' | 'SWIPE_LEFT' | 'SWIPE_RIGHT' | 'SWIPE_CUSTOM'
  | 'VOLUME_UP' | 'VOLUME_DOWN' | 'MUTE'
  | 'MEDIA_PLAY_PAUSE' | 'MEDIA_NEXT' | 'MEDIA_PREV'
  | 'LOCK_SCREEN' | 'WAKE_SCREEN' | 'BRIGHTNESS_UP' | 'BRIGHTNESS_DOWN'
  | 'SCROLL_UP' | 'SCROLL_DOWN'
  | 'BACKSPACE' | 'ENTER' | 'COPY' | 'PASTE' | 'SELECT_ALL'
  | 'WAIT' | 'MACRO' | 'DEACTIVATE';

export interface ActionParams {
  x?: number; y?: number; x2?: number; y2?: number; // percent of screen
  durationMs?: number;
  macroId?: string;
}

export interface ConfiguredAction {
  id: string;
  type: ActionType;
  params: ActionParams;
  delayAfterMs: number; // used when the action is a step inside a macro
}

export interface ActionMapping {
  id: string;
  gestureId: string;
  action: ConfiguredAction;
  enabled: boolean;
}

export interface Macro { id: string; name: string; steps: ConfiguredAction[] }

export type Sensitivity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CUSTOM';
export type HandMode = 'LEFT' | 'RIGHT' | 'EITHER' | 'BOTH';

export interface Settings {
  clapEnabled: boolean;
  clapCount: 1 | 2 | 3;
  clapMaxIntervalMs: number;
  clapSensitivity: Sensitivity;
  clapCustomThreshold: number;
  clapCooldownSec: number;
  clapDeactivates: boolean;

  cameraResolution: 'LOW' | 'MEDIUM' | 'HIGH';
  cameraFps: 10 | 15 | 20 | 30;
  inputSource: 'camera' | 'simulator';

  gestureConfidence: number;
  gestureTimeoutMs: number; // default window for "followed by" gestures
  stabilityMs: number;
  requireVisibleMs: number;
  zoneInset: number; // 0..0.4 activation zone inset
  handMode: HandMode;

  batteryOptimization: boolean;
  autoDeactivateSec: number; // 0 = never
  noHandSleepSec: number; // 0 = never sleep

  showOverlay: boolean;
  soundFeedback: boolean;
  vibrationFeedback: boolean;

  developerMode: boolean;
  debugLogs: boolean;
}

export interface DeviceProfile { api: number; a11yEnabled: boolean; writeSettings: boolean }
