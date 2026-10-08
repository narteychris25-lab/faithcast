import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ListPlus, MonitorPlay, RotateCcw, Trash2, X } from 'lucide-react'
import type { Song, SongSection } from '@shared/types'
import { parseLyrics, sectionAbbrev, serializeLyrics } from '@shared/lyrics'
import { buildSlides } from '@shared/slides'
import { api } from '@/lib/api'
import { themeMap, useApp } from '@/stores/app'
import { useContent } from '@/stores/content'
import { liveItem, useLive } from '@/stores/live'
import { Button, Field, Input, Select, Spinner, Textarea } from '@/components/ui/controls'
import { toast } from '@/components/ui/overlays'
import { ThemeSelect } from '@/components/editors'
import { SlidePreview } from '@/components/slide/SlideCanvas'
import { addToCurrentService, quickItem } from './SongsView'

interface Draft {
  title: string
  author: string
  copyright: string
  ccli: string
  category: string
  tags: string
  lyrics: string
  /** Arrangement as section labels (stable while lyrics are re-parsed). */
  arrangement: string[]
  themeId: string | null
}

function toDraft(s: Song): Draft {
  const byId = new Map(s.sections.map((x) => [x.id, x.label]))
  return {
    title: s.title,
    author: s.author,
    copyright: s.copyright,
    ccli: s.ccli,
    category: s.category,
    tags: s.tags.join(', '),
    lyrics: serializeLyrics(s.sections),
    arrangement: s.arrangement.map((id) => byId.get(id)).filter((l): l is string => !!l),
    themeId: s.themeId
  }
}

/** Re-parse lyrics, keeping section ids stable by label so arrangements survive edits. */
function sectionsFrom(lyrics: string, prev: SongSection[]): SongSection[] {
  const ids = new Map(prev.map((s) => [s.label.toLowerCase(), s.id]))
  return parseLyrics(lyrics).map((s) => ({ ...s, id: ids.get(s.label.toLowerCase()) ?? s.id }))
}

