import { useEffect, useState } from 'react';
import GestureCard from '../components/GestureCard';
import InputPanel from '../components/InputPanel';
import { ActionLabel } from '../components/ActionPicker';
import { Badge, Card, Notice, Row, SectionTitle, Select, Slider, Toggle } from '../components/ui';
import { shapeMeta, movementMeta } from '../lib/catalog';
import { controller, useController } from '../lib/controller';
import { patchSettings, useStore } from '../lib/store';
import type { ActionMapping, GestureProfile } from '../lib/types';

export default function LiveTestPage({ focus, onEdit }: { focus: GestureProfile | null; onEdit: (g: GestureProfile) => void }) {
  const c = useController();
  const s = useStore((x) => x.settings);
  const [match, setMatch] = useState<{ name: string; conf: number; mapping?: ActionMapping; at: number } | null>(null);
  const [, tick] = useState(0);

  useEffect(() => controller.onFrame((ev) => {
    const d = ev.detections[0];
    if (d) setMatch({ name: d.gesture.name, conf: d.gesture.confidence, mapping: d.mapping, at: Date.now() });
  }), []);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 300); return () => clearInterval(t); }, []);

  const matched = match && Date.now() - match.at < 1500;
  const status = c.phase !== 'running' ? 'STOPPED' : matched ? 'MATCHED' : c.hand ? 'TRACKING' : 'NO HAND';
  const tone = status === 'MATCHED' ? 'bg-emerald-500 text-slate-950' : status === 'TRACKING' ? 'bg-indigo-500/30 text-indigo-200' : 'bg-white/10 text-slate-300';
  const sm = c.shape ? shapeMeta(c.shape) : null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Live Gesture Test</h2>
      {focus && (
        <Notice tone="indigo">Testing <b>{focus.icon} {focus.name}</b> - perform it and watch for MATCHED below.</Notice>
      )}
      <Card><InputPanel /></Card>

      <Card>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-xs text-slate-400">Detected</div><div className="font-mono text-base text-white">{sm ? `${sm.icon} ${c.shape}` : '—'}</div></div>
          <div><div className="text-xs text-slate-400">Confidence</div>
            <div className="font-mono text-base text-white">{Math.round(c.shapeConf * 100)}%</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-700"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${c.shapeConf * 100}%` }} /></div></div>
          <div><div className="text-xs text-slate-400">Movement</div><div className="font-mono text-base text-white">{c.hand ? `${movementMeta(c.movement).icon} ${c.movement}` : '—'}</div></div>
          <div><div className="text-xs text-slate-400">Status</div><div className={`inline-block rounded-lg px-2 py-0.5 font-mono text-base ${tone}`}>{status}</div></div>
        </div>
        <div className="mt-3 rounded-xl bg-white/5 p-3 text-sm">
          <div className="text-xs text-slate-400">Last matched gesture → action</div>
          {match ? <div className="mt-0.5 text-white">{match.name} ({Math.round(match.conf * 100)}%) → <span className="text-indigo-300">{match.mapping ? <ActionLabel action={match.mapping.action} /> : 'no action'}</span></div> : <div className="text-slate-500">nothing yet</div>}
          <div className="mt-1 text-xs text-slate-400">{c.lastAction}</div>
        </div>
        <div className="mt-2"><Row label="Run actions on the phone simulator" hint="Off = test only, nothing is executed"><Toggle checked={c.executeInTest} onChange={(v) => controller.setExecuteInTest(v)} /></Row></div>
      </Card>

      <Card>
        <SectionTitle>Tune thresholds - applies immediately</SectionTitle>
        <Slider label="Minimum confidence (global floor)" value={Math.round(s.gestureConfidence * 100)} min={40} max={100} unit="%" onChange={(v) => patchSettings({ gestureConfidence: v / 100 })} />
        <Slider label="Hand must be visible for" value={s.requireVisibleMs} min={0} max={1500} step={50} unit=" ms" onChange={(v) => patchSettings({ requireVisibleMs: v })} />
        <Slider label="Activation zone inset" value={Math.round(s.zoneInset * 100)} min={0} max={40} unit="%" hint="Hands outside the dashed rectangle are ignored" onChange={(v) => patchSettings({ zoneInset: v / 100 })} />
        <Row label="Hand mode"><Select value={s.handMode} onChange={(v) => patchSettings({ handMode: v })} options={[{ value: 'EITHER', label: 'Either hand' }, { value: 'LEFT', label: 'Left only' }, { value: 'RIGHT', label: 'Right only' }, { value: 'BOTH', label: 'Both hands' }]} /></Row>
        <div className="text-[11px] text-slate-500">Per-gesture stability, hold time, distance and cooldown are edited in the Gesture Builder. Hand-mode changes apply on the next session start.</div>
      </Card>

      {focus && <div><SectionTitle>Gesture under test</SectionTitle><GestureCard g={focus} compact onEdit={onEdit} /></div>}
      <div className="text-center"><Badge tone="slate">Log lines appear in the Debug tab (Developer Mode)</Badge></div>
    </div>
  );
}
