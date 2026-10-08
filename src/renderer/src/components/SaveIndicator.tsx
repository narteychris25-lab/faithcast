import { AlertCircle, Check, Circle } from 'lucide-react'
import { useService } from '@/stores/service'
import { Spinner } from './ui/controls'

/** Saved / Saving / Unsaved changes, reflecting real database write state. */
export function SaveIndicator() {
  const status = useService((s) => s.status)
  const map = {
    saved: [<Check key="i" size={13} className="text-ok" />, 'Saved'],
    saving: [<Spinner key="i" size={12} />, 'Saving…'],
    unsaved: [<Circle key="i" size={9} className="fill-warn text-warn" />, 'Unsaved changes'],
    error: [<AlertCircle key="i" size={13} className="text-danger" />, 'Save failed']
  } as const
  const [icon, label] = map[status]
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-muted" role="status" aria-live="polite" data-testid="save-status">
      {icon}
      {label}
    </span>
  )
}
