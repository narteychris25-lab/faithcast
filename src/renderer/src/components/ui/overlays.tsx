import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react'
import { create } from 'zustand'
import { cx } from '@/lib/format'
import { Button, Input } from './controls'

// ------------------------------------------------------------------ modal

/** Open modals, innermost last — the innermost one shows toasts so they never cover its buttons. */
const useModalStack = create<{ ids: string[]; push: (id: string) => void; remove: (id: string) => void }>((set) => ({
  ids: [],
  push: (id) => set((s) => ({ ids: [...s.ids.filter((x) => x !== id), id] })),
  remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) }))
}))

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
  dismissable = true
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
  dismissable?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const modalId = useId()
  const isTop = useModalStack((s) => s.ids[s.ids.length - 1] === modalId)
  const [openedAt, setOpenedAt] = useState(0)
  useEffect(() => {
    if (!open) return
    setOpenedAt(Date.now())
    useModalStack.getState().push(modalId)
    return () => useModalStack.getState().remove(modalId)
  }, [open, modalId])
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>('[autofocus], input, textarea, select, button[data-primary]')
      el?.focus()
    }, 10)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey, true)
      prev?.focus?.()
    }
  }, [open, onClose, dismissable])

  if (!open) return null
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 animate-fade"
      onMouseDown={(e) => e.target === e.currentTarget && dismissable && onClose()}
      data-modal
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className="flex max-h-full w-full flex-col overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl animate-pop"
        style={{ maxWidth: width }}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          {dismissable && (
            <button onClick={onClose} className="rounded p-1 text-muted hover:bg-panel-3 hover:text-fg" aria-label="Close">
              <X size={16} />
            </button>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        {isTop && <ToastList inline since={openedAt} />}
        {footer && <footer className="flex shrink-0 justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body
  )
}

// ------------------------------------------------------------------ confirm / prompt (promise based)

interface DialogRequest {
  kind: 'confirm' | 'prompt'
  title: string
  message?: ReactNode
  confirmLabel?: string
  danger?: boolean
  defaultValue?: string
  placeholder?: string
  resolve: (v: string | boolean | null) => void
}

const useDialogStore = create<{ req: DialogRequest | null; set: (r: DialogRequest | null) => void }>((set) => ({
  req: null,
  set: (req) => set({ req })
}))

export function confirmDialog(opts: { title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => useDialogStore.getState().set({ kind: 'confirm', ...opts, resolve: (v) => resolve(v === true) }))
}

export function promptDialog(opts: { title: string; message?: ReactNode; defaultValue?: string; placeholder?: string; confirmLabel?: string }): Promise<string | null> {
  return new Promise((resolve) =>
    useDialogStore.getState().set({ kind: 'prompt', ...opts, resolve: (v) => resolve(typeof v === 'string' ? v : null) })
  )
}

export function DialogHost() {
  const { req, set } = useDialogStore()
  const [value, setValue] = useState('')
  useEffect(() => setValue(req?.defaultValue ?? ''), [req])
  if (!req) return null
  const close = (v: string | boolean | null) => {
    set(null)
    req.resolve(v)
  }
  const submit = () => close(req.kind === 'prompt' ? value.trim() || null : true)
  return (
    <Modal
      open
      onClose={() => close(null)}
      title={req.title}
      width={440}
      footer={
        <>
          <Button onClick={() => close(null)}>Cancel</Button>
          <Button data-primary variant={req.danger ? 'danger' : 'primary'} onClick={submit}>
            {req.confirmLabel ?? (req.kind === 'prompt' ? 'OK' : 'Confirm')}
          </Button>
        </>
      }
    >
      {req.message && <div className="mb-3 text-[13px] leading-relaxed text-muted">{req.message}</div>}
      {req.kind === 'prompt' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Input autoFocus value={value} placeholder={req.placeholder} onChange={(e) => setValue(e.target.value)} />
        </form>
      )}
    </Modal>
  )
}

// ------------------------------------------------------------------ toasts

export type ToastLevel = 'info' | 'success' | 'warning' | 'error'
interface Toast {
  id: number
  level: ToastLevel
  message: string
  /** Second line, e.g. a licence reminder for an import that succeeded. */
  detail?: string
}

const useToasts = create<{ toasts: Toast[]; push: (t: Omit<Toast, 'id'>) => void; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.random()
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.level === 'error' ? 8000 : t.detail || t.level === 'warning' ? 7000 : 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
}))

export const toast = {
  info: (message: string, detail?: string) => useToasts.getState().push({ level: 'info', message, detail }),
  success: (message: string, detail?: string) => useToasts.getState().push({ level: 'success', message, detail }),
  warning: (message: string, detail?: string) => useToasts.getState().push({ level: 'warning', message, detail }),
  error: (message: string | unknown) =>
    useToasts.getState().push({ level: 'error', message: message instanceof Error ? message.message : String(message) })
}

const TOAST_ICONS: Record<ToastLevel, [LucideIcon, string]> = {
  info: [Info, 'text-accent'],
  success: [CheckCircle2, 'text-ok'],
  warning: [AlertTriangle, 'text-warn'],
  error: [XCircle, 'text-danger']
}

