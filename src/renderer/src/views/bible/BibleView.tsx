import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, CalendarPlus, History, Library, ListPlus, MonitorPlay, Play, Search, Star } from 'lucide-react'
import type { BiblePassage, BibleReference, BibleVerse, RenderSlide, ScheduledPassage } from '@shared/types'
import { BIBLE_BOOKS, bookName, findBook, formatReference, parseReference } from '@shared/bible-books'
import { buildSlides } from '@shared/slides'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'
import { themeMap, useApp } from '@/stores/app'
import { useLive } from '@/stores/live'
import { useService } from '@/stores/service'
import { Badge, Button, EmptyState, Field, Input, Segmented, Toggle } from '@/components/ui/controls'
import { toast } from '@/components/ui/overlays'
import { SlidePreview } from '@/components/slide/SlideCanvas'
import { ScriptureInput } from '@/components/ScriptureInput'
import { VERSION_PREF, VersionPicker, versionShortcutIndex } from '@/components/VersionPicker'
import { addToCurrentService, quickItem } from '@/views/songs/SongsView'
import { ScheduleList } from './ScheduleList'
import { LiveMini } from './LiveMini'

type Tab = 'schedule' | 'recent' | 'favorites'

function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

/** First and last verse shown on a Bible slide, from its label ("John 3:16" / "John 3:16-17"). */
export function slideVerses(slide: RenderSlide | undefined): [number, number] | null {
  const m = slide ? /:(\d+)(?:-(\d+))?$/.exec(slide.label) : null
  return m ? [Number(m[1]), Number(m[2] ?? m[1])] : null
}

/** The live Bible passage and which verses are on screen right now (if a Bible item is live). */
function useLiveBible(): { ref: (BibleReference & { versesPerSlide: number }) | null; verses: [number, number] | null; quick: boolean } {
  const itemId = useLive((s) => s.itemId)
  const quick = useLive((s) => s.quickItem)
  const slide = useLive((s) => s.slides[s.slideIndex])
  const items = useService((s) => s.service?.items)
  const item = quick?.id === itemId ? quick : items?.find((i) => i.id === itemId)
  const ref = item?.type === 'bible' ? (item.data.bible ?? null) : null
  return { ref, verses: ref ? slideVerses(slide) : null, quick: !!quick && quick.id === itemId }
}

