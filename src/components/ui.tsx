import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/20', className)}>{children}</div>;
}

export function Button({
  children, onClick, variant = 'default', size = 'md', disabled, className, title, type = 'button',
}: {
  children: ReactNode; onClick?: () => void; variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg'; disabled?: boolean; className?: string; title?: string; type?: 'button' | 'submit';
}) {
  const v = {
    default: 'bg-white/10 hover:bg-white/15 text-slate-100',
    primary: 'bg-indigo-500 hover:bg-indigo-400 text-white',
    success: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950',
    danger: 'bg-rose-500/90 hover:bg-rose-500 text-white',
    ghost: 'hover:bg-white/10 text-slate-300',
  }[variant];
  const s = { sm: 'px-2.5 py-1 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' }[size];
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick}
      className={cn('rounded-xl font-medium transition active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none', v, s, className)}>
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-40', checked ? 'bg-emerald-500' : 'bg-slate-600')}>
      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition', checked ? 'translate-x-5.5' : 'translate-x-0.5')} />
    </button>
  );
}

export function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-100">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Slider({
  label, value, min, max, step = 1, unit = '', onChange, hint, format,
}: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; hint?: string; format?: (v: number) => string }) {
  return (
    <label className="block py-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-slate-100">{label}</span>
        <span className="tabular-nums text-indigo-300">{format ? format(value) : value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-indigo-400" />
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </label>
  );
}

export function Select<T extends string | number>({
  value, onChange, options, className,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <select value={value} className={cn('rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100', className)}
      onChange={(e) => {
        const o = options.find((x) => String(x.value) === e.target.value);
        if (o) onChange(o.value);
      }}>
      {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
    </select>
  );
}

export function Segmented<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-800 p-0.5">
      {options.map((o) => (
        <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
          className={cn('rounded-[10px] px-3 py-1 text-xs font-medium transition', o.value === value ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:text-white')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'indigo' }) {
  const t = {
    slate: 'bg-white/10 text-slate-300', green: 'bg-emerald-500/20 text-emerald-300', red: 'bg-rose-500/20 text-rose-300',
    amber: 'bg-amber-500/20 text-amber-300', indigo: 'bg-indigo-500/20 text-indigo-300',
  }[tone];
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', t)}>{children}</span>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className={cn('max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 p-5 sm:rounded-3xl', wide ? 'max-w-2xl' : 'max-w-lg')}
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-slate-400 hover:bg-white/10" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-1 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{children}</h2>
      {right}
    </div>
  );
}

export function Notice({ tone = 'amber', children }: { tone?: 'amber' | 'red' | 'indigo' | 'green'; children: ReactNode }) {
  const t = {
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200', red: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    indigo: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200', green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  }[tone];
  return <div className={cn('rounded-xl border px-3 py-2 text-sm', t)}>{children}</div>;
}
