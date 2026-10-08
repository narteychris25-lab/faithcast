import { useEffect, useState } from 'react'
import {
  BookOpen,
  CircleHelp,
  Globe,
  Image as ImageIcon,
  LayoutDashboard,
  ListMusic,
  MonitorPlay,
  Music,
  Palette,
  Settings,
  type LucideIcon
} from 'lucide-react'
import { cx } from '@/lib/format'
import { useApp, type View } from '@/stores/app'
import { useService } from '@/stores/service'

/** The pages in the top bar, left to right. Settings and Help sit at the right end. */
export const NAV: { view: View; label: string; icon: LucideIcon }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'bible', label: 'Bible', icon: BookOpen },
  { view: 'songs', label: 'Songs', icon: Music },
  { view: 'themes', label: 'Themes', icon: Palette },
  { view: 'planner', label: 'Service Planner', icon: ListMusic },
  { view: 'live', label: 'Live', icon: MonitorPlay },
  { view: 'media', label: 'Media', icon: ImageIcon },
  { view: 'internet', label: 'Internet', icon: Globe },
  { view: 'settings', label: 'Settings', icon: Settings },
  { view: 'help', label: 'Help', icon: CircleHelp }
]

/** True while the window is too narrow for nav labels (matches Tailwind's `max-lg`). */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1023.98px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023.98px)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

export function NavBar() {
  const view = useApp((s) => s.view)
  const live = useApp((s) => s.output.open)
  const narrow = useNarrow()
  return (
    <nav className="flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-line bg-panel px-2 [scrollbar-width:none]" aria-label="Main">
      {NAV.map((n) => (
        <button
          key={n.view}
          type="button"
          onClick={() => {
            useService.getState().flush()
            useApp.getState().navigate(n.view)
          }}
          aria-current={view === n.view ? 'page' : undefined}
          data-tip={narrow ? n.label : undefined}
          className={cx(
            'relative flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors',
            view === n.view ? 'bg-accent/20 font-medium text-fg' : 'text-muted hover:bg-panel-3 hover:text-fg',
            n.view === 'settings' && 'ml-auto'
          )}
        >
          <n.icon size={15} className={view === n.view ? 'text-accent' : ''} />
          {/* Icons only on narrow windows; the label stays readable by screen readers */}
          <span className="max-lg:sr-only">{n.label}</span>
          {n.view === 'live' && live && <span className="live-dot h-2 w-2 rounded-full bg-live" />}
        </button>
      ))}
    </nav>
  )
}
