import type { FingerConfig, Fingers, HandShape } from './types';

export interface Landmark { x: number; y: number; z: number }

export interface HandData {
  side: 'Left' | 'Right'; // the USER's hand
  shape: HandShape;
  shapeConfidence: number;
  handScore: number;
  fingers: Fingers;
  fingerCount: number;
  palmFacing: boolean;
  /** palm centre, 0..1, x mirrored so "right" = user's right */
  x: number;
  y: number;
  /** palm size as fraction of frame height; proxy for distance to camera */
  size: number;
  /** thumb-index distance / palm size */
  pinch: number;
  spread: number;
  landmarks?: Landmark[];
}

type P = { x: number; y: number };
const d = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

const EXT = 1.12;
const THUMB_EXT = 0.85;

export function analyzeLandmarks(lm: Landmark[], side: 'Left' | 'Right', score: number, aspect = 4 / 3): HandData {
  const p: P[] = lm.map((l) => ({ x: l.x * aspect, y: l.y }));
  const palm = d(p[0], p[9]) || 1e-6;
  const r = (tip: number, pip: number) => d(p[tip], p[0]) / (d(p[pip], p[0]) || 1e-6);
  const ri = { index: r(8, 6), middle: r(12, 10), ring: r(16, 14), pinky: r(20, 18) };
  const tr = d(p[4], p[9]) / palm;
  const fingers: Fingers = {
    thumb: tr > THUMB_EXT,
    index: ri.index > EXT, middle: ri.middle > EXT, ring: ri.ring > EXT, pinky: ri.pinky > EXT,
  };
  const pinch = d(p[4], p[8]) / palm;
  const spread = (d(p[8], p[12]) + d(p[12], p[16]) + d(p[16], p[20])) / 3 / palm;
  const margins = {
    thumb: clamp(Math.abs(tr - THUMB_EXT) / 0.3),
    index: clamp(Math.abs(ri.index - EXT) / 0.25), middle: clamp(Math.abs(ri.middle - EXT) / 0.25),
    ring: clamp(Math.abs(ri.ring - EXT) / 0.25), pinky: clamp(Math.abs(ri.pinky - EXT) / 0.25),
  };
  const { shape, extraMargin } = classify(fingers, pinch, spread, p, palm, ri.index);
  // confidence only counts the fingers that actually define this shape
  const ignore: (keyof Fingers)[] =
    shape === 'PINCH' || shape === 'OK_SIGN' ? ['thumb', 'index']
      : ['FIST', 'POINTING', 'TWO_FINGERS', 'THREE_FINGERS'].includes(shape) ? ['thumb'] : [];
  const margin = Math.min(...(Object.keys(margins) as (keyof Fingers)[]).filter((k) => !ignore.includes(k)).map((k) => margins[k]));
  const conf = clamp((0.55 + 0.45 * Math.min(margin, extraMargin)) * clamp(0.6 + 0.4 * score));

  const cx = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
  const cy = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;
  const cross = (p[5].x - p[0].x) * (p[17].y - p[0].y) - (p[5].y - p[0].y) * (p[17].x - p[0].x);
  return {
    side, shape, shapeConfidence: conf, handScore: score, fingers,
    fingerCount: Object.values(fingers).filter(Boolean).length,
    palmFacing: (cross > 0) === (side === 'Right'),
    x: 1 - cx, y: cy, size: palm, pinch, spread, landmarks: lm,
  };
}

function classify(f: Fingers, pinch: number, spread: number, p: P[], palm: number, indexRatio: number): { shape: HandShape; extraMargin: number } {
  const four = [f.index, f.middle, f.ring, f.pinky].filter(Boolean).length;
  const pm = clamp(Math.abs(pinch - 0.31) / 0.2);
  if (pinch < 0.32 && f.middle && f.ring && f.pinky) return { shape: 'OK_SIGN', extraMargin: pm };
  // a real pinch keeps the index only partly curled; a tight fist (ratio ~0.6) is not a pinch
  if (pinch < 0.3 && four < 3 && indexRatio > 0.88) return { shape: 'PINCH', extraMargin: pm };
  if (four === 0) {
    if (f.thumb) {
      const dy = (p[2].y - p[4].y) / palm; // + => thumb tip above its base
      if (Math.abs(dy) > 0.6) return { shape: dy > 0 ? 'THUMB_UP' : 'THUMB_DOWN', extraMargin: clamp((Math.abs(dy) - 0.6) / 0.4) };
    }
    return { shape: 'FIST', extraMargin: 1 };
  }
  if (four === 4) {
    if (f.thumb) return { shape: spread > 0.5 ? 'FIVE_FINGERS' : 'OPEN_PALM', extraMargin: 1 };
    return { shape: 'FOUR_FINGERS', extraMargin: 1 };
  }
  if (four === 3 && f.index && f.middle && f.ring) return { shape: 'THREE_FINGERS', extraMargin: 1 };
  if (four === 2 && f.index && f.middle) return { shape: 'TWO_FINGERS', extraMargin: 1 };
  if (four === 1 && f.index) return { shape: 'POINTING', extraMargin: 1 };
  return { shape: 'UNKNOWN', extraMargin: 0.5 };
}

const SHAPE_FINGERS: Partial<Record<HandShape, Fingers>> = {
  OPEN_PALM: { thumb: true, index: true, middle: true, ring: true, pinky: true },
  FIVE_FINGERS: { thumb: true, index: true, middle: true, ring: true, pinky: true },
  FOUR_FINGERS: { thumb: false, index: true, middle: true, ring: true, pinky: true },
  THREE_FINGERS: { thumb: false, index: true, middle: true, ring: true, pinky: false },
  TWO_FINGERS: { thumb: false, index: true, middle: true, ring: false, pinky: false },
  POINTING: { thumb: false, index: true, middle: false, ring: false, pinky: false },
  FIST: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  THUMB_UP: { thumb: true, index: false, middle: false, ring: false, pinky: false },
  THUMB_DOWN: { thumb: true, index: false, middle: false, ring: false, pinky: false },
  OK_SIGN: { thumb: true, index: false, middle: true, ring: true, pinky: true },
  PINCH: { thumb: true, index: true, middle: false, ring: false, pinky: false },
};

/** Synthetic hand used by the on-screen simulator (no camera needed). */
export function syntheticHand(shape: HandShape, x: number, y: number, size: number, side: 'Left' | 'Right'): HandData {
  const fingers = SHAPE_FINGERS[shape] ?? SHAPE_FINGERS.FIST!;
  return {
    side, shape, shapeConfidence: 0.95, handScore: 0.98, fingers: { ...fingers },
    fingerCount: Object.values(fingers).filter(Boolean).length,
    palmFacing: true, x, y, size,
    pinch: shape === 'PINCH' || shape === 'OK_SIGN' ? 0.15 : 1.1,
    spread: shape === 'FIVE_FINGERS' ? 0.7 : 0.3,
  };
}

export function fingersMatch(cfg: FingerConfig, f: Fingers): boolean {
  return (Object.keys(cfg) as (keyof FingerConfig)[]).every((k) =>
    cfg[k] === 'any' ? true : cfg[k] === 'extended' ? f[k] : !f[k]);
}
