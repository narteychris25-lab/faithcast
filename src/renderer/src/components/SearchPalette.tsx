import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, CalendarDays, Image as ImageIcon, Music, Palette, Search, Shapes, type LucideIcon } from 'lucide-react'
import type { SearchResult } from '@shared/types'
import { formatReference } from '@shared/bible-books'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'
import { useApp } from '@/stores/app'
import { useService } from '@/stores/service'
import { useLive } from '@/stores/live'
import { quickItem } from '@/views/songs/SongsView'
import { isMod } from '@/lib/platform'
import { comboLabel } from '@/lib/shortcuts'

const KIND: Record<SearchResult['kind'], { label: string; icon: LucideIcon }> = {
  song: { label: 'Songs', icon: Music },
  bible: { label: 'Bible', icon: BookOpen },
  service: { label: 'Services', icon: CalendarDays },
  media: { label: 'Media', icon: ImageIcon },
  theme: { label: 'Themes', icon: Palette },
  slide: { label: 'Slides & announcements', icon: Shapes }
}

/** ⌘K / Ctrl+K global search across songs, Bible, services, media, slides and themes. */
export function SearchPalette() {
  const open = useApp((s) => s.searchOpen)
  const setOpen = useApp((s) => s.setSearchOpen)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.select(), 10)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => void api('search:global', q).then((r) => { setResults(r); setActive(0) }).catch(() => setResults([])), 90)
    return () => clearTimeout(t)
  }, [q, open])

  if (!open) return null

  function choose(r: SearchResult, present = false) {
    setOpen(false)
    const app = useApp.getState()
    switch (r.kind) {
      case 'song':
        if (present) void useLive.getState().presentQuick(quickItem({ type: 'song', title: r.title, refId: r.id }))
        else app.navigate('songs', r.id)
        break
      case 'service':
        app.openService(r.id)
        break
      case 'media':
        app.navigate('media')
        break
      case 'theme':
        app.navigate('themes')
        break
      case 'slide':
        if (r.serviceId) {
          app.openService(r.serviceId)
          setTimeout(() => useService.getState().select(r.id), 300)
        }
        break
      case 'bible':
        if (r.ref) {
          const title = formatReference(r.ref.book, r.ref.chapter, r.ref.verseStart, r.ref.verseEnd)
          if (present) void useLive.getState().presentQuick(quickItem({ type: 'bible', title, data: { bible: { ...r.ref, versesPerSlide: app.settings.bible.versesPerSlide } } }))
          // The Bible page opens this passage; `n` makes picking the same result again still count
          else app.navigate('bible', JSON.stringify({ ...r.ref, n: Date.now() }))
        }
        break
    }
  }

  const grouped = (Object.keys(KIND) as SearchResult['kind'][]).map((k) => [k, results.filter((r) => r.kind === k)] as const).filter(([, list]) => list.length)
  const flat = grouped.flatMap(([, list]) => list)

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-start justify-center bg-black/50 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)} data-modal>
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl animate-pop" role="dialog" aria-label="Search">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search size={16} className="text-dim" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search songs, lyrics, John 3:16, services, media, themes…"
            className="h-12 flex-1 bg-transparent text-[15px] placeholder:text-dim"
            // Inline so it beats the global :focus-visible ring, which would spill past the dialog's edge
            style={{ outline: 'none' }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(flat.length - 1, active + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, active - 1)) }
              if (e.key === 'Enter' && flat[active]) choose(flat[active], isMod(e))
            }}
          />
        </div>
        <div className="max-h-[55vh] overflow-auto p-2">
          {!q && <div className="p-6 text-center text-[13px] text-dim">Type to search. Press <b>{comboLabel('Enter')}</b> to open, <b>{comboLabel('Mod+Enter')}</b> to present a song or verse immediately.</div>}
          {q && flat.length === 0 && <div className="p-6 text-center text-[13px] text-dim">No results for “{q}”.</div>}
          {grouped.map(([kind, list]) => {
            const K = KIND[kind]
            return (
              <div key={kind} className="mb-2">
                <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-dim uppercase">{K.label}</div>
                {list.map((r) => {
                  const idx = flat.indexOf(r)
                  return (
                    <button
                      key={`${r.kind}-${r.id}`}
                      type="button"
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => choose(r)}
                      className={cx('flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left', idx === active ? 'bg-accent text-white' : 'hover:bg-panel-3')}
                    >
                      <K.icon size={15} className={idx === active ? '' : 'text-muted'} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{r.title}</span>
                        <span className={cx('block truncate text-[11px]', idx === active ? 'text-white/75' : 'text-dim')}>{r.subtitle}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
