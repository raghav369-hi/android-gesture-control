import { useState } from 'react';
import { ACTIONS, actionMeta, CATEGORY_ORDER, runtimeBlocker, supportStatus } from '../lib/catalog';
import { newAction } from '../lib/defaults';
import { useStore } from '../lib/store';
import type { ActionType, ConfiguredAction } from '../lib/types';
import { Badge, Modal, Select, Slider } from './ui';

/** Lists only actions supported by the (simulated) device's Android version. */
export function ActionPickerModal({
  onPick, onClose, allowWait, allowDeactivate = true, allowMacro = true,
}: { onPick: (t: ActionType) => void; onClose: () => void; allowWait?: boolean; allowDeactivate?: boolean; allowMacro?: boolean }) {
  const device = useStore((s) => s.device);
  const [showUnsupported, setShowUnsupported] = useState(false);
  const usable = (t: ActionType) => {
    if (t === 'WAIT') return !!allowWait;
    if (t === 'MACRO') return allowMacro;
    if (t === 'DEACTIVATE') return allowDeactivate;
    return true;
  };
  const hiddenCount = ACTIONS.filter((a) => usable(a.type) && !supportStatus(a.type, device).supported).length;
  return (
    <Modal title="Select action" onClose={onClose}>
      <div className="space-y-4">
        {CATEGORY_ORDER.map((cat) => {
          const items = ACTIONS.filter((a) => a.category === cat && usable(a.type) && (showUnsupported || supportStatus(a.type, device).supported));
          if (!items.length) return null;
          return (
            <div key={cat}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{cat}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {items.map((a) => {
                  const sup = supportStatus(a.type, device);
                  const block = runtimeBlocker(a.type, device);
                  return (
                    <button key={a.type} disabled={!sup.supported} onClick={() => { onPick(a.type); onClose(); }}
                      className="flex flex-col items-start rounded-xl bg-white/5 p-2.5 text-left text-sm transition hover:bg-white/10 disabled:opacity-40"
                      title={a.note}>
                      <span>{a.icon} {a.label}</span>
                      {!sup.supported ? <span className="text-[10px] text-rose-300">Not supported on this device/version.</span>
                        : block ? <span className="text-[10px] text-amber-300">Needs permission</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <button className="text-xs text-slate-400 underline" onClick={() => setShowUnsupported((v) => !v)}>
            {showUnsupported ? 'Hide' : 'Show'} {hiddenCount} action(s) unavailable on Android API {device.api}
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Action chooser + parameter editor. */
export function ActionEditor({
  action, onChange, allowWait, allowMacro = true, allowDeactivate = true,
}: { action: ConfiguredAction; onChange: (a: ConfiguredAction) => void; allowWait?: boolean; allowMacro?: boolean; allowDeactivate?: boolean }) {
  const [open, setOpen] = useState(false);
  const macros = useStore((s) => s.macros);
  const device = useStore((s) => s.device);
  const meta = actionMeta(action.type);
  const p = action.params;
  const setP = (x: Partial<typeof p>) => onChange({ ...action, params: { ...p, ...x } });
  const block = runtimeBlocker(action.type, device);
  const sup = supportStatus(action.type, device);
  return (
    <div className="space-y-2">
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left hover:bg-white/10">
        <span className="text-sm">{meta.icon} {meta.label} <span className="text-xs text-slate-400">· {meta.category}</span></span>
        <span className="text-xs text-indigo-300">Change</span>
      </button>
      {!sup.supported && <div className="text-xs text-rose-300">{sup.reason}</div>}
      {sup.supported && block && <div className="text-xs text-amber-300">{block}</div>}
      {meta.note && <div className="text-[11px] text-slate-500">Android: {meta.note}</div>}
      {meta.params === 'position' && (
        <>
          <Slider label="X position" value={p.x ?? 50} min={0} max={100} unit="%" onChange={(v) => setP({ x: v })} />
          <Slider label="Y position" value={p.y ?? 50} min={0} max={100} unit="%" onChange={(v) => setP({ y: v })} />
        </>
      )}
      {meta.params === 'swipe' && (
        <>
          <div className="grid grid-cols-2 gap-x-4">
            <Slider label="From X" value={p.x ?? 50} min={0} max={100} unit="%" onChange={(v) => setP({ x: v })} />
            <Slider label="From Y" value={p.y ?? 70} min={0} max={100} unit="%" onChange={(v) => setP({ y: v })} />
            <Slider label="To X" value={p.x2 ?? 50} min={0} max={100} unit="%" onChange={(v) => setP({ x2: v })} />
            <Slider label="To Y" value={p.y2 ?? 30} min={0} max={100} unit="%" onChange={(v) => setP({ y2: v })} />
          </div>
          <Slider label="Duration" value={p.durationMs ?? 250} min={50} max={1500} step={50} unit=" ms" onChange={(v) => setP({ durationMs: v })} />
        </>
      )}
      {meta.params === 'wait' && <Slider label="Wait" value={p.durationMs ?? 300} min={50} max={5000} step={50} unit=" ms" onChange={(v) => setP({ durationMs: v })} />}
      {meta.params === 'macro' && (
        macros.length ? (
          <Select value={p.macroId ?? ''} onChange={(v) => setP({ macroId: v })} className="w-full"
            options={[{ value: '', label: 'Choose a macro…' }, ...macros.map((m) => ({ value: m.id, label: `${m.name} (${m.steps.length} steps)` }))]} />
        ) : <div className="text-xs text-amber-300">No macros yet - create one in the Actions tab.</div>
      )}
      {open && (
        <ActionPickerModal allowWait={allowWait} allowMacro={allowMacro} allowDeactivate={allowDeactivate} onClose={() => setOpen(false)}
          onPick={(t) => onChange({ ...newAction(t, {}, action.delayAfterMs), id: action.id })} />
      )}
    </div>
  );
}

export function ActionLabel({ action }: { action: ConfiguredAction }) {
  const macros = useStore((s) => s.macros);
  const m = actionMeta(action.type);
  const extra = action.type === 'MACRO' ? macros.find((x) => x.id === action.params.macroId)?.name ?? 'missing macro' : '';
  return <span>{m.icon} {m.label}{extra ? `: ${extra}` : ''}</span>;
}

export function SupportBadge({ type }: { type: ActionType }) {
  const device = useStore((s) => s.device);
  const sup = supportStatus(type, device);
  if (!sup.supported) return <Badge tone="red">Not supported</Badge>;
  const b = runtimeBlocker(type, device);
  return b ? <Badge tone="amber">Needs permission</Badge> : <Badge tone="green">Ready</Badge>;
}

