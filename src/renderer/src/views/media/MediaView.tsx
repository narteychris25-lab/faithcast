import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Film, FolderSearch, Image as ImageIcon, Link2, ListPlus, MonitorPlay, Music2, Pencil, RefreshCw, Search, Star, Tag, Trash2, Upload } from 'lucide-react'
import type { MediaItem, MediaType } from '@shared/types'
import { DEFAULT_MEDIA_SETTINGS } from '@shared/defaults'
import { api, mediaUrl, thumbUrl } from '@/lib/api'
import { bytes, cx, duration } from '@/lib/format'
import { mediaItemInput } from '@/lib/items'
import { useContent } from '@/stores/content'
import { useLive } from '@/stores/live'
import { Badge, Button, EmptyState, Input, Segmented, Select } from '@/components/ui/controls'
import { Modal, confirmDialog, openContextMenu, promptDialog, toast, type MenuEntry } from '@/components/ui/overlays'
import { addToCurrentService, quickItem } from '@/views/songs/SongsView'

type Filter = 'all' | MediaType | 'favorites'
const PAGE = 240
const ICONS = { image: ImageIcon, video: Film, audio: Music2 }

/**
 * Fill in duration/dimensions (and a thumbnail if QuickLook couldn't make one)
 * by loading media metadata in the browser engine. Also detects files that
 * cannot be played on this Mac.
 */
async function probe(m: MediaItem): Promise<void> {
  if (m.missing) return
  if (m.type === 'image' && m.width) return
  if (m.type !== 'image' && m.duration && (m.type === 'audio' || m.hasThumbnail)) return
  await new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(t)
      resolve()
    }
    const t = setTimeout(done, 8000)
    if (m.type === 'image') {
      const img = new Image()
      img.onload = () => {
        void api('media:setMeta', { id: m.id, width: img.naturalWidth, height: img.naturalHeight })
        done()
      }
      img.onerror = done
      img.src = mediaUrl(m.id)
      return
    }
    const el = document.createElement(m.type === 'video' ? 'video' : 'audio')
    el.preload = 'metadata'
    el.muted = true
    el.crossOrigin = 'anonymous'
    const capture = () => {
      const v = el as HTMLVideoElement
      if (!v.videoWidth) return done()
      const c = document.createElement('canvas')
      c.width = 480
      c.height = Math.round((480 * v.videoHeight) / Math.max(1, v.videoWidth))
      try {
        c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height)
        void api('media:saveThumbnail', { id: m.id, dataUrl: c.toDataURL('image/jpeg', 0.8) }).finally(done)
      } catch {
        done()
      }
    }
    el.onloadedmetadata = () => {
      const v = el as HTMLVideoElement
      void api('media:setMeta', { id: m.id, duration: isFinite(el.duration) ? el.duration : null, width: v.videoWidth || null, height: v.videoHeight || null })
      if (m.type !== 'video' || m.hasThumbnail) done()
    }
    // Seek a little way in for a representative frame when the file is seekable;
    // otherwise (e.g. streamed WebM without an index) use the first frame.
    el.onloadeddata = () => {
      if (m.type !== 'video' || m.hasThumbnail) return
      if (isFinite(el.duration) && el.duration > 2) el.currentTime = Math.min(1, el.duration / 3)
      else {
        // Not seekable: play briefly so we don't capture a blank first frame.
        el.ontimeupdate = () => {
          if (el.currentTime < 0.5) return
          el.ontimeupdate = null
          el.pause()
          capture()
        }
        void el.play().catch(() => capture())
      }
    }
    el.onseeked = capture
    el.onerror = () => {
      toast.warning(`“${m.name}” can't be played on this Mac (unsupported format). Convert it to MP4 (H.264) to use it.`)
      done()
    }
    el.src = mediaUrl(m.id)
  })
}

