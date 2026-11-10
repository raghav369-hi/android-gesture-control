import GestureCard from '../components/GestureCard';
import { Button, Notice } from '../components/ui';
import { restoreDefaultGestures, useStore } from '../lib/store';
import type { GestureProfile } from '../lib/types';

export default function GesturesPage({ onEdit, onAdd, onTest }: { onEdit: (g: GestureProfile) => void; onAdd: () => void; onTest: (g: GestureProfile) => void }) {
  const gestures = useStore((s) => s.gestures);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">My Gestures</h2>
        <Button variant="primary" onClick={onAdd}>＋ Create Gesture</Button>
      </div>
      <Notice tone="indigo">Every gesture, including the defaults, can be edited, duplicated, disabled or deleted. If two gestures match at the same moment, both will fire - use different shapes/cooldowns to keep them apart.</Notice>
      {gestures.map((g, i) => <GestureCard key={g.id} g={g} index={i} total={gestures.length} onEdit={onEdit} onTest={onTest} />)}
      {gestures.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400">
          No gestures. <button className="text-indigo-300 underline" onClick={() => { if (confirm('Restore the default gesture set?')) restoreDefaultGestures(); }}>Restore defaults</button>
        </div>
      )}
      {gestures.length > 0 && (
        <div className="pt-2 text-center">
          <button className="text-xs text-slate-500 underline" onClick={() => { if (confirm('Replace all gestures, mappings and macros with the defaults?')) restoreDefaultGestures(); }}>Restore default gestures</button>
        </div>
      )}
    </div>
  );
}
