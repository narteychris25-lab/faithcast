import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Upload, Star } from 'lucide-react'
import type { ItemInput } from '@shared/ipc'
import type { MediaItem, MediaType, ServiceItemType, SongSummary } from '@shared/types'
import { parseReference, formatReference } from '@shared/bible-books'
import { api, thumbUrl } from '@/lib/api'
import { cx, duration } from '@/lib/format'
import { blankItem, DRAG_MIME, ITEM_META, mediaItemInput } from '@/lib/items'
import { useApp } from '@/stores/app'
import { ScriptureInput } from '@/components/ScriptureInput'
import { useContent } from '@/stores/content'
import { Badge, Button, Input, Select } from '@/components/ui/controls'
import { VersionPicker } from '@/components/VersionPicker'
import { toast } from '@/components/ui/overlays'

type Picker = 'song' | 'bible' | 'image' | 'video' | 'audio'
const PICKERS: Picker[] = ['song', 'bible', 'image', 'video', 'audio']
const DIRECT: ServiceItemType[] = ['announcement', 'custom', 'sermon', 'offering', 'prayer', 'header', 'other']

function dragStart(e: React.DragEvent, item: ItemInput) {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(item))
  e.dataTransfer.effectAllowed = 'copy'
}

/** Left sidebar: add content to the service by click or drag-and-drop. */
export function Library({ onAdd }: { onAdd: (items: ItemInput[]) => void }) {
  const [picker, setPicker] = useState<Picker>('song')
  return (
    <div className="flex min-h-0 flex-col">
      <div className="grid grid-cols-3 gap-1 border-b border-line p-2">
        {PICKERS.map((p) => {
          const M = ITEM_META[p]
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPicker(p)}
              className={cx('flex h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px]', picker === p ? 'bg-accent/20 text-fg' : 'text-muted hover:bg-panel-3 hover:text-fg')}
            >
              <M.icon size={16} className={M.color} />
              {M.label}
            </button>
          )
        })}
        {DIRECT.map((t) => {
          const M = ITEM_META[t]
          return (
            <button
              key={t}
              type="button"
              draggable
              onDragStart={(e) => dragStart(e, blankItem(t))}
              onClick={() => onAdd([blankItem(t)])}
              data-tip={`Add ${M.label.toLowerCase()} (or drag into the service)`}
              className="flex h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] text-muted hover:bg-panel-3 hover:text-fg"
            >
              <M.icon size={16} className={M.color} />
              {M.label === 'Custom Slides' ? 'Slides' : M.label}
            </button>
          )
        })}
      </div>
      <div className="min-h-0 flex-1">
        {picker === 'song' && <SongPicker onAdd={onAdd} />}
        {picker === 'bible' && <BiblePicker onAdd={onAdd} />}
        {(picker === 'image' || picker === 'video' || picker === 'audio') && <MediaList type={picker} onAdd={onAdd} />}
      </div>
    </div>
  )
}

function SongPicker({ onAdd }: { onAdd: (items: ItemInput[]) => void }) {
  const [q, setQ] = useState('')
  const [songs, setSongs] = useState<SongSummary[]>([])
  useEffect(() => {
    const t = setTimeout(() => void api('songs:list', { search: q || undefined, limit: 300 }).then(setSongs).catch(toast.error), 120)
    return () => clearTimeout(t)
  }, [q])
  const toItem = (s: SongSummary): ItemInput => ({ type: 'song', title: s.title, refId: s.id })
  return (
    <div className="flex h-full flex-col">
      <div className="relative p-2">
        <Search size={14} className="absolute top-4 left-4 text-dim" />
        <Input className="pl-8" placeholder="Search songs, lyrics, authors" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="min-h-0 flex-1 overflow-auto px-1 pb-2">
        {songs.map((s) => (
          <li
            key={s.id}
            draggable
            onDragStart={(e) => dragStart(e, toItem(s))}
            onDoubleClick={() => onAdd([toItem(s)])}
            className="group flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 hover:bg-panel-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-[13px]">
                {s.title} {s.demo && <Badge tone="demo">Demo</Badge>}
              </div>
              <div className="truncate text-[11px] text-dim">{s.author || s.firstLine}</div>
            </div>
            <button type="button" onClick={() => onAdd([toItem(s)])} className="rounded p-1 text-muted opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-white" aria-label={`Add ${s.title}`}>
              <Plus size={14} />
            </button>
          </li>
        ))}
        {songs.length === 0 && <li className="p-4 text-center text-[12px] text-dim">{q ? 'No matching songs' : 'No songs yet — add them in Songs.'}</li>}
      </ul>
    </div>
  )
}

