import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Download, Palette, Plus, RotateCcw, Star, Trash2, Upload } from 'lucide-react'
import type { RenderSlide, Theme, ThemeSettings } from '@shared/types'
import { BUILTIN_THEMES, DEFAULT_THEME_SETTINGS, deepMerge } from '@shared/defaults'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'
import { useApp } from '@/stores/app'
import { useLive } from '@/stores/live'
import { Badge, Button, EmptyState, Field, Input, Segmented, Select, Slider, Toggle } from '@/components/ui/controls'
import { confirmDialog, openContextMenu, promptDialog, toast } from '@/components/ui/overlays'
import { BackgroundEditor, Section, TextStyleEditor, TransitionEditor } from '@/components/editors'
import { SlidePreview } from '@/components/slide/SlideCanvas'

function sample(theme: ThemeSettings, kind: 'song' | 'bible' | 'announcement', logo: string | null): RenderSlide {
  const base: RenderSlide = { key: `sample-${kind}`, kind: 'text', label: '', group: '', text: '', subtext: '', title: '', theme, background: theme.background, media: null, elements: [], logoMediaId: logo }
  if (kind === 'bible') return { ...base, text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', subtext: 'John 3:16 (KJV)' }
  if (kind === 'announcement') return { ...base, kind: 'announcement', title: 'Youth Service', text: 'Games, worship and a message', subtext: 'Friday  •  6:00 PM  •  Main Hall' }
  return { ...base, text: 'Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.', subtext: 'Amazing Grace · John Newton' }
}

/** Key-order-independent JSON, for comparing settings objects. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(v)
}

/** A built-in theme the church has changed (so “Reset to original” has something to undo). */
function isEdited(t: Theme): boolean {
  const b = t.builtin ? BUILTIN_THEMES.find((x) => x.id === t.id) : undefined
  return !!b && (t.name !== b.name || canonical(t.settings) !== canonical(deepMerge(DEFAULT_THEME_SETTINGS, b.settings)))
}

export function ThemesView() {
  const themes = useApp((s) => s.themes)
  const settings = useApp((s) => s.settings)
  const logo = useApp((s) => s.church.logoMediaId)
  const [selected, setSelected] = useState<string | null>(themes[0]?.id ?? null)
  const theme = themes.find((t) => t.id === selected) ?? null
  const aspect = settings.presentation.aspectRatio

  async function create() {
    const name = await promptDialog({ title: 'New theme', defaultValue: 'My Theme', confirmLabel: 'Create' })
    if (!name) return
    const base = theme?.settings ?? DEFAULT_THEME_SETTINGS
    const t = await api('themes:create', { name, settings: base })
    await useApp.getState().reloadThemes()
    setSelected(t.id)
  }
  async function duplicate(t: Theme) {
    const copy = await api('themes:duplicate', t.id)
    await useApp.getState().reloadThemes()
    setSelected(copy.id)
    toast.success(`Created “${copy.name}” — edit it on the right.`)
  }
  async function remove(t: Theme) {
    if (!(await confirmDialog({ title: `Delete theme “${t.name}”?`, message: 'Items using it will fall back to the service or default theme.', danger: true, confirmLabel: 'Delete' }))) return
    await api('themes:delete', t.id).catch(toast.error)
    await useApp.getState().reloadThemes()
    setSelected(themes.find((x) => x.id !== t.id)?.id ?? null)
  }
  async function importThemes() {
    const r = await api('themes:import', null)
    if (r.imported) toast.success(`Imported ${r.imported} theme${r.imported === 1 ? '' : 's'}`)
    if (r.errors.length) toast.warning(r.errors.join('\n'))
    await useApp.getState().reloadThemes()
    if (r.ids[0]) setSelected(r.ids[0])
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-h-0 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
          <h1 className="flex-1 text-[15px] font-semibold">Themes</h1>
          <Button icon={Upload} onClick={() => void importThemes()}>Import</Button>
          <Button variant="primary" icon={Plus} onClick={() => void create()}>New theme</Button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t.id)}
                onContextMenu={(e) =>
                  openContextMenu(e, [
                    { label: 'Set as default theme', icon: Star, onSelect: () => void useApp.getState().saveSettings({ defaultThemeId: t.id }) },
                    { label: 'Duplicate', icon: Copy, onSelect: () => void duplicate(t) },
                    { label: 'Export .theme…', icon: Download, onSelect: () => void api('themes:export', t.id).then((f) => f && toast.success(`Exported to ${f}`)) },
                    'separator',
                    { label: 'Delete', icon: Trash2, danger: true, disabled: t.builtin, onSelect: () => void remove(t) }
                  ])
                }
                className={cx('overflow-hidden rounded-lg border-2 text-left', selected === t.id ? 'border-accent' : 'border-line hover:border-line-strong')}
              >
                <SlidePreview slide={sample(t.settings, 'song', logo)} aspect={aspect} />
                <div className="flex items-center gap-2 bg-panel px-2.5 py-2">
                  <span className="flex-1 truncate text-[13px] font-medium">{t.name}</span>
                  {isEdited(t) && <Badge>Edited</Badge>}
                  {settings.defaultThemeId === t.id && <Badge tone="accent">Default</Badge>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <aside className="flex min-h-0 flex-col border-l border-line bg-panel">
        {theme ? <ThemeEditor key={theme.id} theme={theme} onDuplicate={() => void duplicate(theme)} onDelete={() => void remove(theme)} /> : <EmptyState icon={Palette} title="Select a theme" />}
      </aside>
    </div>
  )
}

