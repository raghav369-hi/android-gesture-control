import { shapeMeta, movementMeta } from '../lib/catalog';
import { deleteGesture, duplicateGesture, moveGesture, toggleGesture, useStore } from '../lib/store';
import type { GestureProfile } from '../lib/types';
import { ActionLabel } from './ActionPicker';
import { Badge, Button, Toggle } from './ui';

function describe(g: GestureProfile): string {
  if (g.twoHand) return `L: ${shapeMeta(g.twoHand.left).label} + R: ${shapeMeta(g.twoHand.right).label}`;
  const part = (s: { shape: GestureProfile['step']['shape']; movement: GestureProfile['step']['movement'] }) =>
    s.movement === 'STATIC' ? shapeMeta(s.shape).label : `${shapeMeta(s.shape).label} · ${movementMeta(s.movement).label}`;
  let t = part(g.step);
  if (g.followedBy) t += `  →  ${part(g.followedBy)}`;
  if (g.repeatCount > 1) t += ` ×${g.repeatCount}`;
  if (g.holdMs > 0 && g.step.movement === 'STATIC') t += ` · hold ${g.holdMs} ms`;
  return t;
}

export default function GestureCard({
  g, compact, index, total, onEdit, onTest,
}: { g: GestureProfile; compact?: boolean; index?: number; total?: number; onEdit: (g: GestureProfile) => void; onTest?: (g: GestureProfile) => void }) {
  const mapping = useStore((s) => s.mappings.find((m) => m.gestureId === g.id));
  return (
    <div className={`rounded-2xl border p-3 transition ${g.enabled ? 'border-white/10 bg-slate-900/70' : 'border-white/5 bg-slate-900/30 opacity-60'}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-2xl">{g.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-white">{g.name}</div>
          <div className="truncate text-xs text-slate-400">{describe(g)}</div>
          <div className="mt-0.5 text-sm text-indigo-300">→ {mapping ? <ActionLabel action={mapping.action} /> : <span className="text-amber-300">no action</span>}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Toggle checked={g.enabled} onChange={() => toggleGesture(g.id)} label={`Enable ${g.name}`} />
          {compact && <Button size="sm" variant="ghost" onClick={() => onEdit(g)}>Edit</Button>}
        </div>
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-2">
          <Badge tone="slate">{g.gestureType.replace('_', '-').toLowerCase()}</Badge>
          <Badge tone="slate">conf ≥ {Math.round(g.confidence * 100)}%</Badge>
          <Badge tone="slate">cooldown {g.cooldownMs} ms</Badge>
          <div className="ml-auto flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => moveGesture(g.id, -1)} title="Move up">↑</Button>
            <Button size="sm" variant="ghost" disabled={index === (total ?? 1) - 1} onClick={() => moveGesture(g.id, 1)} title="Move down">↓</Button>
            {onTest && <Button size="sm" onClick={() => onTest(g)}>Test</Button>}
            <Button size="sm" onClick={() => onEdit(g)}>Edit</Button>
            <Button size="sm" onClick={() => duplicateGesture(g.id)}>Duplicate</Button>
            <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete "${g.name}"?`)) deleteGesture(g.id); }}>Delete</Button>
          </div>
        </div>
      )}
    </div>
  );
}
