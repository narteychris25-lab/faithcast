import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlignCenter, AlignLeft, AlignRight, Image as ImageIcon, Film, Music2, Search, Star, Upload, X } from 'lucide-react'
import type { Background, MediaItem, MediaType, TextStyle, Transition } from '@shared/types'
import { DEFAULT_BACKGROUND } from '@shared/defaults'
import { api, thumbUrl } from '@/lib/api'
import { cx, duration } from '@/lib/format'
import { useApp } from '@/stores/app'
import { useContent, useMediaItem } from '@/stores/content'
import { Button, ColorInput, Field, Input, Segmented, Select, Slider, Toggle } from './ui/controls'
import { Modal, toast } from './ui/overlays'
import { IS_MAC } from '@/lib/platform'
import { fontStack } from './slide/FitText'

const MAC_FONTS = [
  'Helvetica Neue',
  'Avenir Next',
  'Avenir',
  'Futura',
  'Gill Sans',
  'Optima',
  'Seravek',
  'Arial',
  'Arial Black',
  'Verdana',
  'Trebuchet MS',
  'Impact',
  'Georgia',
  'Baskerville',
  'Palatino',
  'Times New Roman',
  'Didot',
  'Hoefler Text',
  'Big Caslon',
  'Charter',
  'Iowan Old Style',
  'Rockwell',
  'Copperplate',
  'American Typewriter',
  'Marker Felt',
  'Chalkboard SE',
  'Menlo'
]

/** Fonts that come with Windows 10/11 (plus Office's common ones). */
const WINDOWS_FONTS = [
  'Segoe UI',
  'Segoe UI Semibold',
  'Bahnschrift',
  'Calibri',
  'Candara',
  'Century Gothic',
  'Corbel',
  'Franklin Gothic Medium',
  'Gill Sans MT',
  'Arial',
  'Arial Black',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Impact',
  'Georgia',
  'Cambria',
  'Constantia',
  'Palatino Linotype',
  'Book Antiqua',
  'Times New Roman',
  'Sitka Heading',
  'Gabriola',
  'Rockwell',
  'Ink Free',
  'Comic Sans MS',
  'Consolas'
]

export const FONTS = IS_MAC ? MAC_FONTS : WINDOWS_FONTS

export function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-line">
      <button type="button" onClick={() => setOpen(!open)} className="flex h-9 w-full items-center justify-between px-3 text-[11px] font-bold tracking-wider text-muted uppercase hover:text-fg">
        {title}
        <span className="text-dim">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="flex flex-col gap-3 px-3 pb-4">{children}</div>}
    </div>
  )
}

const Row = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-2 gap-2">{children}</div>

// ------------------------------------------------------------------ text style

