import { useEffect, useMemo, useRef, useState } from 'react';
import { MOVEMENTS, SHAPES } from '../lib/catalog';
import { controller, useController } from '../lib/controller';
import { newAction } from '../lib/defaults';
import { GestureEngine, type Sample } from '../lib/gestureEngine';
import { analyzeRecording } from '../lib/recorder';
import { saveGesture, useStore } from '../lib/store';
import type { ConfiguredAction, FingerReq, GestureProfile, GestureStep } from '../lib/types';
import { ActionEditor } from './ActionPicker';
import InputPanel from './InputPanel';
import { Badge, Button, Card, Notice, SectionTitle, Segmented, Select, Slider, Toggle } from './ui';

const shapeOpts = SHAPES.map((s) => ({ value: s.id, label: `${s.icon} ${s.label}` }));
const moveOpts = MOVEMENTS.map((m) => ({ value: m.id, label: `${m.icon} ${m.label}` }));
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;

function StepEditor({ step, onChange, label }: { step: GestureStep; onChange: (s: GestureStep) => void; label: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <div className="mb-1 text-xs text-slate-400">{label} - hand shape</div>
        <Select value={step.shape} className="w-full" options={shapeOpts}
          onChange={(shape) => onChange({ shape, movement: shape === 'PINCH_RELEASE' ? 'STATIC' : step.movement })} />
      </div>
      <div>
        <div className="mb-1 text-xs text-slate-400">{label} - movement</div>
        <Select value={step.movement} className="w-full" options={moveOpts} onChange={(movement) => onChange({ ...step, movement })} />
      </div>
    </div>
  );
}

