import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cx } from '@/lib/format'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'live'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent hover:bg-accent-strong text-white border-transparent',
  secondary: 'bg-panel-3 hover:bg-line text-fg border-line',
  ghost: 'bg-transparent hover:bg-panel-3 text-fg border-transparent',
  danger: 'bg-danger/90 hover:bg-danger text-white border-transparent',
  live: 'bg-live hover:bg-red-600 text-white border-transparent'
}
const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3 text-[13px] gap-2',
  lg: 'h-11 px-5 text-sm gap-2'
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  tip?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, tip, className, children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      data-tip={tip}
      aria-label={rest['aria-label'] ?? (!children && tip ? tip : undefined)}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-md border font-medium whitespace-nowrap transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {Icon && <Icon size={size === 'lg' ? 18 : size === 'sm' ? 13 : 15} strokeWidth={2} />}
      {children}
    </button>
  )
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  active?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'secondary'
}

export function IconButton({ icon: Icon, label, active, size = 'md', variant = 'ghost', className, ...rest }: IconButtonProps) {
  const dim = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'
  return (
    <button
      type="button"
      aria-label={label}
      data-tip={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-40 disabled:pointer-events-none',
        variant === 'secondary' ? 'border-line bg-panel-3 hover:bg-line' : 'border-transparent hover:bg-panel-3',
        active ? 'bg-accent/20 text-accent' : 'text-muted hover:text-fg',
        dim,
        className
      )}
      {...rest}
    >
      <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
    </button>
  )
}

const widthOf = (className?: string) => (className && /(^|\s)w-/.test(className) ? '' : 'w-full')
const inputBase =
  'rounded-md border border-line bg-panel-2 px-2.5 text-[13px] text-fg placeholder:text-dim focus:border-accent focus:outline-none disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, widthOf(className), 'h-8', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref
) {
  return <textarea ref={ref} className={cx(inputBase, widthOf(className), 'py-2 leading-relaxed', className)} {...rest} />
})

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputBase, widthOf(className), 'h-8 appearance-auto pr-1', className)} {...rest}>
      {children}
    </select>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1', className)}>
      <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-dim">{hint}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  const id = useId()
  return (
    <label htmlFor={id} className={cx('inline-flex cursor-pointer items-center gap-2', disabled && 'opacity-50')}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line-strong')}
      >
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      {label && <span className="text-[13px] whitespace-nowrap">{label}</span>}
    </label>
  )
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  format?: (v: number) => string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer accent-[var(--color-accent)]"
      />
      <span className="w-12 text-right font-mono text-[11px] text-muted tabular-nums">{format ? format(value) : value}</span>
    </div>
  )
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent p-0.5"
      />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md'
}: {
  value: T
  options: { value: T; label: ReactNode; tip?: string }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex rounded-md border border-line bg-panel-2 p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          data-tip={o.tip}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded px-2.5 font-medium whitespace-nowrap transition-colors',
            size === 'sm' ? 'h-6 text-[11px]' : 'h-7 text-xs',
            value === o.value ? 'bg-panel-3 text-fg shadow' : 'text-muted hover:text-fg'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'live' | 'warn' | 'ok' | 'demo'; className?: string }) {
  const tones = {
    neutral: 'bg-panel-3 text-muted',
    accent: 'bg-accent/20 text-accent',
    live: 'bg-live text-white',
    warn: 'bg-warn/20 text-warn',
    ok: 'bg-ok/20 text-ok',
    demo: 'bg-demo/20 text-demo'
  }
  return <span className={cx('inline-flex items-center rounded px-1.5 py-px text-[10px] font-bold tracking-wide uppercase', tones[tone], className)}>{children}</span>
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-panel-3 px-1.5 py-px font-mono text-[11px] text-muted">{children}</kbd>
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-line-strong border-t-accent"
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  )
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="rounded-2xl bg-panel-3 p-4 text-muted">
        <Icon size={28} />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      {children && <div className="max-w-sm text-[13px] text-muted">{children}</div>}
      {action}
    </div>
  )
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('flex min-h-0 flex-col rounded-lg border border-line bg-panel', className)}>
      {(title || actions) && (
        <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
          <div className="truncate text-[11px] font-bold tracking-wider text-muted uppercase">{title}</div>
          <div className="flex items-center gap-1">{actions}</div>
        </header>
      )}
      {children}
    </section>
  )
}
