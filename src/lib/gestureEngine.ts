import { fingersMatch, type HandData } from './handData';
import type { Fingers, GestureProfile, GestureStep, HandMode, HandShape, MovementType } from './types';

// ---------- public contracts ----------
export interface FrameInput { t: number; hands: HandData[] }
export interface DetectedGesture {
  profileId: string; name: string; confidence: number; t: number; hand: string;
}
export interface GestureDetector { process(frame: FrameInput): DetectedGesture[] }

export interface EngineConfig {
  handMode: HandMode;
  confidenceFloor: number;
  requireVisibleMs: number;
  zoneInset: number;
}
export interface EngineStatus {
  handDetected: boolean;
  hands: number;
  shape: HandShape | null;
  shapeConfidence: number;
  movement: MovementType;
  speed: number; // px/s
  heldMs: number;
}

// ---------- movement analysis ----------
export interface Sample { t: number; x: number; y: number; size: number; shape: HandShape; fingers: Fingers }
const W = 640, H = 480;

export function classifyMovement(samples: Sample[], thresholdPx: number): { type: MovementType; distance: number } {
  if (samples.length < 3) return { type: 'NONE', distance: 0 };
  const med = (a: number[]) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
  const head = samples.slice(0, 3), tail = samples.slice(-3);
  const fx = med(head.map((s) => s.x)), fy = med(head.map((s) => s.y));
  const lx = med(tail.map((s) => s.x)), ly = med(tail.map((s) => s.y));
  const dx = (lx - fx) * W, dy = (ly - fy) * H;
  const dist = Math.hypot(dx, dy);
  const sizeRatio = med(tail.map((s) => s.size)) / (med(head.map((s) => s.size)) || 1e-6);

  // path length & circular sweep
  let path = 0;
  for (let i = 1; i < samples.length; i++)
    path += Math.hypot((samples[i].x - samples[i - 1].x) * W, (samples[i].y - samples[i - 1].y) * H);
  const cx = samples.reduce((a, s) => a + s.x, 0) / samples.length;
  const cy = samples.reduce((a, s) => a + s.y, 0) / samples.length;
  let sweep = 0, prev = Math.atan2((samples[0].y - cy) * H, (samples[0].x - cx) * W);
  for (let i = 1; i < samples.length; i++) {
    const a = Math.atan2((samples[i].y - cy) * H, (samples[i].x - cx) * W);
    let da = a - prev;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    sweep += da; prev = a;
  }
  const xs = samples.map((s) => s.x * W), ys = samples.map((s) => s.y * H);
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (Math.abs(sweep) > 4.6 && extent >= thresholdPx * 0.7 && dist < path * 0.5) return { type: 'CIRCLE', distance: extent };

  if (Math.abs(sizeRatio - 1) > 0.28 && dist < thresholdPx * 1.6)
    return { type: sizeRatio > 1 ? 'TOWARD' : 'AWAY', distance: Math.abs(sizeRatio - 1) * 100 };

  if (dist < thresholdPx) return { type: 'NONE', distance: dist };
  const ang = (Math.atan2(-dy, dx) * 180) / Math.PI; // 0 = right, 90 = up
  const sector = ((Math.round(ang / 45) % 8) + 8) % 8;
  const map: MovementType[] = ['RIGHT', 'DIAGONAL_UR', 'UP', 'DIAGONAL_UL', 'LEFT', 'DIAGONAL_DL', 'DOWN', 'DIAGONAL_DR'];
  return { type: map[sector], distance: dist };
}

// ---------- shape matching ----------
export function shapeMatches(want: HandShape, got: HandShape, fingers: Fingers, p: GestureProfile): boolean {
  if (want === 'ANY') return got !== 'UNKNOWN';
  if (want === 'CUSTOM') return fingersMatch(p.fingerConfiguration, fingers);
  if (want === 'OPEN_PALM') return got === 'OPEN_PALM' || got === 'FIVE_FINGERS';
  return want === got;
}

interface Track {
  key: string;
  samples: Sample[];
  shape: HandShape;
  shapeSince: number;
  pending: HandShape | null;
  pendingCount: number;
  visibleSince: number;
  lastSeen: number;
  pinchEndAt: number;
  hand: HandData;
}
interface ProfState { stage: 0 | 1; stageAt: number; lastFire: number; latched: boolean; entries: number[] }