export function TextStyleEditor({ value, onChange, compact }: { value: TextStyle; onChange: (v: TextStyle) => void; compact?: boolean }) {
  const set = <K extends keyof TextStyle>(k: K, v: TextStyle[K]) => onChange({ ...value, [k]: v })
  return (
    <>
      <Field label="Font">
        <Select value={FONTS.includes(value.fontFamily) ? value.fontFamily : '__custom'} onChange={(e) => e.target.value !== '__custom' && set('fontFamily', e.target.value)}>
          {FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: fontStack(f) }}>
              {f}
            </option>
          ))}
          {!FONTS.includes(value.fontFamily) && <option value="__custom">{value.fontFamily}</option>}
        </Select>
      </Field>
      <Row>
        <Field label="Size">
          <Input type="number" min={8} max={400} value={value.fontSize} onChange={(e) => set('fontSize', Math.max(8, Math.min(400, Number(e.target.value) || 8)))} />
        </Field>
        <Field label="Weight">
          <Select value={value.fontWeight} onChange={(e) => set('fontWeight', Number(e.target.value))}>
            {[300, 400, 500, 600, 700, 800, 900].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </Field>
      </Row>
      <Field label="Colour">
        <ColorInput value={value.color} onChange={(v) => set('color', v)} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={value.align}
          onChange={(v) => set('align', v)}
          options={[
            { value: 'left', label: <AlignLeft size={13} />, tip: 'Align left' },
            { value: 'center', label: <AlignCenter size={13} />, tip: 'Centre' },
            { value: 'right', label: <AlignRight size={13} />, tip: 'Align right' }
          ]}
        />
        <Segmented
          value={value.vAlign}
          onChange={(v) => set('vAlign', v)}
          options={[
            { value: 'top', label: 'Top' },
            { value: 'middle', label: 'Mid' },
            { value: 'bottom', label: 'Bottom' }
          ]}
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <Toggle checked={value.italic} onChange={(v) => set('italic', v)} label="Italic" />
        <Toggle checked={value.uppercase} onChange={(v) => set('uppercase', v)} label="Uppercase" />
        <Toggle checked={value.autoFit} onChange={(v) => set('autoFit', v)} label="Auto-fit" />
      </div>
      {!compact && (
        <>
          <Field label="Line spacing">
            <Slider value={value.lineHeight} min={0.8} max={2.5} step={0.05} onChange={(v) => set('lineHeight', v)} format={(v) => v.toFixed(2)} />
          </Field>
          <Field label="Letter spacing">
            <Slider value={value.letterSpacing} min={-5} max={20} step={0.5} onChange={(v) => set('letterSpacing', v)} format={(v) => `${v}px`} />
          </Field>
          {value.autoFit && (
            <Field label="Smallest size when fitting">
              <Slider value={value.minFontSize} min={8} max={value.fontSize} step={1} onChange={(v) => set('minFontSize', v)} format={(v) => `${v}px`} />
            </Field>
          )}
          <div className="rounded-md border border-line p-2">
            <Toggle checked={value.shadow.enabled} onChange={(v) => set('shadow', { ...value.shadow, enabled: v })} label="Shadow" />
            {value.shadow.enabled && (
              <div className="mt-2 flex flex-col gap-2">
                <ColorInput value={value.shadow.color} onChange={(v) => set('shadow', { ...value.shadow, color: v })} />
                <Slider value={value.shadow.blur} min={0} max={60} step={1} onChange={(v) => set('shadow', { ...value.shadow, blur: v })} format={(v) => `blur ${v}`} />
                <Slider value={value.shadow.y} min={-20} max={20} step={1} onChange={(v) => set('shadow', { ...value.shadow, y: v })} format={(v) => `y ${v}`} />
              </div>
            )}
          </div>
          <div className="rounded-md border border-line p-2">
            <Toggle checked={value.outline.enabled} onChange={(v) => set('outline', { ...value.outline, enabled: v })} label="Outline" />
            {value.outline.enabled && (
              <div className="mt-2 flex flex-col gap-2">
                <ColorInput value={value.outline.color} onChange={(v) => set('outline', { ...value.outline, color: v })} />
                <Slider value={value.outline.width} min={0} max={12} step={0.5} onChange={(v) => set('outline', { ...value.outline, width: v })} format={(v) => `${v}px`} />
              </div>
            )}
          </div>
          <div className="rounded-md border border-line p-2">
            <Toggle checked={value.box.enabled} onChange={(v) => set('box', { ...value.box, enabled: v })} label="Background box" />
            {value.box.enabled && (
              <div className="mt-2 flex flex-col gap-2">
                <ColorInput value={value.box.color} onChange={(v) => set('box', { ...value.box, color: v })} />
                <Slider value={value.box.opacity} onChange={(v) => set('box', { ...value.box, opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
                <Slider value={value.box.padding} min={0} max={120} step={2} onChange={(v) => set('box', { ...value.box, padding: v })} format={(v) => `pad ${v}`} />
                <Slider value={value.box.radius} min={0} max={80} step={2} onChange={(v) => set('box', { ...value.box, radius: v })} format={(v) => `r ${v}`} />
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------------ background

export function BackgroundEditor({ value, onChange }: { value: Background; onChange: (v: Background) => void }) {
  const [picking, setPicking] = useState(false)
  const set = <K extends keyof Background>(k: K, v: Background[K]) => onChange({ ...value, [k]: v })
  const media = useMediaItem(value.mediaId)
  const isMedia = value.kind === 'image' || value.kind === 'video'
  return (
    <>
      <Segmented
        size="sm"
        value={value.kind}
        onChange={(kind) => {
          onChange({ ...value, kind })
          if ((kind === 'image' || kind === 'video') && (!value.mediaId || media?.type !== kind)) setPicking(true)
        }}
        options={[
          { value: 'none', label: 'None' },
          { value: 'color', label: 'Colour' },
          { value: 'gradient', label: 'Gradient' },
          { value: 'image', label: 'Image' },
          { value: 'video', label: 'Video' }
        ]}
      />
      {value.kind === 'color' && <ColorInput value={value.color} onChange={(v) => set('color', v)} />}
      {value.kind === 'gradient' && (
        <>
          <Row>
            <ColorInput value={value.gradient.from} onChange={(v) => set('gradient', { ...value.gradient, from: v })} />
            <ColorInput value={value.gradient.to} onChange={(v) => set('gradient', { ...value.gradient, to: v })} />
          </Row>
          <Slider value={value.gradient.angle} min={0} max={360} step={5} onChange={(v) => set('gradient', { ...value.gradient, angle: v })} format={(v) => `${v}°`} />
        </>
      )}
      {isMedia && (
        <>
          <button type="button" onClick={() => setPicking(true)} className="flex items-center gap-2 rounded-md border border-line bg-panel-2 p-1.5 text-left hover:border-accent">
            <div className="h-10 w-16 shrink-0 overflow-hidden rounded bg-black">
              {value.mediaId && media?.hasThumbnail && <img src={thumbUrl(value.mediaId)} className="h-full w-full object-cover" alt="" />}
            </div>
            <div className="min-w-0 flex-1 truncate text-[12px]">{media ? media.name : value.mediaId ? 'Media file unavailable' : `Choose ${value.kind}…`}</div>
          </button>
          <Field label="Fit">
            <Segmented size="sm" value={value.fit} onChange={(v) => set('fit', v)} options={[{ value: 'cover', label: 'Cover' }, { value: 'contain', label: 'Contain' }, { value: 'stretch', label: 'Stretch' }]} />
          </Field>
          <Row>
            <Field label="Position X">
              <Slider value={value.posX} min={0} max={100} step={1} onChange={(v) => set('posX', v)} format={(v) => `${v}%`} />
            </Field>
            <Field label="Position Y">
              <Slider value={value.posY} min={0} max={100} step={1} onChange={(v) => set('posY', v)} format={(v) => `${v}%`} />
            </Field>
          </Row>
          <Field label="Blur">
            <Slider value={value.blur} min={0} max={40} step={1} onChange={(v) => set('blur', v)} format={(v) => `${v}px`} />
          </Field>
          <Field label="Opacity">
            <Slider value={value.opacity} onChange={(v) => set('opacity', v)} format={(v) => `${Math.round(v * 100)}%`} />
          </Field>
          {value.kind === 'video' && (
            <div className="flex flex-wrap gap-4">
              <Toggle checked={value.video.loop} onChange={(v) => set('video', { ...value.video, loop: v })} label="Loop" />
              <Toggle checked={value.video.muted} onChange={(v) => set('video', { ...value.video, muted: v })} label="Muted" />
            </div>
          )}
          {value.kind === 'video' && !value.video.muted && (
            <Field label="Volume">
              <Slider value={value.video.volume} onChange={(v) => set('video', { ...value.video, volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
            </Field>
          )}
        </>
      )}
      {value.kind !== 'none' && (
        <>
          <Field label="Darken (readability)">
            <Slider value={value.dim} max={0.9} onChange={(v) => set('dim', v)} format={(v) => `${Math.round(v * 100)}%`} />
          </Field>
          <Field label="Colour overlay">
            <div className="flex flex-col gap-2">
              <ColorInput value={value.overlayColor} onChange={(v) => set('overlayColor', v)} />
              <Slider value={value.overlayOpacity} max={0.9} onChange={(v) => set('overlayOpacity', v)} format={(v) => `${Math.round(v * 100)}%`} />
            </div>
          </Field>
        </>
      )}
      <MediaPicker
        open={picking}
        type={value.kind === 'video' ? 'video' : 'image'}
        onClose={() => setPicking(false)}
        onPick={(m) => {
          onChange({ ...value, kind: m.type === 'video' ? 'video' : 'image', mediaId: m.id })
          setPicking(false)
        }}
      />
    </>
  )
}

/** Optional override: "inherit" or a custom background. */
export function BackgroundOverride({ value, onChange, inheritLabel = 'Use theme background' }: { value: Background | null; onChange: (v: Background | null) => void; inheritLabel?: string }) {
  return (
    <>
      <Toggle checked={value === null} onChange={(v) => onChange(v ? null : { ...DEFAULT_BACKGROUND })} label={inheritLabel} />
      {value && <BackgroundEditor value={value} onChange={onChange} />}
    </>
  )
}

// ------------------------------------------------------------------ transition

export function TransitionEditor({ value, onChange }: { value: Transition; onChange: (v: Transition) => void }) {
  return (
    <>
      <Select value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value as Transition['type'] })}>
        <option value="cut">Cut</option>
        <option value="fade">Fade</option>
        <option value="crossfade">Crossfade</option>
        <option value="dissolve">Dissolve</option>
        <option value="slide">Slide</option>
      </Select>
      {value.type !== 'cut' && <Slider value={value.duration} min={100} max={2000} step={50} onChange={(v) => onChange({ ...value, duration: v })} format={(v) => `${(v / 1000).toFixed(2)}s`} />}
    </>
  )
}

export function ThemeSelect({ value, onChange, inheritLabel }: { value: string | null; onChange: (v: string | null) => void; inheritLabel?: string }) {
  const themes = useApp((s) => s.themes)
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {inheritLabel && <option value="">{inheritLabel}</option>}
      {themes.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </Select>
  )
}

// ------------------------------------------------------------------ media picker

const TYPE_ICON = { image: ImageIcon, video: Film, audio: Music2 }

export function MediaPicker({ open, type, onClose, onPick }: { open: boolean; type?: MediaType; onClose: () => void; onPick: (m: MediaItem) => void }) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [q, setQ] = useState('')
  const version = useContent((s) => s.mediaVersion)
  useEffect(() => {
    if (!open) return
    void api('media:list', { type, search: q || undefined }).then(setItems).catch(toast.error)
  }, [open, type, q, version])
  const sorted = useMemo(() => [...items].sort((a, b) => Number(b.favorite) - Number(a.favorite)), [items])

  async function importNew() {
    const r = await api('media:import', { paths: null })
    if (r.errors.length) toast.warning(r.errors.join('\n'))
    useContent.getState().invalidateMedia()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Choose ${type ?? 'media'}`}
      width={820}
      footer={
        <Button icon={Upload} onClick={importNew}>
          Import files…
        </Button>
      }
    >
      <div className="relative mb-3">
        <Search size={14} className="absolute top-2 left-2.5 text-dim" />
        <Input autoFocus className="pl-8" placeholder="Search media" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {sorted.length === 0 ? (
        <div className="py-12 text-center text-muted">No {type ?? 'media'} in the library yet. Use “Import files…”.</div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {sorted.map((m) => {
            const Icon = TYPE_ICON[m.type]
            return (
              <button key={m.id} type="button" onClick={() => onPick(m)} className="group overflow-hidden rounded-lg border border-line bg-panel-2 text-left hover:border-accent">
                <div className="relative aspect-video bg-black">
                  {m.hasThumbnail ? <img src={thumbUrl(m.id, m.updatedAt)} className="h-full w-full object-cover" alt="" loading="lazy" /> : <Icon className="absolute inset-0 m-auto text-dim" size={28} />}
                  {m.missing && <span className="absolute inset-x-0 bottom-0 bg-danger/90 px-1 text-[10px] text-white">Media file unavailable</span>}
                  {m.favorite && <Star size={12} className="absolute top-1 right-1 fill-star text-star" />}
                </div>
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <span className="flex-1 truncate text-[12px]">{m.name}</span>
                  {m.duration ? <span className="text-[10px] text-dim">{duration(m.duration)}</span> : null}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

export function MediaField({ label, mediaId, type, onChange }: { label: string; mediaId: string | null; type: MediaType; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const media = useMediaItem(mediaId)
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-panel-2 p-1.5 text-left hover:border-accent">
          <div className={cx('h-9 w-14 shrink-0 overflow-hidden rounded bg-black')}>{mediaId && media?.hasThumbnail && <img src={thumbUrl(mediaId)} className="h-full w-full object-cover" alt="" />}</div>
          <span className="truncate text-[12px]">{media ? media.name : mediaId ? 'Media file unavailable' : `Choose ${type}…`}</span>
        </button>
        {mediaId && (
          <button type="button" className="text-dim hover:text-fg" onClick={() => onChange(null)} aria-label="Remove">
            <X size={14} />
          </button>
        )}
      </div>
      <MediaPicker
        open={open}
        type={type}
        onClose={() => setOpen(false)}
        onPick={(m) => {
          onChange(m.id)
          setOpen(false)
        }}
      />
    </Field>
  )
}
