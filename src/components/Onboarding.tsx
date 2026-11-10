import { useState } from 'react';
import { requestCamera, requestMic } from '../lib/permissions';
import { patchDevice, patchSettings, setState, useStore } from '../lib/store';
import { Badge, Button, Modal, Notice } from './ui';

const STEPS = ['Welcome', 'Camera', 'Microphone', 'Accessibility', 'First gesture', 'Test it', 'Clap activation'];

export default function Onboarding({ goto }: { goto: (tab: string) => void }) {
  const [i, setI] = useState(0);
  const [err, setErr] = useState('');
  const perms = useStore((s) => s.perms);
  const device = useStore((s) => s.device);
  const clap = useStore((s) => s.settings.clapEnabled);
  const finish = (tab?: string) => { setState(() => ({ onboarded: true })); if (tab) goto(tab); };
  const next = () => { setErr(''); setI((x) => Math.min(STEPS.length - 1, x + 1)); };

  const body = [
    <p key={0}>This app lets you control your phone using hand gestures seen by the front camera. Everything runs on your device - nothing is uploaded, and the camera stays <b>off</b> until you activate gesture control. Let's set it up in a few quick steps (each is optional and can be done later).</p>,
    <div key={1} className="space-y-3"><p><b>Step 1 - Camera permission.</b> Needed to see your hand. Frames are analysed locally and never saved or sent.</p>
      {perms.camera === 'granted' ? <Badge tone="green">Granted ✓</Badge> : <Button variant="primary" onClick={async () => { const e = await requestCamera(); setErr(e ?? ''); }}>Allow camera</Button>}</div>,
    <div key={2} className="space-y-3"><p><b>Step 2 - Microphone (optional).</b> Only used by Clap Activation to hear loud claps. No audio is recorded or understood.</p>
      {perms.mic === 'granted' ? <Badge tone="green">Granted ✓</Badge> : <Button onClick={async () => { const e = await requestMic(); setErr(e ?? ''); }}>Allow microphone</Button>}</div>,
    <div key={3} className="space-y-3"><p><b>Step 3 - Accessibility Service.</b> Android only lets apps press Home/Back, tap and swipe for you through an Accessibility Service. It performs only the actions you map, and you enable it yourself in Android Settings (the app can't do it for you).</p>
      <div className="flex items-center gap-3 rounded-xl bg-slate-800 p-3 text-sm">Settings › Accessibility › Gesture Controller
        <button role="switch" aria-checked={device.a11yEnabled} onClick={() => patchDevice({ a11yEnabled: !device.a11yEnabled })}
          className={`ml-auto h-6 w-11 rounded-full transition ${device.a11yEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${device.a11yEnabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} /></button></div></div>,
    <div key={4} className="space-y-3"><p><b>Step 4 - Create your first gesture.</b> We've added sensible defaults (Fist → Back, Two Fingers → Home, Thumb Up → Volume Up…). You can edit or delete all of them, or build your own with the Gesture Builder.</p>
      <Button onClick={() => finish('gestures')}>Open gestures</Button></div>,
    <div key={5} className="space-y-3"><p><b>Step 5 - Test it.</b> The Live Test screen shows what the camera sees, the detected hand shape, confidence and matched action. No camera? Switch to the hand simulator there.</p>
      <Button onClick={() => finish('test')}>Open Live Test</Button></div>,
    <div key={6} className="space-y-3"><p><b>Step 6 - Clap Activation.</b> Clap twice to wake gesture control and turn the camera on; clap again to turn it off. You can change the clap count, interval, sensitivity and cooldown in Settings.</p>
      <div className="flex items-center gap-3">{clap ? <Badge tone="green">Enabled ✓</Badge> : <Button variant="primary" onClick={async () => { const e = await requestMic(); setErr(e ?? ''); patchSettings({ clapEnabled: true }); }}>Enable clap activation</Button>}</div></div>,
  ];

  return (
    <Modal title={`Welcome · ${STEPS[i]}`} onClose={() => finish()}>
      <div className="mb-3 flex gap-1">{STEPS.map((_, k) => <span key={k} className={`h-1 flex-1 rounded ${k <= i ? 'bg-indigo-400' : 'bg-white/10'}`} />)}</div>
      <div className="min-h-32 text-sm text-slate-300">{body[i]}</div>
      {err && <div className="mt-3"><Notice tone="amber">{err}</Notice></div>}
      <div className="mt-5 flex justify-between">
        <Button variant="ghost" onClick={() => finish()}>Skip setup</Button>
        <div className="flex gap-2">
          {i > 0 && <Button onClick={() => setI(i - 1)}>Back</Button>}
          {i < STEPS.length - 1 ? <Button variant="primary" onClick={next}>{i === 0 ? 'Get started' : 'Next'}</Button> : <Button variant="success" onClick={() => finish()}>Done</Button>}
        </div>
      </div>
    </Modal>
  );
}
