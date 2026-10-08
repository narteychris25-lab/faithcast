import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, RotateCcw, Shapes, X } from 'lucide-react'
import type { ItemInput } from '@shared/ipc'
import type { ItemMediaSettings, ServiceItem, ServiceWithItems } from '@shared/types'
import { DEFAULT_MEDIA_SETTINGS } from '@shared/defaults'
import { parseReference, formatReference } from '@shared/bible-books'
import { sectionAbbrev } from '@shared/lyrics'
import { cx } from '@/lib/format'
import { ITEM_META } from '@/lib/items'
import { api } from '@/lib/api'
import { useApp } from '@/stores/app'
import { useContent, useSlides } from '@/stores/content'
import { useService } from '@/stores/service'
import { useLive } from '@/stores/live'
import { SlidePreview } from '@/components/slide/SlideCanvas'
import { BackgroundOverride, MediaField, Section, ThemeSelect, TransitionEditor } from '@/components/editors'
import { ScriptureInput } from '@/components/ScriptureInput'
import { Button, Field, Input, Segmented, Select, Slider, Textarea, Toggle } from '@/components/ui/controls'

let liveRefresh: ReturnType<typeof setTimeout> | undefined
function refreshIfLive(id: string) {
  if (useLive.getState().itemId !== id) return
  clearTimeout(liveRefresh)
  liveRefresh = setTimeout(() => void useLive.getState().refreshLive(), 500)
}

/** Text input that keeps local state while typing and saves debounced. */
function DebouncedInput({ value, onCommit, multiline, rows, placeholder, disabled }: { value: string; onCommit: (v: string) => void; multiline?: boolean; rows?: number; placeholder?: string; disabled?: boolean }) {
  const [v, setV] = useState(value)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setV(value)
  }, [value])
  const common = {
    value: v,
    placeholder,
    disabled,
    onFocus: () => (focused.current = true),
    onBlur: () => (focused.current = false),
    onChange: (e: { target: { value: string } }) => {
      setV(e.target.value)
      onCommit(e.target.value)
    }
  }
  return multiline ? <Textarea rows={rows ?? 5} {...common} /> : <Input {...common} />
}

export function ItemProperties({ onEditSlides }: { onEditSlides: (item: ServiceItem) => void }) {
  const service = useService((s) => s.service)
  const selectedId = useService((s) => s.selectedItemId)
  const item = service?.items.find((i) => i.id === selectedId) ?? null
  if (!service) return null
  if (!item) return <ServiceSettings service={service} />
  return <ItemPanel key={item.id} item={item} service={service} onEditSlides={onEditSlides} />
}

