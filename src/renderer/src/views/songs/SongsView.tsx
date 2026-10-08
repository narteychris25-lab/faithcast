import { useCallback, useEffect, useState } from 'react'
import { Copy, Download, FileDown, ListPlus, MonitorPlay, Music, Plus, Search, Trash2, Upload } from 'lucide-react'
import type { ItemInput } from '@shared/ipc'
import type { ServiceItem, SongSummary } from '@shared/types'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'
import { useApp } from '@/stores/app'
import { useContent } from '@/stores/content'
import { useLive } from '@/stores/live'
import { useService } from '@/stores/service'
import { Badge, Button, EmptyState, Input, Select, Spinner } from '@/components/ui/controls'
import { confirmDialog, openContextMenu, toast, type MenuEntry } from '@/components/ui/overlays'
import { SongEditor } from './SongEditor'
import { IS_MAC, isMod } from '@/lib/platform'

export function quickItem(partial: Pick<ServiceItem, 'type' | 'title'> & Partial<ServiceItem>) {
  return { refId: null, data: {}, themeId: null, background: null, transition: null, hidden: false, locked: false, notes: '', ...partial }
}

export async function addToCurrentService(item: ItemInput) {
  const serviceId = useApp.getState().currentServiceId
  if (!serviceId) {
    toast.info('Open or create a service first (Dashboard → New service).')
    return
  }
  try {
    await api('items:add', { serviceId, item })
    if (useService.getState().service?.id === serviceId) await useService.getState().refresh()
    toast.success(`Added “${item.title}” to the current service`)
  } catch (e) {
    toast.error(e)
  }
}