export function MediaView() {
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [folder, setFolder] = useState('')
  const [folders, setFolders] = useState<string[]>([])
  const [items, setItems] = useState<MediaItem[]>([])
  const [limit, setLimit] = useState(PAGE)
  const [preview, setPreview] = useState<MediaItem | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const version = useContent((s) => s.mediaVersion)
  const probed = useRef(new Set<string>())

  const reload = () =>
    void api('media:list', {
      type: filter === 'all' || filter === 'favorites' ? undefined : filter,
      favorites: filter === 'favorites' || undefined,
      search: q || undefined,
      folder: folder || undefined
    })
      .then(setItems)
      .catch(toast.error)

  useEffect(() => {
    const t = setTimeout(reload, 120)
    return () => clearTimeout(t)
  }, [filter, q, folder, version]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => void api('media:folders').then(setFolders), [version])

  // Probe metadata for visible items, one at a time (keeps CPU low).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      let changed = false
      for (const m of items.slice(0, limit)) {
        if (cancelled) return
        if (probed.current.has(m.id)) continue
        probed.current.add(m.id)
        const before = m.duration ?? m.width
        await probe(m)
        if (before === null || (!m.hasThumbnail && m.type === 'video')) changed = true
      }
      if (changed && !cancelled) reload()
    })()
    return () => {
      cancelled = true
    }
  }, [items, limit]) // eslint-disable-line react-hooks/exhaustive-deps

  async function importPaths(paths: string[] | null) {
    const r = await api('media:import', { paths, folder: folder || undefined })
    if (r.imported) toast.success(`Imported ${r.imported} file${r.imported === 1 ? '' : 's'}`)
    if (r.skipped && !r.imported) toast.info(`${r.skipped} file(s) were already in the library or not supported`)
    if (r.errors.length) toast.warning(r.errors.slice(0, 4).join('\n'))
    useContent.getState().invalidateMedia()
  }

  async function remove(m: MediaItem) {
    const ok = await confirmDialog({ title: `Remove “${m.name}” from the library?`, message: 'The file on your disk is not deleted. Service items using it will show “Media file unavailable”.', danger: true, confirmLabel: 'Remove' })
    if (!ok) return
    await api('media:delete', m.id)
    useContent.getState().invalidateMedia()
  }

  function present(m: MediaItem) {
    if (m.type === 'audio') return toast.info('Add audio to a service, then play it from the Live view.')
    void useLive.getState().presentQuick(quickItem({ type: m.type, title: m.name, data: { mediaId: m.id, media: { ...DEFAULT_MEDIA_SETTINGS, fit: m.type === 'image' ? 'cover' : 'contain' } } }))
  }

  function menu(m: MediaItem): MenuEntry[] {
    return [
      { label: 'Preview', icon: Search, onSelect: () => setPreview(m) },
      { label: 'Add to current service', icon: ListPlus, onSelect: () => void addToCurrentService(mediaItemInput(m)) },
      { label: 'Present now', icon: MonitorPlay, disabled: m.type === 'audio', onSelect: () => present(m) },
      'separator',
      { label: m.favorite ? 'Remove from favourites' : 'Add to favourites', icon: Star, onSelect: () => void api('media:toggleFavorite', m.id).then(reload) },
      {
        label: 'Rename…',
        icon: Pencil,
        onSelect: async () => {
          const name = await promptDialog({ title: 'Rename media', defaultValue: m.name })
          if (name) await api('media:update', { id: m.id, patch: { name } })
        }
      },
      {
        label: 'Edit tags…',
        icon: Tag,
        onSelect: async () => {
          const t = await promptDialog({ title: 'Tags', message: 'Comma separated, e.g. worship, christmas, loop', defaultValue: m.tags.join(', ') })
          if (t !== null) await api('media:update', { id: m.id, patch: { tags: t.split(',').map((x) => x.trim()).filter(Boolean) } })
        }
      },
      {
        label: 'Move to folder…',
        icon: FolderSearch,
        onSelect: async () => {
          const f = await promptDialog({ title: 'Folder', message: 'Organise media into named folders. Leave empty for none.', defaultValue: m.folder })
          if (f !== null) await api('media:update', { id: m.id, patch: { folder: f } })
        }
      },
      { label: m.missing ? 'Locate missing file…' : 'Replace file…', icon: Link2, onSelect: () => void api('media:relink', { id: m.id, path: null }).then((r) => r && toast.success('File relinked')).catch(toast.error) },
      { label: 'Show in Finder', icon: FolderSearch, disabled: m.missing, onSelect: () => void api('app:showInFolder', m.path) },
      'separator',
      { label: 'Remove from library', icon: Trash2, danger: true, onSelect: () => void remove(m) }
    ]
  }

  const missingCount = items.filter((m) => m.missing).length

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDragOver(true)
        }
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const paths = [...e.dataTransfer.files].map((f) => window.wf.pathForFile(f)).filter(Boolean)
        if (paths.length) void importPaths(paths)
      }}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
        <h1 className="mr-2 text-[15px] font-semibold">Media</h1>
        <Segmented
          value={filter}
          onChange={(f) => {
            setFilter(f)
            setLimit(PAGE)
          }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'image', label: 'Images' },
            { value: 'video', label: 'Videos' },
            { value: 'audio', label: 'Audio' },
            { value: 'favorites', label: '★ Favourites' }
          ]}
        />
        <div className="relative w-64">
          <Search size={14} className="absolute top-2 left-2.5 text-dim" />
          <Input className="pl-8" placeholder="Search names and tags" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {folders.length > 0 && (
          <Select className="w-40" value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">All folders</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        )}
        <span className="flex-1" />
        <Button
          icon={RefreshCw}
          onClick={async () => {
            const r = await api('media:checkMissing')
            toast.info(r.missing.length ? `${r.missing.length} of ${r.checked} files are missing` : `All ${r.checked} files are available`)
          }}
          tip="Check for moved or deleted files"
        >
          Check files
        </Button>
        <Button variant="primary" icon={Upload} onClick={() => void importPaths(null)}>
          Import
        </Button>
      </header>
      {missingCount > 0 && (
        <div className="flex items-center gap-2 border-b border-line bg-warn/10 px-4 py-1.5 text-[12px] text-warn">
          <AlertTriangle size={14} /> {missingCount} media file{missingCount === 1 ? ' is' : 's are'} unavailable (moved or deleted). Right-click → “Locate missing file…” to fix.
        </div>
      )}
      <div className={cx('relative min-h-0 flex-1 overflow-auto p-4', dragOver && 'bg-accent/10 outline-2 -outline-offset-8 outline-accent outline-dashed')}>
        {items.length === 0 ? (
          <EmptyState icon={ImageIcon} title={q ? 'No matching media' : 'Your media library is empty'} action={<Button variant="primary" icon={Upload} onClick={() => void importPaths(null)}>Import media</Button>}>
            Import images, videos and audio, or drag files and folders from Finder onto this window. Files stay where they are on your Mac.
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {items.slice(0, limit).map((m) => {
                const Icon = ICONS[m.type]
                return (
                  <div
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    onDoubleClick={() => setPreview(m)}
                    onKeyDown={(e) => e.key === 'Enter' && setPreview(m)}
                    onContextMenu={(e) => openContextMenu(e, menu(m))}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('application/x-worshipflow-item', JSON.stringify(mediaItemInput(m)))}
                    className="group cursor-default overflow-hidden rounded-lg border border-line bg-panel [content-visibility:auto] hover:border-accent"
                  >
                    <div className="relative aspect-video bg-black">
                      {m.hasThumbnail ? <img src={thumbUrl(m.id, m.updatedAt)} className="h-full w-full object-cover" alt="" loading="lazy" draggable={false} /> : <Icon size={30} className="absolute inset-0 m-auto text-dim" />}
                      <span className="absolute top-1.5 left-1.5 rounded bg-black/60 p-1 text-white"><Icon size={11} /></span>
                      <button type="button" onClick={() => void api('media:toggleFavorite', m.id).then(reload)} className={cx('absolute top-1 right-1 rounded p-1', m.favorite ? 'text-star' : 'text-white/70 opacity-0 group-hover:opacity-100')} aria-label="Favourite">
                        <Star size={14} className={m.favorite ? 'fill-star' : ''} />
                      </button>
                      {m.duration ? <span className="absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1 font-mono text-[10px] text-white">{duration(m.duration)}</span> : null}
                      {m.missing && <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-[11px] font-semibold text-danger">Media file unavailable</div>}
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="flex items-center gap-1 text-[12px] font-medium"><span className="truncate">{m.name}</span>{m.demo && <Badge tone="demo" className="shrink-0">Demo</Badge>}</div>
                      <div className="truncate text-[10px] text-dim">{[m.width && m.height ? `${m.width}×${m.height}` : null, bytes(m.size), m.tags.join(', ')].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            {items.length > limit && (
              <div className="mt-4 text-center">
                <Button onClick={() => setLimit(limit + PAGE)}>Show more ({items.length - limit} remaining)</Button>
              </div>
            )}
          </>
        )}
      </div>
      <footer className="border-t border-line px-4 py-1.5 text-[11px] text-dim">{items.length} item{items.length === 1 ? '' : 's'} · drag files from Finder to import · right-click for options</footer>
      {preview && <MediaPreview item={preview} onClose={() => setPreview(null)} onPresent={present} />}
    </div>
  )
}

function MediaPreview({ item, onClose, onPresent }: { item: MediaItem; onClose: () => void; onPresent: (m: MediaItem) => void }) {
  const [failed, setFailed] = useState(false)
  return (
    <Modal
      open
      onClose={onClose}
      title={item.name}
      width={900}
      footer={
        <>
          <Button icon={ListPlus} onClick={() => void addToCurrentService(mediaItemInput(item))}>Add to service</Button>
          {item.type !== 'audio' && <Button variant="live" icon={MonitorPlay} onClick={() => { onClose(); onPresent(item) }}>Present now</Button>}
        </>
      }
    >
      <div className="flex items-center justify-center rounded-lg bg-black">
        {item.missing || failed ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-danger"><AlertTriangle />Media file unavailable</div>
        ) : item.type === 'image' ? (
          <img src={mediaUrl(item.id)} className="max-h-[60vh] max-w-full object-contain" alt="" onError={() => setFailed(true)} />
        ) : item.type === 'video' ? (
          <video src={mediaUrl(item.id)} className="max-h-[60vh] max-w-full" controls autoPlay onError={() => setFailed(true)} />
        ) : (
          <audio src={mediaUrl(item.id)} controls autoPlay className="m-8 w-full" onError={() => setFailed(true)} />
        )}
      </div>
      <div className="mt-2 truncate text-[11px] text-dim">{item.path}</div>
    </Modal>
  )
}