export function BibleView() {
  const translations = useApp((s) => s.translations)
  const settings = useApp((s) => s.settings)
  const themes = useApp((s) => s.themes)
  const church = useApp((s) => s.church)
  const [tid, setTid] = useState(() => {
    let remembered: string | null = null
    try {
      remembered = localStorage.getItem(VERSION_PREF)
    } catch {
      /* storage unavailable */
    }
    const ok = (id: string | null | undefined) => (id && translations.some((t) => t.id === id) ? id : null)
    return ok(remembered) ?? ok(settings.bible.defaultTranslationId) ?? translations[0]?.id ?? ''
  })
  const [structure, setStructure] = useState<Record<number, number[]>>({})
  const [book, setBook] = useState(43)
  const [chapter, setChapter] = useState(3)
  const [verses, setVerses] = useState<BibleVerse[]>([])
  const [sel, setSel] = useState<[number, number] | null>(null)
  const [per, setPer] = useState(settings.bible.versesPerSlide)
  const [q, setQ] = useState('')
  const [refText, setRefText] = useState('')
  const [results, setResults] = useState<BibleVerse[] | null>(null)
  const [tab, setTab] = useState<Tab>('schedule')
  const [passages, setPassages] = useState<BiblePassage[]>([])
  const [schedule, setSchedule] = useState<ScheduledPassage[]>([])
  const [presentOnClick, setPresentOnClick] = useState(() => readPref('fc.bible.presentOnClick', true))
  const live = useLiveBible()

  const loadPassages = () => void api('bible:passages', { favorites: tab === 'favorites', limit: 40 }).then(setPassages)
  const loadSchedule = () => void api('bible:schedule').then(setSchedule).catch(toast.error)
  useEffect(loadPassages, [tab])
  useEffect(loadSchedule, [])
  useEffect(() => {
    if (tid) void api('bible:structure', tid).then(setStructure)
  }, [tid])
  useEffect(() => {
    if (tid) void api('bible:chapter', { translationId: tid, book, chapter }).then(setVerses)
  }, [tid, book, chapter])

  const ref: BibleReference | null = sel && tid ? { translationId: tid, book, chapter, verseStart: Math.min(...sel), verseEnd: Math.max(...sel) } : null
  const title = ref ? formatReference(ref.book, ref.chapter, ref.verseStart, ref.verseEnd) : ''
  const abbrev = translations.find((t) => t.id === tid)?.abbreviation

  /** Build slides locally for a passage within the open chapter. */
  function slidesFor(r: BibleReference, versesPerSlide: number, from: BibleVerse[] = verses, translationAbbrev = abbrev): RenderSlide[] {
    const vs = from.filter((v) => v.verse >= r.verseStart && v.verse <= r.verseEnd)
    const t = formatReference(r.book, r.chapter, r.verseStart, r.verseEnd)
    const item = { ...quickItem({ type: 'bible', title: t, data: { bible: { ...r, versesPerSlide } } }), id: 'bible-preview', serviceId: '', position: 0, createdAt: '', updatedAt: '' }
    return buildSlides(item, { service: null, themes: themeMap(themes), settings, church, verses: vs, translationAbbrev })
  }

  const slides = useMemo(
    () => (ref ? slidesFor(ref, per) : []),
    [ref?.verseStart, ref?.verseEnd, book, chapter, verses, per, themes, settings, church, abbrev] // eslint-disable-line react-hooks/exhaustive-deps
  )

  function goTo(r: { book: number; chapter: number; verseStart?: number | null; verseEnd?: number | null }) {
    setBook(r.book)
    setChapter(r.chapter)
    setSel(r.verseStart ? [r.verseStart, r.verseEnd ?? r.verseStart] : null)
    setResults(null)
  }

  // Opened from ⌘K search: jump to the chosen passage, in the version it was found in
  const viewParam = useApp((s) => s.viewParam)
  useEffect(() => {
    let r: BibleReference | null = null
    try {
      r = viewParam ? (JSON.parse(viewParam) as BibleReference) : null
    } catch {
      /* not a passage */
    }
    if (!r?.book || !r.chapter) return
    if (translations.some((t) => t.id === r.translationId)) setTid(r.translationId)
    // A whole chapter ("John 10") just opens the chapter; a verse or range is selected
    const max = structure[r.book]?.[r.chapter - 1]
    const whole = r.verseStart === 1 && !!max && r.verseEnd >= max
    goTo({ book: r.book, chapter: r.chapter, verseStart: whole ? null : r.verseStart, verseEnd: whole ? null : r.verseEnd })
  }, [viewParam]) // eslint-disable-line react-hooks/exhaustive-deps

  const available = useMemo(() => new Set(Object.keys(structure).map(Number)), [structure])

  // Bring the first selected verse into view when jumping to a reference.
  const firstSelected = sel ? Math.min(...sel) : null
  useEffect(() => {
    if (firstSelected === null) return
    requestAnimationFrame(() => document.querySelector(`[data-testid="verse-${firstSelected}"]`)?.scrollIntoView({ block: 'center' }))
  }, [firstSelected, verses])

  // While presenting from this chapter, follow the live verse (e.g. when the operator presses →).
  const liveHere = live.ref && live.ref.translationId === tid && live.ref.book === book && live.ref.chapter === chapter ? live.verses : null
  const liveFirst = liveHere?.[0] ?? null
  useEffect(() => {
    if (liveFirst === null) return
    document.querySelector(`[data-testid="verse-${liveFirst}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [liveFirst])

  /** Navigate as the operator types, like EasyWorship: "John " → John 1, "John 3:16-18" → selects those verses. */
  function followReference(text: string) {
    const bookOnly = /^\s*(.+?)\s+$/.exec(text)
    const p = parseReference(text)
    if (p && structure[p.book]?.[p.chapter - 1]) {
      const max = structure[p.book][p.chapter - 1]
      goTo({ book: p.book, chapter: p.chapter, verseStart: p.verseStart ? Math.min(p.verseStart, max) : null, verseEnd: p.verseEnd ? Math.min(p.verseEnd, max) : null })
    } else if (bookOnly) {
      const b = findBook(bookOnly[1])
      if (b && structure[b]) goTo({ book: b, chapter: 1 })
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (q.trim().length < 2) return
    setResults(await api('bible:search', { query: q, translationId: tid }))
  }

  const itemFor = (r: BibleReference, versesPerSlide: number, label = formatReference(r.book, r.chapter, r.verseStart, r.verseEnd)) =>
    quickItem({ type: 'bible', title: label, data: { bible: { ...r, versesPerSlide } } })

  /** Present a passage without leaving the Bible page. */
  async function presentPassage(r: BibleReference, versesPerSlide: number, startIndex = 0) {
    await useLive.getState().presentQuick(itemFor(r, versesPerSlide), { startIndex, stay: true })
  }

  /**
   * Present a single clicked verse. The whole chapter goes live starting at
   * that verse, so → / Space continue to the following verses.
   */
  async function presentVerse(v: number) {
    const max = structure[book]?.[chapter - 1] ?? verses.length
    const chapterRef: BibleReference = { translationId: tid, book, chapter, verseStart: 1, verseEnd: max }
    const chapterSlides = slidesFor(chapterRef, per)
    const index = Math.max(0, chapterSlides.findIndex((s) => {
      const r = slideVerses(s)
      return !!r && v >= r[0] && v <= r[1]
    }))
    await useLive.getState().presentQuick(itemFor(chapterRef, per, `${bookName(book)} ${chapter}`), { startIndex: index, stay: true })
    void api('bible:record', { translationId: tid, book, chapter, verseStart: v, verseEnd: v }).then(loadPassages)
  }

  /**
   * Switch version in one click. If a verse from this chapter is on screen
   * (and the page drives the screen), the same verse goes live in the new version.
   */
  async function switchVersion(id: string) {
    if (id === tid) return
    setTid(id)
    try {
      localStorage.setItem(VERSION_PREF, id)
    } catch {
      /* storage unavailable */
    }
    if (!presentOnClick || !live.quick || !live.ref || !liveHere) return
    const newVerses = await api('bible:chapter', { translationId: id, book, chapter })
    if (!newVerses.length) return toast.warning(`${translations.find((t) => t.id === id)?.abbreviation} doesn't have ${bookName(book)} ${chapter}`)
    const max = Math.max(...newVerses.map((v) => v.verse))
    const r = { ...live.ref, translationId: id, verseEnd: Math.min(live.ref.verseEnd, max) }
    const newAbbrev = translations.find((t) => t.id === id)?.abbreviation
    const at = liveHere[0]
    const index = Math.max(0, slidesFor(r, r.versesPerSlide, newVerses, newAbbrev).findIndex((s) => {
      const sv = slideVerses(s)
      return !!sv && at >= sv[0] && at <= sv[1]
    }))
    const title = useLive.getState().quickItem?.title
    await useLive.getState().presentQuick(itemFor(r, r.versesPerSlide, title), { startIndex: index, stay: true })
  }

  // ⌥1–⌥9 pick a version from anywhere on the Bible page
  const switchRef = useRef(switchVersion)
  switchRef.current = switchVersion
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = versionShortcutIndex(e)
      const t = i === null ? undefined : useApp.getState().translations[i]
      if (!t || document.querySelector('[data-modal]')) return
      e.preventDefault()
      void switchRef.current(t.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function onVerseClick(e: React.MouseEvent, v: number) {
    const range: [number, number] = e.shiftKey && sel ? [sel[0], v] : [v, v]
    setSel(range)
    if (!presentOnClick) return
    if (e.shiftKey && sel) {
      const r = { translationId: tid, book, chapter, verseStart: Math.min(...range), verseEnd: Math.max(...range) }
      void presentPassage(r, per)
      void api('bible:record', r).then(loadPassages)
    } else void presentVerse(v)
  }

  async function add() {
    if (!ref) return
    await addToCurrentService({ type: 'bible', title, data: { bible: { ...ref, versesPerSlide: per } } })
    await api('bible:record', ref)
    loadPassages()
  }
  async function present() {
    if (!ref) return
    await api('bible:record', ref)
    loadPassages()
    await presentPassage(ref, per)
  }
  async function addToSchedule() {
    if (!ref) return
    try {
      await api('bible:scheduleAdd', { ref, versesPerSlide: per })
      loadSchedule()
      setTab('schedule')
      toast.success(`${title} added to the scripture schedule`)
    } catch (e) {
      toast.error(e)
    }
  }
  async function favorite() {
    if (!ref) return
    const p = await api('bible:record', ref)
    const on = await api('bible:toggleFavorite', p.id)
    toast.success(on ? `${title} added to favourites` : `${title} removed from favourites`)
    loadPassages()
  }

  function presentScheduled(p: ScheduledPassage) {
    setTid(p.translationId)
    goTo({ book: p.book, chapter: p.chapter, verseStart: p.verseStart, verseEnd: p.verseEnd })
    void presentPassage(p, p.versesPerSlide)
  }

  if (!translations.length) {
    return (
      <EmptyState icon={BookOpen} title="No Bible installed" action={<Button icon={Library} onClick={() => useApp.getState().navigate('settings', 'bibles')}>Manage Bibles…</Button>}>
        Install a free version on the Bibles page, or import a Bible file your church is licensed to use.
      </EmptyState>
    )
  }

  const chapters = structure[book]?.length ?? 0
  const aspect = settings.presentation.aspectRatio

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_180px_minmax(0,1fr)_320px]">
      <aside className="flex min-h-0 flex-col border-r border-line bg-panel">
        <div className="flex flex-col gap-2 border-b border-line p-3">
          <div className="flex items-center gap-2">
            <h1 className="flex-1 text-[15px] font-semibold">Bible</h1>
            <Button size="sm" icon={Library} onClick={() => useApp.getState().navigate('settings', 'bibles')} tip="Install, import or remove Bible versions">
              Versions
            </Button>
          </div>
          <VersionPicker translations={translations} value={tid} onChange={(id) => void switchVersion(id)} shortcuts />
          <ScriptureInput
            value={refText}
            onChange={(v) => {
              setRefText(v)
              followReference(v)
            }}
            onSubmit={(v) => {
              followReference(v)
              // Return opens it; with "Present on click" it also goes live.
              const p = parseReference(v)
              if (presentOnClick && p && structure[p.book]?.[p.chapter - 1]) {
                const max = structure[p.book][p.chapter - 1]
                const r = { translationId: tid, book: p.book, chapter: p.chapter, verseStart: Math.min(p.verseStart ?? 1, max), verseEnd: Math.min(p.verseEnd ?? max, max) }
                void presentPassage(r, per)
                void api('bible:record', r).then(loadPassages)
              }
            }}
            available={available}
            structure={structure}
            placeholder="Book (type jo…)"
          />
          <form onSubmit={search} className="relative">
            <Search size={14} className="absolute top-2 left-2.5 text-dim" />
            <Input className="pl-8" placeholder="Search words, e.g. shepherd" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Bible search" />
          </form>
        </div>
        <div className="flex gap-1 p-2">
          <Segmented
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'schedule', label: <span className="flex items-center gap-1"><CalendarPlus size={11} /> Schedule{schedule.length ? ` (${schedule.length})` : ''}</span> },
              { value: 'recent', label: <span className="flex items-center gap-1"><History size={11} /> Recent</span> },
              { value: 'favorites', label: <span className="flex items-center gap-1"><Star size={11} /> Favourites</span> }
            ]}
          />
        </div>
        {tab === 'schedule' ? (
          <ScheduleList
            items={schedule}
            canAdd={!!ref}
            addLabel={title}
            liveRef={live.ref}
            onAdd={() => void addToSchedule()}
            onPresent={presentScheduled}
            onChanged={loadSchedule}
          />
        ) : (
          <ul className="min-h-0 flex-1 overflow-auto px-1 pb-2">
            {passages.map((p) => (
              <li key={p.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setTid(p.translationId)
                    goTo({ book: p.book, chapter: p.chapter, verseStart: p.verseStart, verseEnd: p.verseEnd })
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-panel-3"
                >
                  {p.favorite && <Star size={11} className="fill-star text-star" />}
                  <span className="truncate">{p.label}</span>
                </button>
                <button type="button" onClick={() => void presentPassage(p, per)} className="mr-1 rounded p-1 text-muted opacity-0 group-hover:opacity-100 hover:bg-live hover:text-white" aria-label={`Present ${p.label}`} data-tip="Present">
                  <Play size={12} />
                </button>
              </li>
            ))}
            {passages.length === 0 && <li className="p-3 text-[12px] text-dim">{tab === 'recent' ? 'Passages you use appear here.' : 'Star a passage to keep it here.'}</li>}
          </ul>
        )}
        <div className="border-t border-line p-2 text-[10px] leading-snug text-dim">{translations.find((t) => t.id === tid)?.license}</div>
      </aside>

      <nav className="min-h-0 overflow-auto border-r border-line p-1" aria-label="Books">
        {(['OT', 'NT'] as const).map((t) => (
          <div key={t}>
            <div className="px-2 pt-2 pb-1 text-[10px] font-bold tracking-wider text-dim uppercase">{t === 'OT' ? 'Old Testament' : 'New Testament'}</div>
            {BIBLE_BOOKS.filter((b) => b.testament === t && structure[b.number]).map((b) => (
              <button
                key={b.number}
                type="button"
                onClick={() => goTo({ book: b.number, chapter: 1 })}
                className={cx('block w-full rounded px-2 py-1 text-left text-[13px]', book === b.number ? 'bg-accent/20 text-fg' : 'text-muted hover:bg-panel-3 hover:text-fg')}
              >
                {b.name}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <main className="flex min-h-0 flex-col">
        <div className="flex flex-wrap gap-1 border-b border-line p-2">
          <span className="mr-2 self-center text-[13px] font-semibold">{bookName(book)}</span>
          {Array.from({ length: chapters }, (_, i) => i + 1).map((c) => (
            <button key={c} type="button" onClick={() => goTo({ book, chapter: c })} className={cx('h-7 min-w-7 rounded px-1.5 text-[12px] tabular-nums', c === chapter ? 'bg-accent text-white' : 'bg-panel-3 text-muted hover:text-fg')}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 border-b border-line px-3 py-1.5">
          <Toggle
            checked={presentOnClick}
            onChange={(v) => {
              setPresentOnClick(v)
              try {
                localStorage.setItem('fc.bible.presentOnClick', v ? '1' : '0')
              } catch {
                /* ignore */
              }
            }}
            label="Present on click"
          />
          <span className="min-w-0 truncate text-[11px] text-dim">
            {presentOnClick ? 'Click a verse to put it on screen · → for the next verse · Shift-click for a range' : 'Click to select · Shift-click for a range · use Present now'}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {results ? (
            <>
              <div className="mb-2 flex items-center gap-2 text-[12px] text-muted">
                {results.length} result{results.length === 1 ? '' : 's'} for “{q}”
                <Button size="sm" variant="ghost" onClick={() => setResults(null)}>Close</Button>
              </div>
              {results.map((v) => (
                <button key={`${v.book}-${v.chapter}-${v.verse}`} type="button" onClick={() => goTo({ book: v.book, chapter: v.chapter, verseStart: v.verse })} className="mb-1 block w-full rounded-md p-2 text-left hover:bg-panel-2">
                  <div className="text-[12px] font-semibold text-accent">{bookName(v.book)} {v.chapter}:{v.verse}</div>
                  <div className="text-[13px] text-muted">{v.text}</div>
                </button>
              ))}
            </>
          ) : (
            verses.map((v) => {
              const inSel = sel && v.verse >= Math.min(...sel) && v.verse <= Math.max(...sel)
              const isLive = !!liveHere && v.verse >= liveHere[0] && v.verse <= liveHere[1]
              return (
                <button
                  key={v.verse}
                  type="button"
                  data-testid={`verse-${v.verse}`}
                  data-live={isLive || undefined}
                  onClick={(e) => onVerseClick(e, v.verse)}
                  className={cx(
                    'relative mb-0.5 flex w-full gap-2 rounded-md border-l-4 px-2 py-1.5 text-left text-[14px] leading-relaxed',
                    isLive ? 'border-live bg-live/15' : inSel ? 'border-transparent bg-accent/20' : 'border-transparent hover:bg-panel-2'
                  )}
                >
                  <sup className={cx('mt-1.5 w-6 shrink-0 text-right text-[10px] font-bold', isLive ? 'text-live' : 'text-accent')}>{v.verse}</sup>
                  <span className="flex-1">{v.text}</span>
                  {isLive && <Badge tone="live" className="mt-1 h-fit">Live</Badge>}
                </button>
              )
            })
          )}
        </div>
      </main>

      <aside className="flex min-h-0 flex-col gap-3 overflow-auto border-l border-line bg-panel p-3">
        <LiveMini />
        {ref ? (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-[15px] font-semibold">{title} <span className="text-[12px] text-muted">{abbrev}</span></div>
              <button type="button" onClick={() => void favorite()} className="text-muted hover:text-star" aria-label="Toggle favourite" data-tip="Favourite">
                <Star size={16} />
              </button>
            </div>
            <Field label="Verses per slide">
              <Segmented size="sm" value={String(per)} onChange={(v) => setPer(Number(v))} options={[{ value: '0', label: 'Auto' }, { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Button icon={CalendarPlus} onClick={() => void addToSchedule()}>Add to schedule</Button>
              <Button icon={ListPlus} onClick={() => void add()}>Add to service</Button>
              <Button variant="live" icon={MonitorPlay} onClick={() => void present()} className="col-span-2">Present {title}</Button>
            </div>
            <div className="text-[11px] font-bold tracking-wider text-muted uppercase">{slides.length} slide{slides.length === 1 ? '' : 's'}</div>
            {slides.map((s) => (
              <SlidePreview key={s.key} slide={s} aspect={aspect} className="rounded border border-line" />
            ))}
          </>
        ) : (
          <EmptyState icon={BookOpen} title="No verses selected">Click a verse to present it, or select verses to add them to the schedule or the service.</EmptyState>
        )}
      </aside>
    </div>
  )
}