function ItemPanel({ item, service, onEditSlides }: { item: ServiceItem; service: ServiceWithItems; onEditSlides: (item: ServiceItem) => void }) {
  const aspect = useApp((s) => s.settings.presentation.aspectRatio)
  const slides = useSlides(item, service)
  const [idx, setIdx] = useState(0)
  const locked = item.locked
  const M = ITEM_META[item.type]
  const update = (patch: Partial<ItemInput>, debounce = false) => {
    useService.getState().updateItem(item.id, patch, debounce)
    refreshIfLive(item.id)
  }
  const updateData = (patch: Partial<ServiceItem['data']>, debounce = false) => update({ data: { ...item.data, ...patch } }, debounce)
  const slide = slides[Math.min(idx, slides.length - 1)] ?? null

  return (
    <div className="flex min-h-0 flex-col overflow-auto">
      <div className="border-b border-line p-3">
        <div className="mb-2 flex items-center gap-2">
          <M.icon size={15} className={M.color} />
          <span className="text-[11px] font-bold tracking-wider text-muted uppercase">{M.label}</span>
          <span className="flex-1" />
          <span className="text-[11px] text-dim">{slides.length} slide{slides.length === 1 ? '' : 's'}</span>
        </div>
        {item.type !== 'audio' && item.type !== 'header' && <SlidePreview slide={slide} aspect={aspect} className="rounded-md border border-line" />}
        {slides.length > 1 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {slides.map((s, i) => (
              <button key={s.key} type="button" onClick={() => setIdx(i)} className={cx('shrink-0 rounded border-2', i === idx ? 'border-accent' : 'border-transparent')} data-tip={s.label}>
                <SlidePreview slide={s} aspect={aspect} width={84} />
              </button>
            ))}
          </div>
        )}
        {locked && <div className="mt-2 rounded bg-warn/15 px-2 py-1 text-[12px] text-warn">Locked — unlock to edit.</div>}
      </div>

      <Section title="General">
        <Field label="Title">
          <DebouncedInput value={item.title} disabled={locked} onCommit={(v) => update({ title: v }, true)} />
        </Field>
        <Field label="Operator notes" hint="Only visible to the operator">
          <DebouncedInput multiline rows={2} value={item.notes} disabled={locked} onCommit={(v) => update({ notes: v }, true)} />
        </Field>
      </Section>

      {!locked && <ContentSection item={item} update={update} updateData={updateData} onEditSlides={onEditSlides} />}

      {!locked && item.type !== 'header' && item.type !== 'audio' && (
        <>
          <Section title="Theme" defaultOpen={false}>
            <ThemeSelect value={item.themeId} onChange={(v) => update({ themeId: v })} inheritLabel="Use service theme" />
          </Section>
          <Section title="Background" defaultOpen={false}>
            <BackgroundOverride value={item.background} onChange={(v) => update({ background: v })} inheritLabel="Use theme / service background" />
          </Section>
          <Section title="Transition" defaultOpen={false}>
            <Toggle checked={!item.transition} onChange={(v) => update({ transition: v ? null : { type: 'fade', duration: 400 } })} label="Use theme transition" />
            {item.transition && <TransitionEditor value={item.transition} onChange={(v) => update({ transition: v })} />}
          </Section>
        </>
      )}
    </div>
  )
}

type Updaters = {
  item: ServiceItem
  update: (patch: Partial<ItemInput>, debounce?: boolean) => void
  updateData: (patch: Partial<ServiceItem['data']>, debounce?: boolean) => void
  onEditSlides: (item: ServiceItem) => void
}