/** Floating in the corner normally; inside the open modal (above its footer) while one is shown. */
export function ToastHost() {
  const modalOpen = useModalStack((s) => s.ids.length > 0)
  if (modalOpen) return null
  return createPortal(<ToastList />, document.body)
}

/** `since`: inside a modal, only messages raised while it is open (older ones return when it closes). */
function ToastList({ inline = false, since = 0 }: { inline?: boolean; since?: number }) {
  const { toasts: all, dismiss } = useToasts()
  const toasts = since ? all.filter((t) => t.id >= since) : all
  if (inline && !toasts.length) return null
  return (
    <div
      className={cx(
        'flex flex-col gap-2',
        inline ? 'shrink-0 border-t border-line px-4 py-2' : 'pointer-events-none fixed right-4 bottom-4 z-[60] w-96'
      )}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const [Icon, color] = TOAST_ICONS[t.level]
        return (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex items-start gap-3 rounded-lg border bg-panel-2 animate-pop',
              inline ? 'border-line px-3 py-2' : 'border-line-strong p-3 shadow-xl'
            )}
          >
            <Icon size={18} className={cx('mt-px shrink-0', color)} />
            <div className="min-w-0 flex-1 text-[13px] leading-snug">
              <div className="whitespace-pre-line">{t.message}</div>
              {t.detail && (
                <div className="mt-1 flex items-start gap-1.5 text-[12px] text-warn">
                  <AlertTriangle size={13} className="mt-px shrink-0" />
                  <span className="whitespace-pre-line">{t.detail}</span>
                </div>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-dim hover:text-fg" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ context menu

export interface MenuItem {
  label: string
  icon?: LucideIcon
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}
export type MenuEntry = MenuItem | 'separator'

const useMenu = create<{ menu: { x: number; y: number; items: MenuEntry[] } | null; set: (m: { x: number; y: number; items: MenuEntry[] } | null) => void }>(
  (set) => ({ menu: null, set: (menu) => set({ menu }) })
)

export function openContextMenu(e: { clientX: number; clientY: number; preventDefault: () => void }, items: MenuEntry[]): void {
  e.preventDefault()
  useMenu.getState().set({ x: e.clientX, y: e.clientY, items })
}

export function ContextMenuHost() {
  const { menu, set } = useMenu()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useLayoutEffect(() => {
    if (!menu || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ x: Math.min(menu.x, window.innerWidth - r.width - 8), y: Math.min(menu.y, window.innerHeight - r.height - 8) })
    ref.current.querySelector<HTMLElement>('button:not(:disabled)')?.focus()
  }, [menu])
  useEffect(() => {
    if (!menu) return
    const close = () => set(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
        const i = btns.indexOf(document.activeElement as HTMLButtonElement)
        btns[(i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length]?.focus()
      }
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('blur', close)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [menu, set])
  if (!menu) return null
  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-[70] min-w-48 rounded-lg border border-line-strong bg-panel-2 p-1 shadow-2xl animate-pop"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {menu.items.map((it, i) =>
        it === 'separator' ? (
          <div key={i} className="my-1 h-px bg-line" />
        ) : (
          <button
            key={i}
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              set(null)
              it.onSelect()
            }}
            className={cx(
              'flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[13px] focus:bg-accent focus:text-white hover:bg-accent hover:text-white disabled:opacity-40',
              it.danger && 'text-danger'
            )}
          >
            {it.icon ? <it.icon size={14} /> : <span className="w-3.5" />}
            <span className="flex-1">{it.label}</span>
            {it.shortcut && <span className="text-[11px] opacity-60">{it.shortcut}</span>}
          </button>
        )
      )}
    </div>,
    document.body
  )
}

// ------------------------------------------------------------------ tooltip (global, driven by data-tip)

export function TooltipHost() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let current: Element | null = null
    const over = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-tip]") ?? null
      if (el === current) return
      current = el
      clearTimeout(timer)
      setTip(null)
      const text = el?.getAttribute('data-tip')
      if (!el || !text) return
      timer = setTimeout(() => {
        const r = el.getBoundingClientRect()
        const below = r.top < 48
        setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 6 : r.top - 6, below })
      }, 450)
    }
    const hide = () => {
      clearTimeout(timer)
      current = null
      setTip(null)
    }
    document.addEventListener('mouseover', over)
    document.addEventListener('mousedown', hide)
    document.addEventListener('keydown', hide)
    return () => {
      document.removeEventListener('mouseover', over)
      document.removeEventListener('mousedown', hide)
      document.removeEventListener('keydown', hide)
    }
  }, [])
  if (!tip) return null
  return createPortal(
    <div
      className="pointer-events-none fixed z-[80] max-w-64 rounded-md bg-black/90 px-2 py-1 text-[11px] text-white shadow-lg animate-fade"
      style={{ left: tip.x, top: tip.y, transform: `translate(-50%, ${tip.below ? '0' : '-100%'})` }}
    >
      {tip.text}
    </div>,
    document.body
  )
}
