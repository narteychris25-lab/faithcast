import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, FolderOpen, Image as ImageIcon, Pencil, Settings2, Trash2, Upload, Wand2 } from 'lucide-react'
import type { MediaItem, RenderSlide, Theme, ThemeSettings } from '@shared/types'
import { DEFAULT_BACKGROUND } from '@shared/defaults'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'
import { useApp } from '@/stores/app'
import { useLive } from '@/stores/live'
import { useContent } from '@/stores/content'
import { Badge, Button } from '@/components/ui/controls'
import { Modal, confirmDialog, promptDialog, toast } from '@/components/ui/overlays'
import { MediaPicker } from '@/components/editors'
import { SlidePreview } from '@/components/slide/SlideCanvas'

function sample(theme: ThemeSettings): RenderSlide {
  return { key: 'bg-sample', kind: 'text', label: '', group: '', text: 'Amazing grace! How sweet the sound', subtext: '', title: '', theme, background: theme.background, media: null, elements: [], logoMediaId: null }
}

/** Switch the projection background; slides that are live update straight away. */
async function choose(id: string | null) {
  await useApp.getState().saveSettings({ presentation: { backgroundThemeId: id } })
  if (useLive.getState().itemId) await useLive.getState().refreshLive()
}

/** A new theme that looks like the default theme but sits on this picture or video. */
async function themeFromMedia(m: MediaItem): Promise<Theme> {
  const { themes, settings } = useApp.getState()
  const base = (themes.find((t) => t.id === settings.defaultThemeId) ?? themes[0]).settings
  return api('themes:create', {
    name: m.name,
    settings: {
      ...base,
      background: { ...DEFAULT_BACKGROUND, kind: m.type === 'video' ? 'video' : 'image', mediaId: m.id, fit: 'cover', dim: 0.35 }
    }
  })
}

/**
 * Top-bar button that changes the projection background at any time.
 * The chosen theme wins over song, service and item themes until it is turned off.
 */
export function BackgroundSwitcher() {
  const themes = useApp((s) => s.themes)
  const activeId = useApp((s) => s.settings.presentation.backgroundThemeId)
  const active = themes.find((t) => t.id === activeId) ?? null
  const [open, setOpen] = useState(false)
  const [managing, setManaging] = useState(false)
  const button = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tip={open ? undefined : 'Change the projection background'}
        className={cx(
          'no-drag flex h-7 max-w-48 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[12px]',
          active ? 'border-accent/50 bg-accent/15 text-fg' : 'border-line text-muted hover:bg-panel-3 hover:text-fg'
        )}
      >
        <ImageIcon size={13} className={active ? 'text-accent' : ''} />
        <span className="truncate">{active ? active.name : 'Background'}</span>
        <ChevronDown size={12} className="shrink-0" />
      </button>
      {open && (
        <Dropdown
          anchor={button.current}
          onClose={() => setOpen(false)}
          onManage={() => {
            setOpen(false)
            setManaging(true)
          }}
        />
      )}
      <ManageBackgrounds open={managing} onClose={() => setManaging(false)} />
    </>
  )
}

