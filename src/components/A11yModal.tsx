import { patchDevice, useStore } from '../lib/store';
import { Modal, Notice, Toggle } from './ui';

/** Mimics the hand-off to Android Settings -> Accessibility. The app never enables it for the user. */
export default function A11yModal({ onClose }: { onClose: () => void }) {
  const on = useStore((s) => s.device.a11yEnabled);
  return (
    <Modal title="Accessibility service" onClose={onClose}>
      <div className="space-y-3 text-sm text-slate-300">
        <p><b className="text-white">Why is this needed?</b> Android only lets an app press Home/Back, tap, swipe, scroll or edit text on your behalf through an Accessibility Service. Without it, gestures can still be detected but most actions cannot run.</p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400">
          <li>The service performs only the actions you map to gestures.</li>
          <li>It does not read, store or send screen contents, passwords or keystrokes.</li>
          <li>You can turn it off at any time in Android Settings.</li>
          <li>The app cannot enable it automatically - Android requires you to do it yourself.</li>
        </ul>
        <div className="rounded-2xl bg-slate-800 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Android Settings › Accessibility › Installed apps (simulated)</div>
          <div className="flex items-center justify-between">
            <div><div className="font-medium text-white">Gesture Controller</div><div className="text-xs text-slate-400">{on ? 'On' : 'Off'}</div></div>
            <Toggle checked={on} onChange={(v) => patchDevice({ a11yEnabled: v })} label="Accessibility service" />
          </div>
        </div>
        {on ? <Notice tone="green">Service enabled - actions can now run.</Notice> : <Notice tone="amber">Service is off. Actions that need it will report an error instead of silently failing.</Notice>}
      </div>
    </Modal>
  );
}
