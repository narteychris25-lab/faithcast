import { ArrowDown, ArrowUp, CalendarPlus, ListPlus, MonitorPlay, Trash2, X } from 'lucide-react'
import type { BibleReference, ScheduledPassage } from '@shared/types'
import { formatReference } from '@shared/bible-books'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'
import { Button, IconButton } from '@/components/ui/controls'
import { confirmDialog, toast } from '@/components/ui/overlays'
import { addToCurrentService } from '@/views/songs/SongsView'

const sameRef = (a: BibleReference | null, b: BibleReference) =>
  !!a && a.translationId === b.translationId && a.book === b.book && a.chapter === b.chapter && a.verseStart === b.verseStart && a.verseEnd === b.verseEnd

/**
 * Scripture schedule: passages lined up in advance; one click presents.
 * Saved in the database, so it survives restarts.
 */
export function ScheduleList({
  items,
  canAdd,
  addLabel,
  liveRef,
  onAdd,
  onPresent,
  onChanged
}: {
  items: ScheduledPassage[]
  canAdd: boolean
  addLabel: string
  liveRef: BibleReference | null
  onAdd: () => void
  onPresent: (p: ScheduledPassage) => void
  onChanged: () => void
}) {
  async function move(i: number, delta: number) {
    const ids = items.map((x) => x.id)
    const j = i + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await api('bible:scheduleReorder', ids).catch(toast.error)
    onChanged()
  }
  async function remove(p: ScheduledPassage) {
    await api('bible:scheduleRemove', p.id).catch(toast.error)
    onChanged()
  }
  async function clear() {
    if (!(await confirmDialog({ title: 'Clear the scripture schedule?', message: `All ${items.length} passages will be removed from the schedule.`, danger: true, confirmLabel: 'Clear' }))) return
    await api('bible:scheduleClear').catch(toast.error)
    onChanged()
  }
  async function addAllToService() {
    for (const p of items) {
      await addToCurrentService({ type: 'bible', title: formatReference(p.book, p.chapter, p.verseStart, p.verseEnd), data: { bible: { translationId: p.translationId, book: p.book, chapter: p.chapter, verseStart: p.verseStart, verseEnd: p.verseEnd, versesPerSlide: p.versesPerSlide } } })
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-2 pb-2">
        <Button size="sm" icon={CalendarPlus} className="w-full" disabled={!canAdd} onClick={onAdd} tip={canAdd ? `Add ${addLabel}` : 'Select verses first'}>
          {canAdd ? `Add ${addLabel}` : 'Select verses to add'}
        </Button>
      </div>
      <ol className="min-h-0 flex-1 overflow-auto px-1 pb-2" aria-label="Scripture schedule">
        {items.map((p, i) => {
          const isLive = sameRef(liveRef, p)
          return (
            <li key={p.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPresent(p)}
                data-testid="schedule-item"
                className={cx(
                  'flex min-w-0 flex-1 items-center gap-2 rounded-md border-l-4 px-2 py-2 text-left text-[13px]',
                  isLive ? 'border-live bg-live/15' : 'border-transparent hover:bg-panel-3'
                )}
                data-tip="Click to present"
              >
                <span className="w-4 shrink-0 text-right font-mono text-[10px] text-dim">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.label}</span>
                  <span className="block text-[10px] text-dim">{p.versesPerSlide ? `${p.versesPerSlide} verse${p.versesPerSlide === 1 ? '' : 's'} per slide` : 'Auto layout'}</span>
                </span>
                {isLive ? <span className="rounded bg-live px-1 text-[9px] font-bold text-white">LIVE</span> : <MonitorPlay size={13} className="shrink-0 text-muted opacity-0 group-hover:opacity-100" />}
              </button>
              <div className="flex flex-col opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                <IconButton size="sm" icon={ArrowUp} label="Move up" disabled={i === 0} onClick={() => void move(i, -1)} />
                <IconButton size="sm" icon={ArrowDown} label="Move down" disabled={i === items.length - 1} onClick={() => void move(i, 1)} />
              </div>
              <IconButton size="sm" icon={X} label="Remove from schedule" className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100" onClick={() => void remove(p)} />
            </li>
          )
        })}
        {items.length === 0 && (
          <li className="p-3 text-[12px] leading-relaxed text-dim">
            Line up the readings for your service here. Select verses, click <b>Add to schedule</b>, then click any passage during the service to put it on screen.
          </li>
        )}
      </ol>
      {items.length > 0 && (
        <div className="flex gap-1 border-t border-line p-2">
          <Button size="sm" icon={ListPlus} className="flex-1" onClick={() => void addAllToService()} tip="Add every scheduled passage to the current service">
            Add all to service
          </Button>
          <Button size="sm" icon={Trash2} variant="ghost" onClick={() => void clear()} tip="Clear schedule" />
        </div>
      )}
    </div>
  )
}