function Dropdown({ anchor, onClose, onManage }: { anchor: HTMLElement | null; onClose: () => void; onManage: () => void }) {
  const themes = useApp((s) => s.themes)
  const aspect = useApp((s) => s.settings.presentation.aspectRatio)
  const activeId = useApp((s) => s.settings.presentation.backgroundThemeId)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  useLayoutEffect(() => {
    if (!anchor) return
    const r = anchor.getBoundingClientRect()
    const zoom = Number(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1
    const width = 384
    setPos({ left: Math.max(8, Math.min(r.left / zoom, window.innerWidth / zoom - width - 8)), top: r.bottom / zoom + 6 })
  }, [anchor])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !anchor?.contains(t)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Projection background"
      className="no-drag fixed z-40 flex max-h-[min(520px,calc(100vh-80px))] w-96 flex-col overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl animate-pop"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="flex-1 text-[12px] font-semibold tracking-wide text-muted uppercase">Projection background</span>
        <Button size="sm" icon={Settings2} onClick={onManage}>Manage</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <button
          type="button"
          aria-label="Automatic"
          onClick={() => void choose(null).then(onClose)}
          className={cx('mb-2 flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-[12px]', !activeId ? 'border-accent bg-accent/10' : 'border-line hover:border-line-strong')}
        >
          <Wand2 size={14} className="shrink-0 text-accent" />
          <span className="flex-1">
            <span className="block font-medium">Automatic</span>
            <span className="text-muted">Use each song’s, service’s or item’s own theme</span>
          </span>
          {!activeId && <Check size={14} className="text-accent" />}
        </button>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void choose(t.id).then(onClose)}
              aria-label={t.name}
              aria-pressed={activeId === t.id}
              className={cx('overflow-hidden rounded-md border-2 text-left', activeId === t.id ? 'border-accent' : 'border-transparent hover:border-line-strong')}
            >
              <div className="relative">
                <SlidePreview slide={sample(t.settings)} aspect={aspect} />
                {activeId === t.id && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white">
                    <Check size={11} />
                  </span>
                )}
              </div>
              <div className="truncate bg-panel-2 px-1.5 py-1 text-[11px]">{t.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

function ManageBackgrounds({ open, onClose }: { open: boolean; onClose: () => void }) {
  const themes = useApp((s) => s.themes)
  const aspect = useApp((s) => s.settings.presentation.aspectRatio)
  const activeId = useApp((s) => s.settings.presentation.backgroundThemeId)
  const [picking, setPicking] = useState(false)

  async function addMedia(items: MediaItem[]) {
    const visual = items.filter((m) => m.type === 'image' || m.type === 'video')
    if (!visual.length) return
    for (const m of visual) await themeFromMedia(m)
    await useApp.getState().reloadThemes()
    toast.success(`Added ${visual.length} background${visual.length === 1 ? '' : 's'}`)
  }
  async function importFiles() {
    const r = await api('media:import', { paths: null })
    if (r.errors.length) toast.warning(r.errors.join('\n'))
    useContent.getState().invalidateMedia()
    if (r.ids.length) await addMedia(await api('media:getMany', r.ids))
  }
  async function rename(t: Theme) {
    const name = await promptDialog({ title: 'Rename background', defaultValue: t.name, confirmLabel: 'Rename' })
    if (!name?.trim()) return
    await api('themes:update', { id: t.id, name: name.trim() }).catch(toast.error)
    await useApp.getState().reloadThemes()
  }
  async function remove(t: Theme) {
    if (!(await confirmDialog({ title: `Delete “${t.name}”?`, message: 'The theme is removed. Its picture stays in your media library.', danger: true, confirmLabel: 'Delete' }))) return
    if (activeId === t.id) await choose(null)
    await api('themes:delete', t.id).catch(toast.error)
    await useApp.getState().reloadThemes()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage backgrounds"
      width={760}
      footer={
        <>
          <Button
            className="mr-auto"
            onClick={() => {
              onClose()
              useApp.getState().navigate('themes')
            }}
          >
            Edit text and colours in Themes
          </Button>
          <Button icon={FolderOpen} onClick={() => setPicking(true)}>From media library…</Button>
          <Button variant="primary" icon={Upload} onClick={() => void importFiles()}>Add images or videos…</Button>
        </>
      }
    >
      <p className="mb-3 text-[12px] text-muted">
        Each picture or video you add becomes a theme with your default theme’s text style, so it shows up in the Background menu and on the Themes page.
      </p>
      <div className="grid grid-cols-4 gap-3">
        {themes.map((t) => (
          <div key={t.id} className={cx('overflow-hidden rounded-lg border-2', activeId === t.id ? 'border-accent' : 'border-line')}>
            <button type="button" className="block w-full" aria-label={`Use ${t.name}`} onClick={() => void choose(t.id)} data-tip="Use this background">
              <SlidePreview slide={sample(t.settings)} aspect={aspect} />
            </button>
            <div className="flex items-center gap-1 bg-panel-2 py-1 pr-1 pl-2">
              <span className="min-w-0 flex-1 truncate text-[12px]">{t.name}</span>
              {t.builtin && <Badge>Built-in</Badge>}
              <button type="button" aria-label={`Rename ${t.name}`} data-tip="Rename" onClick={() => void rename(t)} className="rounded p-1 text-muted hover:bg-panel-3 hover:text-fg">
                <Pencil size={12} />
              </button>
              {!t.builtin && (
                <button type="button" aria-label={`Delete ${t.name}`} data-tip="Delete" onClick={() => void remove(t)} className="rounded p-1 text-muted hover:bg-panel-3 hover:text-danger">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <MediaPicker
        open={picking}
        type="image"
        onClose={() => setPicking(false)}
        onPick={(m) => {
          setPicking(false)
          void addMedia([m])
        }}
      />
    </Modal>
  )
}
