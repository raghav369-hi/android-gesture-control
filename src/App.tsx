import { useEffect, useState } from 'react';
import GestureBuilder from './components/GestureBuilder';
import Onboarding from './components/Onboarding';
import PhoneSim from './components/PhoneSim';
import { controller, useController } from './lib/controller';
import { newAction, newGesture } from './lib/defaults';
import { refreshPermissionState } from './lib/permissions';
import { getState, useStore } from './lib/store';
import type { ConfiguredAction, GestureProfile } from './lib/types';
import AboutPage from './pages/AboutPage';
import ActionsPage from './pages/ActionsPage';
import DebugPage from './pages/DebugPage';
import GesturesPage from './pages/GesturesPage';
import HomePage from './pages/HomePage';
import LiveTestPage from './pages/LiveTestPage';
import SettingsPage from './pages/SettingsPage';
import { cn } from './utils/cn';

const TABS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'gestures', label: 'Gestures', icon: '✋' },
  { id: 'actions', label: 'Actions', icon: '🧩' },
  { id: 'test', label: 'Live Test', icon: '🎯' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'debug', label: 'Debug', icon: '🐞' },
  { id: 'about', label: 'Privacy', icon: '🔒' },
];

export default function App() {
  const [tab, setTab] = useState('home');
  const [builder, setBuilder] = useState<{ g: GestureProfile; a: ConfiguredAction } | null>(null);
  const [focus, setFocus] = useState<GestureProfile | null>(null);
  const [showPhone, setShowPhone] = useState(false);
  const onboarded = useStore((s) => s.onboarded);
  const dev = useStore((s) => s.settings.developerMode);
  const c = useController();

  useEffect(() => { void refreshPermissionState(); }, []);

  const edit = (g: GestureProfile) => {
    const m = getState().mappings.find((x) => x.gestureId === g.id);
    setBuilder({ g, a: m?.action ?? newAction('NONE', {}, 0) });
  };
  const add = () => setBuilder({ g: newGesture(), a: newAction('HOME', {}, 0) });
  const test = (g: GestureProfile) => {
    setFocus(g); setTab('test');
    if (controller.getSnapshot().mode === 'IDLE') void controller.start('TEST');
  };
  const tabs = TABS.filter((t) => t.id !== 'debug' || dev);
  const active = c.mode === 'ACTIVE' && c.phase === 'running';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-lg">✋</div>
          <div className="leading-tight">
            <div className="font-semibold text-white">Gesture Controller</div>
            <div className="text-[11px] text-slate-400">Camera &amp; clap-activated phone control · web prototype</div>
          </div>
          <div className={cn('ml-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
            active ? 'bg-emerald-500/20 text-emerald-300' : c.mode === 'TEST' ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-slate-400')}>
            <span className={cn('h-2 w-2 rounded-full', active ? 'animate-pulse bg-emerald-400' : c.mode === 'TEST' ? 'bg-amber-400' : 'bg-slate-500')} />
            {active ? 'ACTIVE' : c.mode === 'TEST' ? 'TESTING' : 'INACTIVE'}
            {c.stream && <span title="Camera on">📷</span>}
            {c.clapListening && <span title="Microphone listening">🎙️</span>}
          </div>
          {(active || c.mode === 'TEST') && (
            <button onClick={() => controller.stop('header button')} className="rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-400">Disable</button>
          )}
          <button onClick={() => setShowPhone((v) => !v)} className="rounded-full bg-white/10 px-3 py-1 text-xs lg:hidden">📱</button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setBuilder(null); }}
              className={cn('whitespace-nowrap rounded-xl px-3 py-1.5 text-sm transition', tab === t.id && !builder ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/10')}>
              <span className="mr-1">{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <main className="min-w-0">
          {showPhone && <div className="mb-5 lg:hidden"><PhoneSim /></div>}
          {builder ? (
            <GestureBuilder key={builder.g.id} initial={builder.g} initialAction={builder.a} onClose={() => setBuilder(null)} />
          ) : tab === 'home' ? <HomePage onEdit={edit} onAdd={add} goto={setTab} />
            : tab === 'gestures' ? <GesturesPage onEdit={edit} onAdd={add} onTest={test} />
            : tab === 'actions' ? <ActionsPage />
            : tab === 'test' ? <LiveTestPage focus={focus} onEdit={edit} />
            : tab === 'settings' ? <SettingsPage />
            : tab === 'debug' && dev ? <DebugPage />
            : <AboutPage />}
        </main>
        <aside className="hidden lg:block">
          <div className="sticky top-32"><PhoneSim /></div>
        </aside>
      </div>
      {!onboarded && <Onboarding goto={setTab} />}
    </div>
  );
}