function BiblePicker({ onAdd }: { onAdd: (items: ItemInput[]) => void }) {
  const translations = useApp((s) => s.translations)
  const settings = useApp((s) => s.settings)
  const [tid, setTid] = useState(settings.bible.defaultTranslationId ?? translations[0]?.id ?? '')
  const [text, setText] = useState('')
  const [per, setPer] = useState(settings.bible.versesPerSlide)
  const [structure, setStructure] = useState<Record<number, number[]>>({})
  const [preview, setPreview] = useState<string>('')
  useEffect(() => {
    if (tid) void api('bible:structure', tid).then(setStructure)
  }, [tid])
  const available = useMemo(() => new Set(Object.keys(structure).map(Number)), [structure])

  const ref = useMemo(() => {
    const p = parseReference(text)
    if (!p || !tid) return null
    const max = structure[p.book]?.[p.chapter - 1]
    if (!max) return null
    const vs = Math.min(p.verseStart ?? 1, max)
    const ve = Math.min(p.verseEnd ?? max, max)
    return { translationId: tid, book: p.book, chapter: p.chapter, verseStart: vs, verseEnd: ve }
  }, [text, tid, structure])

  useEffect(() => {
    if (!ref) return setPreview('')
    void api('bible:passage', ref).then((v) => setPreview(v.map((x) => `${x.verse} ${x.text}`).join(' ')))
  }, [ref])

  const item = (): ItemInput | null =>
    ref ? { type: 'bible', title: formatReference(ref.book, ref.chapter, ref.verseStart, ref.verseEnd), data: { bible: { ...ref, versesPerSlide: per } } } : null

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <VersionPicker translations={translations} value={tid} onChange={setTid} />
      <ScriptureInput
        autoFocus
        value={text}
        onChange={setText}
        available={available}
        structure={structure}
        placeholder="Book (type jo…)"
        onSubmit={() => {
          const it = item()
          if (it) {
            onAdd([it])
            void api('bible:record', ref!)
            setText('')
          }
        }}
      />
      <div className="flex items-center gap-2 text-[12px] text-muted">
        Verses per slide
        <Select className="w-20" value={per} onChange={(e) => setPer(Number(e.target.value))}>
          <option value={0}>Auto</option>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>
      {ref ? (
        <div
          draggable
          onDragStart={(e) => dragStart(e, item()!)}
          className="min-h-0 flex-1 cursor-grab overflow-auto rounded-md border border-line bg-panel-2 p-2 text-[12px] leading-relaxed"
        >
          <div className="mb-1 font-semibold text-fg">{formatReference(ref.book, ref.chapter, ref.verseStart, ref.verseEnd)}</div>
          <div className="text-muted">{preview}</div>
        </div>
      ) : (
        <div className="flex-1 text-[12px] text-dim">{text ? 'Reference not found' : 'Type a reference, or use the Bible page to browse.'}</div>
      )}
      <Button
        variant="primary"
        icon={Plus}
        disabled={!ref}
        onClick={() => {
          const it = item()
          if (it) {
            onAdd([it])
            void api('bible:record', ref!)
          }
        }}
      >
        Add passage
      </Button>
    </div>
  )
}

function MediaList({ type, onAdd }: { type: MediaType; onAdd: (items: ItemInput[]) => void }) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [q, setQ] = useState('')
  const version = useContent((s) => s.mediaVersion)
  useEffect(() => {
    void api('media:list', { type, search: q || undefined }).then(setItems).catch(toast.error)
  }, [type, q, version])
  async function importFiles() {
    const r = await api('media:import', { paths: null })
    if (r.errors.length) toast.warning(r.errors.join('\n'))
    useContent.getState().invalidateMedia()
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 p-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute top-2 left-2.5 text-dim" />
          <Input className="pl-8" placeholder={`Search ${type}s`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button icon={Upload} onClick={importFiles} tip="Import files" />
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-auto px-2 pb-2">
        {items.map((m) => (
          <button
            key={m.id}
            type="button"
            draggable
            onDragStart={(e) => dragStart(e, mediaItemInput(m))}
            onDoubleClick={() => onAdd([mediaItemInput(m)])}
            className="group overflow-hidden rounded-md border border-line bg-panel-2 text-left hover:border-accent"
            data-tip="Double-click or drag to add"
          >
            <div className="relative aspect-video bg-black">
              {m.hasThumbnail && <img src={thumbUrl(m.id, m.updatedAt)} className="h-full w-full object-cover" alt="" loading="lazy" />}
              {m.favorite && <Star size={11} className="absolute top-1 right-1 fill-star text-star" />}
              {m.missing && <span className="absolute inset-x-0 bottom-0 bg-danger/90 px-1 text-[9px] text-white">Unavailable</span>}
            </div>
            <div className="flex items-center gap-1 px-1.5 py-1">
              <span className="flex-1 truncate text-[11px]">{m.name}</span>
              {m.duration ? <span className="text-[10px] text-dim">{duration(m.duration)}</span> : null}
            </div>
          </button>
        ))}
        {items.length === 0 && <div className="col-span-2 p-4 text-center text-[12px] text-dim">No {type}s yet. Import files or drag them from Finder into the service.</div>}
      </div>
    </div>
  )
}