export const DEFAULT_CONFIG: EngineConfig = { handMode: 'EITHER', confidenceFloor: 0.6, requireVisibleMs: 0, zoneInset: 0 };

export class GestureEngine implements GestureDetector {
  private tracks = new Map<string, Track>();
  private states = new Map<string, ProfState>();
  status: EngineStatus = { handDetected: false, hands: 0, shape: null, shapeConfidence: 0, movement: 'NONE', speed: 0, heldMs: 0 };

  constructor(private getProfiles: () => GestureProfile[], private getConfig: () => EngineConfig = () => DEFAULT_CONFIG) {}

  reset() { this.tracks.clear(); this.states.clear(); }

  private st(id: string): ProfState {
    let s = this.states.get(id);
    if (!s) { s = { stage: 0, stageAt: 0, lastFire: -1e9, latched: false, entries: [] }; this.states.set(id, s); }
    return s;
  }

  process(frame: FrameInput): DetectedGesture[] {
    const cfg = this.getConfig();
    const now = frame.t;
    this.ingest(frame, cfg);
    const tracks = [...this.tracks.values()];
    const out: DetectedGesture[] = [];
    for (const p of this.getProfiles()) if (p.enabled) this.evalProfile(p, tracks, now, cfg, out);
    this.updateStatus(tracks, now);
    return out;
  }

  private ingest(frame: FrameInput, cfg: EngineConfig) {
    const now = frame.t;
    const seen = new Set<string>();
    for (const h of frame.hands) {
      if (cfg.handMode === 'LEFT' && h.side !== 'Left') continue;
      if (cfg.handMode === 'RIGHT' && h.side !== 'Right') continue;
      if (cfg.zoneInset > 0 && (h.x < cfg.zoneInset || h.x > 1 - cfg.zoneInset || h.y < cfg.zoneInset || h.y > 1 - cfg.zoneInset)) continue;
      if (seen.has(h.side)) continue;
      seen.add(h.side);
      let tr = this.tracks.get(h.side);
      if (!tr) {
        tr = { key: h.side, samples: [], shape: h.shape, shapeSince: now, pending: null, pendingCount: 0, visibleSince: now, lastSeen: now, pinchEndAt: -1e9, hand: h };
        this.tracks.set(h.side, tr);
      }
      tr.hand = h; tr.lastSeen = now;
      // debounce shape flicker: a new shape must persist for 2 frames
      if (h.shape === tr.shape) { tr.pending = null; tr.pendingCount = 0; }
      else {
        if (tr.pending === h.shape) tr.pendingCount++; else { tr.pending = h.shape; tr.pendingCount = 1; }
        if (tr.pendingCount >= 2) {
          if (tr.shape === 'PINCH') tr.pinchEndAt = now;
          tr.shape = h.shape; tr.shapeSince = now; tr.pending = null; tr.pendingCount = 0;
        }
      }
      tr.samples.push({ t: now, x: h.x, y: h.y, size: h.size, shape: tr.shape, fingers: h.fingers });
      while (tr.samples.length && now - tr.samples[0].t > 2500) tr.samples.shift();
    }
    for (const [k, tr] of this.tracks) if (now - tr.lastSeen > 300) {
      this.tracks.delete(k);
      for (const s of this.states.values()) s.latched = false;
    }
  }

  /** returns confidence (>0) if the step is currently satisfied */
  private evalStep(tr: Track, step: GestureStep, p: GestureProfile, now: number, cfg: EngineConfig): number {
    if (now - tr.visibleSince < cfg.requireVisibleMs) return 0;
    const need = Math.max(p.confidence, cfg.confidenceFloor);
    const h = tr.hand;
    if (step.shape === 'PINCH_RELEASE') {
      return now - tr.pinchEndAt < 350 && step.movement === 'STATIC' ? h.handScore : 0;
    }
    if (h.shapeConfidence < need) return 0;
    if (step.movement === 'STATIC') {
      if (!shapeMatches(step.shape, tr.shape, h.fingers, p)) return 0;
      if (now - tr.shapeSince < Math.max(p.stabilityMs, p.holdMs)) return 0;
      const recent = tr.samples.filter((s) => now - s.t <= 350);
      if (recent.length >= 3 && classifyMovement(recent, 90).type !== 'NONE') return 0; // moving => not a still pose
      return h.shapeConfidence;
    }
    const win = tr.samples.filter((s) => now - s.t <= p.maxDurationMs);
    if (win.length < 3 || win[win.length - 1].t - win[0].t < 120) return 0;
    if (step.shape !== 'ANY') {
      const ok = win.filter((s) => shapeMatches(step.shape, s.shape, s.fingers, p)).length / win.length;
      if (ok < 0.8) return 0;
    }
    const m = classifyMovement(win, p.movementThreshold);
    if (m.type !== step.movement) return 0;
    return h.shapeConfidence;
  }

