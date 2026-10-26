'use client';
// Small building blocks on top of the design system classes.
import { Check, Clock, Hourglass, Minus, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { initials } from '@/lib/format';
import { divClass } from '@/lib/roles';
import type { DivisionKind } from '@/lib/types';

// ----- Status chips: always an icon and a word, never colour alone -----
type ChipKind = 'ok' | 'bad' | 'warn' | 'void' | 'pending' | 'soft';
const chipIcon = { ok: Check, bad: X, warn: Clock, void: Minus, pending: Hourglass, soft: null } as const;
export function Chip({ kind, children }: { kind: ChipKind; children: React.ReactNode }) {
  const Icon = chipIcon[kind];
  const cls = kind === 'pending' ? 'warn' : kind;
  return (
    <span className={`tx-chip tx-chip--${cls}`}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  );
}

// Division tag, outlined in the division colour, always with a name.
export function DivTag({ kind, children }: { kind: DivisionKind | null | undefined; children: React.ReactNode }) {
  const c = divClass(kind);
  return <span className={`tx-tag ${c ? `tx-tag--${c}` : ''}`} style={c ? undefined : { color: 'var(--ink-2)' }}>{children}</span>;
}

export function Avatar({ name, small = false, photo, size }: { name: string; small?: boolean; photo?: string | null; size?: number }) {
  const style = size ? { width: size, height: size, minWidth: size } : undefined;
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" title={name} aria-hidden="true" className={`tx-av ${small ? 'tx-av--sm' : ''} object-cover`} style={{ ...style, padding: 0 }} />;
  }
  return <span className={`tx-av ${small ? 'tx-av--sm' : ''}`} title={name} aria-hidden="true" style={style}>{initials(name)}</span>;
}

// ----- Empty state: dashed frame, red X, one line, one action -----
export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="tx-empty">
      <div className="tx-empty__x" aria-hidden="true" />
      <h3 className="h4">{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

// ----- Form fields: label above, 16px text, help or error below -----
type FieldProps = { label: string; help?: string; error?: string | null; children: React.ReactNode; htmlFor?: string };
export function Field({ label, help, error, children, htmlFor }: FieldProps) {
  return (
    <div className={`tx-field ${error ? 'is-error' : ''}`}>
      <label className="tx-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {(error || help) && <p className="tx-help" role={error ? 'alert' : undefined}>{error ?? help}</p>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string; error?: string | null }) {
  const { label, help, error, id, className, ...rest } = props;
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} help={help} error={error} htmlFor={fid}>
      <input id={fid} className={`tx-input ${className ?? ''}`} aria-invalid={!!error || undefined} {...rest} />
    </Field>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; help?: string; error?: string | null }) {
  const { label, help, error, id, ...rest } = props;
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} help={help} error={error} htmlFor={fid}>
      <textarea id={fid} className="tx-input" aria-invalid={!!error || undefined} {...rest} />
    </Field>
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; help?: string; error?: string | null }) {
  const { label, help, error, id, children, ...rest } = props;
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} help={help} error={error} htmlFor={fid}>
      <select id={fid} className="tx-select" aria-invalid={!!error || undefined} {...rest}>{children}</select>
    </Field>
  );
}

export function Check2({ label, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className="tx-check">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

// Segmented control for 2–4 exclusive options.
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="tx-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value}
          className={o.value === value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ----- Modal: bottom sheet on mobile, centred dialog on desktop -----
export function Modal({ open, onClose, title, children, actions, labelledBy }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; actions?: React.ReactNode; labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tid = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="tx-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="tx-modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? tid}>
        <div className="tx-modal__grab md:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-s3 mb-s4">
          <h2 id={tid} className="h4">{title}</h2>
          <button data-close className="tx-iconbtn -mr-s2 -mt-s2" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        {children}
        {actions && <div className="tx-modal__actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

// Loading button: label stays, a 2px red bar runs underneath.
export function Button({ variant = 'primary', loading, block, small, className = '', children, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; block?: boolean; small?: boolean }) {
  return (
    <button
      className={`tx-btn tx-btn--${variant} ${block ? 'tx-btn--block' : ''} ${small ? 'tx-btn--sm' : ''} ${loading ? 'is-loading' : ''} ${className}`}
      aria-busy={loading || undefined}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Skeleton({ h = 20, w = '100%', className = '' }: { h?: number; w?: number | string; className?: string }) {
  return <div className={`tx-skel ${className}`} style={{ height: h, width: w }} aria-hidden="true" />;
}
