import { classifyMovement, type Sample } from './gestureEngine';
import { movementMeta, shapeMeta } from './catalog';
import type { FingerConfig, FingerReq, GestureProfile, HandShape, MovementType } from './types';

export interface RecordingResult {
  patch: Partial<GestureProfile>;
  summary: string;
  ok: boolean;
}

/** Turns a recorded hand motion into editable, parameter-based gesture settings (no ML training). */
export function analyzeRecording(samples: Sample[]): RecordingResult {
  if (samples.length < 6) return { ok: false, patch: {}, summary: 'Not enough hand data was captured. Keep your hand in view while recording.' };
  const counts = new Map<HandShape, number>();
  for (const s of samples) if (s.shape !== 'UNKNOWN') counts.set(s.shape, (counts.get(s.shape) ?? 0) + 1);
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'ANY';
  const duration = samples[samples.length - 1].t - samples[0].t;

  const keys: (keyof FingerConfig)[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  const fc = {} as FingerConfig;
  for (const k of keys) {
    const frac = samples.filter((s) => s.fingers[k]).length / samples.length;
    fc[k] = (frac > 0.8 ? 'extended' : frac < 0.2 ? 'curled' : 'any') as FingerReq;
  }

  const mv = classifyMovement(samples, 40);
  const movement: MovementType = mv.type === 'NONE' ? 'STATIC' : mv.type;
  const patch: Partial<GestureProfile> = {
    step: { shape: dominant, movement },
    fingerConfiguration: fc,
    gestureType: movement === 'STATIC' ? 'SHAPE' : 'MOVEMENT',
  };
  if (movement !== 'STATIC') {
    const isPx = movement !== 'TOWARD' && movement !== 'AWAY';
    if (isPx) patch.movementThreshold = Math.max(40, Math.round((mv.distance * 0.6) / 10) * 10);
    patch.maxDurationMs = Math.min(3000, Math.max(400, Math.round((duration * 1.4) / 100) * 100));
  }
  const summary = `Shape: ${shapeMeta(dominant).label} · Movement: ${movementMeta(movement).label}` +
    (movement !== 'STATIC' ? ` · ${Math.round(mv.distance)}${movement === 'TOWARD' || movement === 'AWAY' ? '% size change' : ' px'} in ${Math.round(duration)} ms` : '');
  return { ok: true, patch, summary };
}