export function SongEditor({ songId, onChanged, onDelete }: { songId: string; onChanged: () => void; onDelete: () => void }) {
  const [song, setSong] = useState<Song | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [status, setStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [usage, setUsage] = useState<{ serviceName: string; date: string }[]>([])
  const sectionsRef = useRef<SongSection[]>([])
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const themes = useApp((s) => s.themes)
  const settings = useApp((s) => s.settings)
  const church = useApp((s) => s.church)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const s = await api('songs:get', songId)
      if (cancelled || !s) return
      // Offer an unsaved draft left over from a crash.
      const recovered = (await api('drafts:get', `song:${songId}`)) as Draft | null
      sectionsRef.current = s.sections
      setSong(s)
      if (recovered) {
        setDraft(recovered)
        setStatus('unsaved')
        toast.info('Recovered unsaved changes to this song.')
      } else setDraft(toDraft(s))
      setUsage(await api('songs:usage', songId))
    })()
    return () => {
      cancelled = true
    }
  }, [songId])

  // Flush pending save on unmount.
  const draftRef = useRef(draft)
  draftRef.current = draft
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        if (draftRef.current) void save(draftRef.current)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  async function save(d: Draft) {
    timer.current = undefined
    setStatus('saving')
    const sections = sectionsFrom(d.lyrics, sectionsRef.current)
    sectionsRef.current = sections
    const byLabel = new Map(sections.map((s) => [s.label.toLowerCase(), s.id]))
    try {
      const saved = await api('songs:save', {
        id: songId,
        title: d.title,
        author: d.author,
        copyright: d.copyright,
        ccli: d.ccli,
        category: d.category,
        tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean),
        sections,
        arrangement: d.arrangement.map((l) => byLabel.get(l.toLowerCase())).filter((x): x is string => !!x),
        themeId: d.themeId
      })
      useContent.getState().setSong(saved)
      void api('drafts:delete', `song:${songId}`)
      void api('app:setUnsaved', false)
      setStatus('saved')
      onChanged()
      // Keep the projector accurate if this song is live.
      const li = liveItem()
      if (li?.type === 'song' && li.refId === songId) void useLive.getState().refreshLive()
    } catch (e) {
      toast.error(e)
      setStatus('unsaved')
    }
  }

  function change(patch: Partial<Draft>) {
    if (!draft) return
    const next = { ...draft, ...patch }
    setDraft(next)
    setStatus('unsaved')
    void api('app:setUnsaved', true)
    void api('drafts:save', { key: `song:${songId}`, label: `Song: ${next.title}`, data: next })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(next), 700)
  }

  const sections = useMemo(() => (draft ? sectionsFrom(draft.lyrics, sectionsRef.current) : []), [draft])
  const labels = useMemo(() => [...new Set(sections.map((s) => s.label))], [sections])

  const previewSlides = useMemo(() => {
    if (!draft || !song) return []
    const byLabel = new Map(sections.map((s) => [s.label.toLowerCase(), s.id]))
    const temp: Song = {
      ...song,
      title: draft.title,
      author: draft.author,
      copyright: draft.copyright,
      ccli: draft.ccli,
      sections,
      arrangement: draft.arrangement.map((l) => byLabel.get(l.toLowerCase())).filter((x): x is string => !!x),
      themeId: draft.themeId
    }
    const item = { ...quickItem({ type: 'song', title: temp.title, refId: temp.id }), id: 'preview', serviceId: '', position: 0, createdAt: '', updatedAt: '' }
    return buildSlides(item, { service: null, themes: themeMap(themes), settings, church, song: temp })
  }, [draft, song, sections, themes, settings, church])

  function insertTag(tag: string) {
    const el = textRef.current
    if (!el || !draft) return
    const n = sections.filter((s) => s.label.startsWith(tag)).length + 1
    const label = tag === 'Verse' ? `${tag} ${n}` : tag
    const pos = el.selectionStart
    const before = draft.lyrics.slice(0, pos)
    const insert = `${before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''}[${label}]\n`
    change({ lyrics: before + insert + draft.lyrics.slice(pos) })
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = pos + insert.length
    })
  }

  if (!song || !draft) return <div className="flex h-full items-center justify-center"><Spinner /></div>
  const aspect = settings.presentation.aspectRatio
  const order = draft.arrangement.length ? draft.arrangement : labels

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(260px,34%)]">
      <div className="flex min-h-0 flex-col overflow-auto">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <Input className="h-9 flex-1 text-[15px] font-semibold" value={draft.title} onChange={(e) => change({ title: e.target.value })} aria-label="Song title" />
          <span className="w-28 text-right text-[12px] text-muted" data-testid="song-save-status">
            {status === 'saved' ? '✓ Saved' : status === 'saving' ? 'Saving…' : '● Unsaved changes'}
          </span>
          <Button icon={ListPlus} onClick={() => void addToCurrentService({ type: 'song', title: draft.title, refId: songId })}>
            Add to service
          </Button>
          <Button icon={MonitorPlay} onClick={() => void useLive.getState().presentQuick(quickItem({ type: 'song', title: draft.title, refId: songId }))}>
            Present
          </Button>
          <Button icon={Trash2} variant="ghost" onClick={onDelete} tip="Delete song" />
        </div>
        <div className="grid grid-cols-2 gap-3 border-b border-line p-4">
          <Field label="Author">
            <Input value={draft.author} onChange={(e) => change({ author: e.target.value })} />
          </Field>
          <Field label="Copyright">
            <Input value={draft.copyright} onChange={(e) => change({ copyright: e.target.value })} placeholder="e.g. Public domain" />
          </Field>
          <Field label="CCLI song number">
            <Input value={draft.ccli} onChange={(e) => change({ ccli: e.target.value })} />
          </Field>
          <Field label="Category">
            <Input value={draft.category} onChange={(e) => change({ category: e.target.value })} placeholder="e.g. Hymns, Worship, Christmas" />
          </Field>
          <Field label="Tags" hint="Comma separated">
            <Input value={draft.tags} onChange={(e) => change({ tags: e.target.value })} />
          </Field>
          <Field label="Theme">
            <ThemeSelect value={draft.themeId} onChange={(v) => change({ themeId: v })} inheritLabel="Use service theme" />
          </Field>
        </div>
        <div className="flex min-h-[380px] flex-1 flex-col p-4">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Lyrics</span>
            {['Verse', 'Chorus', 'Pre-Chorus', 'Bridge', 'Tag', 'Ending'].map((t) => (
              <Button key={t} size="sm" variant="ghost" onClick={() => insertTag(t)}>
                + {t}
              </Button>
            ))}
          </div>
          <Textarea
            ref={textRef}
            className="min-h-0 flex-1 resize-none font-mono text-[13px]"
            value={draft.lyrics}
            spellCheck
            onChange={(e) => change({ lyrics: e.target.value })}
            aria-label="Lyrics"
            placeholder={'[Verse 1]\nFirst line\nSecond line\n\n[Chorus]\n…'}
          />
          <p className="mt-2 text-[11px] text-dim">
            Put section names in brackets, e.g. [Verse 1], [Chorus]. A blank line inside a section starts a new slide. Long sections split automatically at {settings.songs.maxLinesPerSlide} lines.
          </p>
        </div>
        <div className="border-t border-line p-4">
          <Field label="Arrangement (order sections are shown)">
            <div className="flex flex-wrap items-center gap-1">
              {order.map((l, i) => (
                <span key={`${l}-${i}`} className="inline-flex items-center gap-0.5 rounded bg-panel-3 py-0.5 pr-0.5 pl-1.5 text-[12px]">
                  <button type="button" disabled={i === 0} onClick={() => { const a = [...order]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; change({ arrangement: a }) }} className="text-dim hover:text-fg disabled:opacity-30" aria-label="Move left">
                    <ChevronLeft size={12} />
                  </button>
                  <span data-tip={l}>{sectionAbbrev(l)}</span>
                  <button type="button" disabled={i === order.length - 1} onClick={() => { const a = [...order]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; change({ arrangement: a }) }} className="text-dim hover:text-fg disabled:opacity-30" aria-label="Move right">
                    <ChevronRight size={12} />
                  </button>
                  <button type="button" onClick={() => change({ arrangement: order.filter((_, k) => k !== i) })} className="text-dim hover:text-danger" aria-label="Remove">
                    <X size={12} />
                  </button>
                </span>
              ))}
              <Select className="w-40" value="" onChange={(e) => e.target.value && change({ arrangement: [...order, e.target.value] })}>
                <option value="">Add section…</option>
                {labels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
              {draft.arrangement.length > 0 && <Button size="sm" icon={RotateCcw} variant="ghost" onClick={() => change({ arrangement: [] })}>Natural order</Button>}
            </div>
          </Field>
          {usage.length > 0 && <div className="mt-3 text-[11px] text-dim">Used in: {usage.slice(0, 5).map((u) => `${u.serviceName} (${u.date})`).join(', ')}{usage.length > 5 ? '…' : ''}</div>}
        </div>
      </div>
      <aside className="min-h-0 overflow-auto border-l border-line bg-panel p-3">
        <div className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Slides preview ({previewSlides.length})</div>
        <div className="flex flex-col gap-2">
          {previewSlides.map((s, i) => (
            <div key={`${s.key}-${i}`}>
              <div className="mb-0.5 text-[11px] text-dim">{i + 1}. {s.label}</div>
              <SlidePreview slide={s} aspect={aspect} className="rounded border border-line" />
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
