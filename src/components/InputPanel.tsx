import { useEffect, useRef, useState } from 'react';
import { controller, useController } from '../lib/controller';
import { shapeMeta, SHAPES } from '../lib/catalog';
import { syntheticHand } from '../lib/handData';
import { patchSettings, useStore } from '../lib/store';
import type { HandShape } from '../lib/types';
import { Button, Notice, Segmented, Select } from './ui';

const CONN = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

/** Camera preview (or simulator) with landmark overlay, plus start/stop for a TEST session. */
export default function InputPanel({ compact }: { compact?: boolean }) {
  const c = useController();
  const source = useStore((s) => s.settings.inputSource);
  const zone = useStore((s) => s.settings.zoneInset);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const running = c.phase === 'running';

  useEffect(() => {
    const v = videoRef.current;
    if (v) { v.srcObject = c.stream; if (c.stream) void v.play().catch(() => {}); }
  }, [c.stream, source]);

  useEffect(() => controller.onFrame((ev) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, cv.width, cv.height);
    for (const h of ev.hands) {
      if (!h.landmarks) continue;
      const pts = h.landmarks.map((l) => [l.x * cv.width, l.y * cv.height]);
      g.strokeStyle = h.shapeConfidence > 0.75 ? '#34d399' : '#fbbf24';
      g.lineWidth = 3;
      g.beginPath();
      for (const [a, b] of CONN) { g.moveTo(pts[a][0], pts[a][1]); g.lineTo(pts[b][0], pts[b][1]); }
      g.stroke();
      g.fillStyle = '#fff';
      for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    }
  }), []);

  const startTest = () => void controller.start('TEST');

  return (
    <div className="space-y-2">
      {source === 'camera' ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
          <div className="absolute inset-0 -scale-x-100">
            <video ref={videoRef} muted playsInline className="h-full w-full object-contain" />
            <canvas ref={canvasRef} width={640} height={480} className="absolute inset-0 h-full w-full" />
          </div>
          {zone > 0 && <div className="pointer-events-none absolute rounded-lg border-2 border-dashed border-indigo-400/70"
            style={{ left: `${zone * 100}%`, right: `${zone * 100}%`, top: `${zone * 100}%`, bottom: `${zone * 100}%` }} />}
          {!c.stream && (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-slate-400">
              📷 Camera is OFF. {compact ? '' : 'It only turns on when you start a test or activate gesture control.'}
            </div>
          )}
          {c.trackerState === 'loading' && <div className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-center text-xs text-amber-300">Loading hand-tracking model…</div>}
          {running && <div className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-slate-950">● LIVE {c.camFps}/{c.procFps} fps</div>}
        </div>
      ) : (
        <HandSimulator running={running} />
      )}

      {c.error && <Notice tone="red">{c.error}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        {c.mode === 'TEST' && <Button variant="danger" onClick={() => controller.stop('test stopped')}>■ Stop test (release camera)</Button>}
        {c.mode === 'IDLE' && <Button variant="primary" onClick={startTest}>▶ Start test session</Button>}
        {c.mode === 'ACTIVE' && <Notice tone="indigo">Gesture control is active - it is feeding this panel. Detected gestures will run real actions.</Notice>}
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          Input
          <Segmented value={source} onChange={(v) => { if (c.mode === 'IDLE') patchSettings({ inputSource: v }); }}
            options={[{ value: 'camera', label: 'Camera' }, { value: 'simulator', label: 'Simulator' }]} />
        </div>
      </div>
    </div>
  );
}

interface SimHand { on: boolean; shape: HandShape }

export function HandSimulator({ running }: { running: boolean }) {
  const padRef = useRef<HTMLDivElement>(null);
  const handMode = useStore((s) => s.settings.handMode);
  const [right, setRight] = useState<SimHand>({ on: false, shape: 'OPEN_PALM' });
  const [left, setLeft] = useState<SimHand>({ on: false, shape: 'FIST' });
  const [pos, setPos] = useState({ x: 0.5, y: 0.5, size: 0.2 });
  const ref = useRef({ right, left, pos });
  ref.current = { right, left, pos };
  const anim = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const { right: r, left: l, pos: p } = ref.current;
      const hands = [];
      if (r.on) hands.push(syntheticHand(r.shape, l.on ? p.x + 0.18 : p.x, p.y, p.size, 'Right'));
      if (l.on) hands.push(syntheticHand(l.shape, r.on ? p.x - 0.18 : p.x, p.y, p.size, 'Left'));
      controller.pushFrame(hands);
    }, 33);
    return () => window.clearInterval(id);
  }, [running]);

  const move = (e: React.PointerEvent) => {
    if (!dragging.current || !padRef.current) return;
    const r = padRef.current.getBoundingClientRect();
    setPos((p) => ({ ...p, x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }));
  };

  /** scripted motion so gestures can be tested without a mouse drag */
  const run = (f: (t: number) => Partial<{ x: number; y: number; size: number }>, ms = 450) => {
    cancelAnimationFrame(anim.current);
    const start = performance.now(), origin = { ...ref.current.pos };
    const frame = () => {
      const t = Math.min(1, (performance.now() - start) / ms);
      const d = f(t);
      const cl = (v: number) => Math.min(1, Math.max(0, v));
      setPos({ x: cl(origin.x + (d.x ?? 0)), y: cl(origin.y + (d.y ?? 0)), size: Math.min(0.4, Math.max(0.08, origin.size * (1 + (d.size ?? 0)))) });
      if (t < 1) anim.current = requestAnimationFrame(frame); // hand stays where the move ends (no snap-back)
    };
    frame();
  };
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  const shapeOpts = SHAPES.filter((s) => !['ANY', 'CUSTOM', 'PINCH_RELEASE'].includes(s.id)).map((s) => ({ value: s.id, label: `${s.icon} ${s.label}` }));
  const both = handMode === 'BOTH';
  const handEl = (h: SimHand, label: string, set: (v: SimHand) => void) => (
    <div className="flex items-center gap-1.5 text-xs">
      <Button size="sm" variant={h.on ? 'success' : 'default'} onClick={() => { if (!running) return; set({ ...h, on: !h.on }); }}>{h.on ? `${label} hand: ON` : `${label} hand: OFF`}</Button>
      <Select value={h.shape} onChange={(v) => set({ ...h, shape: v })} options={shapeOpts} className="max-w-[170px]" />
    </div>
  );
  const dx = 0.3, dy = 0.3;
  return (
    <div className="space-y-2">
      <div ref={padRef} onPointerDown={(e) => { dragging.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); move(e); }}
        onPointerMove={move} onPointerUp={() => { dragging.current = false; }}
        onWheel={(e) => setPos((p) => ({ ...p, size: Math.min(0.4, Math.max(0.08, p.size - e.deltaY * 0.0003)) }))}
        className="relative aspect-[4/3] w-full touch-none overflow-hidden rounded-2xl border border-dashed border-indigo-400/40 bg-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_70%)]" />
        <div className="pointer-events-none absolute left-2 top-2 text-[11px] text-slate-400">
          Simulated camera view · drag to move the hand · wheel = closer/farther
        </div>
        {!running && <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-slate-300">Start a session to use the simulator</div>}
        {[right.on && { h: right, off: left.on ? 0.18 : 0 }, left.on && { h: left, off: right.on ? -0.18 : 0 }].map((x, i) => x && (
          <div key={i} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
            style={{ left: `${Math.min(1, Math.max(0, pos.x + x.off)) * 100}%`, top: `${pos.y * 100}%`, fontSize: `${pos.size * 330}px`, lineHeight: 1 }}>
            {shapeMeta(x.h.shape).icon}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {handEl(right, 'Right', setRight)}
        {both && handEl(left, 'Left', setLeft)}
      </div>
      <div className="flex flex-wrap gap-1">
        <span className="mr-1 self-center text-[11px] text-slate-500">Scripted moves:</span>
        <Button size="sm" onClick={() => run((t) => ({ x: -dx * t }))}>⬅</Button>
        <Button size="sm" onClick={() => run((t) => ({ x: dx * t }))}>➡</Button>
        <Button size="sm" onClick={() => run((t) => ({ y: -dy * t }))}>⬆</Button>
        <Button size="sm" onClick={() => run((t) => ({ y: dy * t }))}>⬇</Button>
        <Button size="sm" onClick={() => run((t) => ({ x: dx * t, y: -dy * t }))}>↗</Button>
        <Button size="sm" onClick={() => run((t) => ({ size: 0.9 * t }))}>Toward</Button>
        <Button size="sm" onClick={() => run((t) => ({ size: -0.55 * t }))}>Away</Button>
        <Button size="sm" onClick={() => { cancelAnimationFrame(anim.current); setPos({ x: 0.5, y: 0.5, size: 0.2 }); }} title="Re-centre hand">⌖</Button>
        <Button size="sm" onClick={() => run((t) => ({ x: Math.sin(t * 2 * Math.PI * 1.1) * 0.12, y: (1 - Math.cos(t * 2 * Math.PI * 1.1)) * 0.12 - 0.12 }), 1100)}>Circle</Button>
      </div>
    </div>
  );
}
