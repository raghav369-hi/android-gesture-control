import { useEffect, useState } from 'react';
import { Button, Card, Row, SectionTitle, Toggle } from '../components/ui';
import { controller, useController } from '../lib/controller';
import { patchSettings, useStore } from '../lib/store';

interface Battery { level: number; charging: boolean }

export default function DebugPage() {
  const c = useController();
  const s = useStore((x) => x.settings);
  const [bat, setBat] = useState<Battery | null>(null);
  const [startBat, setStartBat] = useState<Battery | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> };
    if (!nav.getBattery) return;
    const read = () => nav.getBattery!().then((b) => setBat({ level: b.level, charging: b.charging })).catch(() => {});
    void read();
    const t = setInterval(read, 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (c.phase === 'running' && bat) setStartBat((p) => p ?? bat); if (c.phase === 'idle') setStartBat(null); }, [c.phase, bat]);

  const rows: [string, string][] = [
    ['Session', `${c.mode} / ${c.phase}${c.sleeping ? ' (low-power scan)' : ''}`],
    ['Camera stream', c.stream ? 'OPEN' : 'closed'],
    ['Hand tracker', `${c.trackerState}${c.delegate ? ` (${c.delegate})` : ''}`],
    ['Camera FPS', String(c.camFps)],
    ['Processing FPS', String(c.procFps)],
    ['Hand detected', c.hand ? 'yes' : 'no'],
    ['Hand confidence', `${Math.round(c.handScore * 100)}%`],
    ['Current shape', c.shape ?? '-'],
    ['Gesture confidence', `${Math.round(c.shapeConf * 100)}%`],
    ['Movement', c.movement],
    ['Last gesture', c.lastGesture],
    ['Last action', c.lastAction],
    ['Action execution time', `${c.lastActionMs} ms`],
    ['Clap detection level', `${(c.clapLevel * 100).toFixed(1)}%${c.clapListening ? '' : ' (mic off)'}`],
    ['Battery', bat ? `${Math.round(bat.level * 100)}%${bat.charging ? ' charging' : ''}${startBat ? ` · Δ since session ${(((bat.level - startBat.level) * 100)).toFixed(0)}%` : ''}` : 'not available in this browser'],
  ];
  const tone = { gesture: 'text-indigo-300', action: 'text-emerald-300', system: 'text-slate-300', error: 'text-rose-300', clap: 'text-orange-300', debug: 'text-slate-500' } as const;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Debug</h2>
      <Card>
        <SectionTitle>Live metrics</SectionTitle>
        <div className="divide-y divide-white/5 font-mono text-xs">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-1.5"><span className="text-slate-400">{k}</span><span className="text-right text-white">{v}</span></div>)}
        </div>
      </Card>
      <Card>
        <Row label="Verbose debug logs"><Toggle checked={s.debugLogs} onChange={(v) => patchSettings({ debugLogs: v })} /></Row>
        <Row label="Developer mode" hint="Turning off hides this tab"><Toggle checked={s.developerMode} onChange={(v) => patchSettings({ developerMode: v })} /></Row>
      </Card>
      <Card>
        <SectionTitle right={<Button size="sm" variant="ghost" onClick={() => controller.clearLog()}>Clear</Button>}>Event log</SectionTitle>
        <div className="max-h-96 space-y-1 overflow-y-auto font-mono text-[11px]">
          {c.log.length === 0 && <div className="text-slate-500">No events yet.</div>}
          {c.log.map((l) => (
            <div key={l.id} className={tone[l.kind]}>
              <span className="text-slate-600">{new Date(l.t).toLocaleTimeString()} </span>[{l.kind}] {l.msg}{l.ok === false ? ' ✗' : ''}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