function ContentSection({ item, update, updateData, onEditSlides }: Updaters) {
  switch (item.type) {
    case 'song':
      return <SongContent item={item} updateData={updateData} update={update} onEditSlides={onEditSlides} />
    case 'bible':
      return <BibleContent item={item} update={update} updateData={updateData} onEditSlides={onEditSlides} />
    case 'image':
    case 'video':
    case 'audio':
      return <MediaContent item={item} update={update} updateData={updateData} onEditSlides={onEditSlides} />
    case 'announcement': {
      const a = item.data.announcement ?? { title: '', description: '', date: '', time: '', location: '', imageMediaId: null }
      const set = (p: Partial<typeof a>, debounce = true) => updateData({ announcement: { ...a, ...p } }, debounce)
      return (
        <Section title="Announcement">
          <Field label="Title">
            <DebouncedInput value={a.title} onCommit={(v) => set({ title: v })} />
          </Field>
          <Field label="Description">
            <DebouncedInput multiline rows={3} value={a.description} onCommit={(v) => set({ description: v })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date">
              <DebouncedInput value={a.date} placeholder="Friday" onCommit={(v) => set({ date: v })} />
            </Field>
            <Field label="Time">
              <DebouncedInput value={a.time} placeholder="6:00 PM" onCommit={(v) => set({ time: v })} />
            </Field>
          </div>
          <Field label="Location">
            <DebouncedInput value={a.location} onCommit={(v) => set({ location: v })} />
          </Field>
          <MediaField label="Image (used as background)" type="image" mediaId={a.imageMediaId} onChange={(id) => set({ imageMediaId: id }, false)} />
        </Section>
      )
    }
    case 'custom':
      return (
        <Section title="Slides">
          <Button variant="primary" icon={Shapes} onClick={() => onEditSlides(item)}>
            Open slide editor
          </Button>
        </Section>
      )
    case 'header':
      return null
    case 'web': {
      const w = item.data.web ?? { url: '', title: item.title }
      return (
        <Section title="Web page">
          <Field label="Address" hint="YouTube links play full-screen on the projector">
            <DebouncedInput value={w.url} placeholder="https://…" onCommit={(v) => /^https?:\/\//i.test(v.trim()) && updateData({ web: { ...w, url: v.trim() } }, true)} />
          </Field>
          <Field label="Name">
            <DebouncedInput value={w.title} onCommit={(v) => updateData({ web: { ...w, title: v } }, true)} />
          </Field>
          <p className="text-[11px] text-dim">Needs an internet connection during the service.</p>
        </Section>
      )
    }
    default:
      return (
        <Section title="Slide text">
          <Field label="Text" hint="Leave a blank line between paragraphs to start a new slide.">
            <DebouncedInput multiline rows={8} value={item.data.body ?? ''} onCommit={(v) => updateData({ body: v }, true)} />
          </Field>
        </Section>
      )
  }
}

function SongContent({ item, updateData, update }: Updaters) {
  const song = useContent((s) => (item.refId ? s.songs[item.refId] : undefined))
  const navigate = useApp((s) => s.navigate)
  if (!item.refId || song === null) return <Section title="Song"><div className="text-[12px] text-danger">This song is no longer in the library.</div></Section>
  if (!song) return null
  const byId = new Map(song.sections.map((s) => [s.id, s]))
  const custom = item.data.arrangement && item.data.arrangement.length > 0
  const order = (custom ? item.data.arrangement! : song.arrangement.length ? song.arrangement : song.sections.map((s) => s.id)).filter((id) => byId.has(id))
  const setOrder = (ids: string[]) => updateData({ arrangement: ids })
  return (
    <Section title="Song">
      <div>
        <div className="text-[13px] font-medium">{song.title}</div>
        <div className="text-[11px] text-dim">{song.author}</div>
      </div>
      <Button icon={Pencil} onClick={() => navigate('songs', song.id)}>
        Edit song lyrics
      </Button>
      <Field label={custom ? 'Arrangement (this service only)' : 'Arrangement'}>
        <div className="flex flex-wrap gap-1">
          {order.map((id, i) => (
            <span key={`${id}-${i}`} className="inline-flex items-center gap-1 rounded bg-panel-3 py-0.5 pr-1 pl-1.5 text-[11px]" data-tip={byId.get(id)?.label}>
              {sectionAbbrev(byId.get(id)!.label)}
              <button type="button" onClick={() => setOrder(order.filter((_, k) => k !== i))} className="text-dim hover:text-danger" aria-label="Remove">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      </Field>
      <div className="flex gap-2">
        <Select
          value=""
          onChange={(e) => {
            if (e.target.value) setOrder([...order, e.target.value])
          }}
        >
          <option value="">Add section…</option>
          {song.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        {custom && <Button icon={RotateCcw} tip="Reset to the song's arrangement" onClick={() => update({ data: { ...item.data, arrangement: [] } })} />}
      </div>
    </Section>
  )
}

function BibleContent({ item, updateData, update }: Updaters) {
  const translations = useApp((s) => s.translations)
  const b = item.data.bible
  const [text, setText] = useState(b ? formatReference(b.book, b.chapter, b.verseStart, b.verseEnd) : '')
  const [error, setError] = useState('')
  const [structure, setStructure] = useState<Record<number, number[]>>({})
  const translationId = b?.translationId
  useEffect(() => {
    if (translationId) void api('bible:structure', translationId).then(setStructure)
  }, [translationId])
  if (!b) return null
  async function apply(v: string) {
    const p = parseReference(v)
    if (!p || !b) return setError('Reference not recognised')
    const structure = await api('bible:structure', b.translationId)
    const max = structure[p.book]?.[p.chapter - 1]
    if (!max) return setError('Chapter not found in this translation')
    const vs = Math.min(p.verseStart ?? 1, max)
    const ve = Math.min(p.verseEnd ?? max, max)
    setError('')
    const ref = { ...b, book: p.book, chapter: p.chapter, verseStart: vs, verseEnd: ve }
    update({ title: formatReference(p.book, p.chapter, vs, ve), data: { ...item.data, bible: ref } })
    void api('bible:record', ref)
  }
  return (
    <Section title="Passage">
      <Field label="Reference">
        <ScriptureInput
          value={text}
          onChange={setText}
          onSubmit={(v) => void apply(v)}
          onBlur={() => void apply(text)}
          structure={structure}
          available={new Set(Object.keys(structure).map(Number))}
        />
        {error && <span className="text-[11px] text-danger">{error}</span>}
      </Field>
      <Field label="Translation">
        <Select value={b.translationId} onChange={(e) => updateData({ bible: { ...b, translationId: e.target.value } })}>
          {translations.map((t) => (
            <option key={t.id} value={t.id}>
              {t.abbreviation} — {t.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Verses per slide">
        <Segmented
          size="sm"
          value={String(b.versesPerSlide)}
          onChange={(v) => updateData({ bible: { ...b, versesPerSlide: Number(v) } })}
          options={[{ value: '0', label: 'Auto' }, { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]}
        />
      </Field>
    </Section>
  )
}

function MediaContent({ item, updateData }: Updaters) {
  const m: ItemMediaSettings = useMemo(() => ({ ...DEFAULT_MEDIA_SETTINGS, ...item.data.media }), [item.data.media])
  const set = (p: Partial<ItemMediaSettings>) => updateData({ media: { ...m, ...p } })
  const type = item.type as 'image' | 'video' | 'audio'
  return (
    <Section title={ITEM_META[type].label}>
      <MediaField label="File" type={type} mediaId={item.data.mediaId ?? null} onChange={(id) => id && updateData({ mediaId: id })} />
      {type !== 'audio' && (
        <Field label="Fit">
          <Segmented size="sm" value={m.fit} onChange={(v) => set({ fit: v })} options={[{ value: 'contain', label: 'Contain' }, { value: 'cover', label: 'Cover' }, { value: 'stretch', label: 'Stretch' }]} />
        </Field>
      )}
      {type !== 'image' && (
        <>
          <div className="flex flex-wrap gap-4">
            <Toggle checked={m.autoPlay} onChange={(v) => set({ autoPlay: v })} label="Auto-play" />
            <Toggle checked={m.loop} onChange={(v) => set({ loop: v })} label="Loop" />
            <Toggle checked={m.muted} onChange={(v) => set({ muted: v })} label="Mute" />
          </div>
          <Field label="Volume">
            <Slider value={m.volume} onChange={(v) => set({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
          </Field>
        </>
      )}
      {type === 'audio' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Fade in">
            <Slider value={m.fadeIn} min={0} max={10} step={0.5} onChange={(v) => set({ fadeIn: v })} format={(v) => `${v}s`} />
          </Field>
          <Field label="Fade out">
            <Slider value={m.fadeOut} min={0} max={10} step={0.5} onChange={(v) => set({ fadeOut: v })} format={(v) => `${v}s`} />
          </Field>
        </div>
      )}
    </Section>
  )
}

function ServiceSettings({ service }: { service: ServiceWithItems }) {
  const upd = useService((s) => s.updateService)
  return (
    <div className="flex min-h-0 flex-col overflow-auto">
      <div className="border-b border-line p-3 text-[12px] text-muted">No item selected. These settings apply to the whole service.</div>
      <Section title="Service">
        <Field label="Name">
          <DebouncedInput value={service.name} onCommit={(v) => upd({ name: v }, true)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">
            <Input type="date" value={service.date} onChange={(e) => e.target.value && upd({ date: e.target.value })} />
          </Field>
          <Field label="Time">
            <Input type="time" value={service.time} onChange={(e) => upd({ time: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes">
          <DebouncedInput multiline rows={3} value={service.notes} onCommit={(v) => upd({ notes: v }, true)} />
        </Field>
      </Section>
      <Section title="Service theme">
        <ThemeSelect value={service.themeId} onChange={(v) => upd({ themeId: v })} inheritLabel="Use default theme" />
      </Section>
      <Section title="Service background" defaultOpen={false}>
        <BackgroundOverride value={service.background} onChange={(v) => upd({ background: v })} inheritLabel="Use theme background" />
      </Section>
      <div className="p-3">
        <Button icon={Plus} onClick={() => useService.getState().select(service.items[0]?.id ?? null)} disabled={!service.items.length}>
          Select first item
        </Button>
      </div>
    </div>
  )
}