export default function GestureBuilder({
  initial, initialAction, onClose,
}: { initial: GestureProfile; initialAction: ConfiguredAction; onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const c = useController();
  const [g, setG] = useState<GestureProfile>(initial);
  const [action, setAction] = useState<ConfiguredAction>(initialAction);
  const patch = (p: Partial<GestureProfile>) => setG((x) => ({ ...x, ...p }));

  // ---- recording ----
  const [rec, setRec] = useState<{ phase: 'idle' | 'countdown' | 'recording' | 'done'; n: number; msg: string; ok: boolean }>({ phase: 'idle', n: 0, msg: '', ok: true });
  const samples = useRef<Sample[]>([]);
  const phaseRef = useRef(rec.phase);
  phaseRef.current = rec.phase;
  const timers = useRef<number[]>([]);

  const finishRecording = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    const r = analyzeRecording(samples.current);
    if (r.ok) setG((x) => ({ ...x, ...r.patch, followedBy: x.followedBy }));
    setRec({ phase: 'done', n: 0, msg: r.summary, ok: r.ok });
  };
  const startRecording = async () => {
    if (c.mode === 'IDLE') await controller.start('TEST');
    if (controller.getSnapshot().phase !== 'running') return;
    samples.current = [];
    setRec({ phase: 'countdown', n: 3, msg: '', ok: true });
    [1, 2, 3].forEach((i) => timers.current.push(window.setTimeout(() => {
      if (i < 3) setRec((r) => ({ ...r, n: 3 - i }));
      else { setRec({ phase: 'recording', n: 0, msg: '', ok: true }); timers.current.push(window.setTimeout(finishRecording, 3000)); }
    }, i * 1000)));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // ---- live test of the DRAFT only ----
  const draftRef = useRef(g);
  draftRef.current = g;
  const testEngine = useMemo(() => new GestureEngine(
    () => [{ ...draftRef.current, enabled: true }],
    () => ({ handMode: settings.handMode, confidenceFloor: 0, requireVisibleMs: settings.requireVisibleMs, zoneInset: settings.zoneInset }),
  ), [settings.handMode, settings.requireVisibleMs, settings.zoneInset]);
  const [hits, setHits] = useState(0);
  const [flash, setFlash] = useState(false);
  const [live, setLive] = useState({ shape: '-', conf: 0, move: '-' });
  useEffect(() => controller.onFrame((ev) => {
    if (phaseRef.current === 'recording') {
      const h = ev.hands[0];
      if (h) samples.current.push({ t: ev.t, x: h.x, y: h.y, size: h.size, shape: h.shape, fingers: h.fingers });
    }
    const d = testEngine.process({ t: ev.t, hands: ev.hands });
    const st = testEngine.status;
    setLive((p) => (p.shape === (st.shape ?? '-') && Math.abs(p.conf - st.shapeConfidence) < 0.03 && p.move === st.movement ? p : { shape: st.shape ?? '-', conf: st.shapeConfidence, move: st.movement }));
    if (d.length) { setHits((n) => n + 1); setFlash(true); setTimeout(() => setFlash(false), 700); }
  }), [testEngine]);
  useEffect(() => testEngine.reset(), [g.step.shape, g.step.movement, testEngine]);

  const isMove = g.step.movement !== 'STATIC';
  const pxMove = isMove && g.step.movement !== 'TOWARD' && g.step.movement !== 'AWAY';
  const canSave = g.name.trim().length > 0;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Gesture Builder</h2>
        <Button variant="ghost" onClick={onClose}>✕ Cancel</Button>
      </div>

      <Card>
        <SectionTitle>1 · Name</SectionTitle>
        <div className="flex gap-2">
          <input value={g.icon} onChange={(e) => patch({ icon: e.target.value.slice(0, 4) })} aria-label="Icon"
            className="w-14 rounded-xl border border-white/10 bg-slate-800 px-2 py-2 text-center text-xl" />
          <input value={g.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Swipe Right"
            className="flex-1 rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white" />
        </div>
        <input value={g.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Description (optional)"
          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white" />
      </Card>

      <Card>
        <SectionTitle>2 · Record a gesture <span className="normal-case text-slate-500">(optional)</span></SectionTitle>
        <p className="mb-2 text-xs text-slate-400">Perform the gesture in front of the camera. Your hand shape, direction, distance and speed are measured and turned into editable parameters - no model training.</p>
        <InputPanel />
        <div className="mt-3 flex items-center gap-3">
          {rec.phase === 'idle' || rec.phase === 'done' ? (
            <Button variant="primary" onClick={startRecording}>● {rec.phase === 'done' ? 'Record again' : 'Start recording'}</Button>
          ) : rec.phase === 'countdown' ? (
            <Badge tone="amber">Get ready… {rec.n}</Badge>
          ) : (
            <><Badge tone="red">● Recording - perform the gesture now</Badge><Button size="sm" onClick={finishRecording}>Stop</Button></>
          )}
        </div>
        {rec.phase === 'done' && <div className="mt-2"><Notice tone={rec.ok ? 'green' : 'red'}>{rec.ok ? '✓ Applied to the settings below. ' : ''}{rec.msg}</Notice></div>}
      </Card>

      <Card>
        <SectionTitle>3 · Detection parameters</SectionTitle>
        <StepEditor step={g.step} label="Step 1" onChange={(step) => patch({ step })} />
        {g.step.shape === 'CUSTOM' || g.followedBy?.shape === 'CUSTOM' ? (
          <div className="mt-3 rounded-xl bg-white/5 p-3">
            <div className="mb-1 text-xs font-medium text-slate-300">Finger configuration</div>
            {FINGERS.map((f) => (
              <div key={f} className="flex items-center justify-between py-1">
                <span className="text-sm capitalize">{f}</span>
                <Segmented<FingerReq> value={g.fingerConfiguration[f]} onChange={(v) => patch({ fingerConfiguration: { ...g.fingerConfiguration, [f]: v } })}
                  options={[{ value: 'any', label: 'Any' }, { value: 'extended', label: 'Extended' }, { value: 'curled', label: 'Curled' }]} />
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
          <div><div className="text-sm font-medium">Followed by another gesture</div><div className="text-xs text-slate-400">e.g. Fist → Open palm</div></div>
          <Toggle checked={!!g.followedBy} onChange={(v) => patch({ followedBy: v ? { shape: 'OPEN_PALM', movement: 'STATIC' } : null, twoHand: v ? null : g.twoHand, sequenceWindowMs: settings.gestureTimeoutMs })} />
        </div>
        {g.followedBy && (
          <div className="mt-2 space-y-1">
            <StepEditor step={g.followedBy} label="Step 2" onChange={(followedBy) => patch({ followedBy })} />
            <Slider label="Time allowed between steps" value={g.sequenceWindowMs} min={300} max={5000} step={100} unit=" ms" onChange={(v) => patch({ sequenceWindowMs: v })} />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
          <div><div className="text-sm font-medium">Two-hand gesture</div><div className="text-xs text-slate-400">Needs hand mode "Both hands" (Settings)</div></div>
          <Toggle checked={!!g.twoHand} onChange={(v) => patch({ twoHand: v ? { left: 'FIST', right: 'OPEN_PALM' } : null, followedBy: v ? null : g.followedBy })} />
        </div>
        {g.twoHand && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div><div className="mb-1 text-xs text-slate-400">Left hand</div><Select value={g.twoHand.left} className="w-full" options={shapeOpts.filter((o) => o.value !== 'PINCH_RELEASE')} onChange={(left) => patch({ twoHand: { ...g.twoHand!, left } })} /></div>
            <div><div className="mb-1 text-xs text-slate-400">Right hand</div><Select value={g.twoHand.right} className="w-full" options={shapeOpts.filter((o) => o.value !== 'PINCH_RELEASE')} onChange={(right) => patch({ twoHand: { ...g.twoHand!, right } })} /></div>
          </div>
        )}
        {!g.twoHand && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm">Which hand</span>
            <Segmented value={g.hand} onChange={(hand) => patch({ hand })} options={[{ value: 'ANY', label: 'Either' }, { value: 'LEFT', label: 'Left' }, { value: 'RIGHT', label: 'Right' }]} />
          </div>
        )}

        <div className="mt-2 divide-y divide-white/5">
          {pxMove && <Slider label="Minimum distance" value={g.movementThreshold} min={30} max={400} step={10} unit=" px" hint="Measured on a 640×480 reference frame" onChange={(v) => patch({ movementThreshold: v })} />}
          {isMove && <Slider label="Maximum duration" value={g.maxDurationMs} min={200} max={3000} step={50} unit=" ms" onChange={(v) => patch({ maxDurationMs: v })} />}
          {!isMove && <Slider label="Hold duration" value={g.holdMs} min={0} max={3000} step={50} unit=" ms" hint="Pose must be held this long (0 = just stability time)" onChange={(v) => patch({ holdMs: v })} />}
          <Slider label="Stability time" value={g.stabilityMs} min={0} max={1000} step={25} unit=" ms" hint="Pose must stay the same this long before it counts" onChange={(v) => patch({ stabilityMs: v })} />
          <Slider label="Confidence threshold" value={Math.round(g.confidence * 100)} min={40} max={100} unit="%" onChange={(v) => patch({ confidence: v / 100 })} />
          <Slider label="Cooldown" value={g.cooldownMs} min={0} max={5000} step={50} unit=" ms" onChange={(v) => patch({ cooldownMs: v })} />
          <div className="py-2">
            <div className="flex items-center justify-between"><span className="text-sm font-medium">Performed…</span>
              <Segmented value={g.repeatCount} onChange={(v) => patch({ repeatCount: v })} options={[{ value: 1, label: 'Once' }, { value: 2, label: 'Twice' }, { value: 3, label: '3 times' }]} /></div>
            {g.repeatCount > 1 && <Slider label="…within" value={g.repeatWindowMs} min={400} max={4000} step={100} unit=" ms" onChange={(v) => patch({ repeatWindowMs: v })} />}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>4 · Action</SectionTitle>
        <p className="mb-2 text-xs text-slate-400">The gesture only produces an ID. This mapping decides what happens - change it any time.</p>
        <ActionEditor action={action} onChange={setAction} allowWait={false} />
      </Card>

      <Card className={flash ? 'ring-2 ring-emerald-400' : ''}>
        <SectionTitle right={<Button size="sm" variant="ghost" onClick={() => setHits(0)}>Reset counter</Button>}>5 · Test this gesture</SectionTitle>
        <p className="mb-2 text-xs text-slate-400">Uses the camera/simulator above. Only this draft is evaluated - nothing is executed.</p>
        {c.mode === 'IDLE' && <Notice tone="indigo">Start the session in step 2 to test.</Notice>}
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-white/5 p-2"><div className="text-[11px] text-slate-400">Shape</div><div className="font-mono text-xs">{live.shape}</div></div>
          <div className="rounded-xl bg-white/5 p-2"><div className="text-[11px] text-slate-400">Confidence</div><div className="font-mono text-xs">{Math.round(live.conf * 100)}%</div></div>
          <div className="rounded-xl bg-white/5 p-2"><div className="text-[11px] text-slate-400">Movement</div><div className="font-mono text-xs">{live.move}</div></div>
        </div>
        <div className={`mt-3 rounded-xl p-3 text-center font-semibold ${flash ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-slate-300'}`}>
          {flash ? '✓ MATCHED' : 'Waiting for gesture…'} <span className="ml-2 text-xs font-normal opacity-80">detected {hits}×</span>
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" variant="success" disabled={!canSave}
            onClick={() => { saveGesture(g, action.type === 'WAIT' ? newAction('NONE') : action); if (c.mode === 'TEST') controller.stop('builder saved'); onClose(); }}>
            Save gesture
          </Button>
        </div>
      </div>
    </div>
  );
}