function ThemeEditor({ theme, onDuplicate, onDelete }: { theme: Theme; onDuplicate: () => void; onDelete: () => void }) {
  const settings = useApp((s) => s.settings)
  const logo = useApp((s) => s.church.logoMediaId)
  const [draft, setDraft] = useState<ThemeSettings>(theme.settings)
  const [name, setName] = useState(theme.name)
  const [previewKind, setPreviewKind] = useState<'song' | 'bible' | 'announcement'>('song')
  const [status, setStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  function change(next: ThemeSettings, nextName = name) {
    setDraft(next)
    setStatus('unsaved')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setStatus('saving')
      try {
        await api('themes:update', { id: theme.id, name: nextName, settings: next })
        await useApp.getState().reloadThemes()
        setStatus('saved')
        if (useLive.getState().itemId) void useLive.getState().refreshLive()
      } catch (e) {
        toast.error(e)
        setStatus('unsaved')
      }
    }, 500)
  }
  async function reset() {
    if (!(await confirmDialog({ title: `Reset “${theme.name}” to the original?`, message: 'All your changes to this built-in theme are undone. Slides using it update straight away.', confirmLabel: 'Reset' }))) return
    clearTimeout(timer.current)
    try {
      const t = await api('themes:reset', theme.id)
      setDraft(t.settings)
      setName(t.name)
      setStatus('saved')
      await useApp.getState().reloadThemes()
      if (useLive.getState().itemId) void useLive.getState().refreshLive()
      toast.success(`${t.name} is back to the original`)
    } catch (e) {
      toast.error(e)
    }
  }
  const set = <K extends keyof ThemeSettings>(k: K, v: ThemeSettings[K]) => change({ ...draft, [k]: v })
  const preview = useMemo(() => sample(draft, previewKind, logo), [draft, previewKind, logo])

  return (
    <>
      <div className="border-b border-line p-3">
        <div className="mb-2 flex items-center gap-2">
          <Input value={name} onChange={(e) => { setName(e.target.value); change(draft, e.target.value) }} className="font-semibold" aria-label="Theme name" />
          <span className="w-20 text-right text-[11px] text-muted">{status === 'saved' ? '✓ Saved' : status === 'saving' ? 'Saving…' : '● Unsaved'}</span>
        </div>
        <SlidePreview slide={preview} aspect={settings.presentation.aspectRatio} className="rounded border border-line" />
        <div className="mt-2 flex items-center gap-2">
          <Segmented size="sm" value={previewKind} onChange={setPreviewKind} options={[{ value: 'song', label: 'Song' }, { value: 'bible', label: 'Bible' }, { value: 'announcement', label: 'Announcement' }]} />
          <span className="flex-1" />
          <Button size="sm" icon={Check} disabled={settings.defaultThemeId === theme.id} onClick={() => void useApp.getState().saveSettings({ defaultThemeId: theme.id })}>
            {settings.defaultThemeId === theme.id ? 'Default' : 'Make default'}
          </Button>
        </div>
        {theme.builtin && (
          <div className="mt-2 flex items-center gap-2 rounded bg-panel-3 p-2 text-[12px] text-muted">
            <Badge>Built-in</Badge>
            <span className="flex-1">Edit it freely; you can always go back.</span>
            <Button size="sm" icon={RotateCcw} disabled={!isEdited(theme)} onClick={() => void reset()}>Reset to original</Button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Section title="Main text">
          <TextStyleEditor value={draft.text} onChange={(v) => set('text', v)} />
        </Section>
        <Section title="Text area & layout" defaultOpen={false}>
          {(['x', 'y', 'w', 'h'] as const).map((k) => (
            <Field key={k} label={{ x: 'Left', y: 'Top', w: 'Width', h: 'Height' }[k]}>
              <Slider value={draft.textArea[k]} min={0} max={100} step={1} onChange={(v) => set('textArea', { ...draft.textArea, [k]: v })} format={(v) => `${v}%`} />
            </Field>
          ))}
          <Field label="Maximum lines per slide">
            <Slider value={draft.maxLines} min={1} max={12} step={1} onChange={(v) => set('maxLines', v)} format={(v) => String(v)} />
          </Field>
          <Field label="Reference / copyright position">
            <Select value={draft.subtextPosition} onChange={(e) => set('subtextPosition', e.target.value as ThemeSettings['subtextPosition'])}>
              <option value="bottom">Bottom of screen</option>
              <option value="below">Directly below text</option>
              <option value="top">Top of screen</option>
            </Select>
          </Field>
        </Section>
        <Section title="Background">
          <BackgroundEditor value={draft.background} onChange={(v) => set('background', v)} />
        </Section>
        <Section title="Reference & copyright text" defaultOpen={false}>
          <TextStyleEditor value={draft.subtext} onChange={(v) => set('subtext', v)} compact />
        </Section>
        <Section title="Announcement title" defaultOpen={false}>
          <TextStyleEditor value={draft.title} onChange={(v) => set('title', v)} compact />
        </Section>
        <Section title="Transition" defaultOpen={false}>
          <TransitionEditor value={draft.transition} onChange={(v) => set('transition', v)} />
        </Section>
        <Section title="Church logo" defaultOpen={false}>
          <Toggle checked={draft.showLogo} onChange={(v) => set('showLogo', v)} label="Show logo on slides" />
          {draft.showLogo && (
            <Select value={draft.logoPosition} onChange={(e) => set('logoPosition', e.target.value as ThemeSettings['logoPosition'])}>
              <option value="top-left">Top left</option>
              <option value="top-right">Top right</option>
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-right">Bottom right</option>
            </Select>
          )}
          {!logo && <p className="text-[11px] text-dim">Set your logo in Settings → Church.</p>}
        </Section>
        <div className="flex gap-2 p-3">
          <Button icon={Copy} onClick={onDuplicate}>Duplicate</Button>
          <Button icon={Download} onClick={() => void api('themes:export', theme.id).then((f) => f && toast.success(`Exported to ${f}`))}>Export</Button>
          {!theme.builtin && <Button icon={Trash2} variant="danger" onClick={onDelete}>Delete</Button>}
        </div>
      </div>
    </>
  )
}
