import { useState } from 'react';
import A11yModal from '../components/A11yModal';
import { Badge, Button, Card, Notice, Row, SectionTitle, Segmented, Select, Slider, Toggle } from '../components/ui';
import { controller, useController } from '../lib/controller';
import { requestCamera, requestMic } from '../lib/permissions';
import { patchDevice, patchSettings, resetEverything, useStore } from '../lib/store';

const ANDROID = [
  [26, 'Android 8.0 (API 26)'], [27, 'Android 8.1 (API 27)'], [28, 'Android 9 (API 28)'], [29, 'Android 10 (API 29)'], [30, 'Android 11 (API 30)'],
  [31, 'Android 12 (API 31)'], [33, 'Android 13 (API 33)'], [34, 'Android 14 (API 34)'], [35, 'Android 15 (API 35)'],
] as const;

export default function SettingsPage() {
  const s = useStore((x) => x.settings);
  const device = useStore((x) => x.device);
  const perms = useStore((x) => x.perms);
  const c = useController();
  const [a11y, setA11y] = useState(false);
  const autoOptions = [{ value: 0, label: 'Never' }, { value: 10, label: '10 seconds' }, { value: 30, label: '30 seconds' }, { value: 60, label: '1 minute' }, { value: 300, label: '5 minutes' }, { value: -1, label: 'Custom…' }];
  const autoIsCustom = ![0, 10, 30, 60, 300].includes(s.autoDeactivateSec);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Settings</h2>

      <Card>
        <SectionTitle>Clap activation</SectionTitle>
        <Row label="Clap Activation" hint="Only the microphone runs while idle - the camera stays off"><Toggle checked={s.clapEnabled} onChange={async (v) => { patchSettings({ clapEnabled: v }); if (v) await requestMic(); }} /></Row>
        <Row label="Number of claps"><Segmented value={s.clapCount} onChange={(v) => patchSettings({ clapCount: v })} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} /></Row>
        <Slider label="Maximum interval between claps" value={s.clapMaxIntervalMs} min={200} max={2000} step={50} unit=" ms" onChange={(v) => patchSettings({ clapMaxIntervalMs: v })} />
        <Row label="Sensitivity"><Segmented value={s.clapSensitivity} onChange={(v) => patchSettings({ clapSensitivity: v })} options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'CUSTOM', label: 'Custom' }]} /></Row>
        {s.clapSensitivity === 'CUSTOM' && <Slider label="Custom loudness threshold" value={Math.round(s.clapCustomThreshold * 100)} min={2} max={60} unit="%" hint="Lower = triggers on quieter claps" onChange={(v) => patchSettings({ clapCustomThreshold: v / 100 })} />}
        <Slider label="Cooldown" value={s.clapCooldownSec} min={0.5} max={10} step={0.5} unit=" s" onChange={(v) => patchSettings({ clapCooldownSec: v })} />
        <Row label="Clap while active → deactivate" hint="Same clap pattern turns gesture control off"><Toggle checked={s.clapDeactivates} onChange={(v) => patchSettings({ clapDeactivates: v })} /></Row>
        <div className="mt-1 rounded-xl bg-white/5 p-3">
          <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Live clap meter</span><span>{c.clapListening ? 'listening' : 'enable Clap Activation to test'}</span></div>
          <div className="h-3 overflow-hidden rounded bg-slate-700"><div className="h-full bg-orange-400 transition-all" style={{ width: `${Math.min(100, c.clapLevel * 250)}%` }} /></div>
          <div className="mt-2"><Button size="sm" onClick={() => controller.simulateClap()}>Simulate one clap</Button></div>
        </div>
        {c.clapError && <div className="mt-2"><Notice tone="amber">{c.clapError}</Notice></div>}
      </Card>

      <Card>
        <SectionTitle>Camera &amp; performance</SectionTitle>
        <Row label="Input source" hint="Simulator lets you test without a camera"><Segmented value={s.inputSource} onChange={(v) => patchSettings({ inputSource: v })} options={[{ value: 'camera', label: 'Camera' }, { value: 'simulator', label: 'Simulator' }]} /></Row>
        <Row label="Camera resolution" hint="Lower = less battery"><Segmented value={s.cameraResolution} onChange={(v) => patchSettings({ cameraResolution: v })} options={[{ value: 'LOW', label: '320×240' }, { value: 'MEDIUM', label: '640×480' }, { value: 'HIGH', label: '720p' }]} /></Row>
        <Row label="Camera frame rate"><Segmented value={s.cameraFps} onChange={(v) => patchSettings({ cameraFps: v })} options={[{ value: 10, label: '10' }, { value: 15, label: '15' }, { value: 20, label: '20' }, { value: 30, label: '30' }]} /></Row>
        <Row label="Battery optimisation" hint="Caps analysis at 15 fps; only the newest frame is analysed"><Toggle checked={s.batteryOptimization} onChange={(v) => patchSettings({ batteryOptimization: v })} /></Row>
        <Row label="Auto-deactivate after" hint="No gesture performed for this long">
          <Select value={autoIsCustom ? -1 : s.autoDeactivateSec} onChange={(v) => patchSettings({ autoDeactivateSec: v === -1 ? 45 : v })} options={autoOptions} />
        </Row>
        {autoIsCustom && <Slider label="Custom auto-deactivate" value={s.autoDeactivateSec} min={5} max={900} step={5} unit=" s" onChange={(v) => patchSettings({ autoDeactivateSec: v })} />}
        <Slider label="Low-power scan when no hand visible for" value={s.noHandSleepSec} min={0} max={60} unit=" s" format={(v) => (v === 0 ? 'never' : String(v))} hint="Drops to ~3 analysed frames per second until a hand appears" onChange={(v) => patchSettings({ noHandSleepSec: v })} />
        <div className="text-[11px] text-slate-500">Resolution/FPS apply the next time the camera starts.</div>
      </Card>

      <Card>
        <SectionTitle>Recognition &amp; false-positive protection</SectionTitle>
        <Slider label="Default / minimum confidence" value={Math.round(s.gestureConfidence * 100)} min={40} max={100} unit="%" onChange={(v) => patchSettings({ gestureConfidence: v / 100 })} />
        <Slider label="Default 'followed by' time window" value={s.gestureTimeoutMs} min={300} max={5000} step={100} unit=" ms" onChange={(v) => patchSettings({ gestureTimeoutMs: v })} />
        <Slider label="Hand must be visible for" value={s.requireVisibleMs} min={0} max={1500} step={50} unit=" ms" onChange={(v) => patchSettings({ requireVisibleMs: v })} />
        <Slider label="Activation zone inset" value={Math.round(s.zoneInset * 100)} min={0} max={40} unit="%" hint="0 = whole frame" onChange={(v) => patchSettings({ zoneInset: v / 100 })} />
        <Row label="Hand mode" hint="Applies on next start"><Select value={s.handMode} onChange={(v) => patchSettings({ handMode: v })} options={[{ value: 'EITHER', label: 'Either hand' }, { value: 'LEFT', label: 'Left hand' }, { value: 'RIGHT', label: 'Right hand' }, { value: 'BOTH', label: 'Both hands' }]} /></Row>
        <div className="text-[11px] text-slate-500">Per-gesture stability time, hold duration, minimum movement distance, cooldown and confidence live in each gesture's settings.</div>
      </Card>

      <Card>
        <SectionTitle>Feedback &amp; overlay</SectionTitle>
        <Row label="Show active indicator" hint="Green badge on screen while active"><Toggle checked={s.showOverlay} onChange={(v) => patchSettings({ showOverlay: v })} /></Row>
        <Row label="Sound feedback"><Toggle checked={s.soundFeedback} onChange={(v) => patchSettings({ soundFeedback: v })} /></Row>
        <Row label="Vibration feedback"><Toggle checked={s.vibrationFeedback} onChange={(v) => patchSettings({ vibrationFeedback: v })} /></Row>
      </Card>

      <Card>
        <SectionTitle>Permissions</SectionTitle>
        <Row label="Camera"><div className="flex items-center gap-2"><Badge tone={perms.camera === 'granted' ? 'green' : perms.camera === 'denied' ? 'red' : 'slate'}>{perms.camera}</Badge><Button size="sm" onClick={() => void requestCamera()}>Request</Button></div></Row>
        <Row label="Microphone"><div className="flex items-center gap-2"><Badge tone={perms.mic === 'granted' ? 'green' : perms.mic === 'denied' ? 'red' : 'slate'}>{perms.mic}</Badge><Button size="sm" onClick={() => void requestMic()}>Request</Button></div></Row>
        <Row label="Accessibility service"><div className="flex items-center gap-2"><Badge tone={device.a11yEnabled ? 'green' : 'amber'}>{device.a11yEnabled ? 'enabled' : 'off'}</Badge><Button size="sm" onClick={() => setA11y(true)}>Open…</Button></div></Row>
      </Card>

      <Card>
        <SectionTitle>Simulated device</SectionTitle>
        <Row label="Android version" hint="Actions the OS doesn't support are hidden or marked"><Select value={device.api} onChange={(v) => patchDevice({ api: v })} options={ANDROID.map(([v, l]) => ({ value: v, label: l }))} /></Row>
        <Row label="“Modify system settings” granted" hint="Required for brightness actions"><Toggle checked={device.writeSettings} onChange={(v) => patchDevice({ writeSettings: v })} /></Row>
      </Card>

      <Card>
        <SectionTitle>Developer</SectionTitle>
        <Row label="Developer mode" hint="Shows the Debug tab"><Toggle checked={s.developerMode} onChange={(v) => patchSettings({ developerMode: v })} /></Row>
        <Row label="Verbose debug logs"><Toggle checked={s.debugLogs} onChange={(v) => patchSettings({ debugLogs: v })} /></Row>
        <div className="pt-2"><Button variant="danger" size="sm" onClick={() => { if (confirm('Reset all gestures, macros and settings to defaults?')) { controller.stop('reset'); resetEverything(); } }}>Reset everything</Button></div>
      </Card>
      {a11y && <A11yModal onClose={() => setA11y(false)} />}
    </div>
  );
}
