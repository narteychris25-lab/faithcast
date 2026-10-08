import { ChevronLeft, ChevronRight, CircleSlash, Eraser, MonitorOff } from 'lucide-react'
import { useApp } from '@/stores/app'
import { useLive } from '@/stores/live'
import { cx } from '@/lib/format'
import { LiveMonitor } from '@/views/live/Monitors'

/**
 * Compact live monitor + essential controls, so the operator can present
 * scripture without leaving the Bible page.
 */
export function LiveMini() {
  const itemId = useLive((s) => s.itemId)
  const live = useLive()
  const aspect = useApp((s) => s.settings.presentation.aspectRatio)
  const outputOpen = useApp((s) => s.output.open)
  if (!itemId) return null
  const btn = (active: boolean, tone: 'live' | 'warn' | 'plain') =>
    cx(
      'flex h-8 flex-1 items-center justify-center gap-1 rounded-md border text-[12px] font-medium',
      active ? (tone === 'live' ? 'border-live bg-live text-white' : 'border-warn bg-warn text-black') : 'border-line bg-panel-3 hover:bg-line'
    )
  return (
    <div className="flex flex-col gap-2" data-testid="live-mini">
      <LiveMonitor aspect={aspect} />
      <div className="flex gap-1">
        <button type="button" className={btn(false, 'plain')} onClick={() => void live.previous()} data-tip="Previous (←)" aria-label="Previous slide">
          <ChevronLeft size={15} />
        </button>
        <button type="button" className={cx(btn(false, 'plain'), 'flex-[2] bg-accent text-white hover:bg-accent-strong')} onClick={() => void live.next()} data-tip="Next (→)" aria-label="Next slide">
          Next <ChevronRight size={15} />
        </button>
        <button type="button" className={btn(live.mode === 'black', 'live')} onClick={() => live.toggleMode('black')} aria-pressed={live.mode === 'black'} data-tip="Black screen (B)">
          <CircleSlash size={14} />
        </button>
        <button type="button" className={btn(live.mode === 'clear', 'warn')} onClick={() => live.toggleMode('clear')} aria-pressed={live.mode === 'clear'} data-tip="Clear text (C)">
          <Eraser size={14} />
        </button>
        <button type="button" className={btn(false, 'plain')} onClick={() => void live.exit()} data-tip={outputOpen ? 'End presentation (Esc)' : 'Clear live'} aria-label="End presentation">
          <MonitorOff size={14} />
        </button>
      </div>
    </div>
  )
}
