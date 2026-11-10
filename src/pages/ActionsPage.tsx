import { useState } from 'react';
import { ActionEditor, SupportBadge } from '../components/ActionPicker';
import { Badge, Button, Card, Notice, SectionTitle, Slider } from '../components/ui';
import { ACTIONS, CATEGORY_ORDER, actionMeta } from '../lib/catalog';
import { controller } from '../lib/controller';
import { newAction } from '../lib/defaults';
import { deleteMacro, newMacro, saveMacro, useStore } from '../lib/store';
import type { Macro } from '../lib/types';

function MacroCard({ m, open, onToggle }: { m: Macro; open: boolean; onToggle: () => void }) {
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const upd = (p: Partial<Macro>) => saveMacro({ ...m, ...p });
  const move = (i: number, d: number) => {
    const steps = [...m.steps]; const j = i + d;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    upd({ steps });
  };
  const run = async () => {
    setRunning(true); setMsg('');
    const r = await controller.runAction({ ...newAction('MACRO', { macroId: m.id }, 0) });
    setMsg(r.message); setRunning(false);
  };
  return (
    <Card>
      <div className="flex items-center gap-2">
        <button onClick={onToggle} className="flex-1 text-left">
          <div className="font-medium text-white">🧩 {m.name}</div>
          <div className="text-xs text-slate-400">{m.steps.map((s) => actionMeta(s.type).label).join(' → ') || 'empty'}</div>
        </button>
        <Button size="sm" variant="success" disabled={running} onClick={run}>{running ? 'Running…' : '▶ Run'}</Button>
        <Button size="sm" onClick={onToggle}>{open ? 'Close' : 'Edit'}</Button>
      </div>
      {msg && <div className="mt-1 text-xs text-slate-400">{msg}</div>}
      {open && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          <input value={m.name} onChange={(e) => upd({ name: e.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white" aria-label="Macro name" />
          {m.steps.map((s, i) => (
            <div key={s.id} className="rounded-xl bg-white/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <Badge tone="indigo">Step {i + 1}</Badge>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
                  <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === m.steps.length - 1}>↓</Button>
                  <Button size="sm" variant="danger" onClick={() => upd({ steps: m.steps.filter((x) => x.id !== s.id) })}>✕</Button>
                </div>
              </div>
              <ActionEditor action={s} allowWait allowDeactivate={false} onChange={(a) => upd({ steps: m.steps.map((x) => (x.id === s.id ? a : x)) })} />
              {s.type !== 'WAIT' && <Slider label="Wait after this step" value={s.delayAfterMs} min={0} max={5000} step={50} unit=" ms" onChange={(v) => upd({ steps: m.steps.map((x) => (x.id === s.id ? { ...x, delayAfterMs: v } : x)) })} />}
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => upd({ steps: [...m.steps, newAction('HOME', {}, 300)] })}>＋ Add action</Button>
            <Button size="sm" onClick={() => upd({ steps: [...m.steps, newAction('WAIT', { durationMs: 300 }, 0)] })}>＋ Add wait</Button>
            <Button size="sm" variant="danger" className="ml-auto" onClick={() => { if (confirm(`Delete macro "${m.name}"?`)) deleteMacro(m.id); }}>Delete macro</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function ActionsPage() {
  const macros = useStore((s) => s.macros);
  const device = useStore((s) => s.device);
  const [open, setOpen] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Actions &amp; Macros</h2>

      <div>
        <SectionTitle right={<Button size="sm" variant="primary" onClick={() => { const m = newMacro(); saveMacro(m); setOpen(m.id); }}>＋ New macro</Button>}>Macros</SectionTitle>
        <div className="space-y-2">
          {macros.map((m) => <MacroCard key={m.id} m={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} />)}
          {macros.length === 0 && <Notice tone="indigo">No macros yet. A macro runs several actions in order with delays between them, then you can assign it to any gesture.</Notice>}
        </div>
      </div>

      <div>
        <SectionTitle>Action catalog · Android API {device.api}</SectionTitle>
        <Notice tone="amber">Android does not allow unrestricted control. Each action below uses only an official API; unsupported ones are marked rather than faked. Change the simulated Android version in Settings.</Notice>
        <div className="mt-3 space-y-3">
          {CATEGORY_ORDER.map((cat) => (
            <Card key={cat} className="!p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{cat}</div>
              <div className="divide-y divide-white/5">
                {ACTIONS.filter((a) => a.category === cat && a.type !== 'WAIT' && a.type !== 'MACRO' && a.type !== 'NONE').map((a) => (
                  <div key={a.type} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white">{a.icon} {a.label}</div>
                      <div className="truncate text-[11px] text-slate-500">{a.note ?? ''}{a.minApi > 1 ? ` · API ${a.minApi}+` : ''}</div>
                      {result[a.type] && <div className="text-[11px] text-indigo-300">{result[a.type]}</div>}
                    </div>
                    <SupportBadge type={a.type} />
                    {a.type !== 'DEACTIVATE' && (
                      <Button size="sm" onClick={async () => { const r = await controller.runAction(newAction(a.type, {}, 0)); setResult((x) => ({ ...x, [a.type]: `${r.ok ? '✓' : '✗'} ${r.message}` })); }}>Try</Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