export function SongsView() {
  const param = useApp((s) => s.viewParam)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [songs, setSongs] = useState<SongSummary[] | null>(null)
  const [selected, setSelected] = useState<string | null>(param)
  const [multi, setMulti] = useState<Set<string>>(new Set())

  const reload = useCallback(() => {
    void api('songs:list', { search: q || undefined, category: category || undefined }).then(setSongs).catch(toast.error)
    void api('songs:categories').then(setCategories)
  }, [q, category])

  useEffect(() => {
    const t = setTimeout(reload, 120)
    return () => clearTimeout(t)
  }, [reload])
  useEffect(() => {
    if (param) setSelected(param)
  }, [param])

  async function newSong() {
    const song = await api('songs:save', { title: 'New Song', sections: [{ id: crypto.randomUUID(), type: 'verse', label: 'Verse 1', text: '' }] })
    useContent.getState().setSong(song)
    setSelected(song.id)
    reload()
  }

  async function importSongs() {
    const r = await api('songs:import', null)
    if (r.imported) toast.success(`Imported ${r.imported} song${r.imported === 1 ? '' : 's'}`)
    if (r.errors.length) toast.warning(r.errors.slice(0, 4).join('\n'))
    reload()
    if (r.ids[0]) setSelected(r.ids[0])
  }

  async function exportSongs(ids: string[], format: 'song' | 'txt' | 'json' | 'csv') {
    const out = await api('songs:export', { ids, format }).catch((e) => toast.error(e))
    if (out) toast.success(`Exported to ${out}`)
  }

  async function deleteSongs(ids: string[]) {
    const ok = await confirmDialog({
      title: ids.length === 1 ? 'Delete this song?' : `Delete ${ids.length} songs?`,
      message: 'Service items that use these songs will show “Song unavailable”.',
      danger: true,
      confirmLabel: 'Delete'
    })
    if (!ok) return
    for (const id of ids) {
      await api('songs:delete', id)
      useContent.getState().forgetSong(id)
    }
    if (selected && ids.includes(selected)) setSelected(null)
    setMulti(new Set())
    reload()
  }

  function menuFor(s: SongSummary): MenuEntry[] {
    const ids = multi.has(s.id) && multi.size > 1 ? [...multi] : [s.id]
    return [
      { label: 'Add to current service', icon: ListPlus, onSelect: () => void addToCurrentService({ type: 'song', title: s.title, refId: s.id }) },
      { label: 'Present now', icon: MonitorPlay, onSelect: () => void useLive.getState().presentQuick(quickItem({ type: 'song', title: s.title, refId: s.id })) },
      'separator',
      {
        label: 'Duplicate',
        icon: Copy,
        onSelect: async () => {
          const d = await api('songs:duplicate', s.id)
          reload()
          setSelected(d.id)
        }
      },
      { label: `Export ${ids.length > 1 ? `${ids.length} songs ` : ''}as .song…`, icon: FileDown, onSelect: () => void exportSongs(ids, 'song') },
      { label: 'Export as text…', icon: FileDown, onSelect: () => void exportSongs(ids, 'txt') },
      { label: 'Export as JSON…', icon: FileDown, onSelect: () => void exportSongs(ids, 'json') },
      { label: 'Export as CSV…', icon: FileDown, onSelect: () => void exportSongs(ids, 'csv') },
      'separator',
      { label: ids.length > 1 ? `Delete ${ids.length} songs` : 'Delete', icon: Trash2, danger: true, onSelect: () => void deleteSongs(ids) }
    ]
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-r border-line bg-panel">
        <div className="flex items-center gap-2 border-b border-line p-3">
          <h1 className="flex-1 text-[15px] font-semibold">Songs</h1>
          <Button size="sm" icon={Upload} onClick={() => void importSongs()} tip="Import .song, .txt (incl. CCLI SongSelect), .json or OpenLyrics .xml">
            Import
          </Button>
          <Button size="sm" icon={Download} onClick={() => void exportSongs((songs ?? []).map((s) => s.id), 'csv')} tip="Export the list as CSV" disabled={!songs?.length} />
          <Button size="sm" variant="primary" icon={Plus} onClick={() => void newSong()}>
            New
          </Button>
        </div>
        <div className="flex flex-col gap-2 border-b border-line p-2">
          <div className="relative">
            <Search size={14} className="absolute top-2 left-2.5 text-dim" />
            <Input className="pl-8" placeholder="Search title, lyrics, author" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <ul className="min-h-0 flex-1 overflow-auto p-1" aria-label="Songs">
          {songs?.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={(e) => {
                  if (isMod(e)) {
                    const next = new Set(multi)
                    if (next.has(s.id)) next.delete(s.id)
                    else next.add(s.id)
                    setMulti(next)
                  } else {
                    setMulti(new Set([s.id]))
                    setSelected(s.id)
                  }
                }}
                onContextMenu={(e) => openContextMenu(e, menuFor(s))}
                className={cx('w-full rounded-md px-2.5 py-2 text-left', selected === s.id ? 'bg-accent/20' : multi.has(s.id) ? 'bg-panel-3' : 'hover:bg-panel-2')}
              >
                <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                  {s.title} {s.demo && <Badge tone="demo">Demo</Badge>}
                </div>
                <div className="truncate text-[11px] text-dim">{s.author || s.firstLine || '—'}</div>
              </button>
            </li>
          ))}
          {songs === null && (
            <li className="flex justify-center p-6">
              <Spinner />
            </li>
          )}
          {songs?.length === 0 && (
            <li className="p-6 text-center text-[12px] text-dim">{q || category ? 'No songs match.' : 'Your song library is empty. Create a song or import lyrics.'}</li>
          )}
        </ul>
        <div className="border-t border-line px-3 py-1.5 text-[11px] text-dim">
          {songs ? `${songs.length} song${songs.length === 1 ? '' : 's'}` : 'Loading…'}
          {multi.size > 1 && ` · ${multi.size} selected (right-click for actions)`}
        </div>
      </aside>
      <main className="min-h-0">
        {selected ? (
          <SongEditor key={selected} songId={selected} onChanged={reload} onDelete={() => void deleteSongs([selected])} />
        ) : (
          <EmptyState icon={Music} title="Select a song" action={<Button variant="primary" icon={Plus} onClick={() => void newSong()}>New song</Button>}>
            Pick a song on the left to edit its lyrics, or create a new one. {IS_MAC ? '⌘' : 'Ctrl'}-click to select several for export.
          </EmptyState>
        )}
      </main>
    </div>
  )
}
