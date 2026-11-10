import { useState } from 'react';
import A11yModal from '../components/A11yModal';
import GestureCard from '../components/GestureCard';
import InputPanel from '../components/InputPanel';
import { Badge, Button, Card, Notice, Row, SectionTitle, Toggle } from '../components/ui';
import { controller, useController } from '../lib/controller';
import { requestCamera, requestMic } from '../lib/permissions';
import { patchSettings, useStore } from '../lib/store';
import type { GestureProfile } from '../lib/types';

export default function HomePage({ onEdit, onAdd, goto }: { onEdit: (g: GestureProfile) => void; onAdd: () => void; goto: (t: string) => void }) {
  const c = useController();
  const s = useStore((x) => x.settings);
  const gestures = useStore((x) => x.gestures);
  const perms = useStore((x) => x.perms);
  const device = useStore((x) => x.device);
  const [a11y, setA11y] = useState(false);
  const [permErr, setPermErr] = useState('');

  const active = c.mode === 'ACTIVE' && c.phase === 'running';
  const starting = c.phase === 'starting';
  const stateLabel = starting ? 'STARTING…' : active ? (c.sleeping ? 'ACTIVE · LOW-POWER SCAN' : 'ACTIVE') : c.mode === 'TEST' ? 'TEST SESSION' : 'INACTIVE';
  const dot = active ? 'bg-emerald-400' : starting || c.mode === 'TEST' ? 'bg-amber-400' : 'bg-slate-500';

  const toggleClap = async (v: boolean) => {
    patchSettings({ clapEnabled: v });
    if (v) { const e = await requestMic(); setPermErr(e ? `Microphone: ${e}` : ''); }
  };

  return (
    <div className="space-y-4">
      <Card className="text-center">
        <div className="text-xs uppercase tracking-widest text-slate-400">Gesture Controller</div>
        <div className="my-4 flex items-center justify-center gap-3">
          <span className={`h-4 w-4 rounded-full ${dot} ${active ? 'animate-pulse shadow-[0_0_20px] shadow-emerald-400' : ''}`} />
          <span className="text-2xl font-bold tracking-wide text-white">{stateLabel}</span>
        </div>
        {c.mode === 'ACTIVE' || starting ? (
          <Button size="lg" variant="danger" className="w-full max-w-xs" onClick={() => controller.stop('app button')} disabled={starting && c.mode !== 'ACTIVE'}>
            ■ DEACTIVATE
          </Button>
        ) : (
          <Button size="lg" variant="primary" className="w-full max-w-xs" disabled={c.mode === 'TEST'} onClick={() => void controller.start('ACTIVE', 'app button')}>
            ACTIVATE
          </Button>
        )}
        {c.mode === 'TEST' && <div className="mt-2 text-xs text-amber-300">A test session is running - stop it from the Live Test tab first.</div>}
        <div className="mt-2 text-[11px] text-slate-500">Emergency stop: notification “Disable”, tap the green badge, Esc key, or press both volume buttons on the phone.</div>
      </Card>

      {c.error && (
        <Notice tone="red">
          <div className="flex items-start justify-between gap-2"><span>{c.error}</span><button className="text-xs underline" onClick={() => controller.clearError()}>dismiss</button></div>
          {s.inputSource === 'camera' && <button className="mt-1 text-xs underline" onClick={() => { patchSettings({ inputSource: 'simulator' }); controller.clearError(); }}>Use the hand simulator instead</button>}
        </Notice>
      )}
      {permErr && <Notice tone="amber">{permErr}</Notice>}
      {c.clapError && <Notice tone="amber">{c.clapError}</Notice>}

      {c.mode === 'ACTIVE' && <Card><InputPanel compact /></Card>}

      <Card className="divide-y divide-white/5 !py-1">
        <Row label="👏 Clap Activation" hint={s.clapEnabled ? `${s.clapCount} clap${s.clapCount > 1 ? 's' : ''} within ${s.clapMaxIntervalMs} ms${s.clapDeactivates ? ' · clap again to stop' : ''}` : 'Off - microphone is not used'}>
          <div className="flex items-center gap-2"><Badge tone={s.clapEnabled ? 'green' : 'slate'}>{s.clapEnabled ? 'ON' : 'OFF'}</Badge><Toggle checked={s.clapEnabled} onChange={toggleClap} label="Clap activation" /></div>
        </Row>
        <Row label="📷 Camera" hint={c.stream ? 'In use - released the moment you deactivate' : 'Completely off'}>
          <Badge tone={c.stream ? 'green' : 'slate'}>{c.stream ? 'ON' : 'OFF'}</Badge>
        </Row>
        <Row label="🎙️ Microphone" hint={c.clapListening ? 'Clap detector listening (nothing is recorded)' : 'Off'}>
          <Badge tone={c.clapListening ? 'amber' : 'slate'}>{c.clapListening ? 'LISTENING' : 'OFF'}</Badge>
        </Row>
        {s.clapEnabled && (
          <Row label="Clap level" hint="Try clapping - the bar should spike">
            <div className="flex items-center gap-2">
              <div className="h-2 w-28 overflow-hidden rounded bg-slate-700"><div className="h-full bg-orange-400 transition-all" style={{ width: `${Math.min(100, c.clapLevel * 250)}%` }} /></div>
              <Button size="sm" onClick={() => controller.simulateClap()}>Simulate clap</Button>
            </div>
          </Row>
        )}
      </Card>

      <Card>
        <SectionTitle>Setup checklist</SectionTitle>
        <div className="divide-y divide-white/5">
          <Row label="Camera permission" hint="Needed for hand tracking">
            {perms.camera === 'granted' ? <Badge tone="green">Granted</Badge> : <Button size="sm" onClick={async () => { const e = await requestCamera(); setPermErr(e ? `Camera: ${e}` : ''); }}>{perms.camera === 'denied' ? 'Denied - retry' : 'Grant'}</Button>}
          </Row>
          <Row label="Microphone permission" hint="Optional - only for clap activation">
            {perms.mic === 'granted' ? <Badge tone="green">Granted</Badge> : <Button size="sm" onClick={async () => { const e = await requestMic(); setPermErr(e ? `Microphone: ${e}` : ''); }}>{perms.mic === 'denied' ? 'Denied - retry' : 'Grant'}</Button>}
          </Row>
          <Row label="Accessibility service" hint="Lets gestures press Home/Back, tap, swipe…">
            {device.a11yEnabled ? <Badge tone="green">Enabled</Badge> : <Button size="sm" variant="primary" onClick={() => setA11y(true)}>Enable…</Button>}
          </Row>
        </div>
        {!device.a11yEnabled && <div className="mt-2"><Notice tone="amber">Accessibility is off, so most actions will report an error. Volume/media actions still work.</Notice></div>}
      </Card>

      <div>
        <SectionTitle right={<button className="text-xs text-indigo-300" onClick={() => goto('gestures')}>Manage all →</button>}>My Gestures</SectionTitle>
        <div className="space-y-2">
          {gestures.slice(0, 5).map((g) => <GestureCard key={g.id} g={g} compact onEdit={onEdit} />)}
          {gestures.length > 5 && <div className="text-center text-xs text-slate-500">+ {gestures.length - 5} more</div>}
          {gestures.length === 0 && <Notice tone="indigo">No gestures yet. Add your first one!</Notice>}
          <Button className="w-full" onClick={onAdd}>＋ Add Gesture</Button>
        </div>
      </div>
      {a11y && <A11yModal onClose={() => setA11y(false)} />}
    </div>
  );
}
