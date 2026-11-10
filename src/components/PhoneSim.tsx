import { useEffect, useRef, useState } from 'react';
import { controller, useController } from '../lib/controller';
import { useStore } from '../lib/store';
import { emitSim, getSim, onSimEvent, simSet, simToast, useSim } from '../lib/simStore';
import { cn } from '../utils/cn';

const TRACKS = ['Lo-fi Beats', 'Morning Run Mix', 'Quiet Piano', 'Road Trip'];
const APPS = [
  ['📷', 'Camera'], ['🖼️', 'Gallery'], ['🎵', 'Music'], ['🗺️', 'Maps'], ['✉️', 'Mail'], ['🗒️', 'Notes'],
  ['🌤️', 'Weather'], ['⚙️', 'Settings'], ['🛒', 'Shop'], ['📞', 'Phone'], ['💬', 'Chat'], ['🌐', 'Web'],
];
const SLIDES = ['🌅 Sunrise', '🏔️ Mountains', '🌊 Ocean', '🌲 Forest'];

interface Fx { id: number; kind: 'ripple' | 'long' | 'trail'; x: number; y: number; x2?: number; y2?: number }

export default function PhoneSim() {
  const s = useSim();
  const c = useController();
  const showOverlay = useStore((x) => x.settings.showOverlay);
  const screenRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fx, setFx] = useState<Fx[]>([]);
  const volPress = useRef<{ up: number; down: number }>({ up: 0, down: 0 });
  const [, tick] = useState(0);

  // action events -> visual touches
  useEffect(() => onSimEvent((e) => {
    const el = screenRef.current;
    if (!el) return;
    const add = (f: Omit<Fx, 'id'>) => {
      const id = Math.random();
      setFx((a) => [...a, { ...f, id }]);
      setTimeout(() => setFx((a) => a.filter((x) => x.id !== id)), 700);
    };
    const r = el.getBoundingClientRect();
    if (e.type === 'tap') {
      add({ kind: e.long ? 'long' : 'ripple', x: e.x, y: e.y });
      const target = document.elementFromPoint(r.left + (e.x / 100) * r.width, r.top + (e.y / 100) * r.height) as HTMLElement | null;
      const clickable = target?.closest('[data-tap]') as HTMLElement | null;
      setTimeout(() => clickable?.click(), e.long ? 450 : 60);
    } else if (e.type === 'swipe') {
      add({ kind: 'trail', x: e.x1, y: e.y1, x2: e.x2, y2: e.y2 });
      const dx = e.x2 - e.x1, dy = e.y2 - e.y1;
      const cur = getSim();
      if (Math.abs(dx) > Math.abs(dy)) {
        const dir = dx < 0 ? 1 : -1; // swipe left -> next
        if (cur.screen === 'home') simSet({ page: Math.min(1, Math.max(0, cur.page + dir)) });
        else if (cur.screen === 'app') simSet({ carousel: (cur.carousel + dir + SLIDES.length) % SLIDES.length });
      } else {
        scrollRef.current?.scrollBy({ top: -dy * 4, behavior: 'smooth' });
      }
    } else {
      scrollRef.current?.scrollBy({ top: e.dir * 220, behavior: 'smooth' });
    }
  }), []);

  // transient HUD/toast expiry
  useEffect(() => {
    const t = setInterval(() => {
      const cur = getSim();
      const n = Date.now();
      if ((cur.hud && n - cur.hud.at > 1500) || (cur.toast && n - cur.toast.at > 1800)) {
        simSet({ hud: cur.hud && n - cur.hud.at > 1500 ? null : cur.hud, toast: cur.toast && n - cur.toast.at > 1800 ? null : cur.toast });
      }
      tick((x) => x + 1);
    }, 500);
    return () => clearInterval(t);
  }, []);

  const volButton = (dir: 'up' | 'down') => {
    const n = Date.now();
    volPress.current[dir] = n;
    const other = dir === 'up' ? 'down' : 'up';
    if (n - volPress.current[other] < 600 && controller.getSnapshot().mode !== 'IDLE') {
      controller.stop('emergency (volume up + down)');
      return;
    }
    simSet((cur) => ({ volume: Math.min(15, Math.max(0, cur.volume + (dir === 'up' ? 1 : -1))), muted: false, hud: { kind: 'volume', at: Date.now() } }));
  };

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const active = c.mode === 'ACTIVE';

  return (
    <div className="relative mx-auto w-[300px] select-none">
      {/* side buttons */}
      <button onClick={() => volButton('up')} title="Volume up (press both volume buttons together = emergency disable)"
        className="absolute -right-1.5 top-24 h-12 w-1.5 rounded-r bg-slate-600 hover:bg-slate-400" aria-label="Volume up" />
      <button onClick={() => volButton('down')} title="Volume down"
        className="absolute -right-1.5 top-40 h-12 w-1.5 rounded-r bg-slate-600 hover:bg-slate-400" aria-label="Volume down" />
      <button onClick={() => simSet((cur) => (cur.power ? { power: false } : { power: true }))} title="Power button"
        className="absolute -left-1.5 top-32 h-14 w-1.5 rounded-l bg-slate-600 hover:bg-slate-400" aria-label="Power" />

      <div className="rounded-[2.6rem] border-[6px] border-slate-700 bg-black p-1 shadow-2xl shadow-black/60">
        <div ref={screenRef} className="relative h-[600px] overflow-hidden rounded-[2.1rem] bg-slate-950 text-[12px] text-white"
          style={{ filter: s.power ? `brightness(${0.4 + s.brightness / 160})` : 'none' }}>
          {!s.power ? (
            <div className="flex h-full items-center justify-center bg-black text-slate-700">
              <button onClick={() => simSet({ power: true })} className="rounded-full border border-slate-700 px-3 py-1 text-[11px]" title="Wake">Screen off · tap to wake</button>
            </div>
          ) : (
            <>
              {/* status bar */}
              <div className="absolute inset-x-0 top-0 z-30 flex h-6 items-center justify-between px-4 text-[10px]">
                <span>{time}</span>
                <span className="flex items-center gap-1.5">
                  {c.stream && <span title="Camera in use" className="h-2 w-2 rounded-full bg-emerald-400" />}
                  {c.clapListening && <span title="Microphone in use" className="h-2 w-2 rounded-full bg-orange-400" />}
                  {active && s.power && <span title="Gesture control active">✋</span>}
                  <span>{s.muted ? '🔇' : '📶'}</span><span>🔋</span>
                </span>
              </div>

              {s.locked ? (
                <div className="flex h-full flex-col items-center bg-gradient-to-b from-indigo-950 to-slate-950 pt-24">
                  <div className="text-5xl font-light">{time}</div>
                  <div className="mt-1 text-slate-400">🔒 Locked</div>
                  <button data-tap onClick={() => simSet({ locked: false })} className="mt-auto mb-10 rounded-full bg-white/10 px-4 py-2">Tap to unlock (you, manually)</button>
                </div>
              ) : (
                <>
                  <div className="h-full bg-gradient-to-br from-indigo-900 via-slate-900 to-fuchsia-950 pt-6">
                    {s.screen === 'home' && (
                      <div className="flex h-full flex-col">
                        <div className="flex-1 overflow-hidden">
                          <div className="flex h-full transition-transform duration-300" style={{ transform: `translateX(-${s.page * 100}%)` }}>
                            <div className="grid w-full shrink-0 grid-cols-4 content-start gap-y-5 p-4 pt-8">
                              {APPS.map(([ic, n]) => (
                                <button key={n} data-tap onClick={() => (n === 'Notes' || n === 'Gallery' ? simSet({ screen: 'app' }) : simToast(`${n} (demo)`))}
                                  className="flex flex-col items-center gap-1">
                                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-xl">{ic}</span>
                                  <span className="text-[10px]">{n}</span>
                                </button>
                              ))}
                            </div>
                            <div className="flex w-full shrink-0 flex-col items-center justify-center gap-2 p-6 text-center text-slate-300">
                              <div className="text-4xl">{s.playing ? '🎶' : '🎵'}</div>
                              <div className="font-semibold">{TRACKS[s.track]}</div>
                              <div className="text-slate-400">{s.playing ? 'Playing' : 'Paused'}</div>
                              <div className="text-[10px] text-slate-500">Home page 2</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-center gap-1 pb-1">
                          {[0, 1].map((i) => <span key={i} className={cn('h-1.5 w-1.5 rounded-full', s.page === i ? 'bg-white' : 'bg-white/30')} />)}
                        </div>
                        <div className="mb-3 mx-3 flex justify-around rounded-3xl bg-white/10 p-2 text-xl">
                          {['📞', '💬', '🌐', '📷'].map((i) => <span key={i}>{i}</span>)}
                        </div>
                      </div>
                    )}
                    {s.screen === 'app' && (
                      <div className="flex h-full flex-col bg-slate-900">
                        <div className="px-4 py-2 text-sm font-semibold">Demo app · Notes &amp; Gallery</div>
                        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 pb-3">
                          <div className="mb-3 flex h-24 items-center justify-center rounded-2xl bg-indigo-600/40 text-lg">{SLIDES[s.carousel]}</div>
                          <div className="mb-2 text-center text-[10px] text-slate-400">swipe left/right to change picture ({s.carousel + 1}/{SLIDES.length})</div>
                          <div className={cn('mb-3 whitespace-pre-wrap rounded-xl border p-3 text-sm', s.selected ? 'border-indigo-400 bg-indigo-500/20' : 'border-white/10 bg-white/5')} data-tap>
                            {s.text || <span className="text-slate-500">(empty text field)</span>}
                            <span className="animate-pulse">|</span>
                          </div>
                          <div className="mb-2 text-[10px] text-slate-500">Clipboard: {s.clip ? `"${s.clip}"` : 'empty'}</div>
                          {Array.from({ length: 16 }, (_, i) => (
                            <button key={i} data-tap onClick={() => simToast(`Opened item ${i + 1}`)} className="mb-2 flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-left">
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">{i + 1}</span>
                              <span>List item {i + 1}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {s.screen === 'recents' && (
                      <div className="flex h-full flex-col items-center justify-center gap-3 bg-black/50 p-6">
                        {['Notes', 'Gallery', 'Music'].map((n) => (
                          <button key={n} data-tap onClick={() => simSet({ screen: 'app' })} className="w-full rounded-2xl bg-slate-800 p-4 text-left">{n}</button>
                        ))}
                        <div className="text-[10px] text-slate-400">Recent apps</div>
                      </div>
                    )}
                  </div>

                  {/* nav bar */}
                  <div className="absolute inset-x-0 bottom-0 z-20 flex h-6 items-center justify-center gap-10 bg-black/30 text-[11px] text-slate-300">
                    <span>◀</span><span>●</span><span>■</span>
                  </div>

                  {/* shade */}
                  <div className={cn('absolute inset-x-0 top-0 z-40 overflow-hidden bg-slate-900/97 transition-all duration-300', s.shade === 'none' ? 'h-0' : 'h-[75%]')}>
                    <div className="p-4 pt-8">
                      {s.shade === 'quick' ? (
                        <div className="grid grid-cols-3 gap-2">
                          {['📶 Wi-Fi', '🔵 Bluetooth', '🔦 Torch', '✈️ Airplane', '🌙 DND', '🔄 Rotate'].map((q) => (
                            <div key={q} className="rounded-2xl bg-indigo-500/30 p-3 text-center text-[11px]">{q}</div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="mb-2 text-slate-400">Notifications</div>
                          {active && (
                            <div className="mb-2 rounded-2xl bg-white/10 p-3">
                              <div className="font-semibold">✋ Gesture Control Active</div>
                              <div className="text-[11px] text-slate-400">Camera is on. Tap Disable to stop.</div>
                              <button data-tap onClick={() => controller.stop('notification action')} className="mt-2 rounded-lg bg-rose-500 px-3 py-1 text-[11px] font-semibold">Disable</button>
                            </div>
                          )}
                          {c.clapListening && !active && (
                            <div className="mb-2 rounded-2xl bg-white/10 p-3">
                              <div className="font-semibold">👏 Clap activation listening</div>
                              <div className="text-[11px] text-slate-400">Microphone on, camera off.</div>
                            </div>
                          )}
                          <div className="rounded-2xl bg-white/5 p-3">✉️ New mail · Weekly digest</div>
                          <div className="mt-2 rounded-2xl bg-white/5 p-3">💬 Sam: are we still on for lunch?</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* power menu */}
                  {s.powerMenu && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
                      <div className="w-48 rounded-3xl bg-slate-800 p-3 text-center">
                        {['Power off', 'Restart', 'Emergency'].map((o) => (
                          <button key={o} data-tap onClick={() => simSet({ powerMenu: false })} className="block w-full rounded-xl p-2.5 hover:bg-white/10">{o}</button>
                        ))}
                        <div className="mt-1 text-[10px] text-slate-400">(Back closes)</div>
                      </div>
                    </div>
                  )}

                  {/* overlay indicator */}
                  {active && showOverlay && <ActiveBadge c={c} />}

                  {/* HUD */}
                  {s.hud && (
                    <div className="absolute left-1/2 top-12 z-50 w-40 -translate-x-1/2 rounded-2xl bg-black/80 p-3 text-center">
                      <div>{s.hud.kind === 'volume' ? (s.muted ? '🔇 Muted' : '🔊 Volume') : '🔆 Brightness'}</div>
                      <div className="mt-1 h-1.5 rounded bg-white/20">
                        <div className="h-full rounded bg-white" style={{ width: `${s.hud.kind === 'volume' ? (s.muted ? 0 : (s.volume / 15) * 100) : s.brightness}%` }} />
                      </div>
                    </div>
                  )}
                  {s.toast && <div className="absolute inset-x-6 bottom-12 z-50 rounded-full bg-slate-700 px-3 py-1.5 text-center">{s.toast.msg}</div>}

                  {/* touch effects */}
                  {fx.map((f) =>
                    f.kind === 'trail' ? (
                      <svg key={f.id} className="pointer-events-none absolute inset-0 z-[60] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <line x1={f.x} y1={f.y} x2={f.x2} y2={f.y2} stroke="#a5b4fc" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="100" className="animate-[dash_0.5s_ease-out_forwards]" />
                        <circle cx={f.x2} cy={f.y2} r="2" fill="#a5b4fc" />
                      </svg>
                    ) : (
                      <span key={f.id} className={cn('pointer-events-none absolute z-[60] -ml-5 -mt-5 h-10 w-10 rounded-full border-2 border-indigo-300 bg-indigo-400/30', f.kind === 'long' ? 'animate-[ping_0.7s_ease-out]' : 'animate-ping')}
                        style={{ left: `${f.x}%`, top: `${f.y}%` }} />
                    ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes dash{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}`}</style>
      <div className="mt-3 text-center text-[11px] text-slate-500">Simulated Android phone · actions from gestures run here</div>
      <div className="mt-1 flex justify-center gap-2">
        <button className="text-[11px] text-slate-400 underline" onClick={() => emitSim({ type: 'scroll', dir: 1 })}>scroll test</button>
        <button className="text-[11px] text-slate-400 underline" onClick={() => simSet({ screen: 'app', shade: 'none' })}>open demo app</button>
      </div>
    </div>
  );
}

function ActiveBadge({ c }: { c: ReturnType<typeof useController> }) {
  return (
    <button data-tap onClick={() => controller.stop('overlay tap')} title="Tap to disable"
      className="absolute left-2 top-8 z-50 flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold text-slate-950">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-950" />
      {c.sleeping ? 'GESTURE · idle scan' : 'GESTURE ACTIVE'}
    </button>
  );
}