  private resetMotion(tr: Track) { tr.samples = tr.samples.slice(-1); }

  private evalProfile(p: GestureProfile, tracks: Track[], now: number, cfg: EngineConfig, out: DetectedGesture[]) {
    const st = this.st(p.id);
    let sat = false, conf = 0, via: Track | null = null, step: GestureStep = p.step;
    const staged = !!p.followedBy && !p.twoHand;
    if (staged && st.stage === 1 && now - st.stageAt > p.sequenceWindowMs) st.stage = 0;
    if (staged && st.stage === 1) step = p.followedBy!;

    if (p.twoHand) {
      const L = this.tracks.get('Left'), R = this.tracks.get('Right');
      if (L && R && cfg.handMode === 'BOTH') {
        const need = Math.max(p.confidence, cfg.confidenceFloor);
        const ok = (t: Track, s: HandShape) => shapeMatches(s, t.shape, t.hand.fingers, p)
          && t.hand.shapeConfidence >= need
          && now - t.shapeSince >= Math.max(p.stabilityMs, p.holdMs)
          && now - t.visibleSince >= cfg.requireVisibleMs;
        if (ok(L, p.twoHand.left) && ok(R, p.twoHand.right)) {
          sat = true; conf = Math.min(L.hand.shapeConfidence, R.hand.shapeConfidence); via = L;
        }
      }
    } else {
      for (const tr of tracks) {
        if (p.hand === 'LEFT' && tr.key !== 'Left') continue;
        if (p.hand === 'RIGHT' && tr.key !== 'Right') continue;
        const c = this.evalStep(tr, step, p, now, cfg);
        if (c > 0) { sat = true; conf = c; via = tr; break; }
      }
    }

    const moving = step.movement !== 'STATIC';
    if (sat && via && moving) this.resetMotion(via);

    if (!sat) { st.latched = false; return; }
    if (staged && st.stage === 0) {
      st.stage = 1; st.stageAt = now;
      if (via) { via.shapeSince = now; this.resetMotion(via); }
      return;
    }
    if (now - st.lastFire < p.cooldownMs) { st.latched = true; return; }
    if (st.latched) return;
    st.latched = true;
    if (p.repeatCount > 1) {
      st.entries.push(now);
      st.entries = st.entries.filter((t) => now - t <= p.repeatWindowMs);
      if (st.entries.length < p.repeatCount) return;
    }
    st.entries = []; st.stage = 0; st.lastFire = now;
    out.push({ profileId: p.id, name: p.name, confidence: conf, t: now, hand: via?.key ?? 'Both' });
  }

  private updateStatus(tracks: Track[], now: number) {
    const tr = tracks[0];
    if (!tr) { this.status = { handDetected: false, hands: 0, shape: null, shapeConfidence: 0, movement: 'NONE', speed: 0, heldMs: 0 }; return; }
    const recent = tr.samples.filter((s) => now - s.t <= 450);
    const m = classifyMovement(recent, 45);
    let speed = 0;
    if (recent.length >= 2) {
      const a = recent[0], b = recent[recent.length - 1];
      speed = Math.hypot((b.x - a.x) * W, (b.y - a.y) * H) / Math.max(1, (b.t - a.t) / 1000);
    }
    this.status = {
      handDetected: true, hands: tracks.length, shape: tr.shape,
      shapeConfidence: tr.hand.shapeConfidence, movement: m.type === 'NONE' ? 'STATIC' : m.type,
      speed, heldMs: now - tr.shapeSince,
    };
  }
}
