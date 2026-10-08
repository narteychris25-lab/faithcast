import { useEffect, useState, type ReactNode } from 'react'
import { Archive, Library, Building2, Cog, Database, HardDrive, Image as ImageIcon, Keyboard, Monitor, Palette, Presentation, RotateCcw, ScanEye, Trash2, Upload, Volume2, Wrench, X } from 'lucide-react'
import type { AppSettings, BackupInfo, ShortcutAction } from '@shared/types'
import type { AppInfo } from '@shared/ipc'
import { BRAND } from '@shared/brand'
import { DEFAULT_SHORTCUTS, SHORTCUT_LABELS } from '@shared/defaults'
import { api } from '@/lib/api'
import { bytes, cx, relativeTime } from '@/lib/format'
import { comboLabel, eventCombo } from '@/lib/shortcuts'
import { IS_MAC, OS } from '@/lib/platform'
import { useApp } from '@/stores/app'
import { useContent } from '@/stores/content'
import { effectiveDisplayId, useLive } from '@/stores/live'
import { Badge, Button, Field, Input, Kbd, Segmented, Select, Slider, Toggle } from '@/components/ui/controls'
import { confirmDialog, toast } from '@/components/ui/overlays'
import { MediaField, ThemeSelect, TransitionEditor } from '@/components/editors'
import { BibleVersions } from './BibleVersions'
import { Logo } from '@/components/Logo'

type Tab = 'general' | 'presentation' | 'displays' | 'audio' | 'keyboard' | 'bibles' | 'database' | 'media' | 'themes' | 'church' | 'backup' | 'advanced'
const TABS: { id: Tab; label: string; icon: typeof Cog }[] = [
  { id: 'general', label: 'General', icon: Cog },
  { id: 'presentation', label: 'Presentation', icon: Presentation },
  { id: 'displays', label: 'Displays', icon: Monitor },
  { id: 'audio', label: 'Audio', icon: Volume2 },
  { id: 'keyboard', label: 'Keyboard', icon: Keyboard },
  { id: 'bibles', label: 'Bibles', icon: Library },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'media', label: 'Media', icon: ImageIcon },
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'church', label: 'Church', icon: Building2 },
  { id: 'backup', label: 'Backup', icon: Archive },
  { id: 'advanced', label: 'Advanced', icon: Wrench }
]

const MULTI_CARD = new Set<Tab>(['general', 'presentation', 'displays', 'church', 'backup', 'advanced'])

const Card = ({ title, children, desc }: { title: string; desc?: string; children: ReactNode }) => (
  <section className="rounded-lg border border-line bg-panel p-4">
    <h2 className="text-[13px] font-semibold">{title}</h2>
    {desc && <p className="mt-0.5 mb-3 text-[12px] text-muted">{desc}</p>}
    <div className={cx('flex flex-col gap-3', !desc && 'mt-3')}>{children}</div>
  </section>
)

export function SettingsView() {
  const param = useApp((s) => s.viewParam)
  const [tab, setTab] = useState<Tab>((param as Tab) ?? 'general')
  useEffect(() => {
    if (param && TABS.some((t) => t.id === param)) setTab(param as Tab)
  }, [param])
  return (
    <div className="grid h-full min-h-0 grid-cols-[200px_minmax(0,1fr)]">
      <nav className="flex flex-col gap-0.5 border-r border-line bg-panel p-2">
        <h1 className="px-2 py-2 text-[15px] font-semibold">Settings</h1>
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cx('flex h-8 items-center gap-2 rounded-md px-2 text-[13px]', tab === t.id ? 'bg-accent/20 text-fg' : 'text-muted hover:bg-panel-3 hover:text-fg')}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 overflow-auto">
        <div
          className={cx(
            'p-6',
            // Several cards: packed into two columns on wide windows (no gaps); one card or the Bibles list: full width
            MULTI_CARD.has(tab) ? 'gap-4 xl:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid' : 'flex flex-col gap-4'
          )}
        >
          {tab === 'general' && <General />}
          {tab === 'presentation' && <PresentationTab />}
          {tab === 'displays' && <Displays />}
          {tab === 'audio' && <AudioTab />}
          {tab === 'keyboard' && <KeyboardTab />}
          {tab === 'bibles' && <BibleVersions />}
          {tab === 'database' && <DatabaseTab />}
          {tab === 'media' && <MediaTab />}
          {tab === 'themes' && <ThemesTab />}
          {tab === 'church' && <ChurchTab />}
          {tab === 'backup' && <BackupTab />}
          {tab === 'advanced' && <AdvancedTab />}
        </div>
      </div>
    </div>
  )
}

function useSettings(): [AppSettings, (p: unknown) => void] {
  const s = useApp((x) => x.settings)
  return [s, (p) => void useApp.getState().saveSettings(p)]
}

function General() {
  const [s, save] = useSettings()
  const translations = useApp((x) => x.translations)
  return (
    <>
      <Card title="Live operation">
        <Toggle checked={s.autoAdvanceToNextItem} onChange={(v) => save({ autoAdvanceToNextItem: v })} label="“Next” on the last slide moves to the next service item" />
        <Toggle checked={s.confirmExitPresentation} onChange={(v) => save({ confirmExitPresentation: v })} label="Ask before ending the presentation" />
      </Card>
      <Card title="Appearance" desc="Changes the operator interface only. What the audience sees always follows your slide themes.">
        <Segmented
          value={s.appearance}
          onChange={(v) => save({ appearance: v })}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: `Match ${OS.name}` }
          ]}
        />
        <p className="text-[12px] text-muted">Dark is recommended in a dim sanctuary or sound booth; Light suits daytime planning.</p>
      </Card>
      <Card title="Accessibility">
        <Field label="Interface scale">
          <Slider value={s.uiScale} min={0.8} max={1.4} step={0.05} onChange={(v) => save({ uiScale: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </Field>
        <Toggle checked={s.highContrast} onChange={(v) => save({ highContrast: v })} label="High-contrast interface" />
      </Card>
      <Card title="Songs">
        <Field label="Maximum lines per slide">
          <Slider value={s.songs.maxLinesPerSlide} min={1} max={10} step={1} onChange={(v) => save({ songs: { maxLinesPerSlide: v } })} format={(v) => String(v)} />
        </Field>
        <Toggle checked={s.songs.showCopyrightOnFirstSlide} onChange={(v) => save({ songs: { showCopyrightOnFirstSlide: v } })} label="Show title/copyright/CCLI on the first slide" />
        <Toggle checked={s.songs.showCopyrightOnLastSlide} onChange={(v) => save({ songs: { showCopyrightOnLastSlide: v } })} label="Show title/copyright/CCLI on the last slide" />
      </Card>
      <Card title="Bible">
        <Field label="Default translation">
          <Select value={s.bible.defaultTranslationId ?? ''} onChange={(e) => save({ bible: { defaultTranslationId: e.target.value } })}>
            {translations.map((t) => (
              <option key={t.id} value={t.id}>{t.abbreviation} — {t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Default verses per slide">
          <Segmented size="sm" value={String(s.bible.versesPerSlide)} onChange={(v) => save({ bible: { versesPerSlide: Number(v) } })} options={[{ value: '0', label: 'Auto' }, { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }]} />
        </Field>
        <Toggle checked={s.bible.showReference} onChange={(v) => save({ bible: { showReference: v } })} label="Show the reference on Bible slides" />
      </Card>
    </>
  )
}

function PresentationTab() {
  const [s, save] = useSettings()
  return (
    <>
      <Card title="Output format" desc="Slides are designed on a fixed canvas and scale to any resolution — 720p, 1080p, 4K or custom — without re-layout.">
        <Field label="Aspect ratio">
          <Segmented value={s.presentation.aspectRatio} onChange={(v) => save({ presentation: { aspectRatio: v } })} options={[{ value: '16:9', label: '16:9 (TV / modern projector)' }, { value: '16:10', label: '16:10' }, { value: '4:3', label: '4:3 (older projector)' }]} />
        </Field>
        <Field label="Fullscreen method" hint={`Borderless covers the whole display instantly and is recommended. Native uses ${IS_MAC ? 'macOS full-screen Spaces' : `${OS.name} full-screen mode`}.`}>
          <Segmented value={s.presentation.fullscreenMode} onChange={(v) => save({ presentation: { fullscreenMode: v } })} options={[{ value: 'borderless', label: 'Borderless (recommended)' }, { value: 'native', label: `${OS.name} native` }]} />
        </Field>
        <Field label="Preview window size (when no second display)">
          <Slider value={s.presentation.previewWindowScale} min={0.25} max={0.8} step={0.05} onChange={(v) => save({ presentation: { previewWindowScale: v } })} format={(v) => `${Math.round(v * 100)}% of screen`} />
        </Field>
      </Card>
      <Card title="Default transition" desc="Used when neither the item nor its theme sets one.">
        <TransitionEditor value={s.presentation.defaultTransition} onChange={(v) => save({ presentation: { defaultTransition: v } })} />
      </Card>
    </>
  )
}

function Displays() {
  const displays = useApp((x) => x.displays)
  const output = useApp((x) => x.output)
  const [s, save] = useSettings()
  const current = effectiveDisplayId()
  return (
    <>
      <Card title="Detected displays" desc="Displays are detected automatically, including ones connected while FaithCast is running.">
        <div className="flex flex-col gap-2">
          {displays.map((d) => (
            <div key={d.id} className={cx('flex items-center gap-3 rounded-md border p-3', current === d.id ? 'border-live/60 bg-live/5' : 'border-line')}>
              <Monitor size={20} className={d.primary ? 'text-accent' : 'text-muted'} />
              <div className="flex-1">
                <div className="text-[13px] font-medium">{d.label}</div>
                <div className="text-[11px] text-muted">
                  {d.width}×{d.height} · {Math.round(d.refreshRate)} Hz · scale {d.scaleFactor}× {d.primary && '· operator screen'}
                </div>
              </div>
              {d.primary ? <Badge>Operator</Badge> : current === d.id ? <Badge tone="live">Presentation</Badge> : (
                <Button size="sm" onClick={() => save({ presentation: { outputDisplayId: d.id } })}>Use for presentation</Button>
              )}
            </div>
          ))}
        </div>
        {displays.length === 1 && <p className="text-[12px] text-muted">Only one display is connected. The output will open in a preview window. Connect a projector or TV (HDMI/USB-C) and it will appear here automatically.</p>}
      </Card>
      <Card title="Presentation output">
        <Field label="Output display">
          <Select
            value={s.presentation.outputDisplayId === -1 ? 'preview' : s.presentation.outputDisplayId === null ? 'auto' : String(s.presentation.outputDisplayId)}
            onChange={(e) => save({ presentation: { outputDisplayId: e.target.value === 'auto' ? null : e.target.value === 'preview' ? -1 : Number(e.target.value) } })}
          >
            <option value="auto">Automatic — first external display</option>
            <option value="preview">Preview window on the operator screen</option>
            {displays.filter((d) => !d.primary).map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button icon={ScanEye} onClick={() => void api('output:identify')}>Identify displays</Button>
          {output.open ? (
            <Button onClick={async () => useApp.getState().setOutput(await api('output:close'))}>Close output</Button>
          ) : (
            <Button variant="live" onClick={() => void useLive.getState().startOutput()}>Open output</Button>
          )}
        </div>
        {output.open && <p className="text-[12px] text-muted">Output is on <b>{output.displayLabel}</b> at {output.width}×{output.height}. Frame rate follows the display's refresh rate.</p>}
      </Card>
    </>
  )
}

function AudioTab() {
  const [s, save] = useSettings()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  useEffect(() => {
    void navigator.mediaDevices?.enumerateDevices().then((d) => setDevices(d.filter((x) => x.kind === 'audiooutput')))
  }, [])
  function testTone() {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = s.audio.defaultVolume * 0.2
    osc.frequency.value = 440
    osc.connect(gain)
    const dest = ctx.createMediaStreamDestination()
    gain.connect(dest)
    const el = new Audio() as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
    el.srcObject = dest.stream
    void (s.audio.outputDeviceId !== 'default' && el.setSinkId ? el.setSinkId(s.audio.outputDeviceId) : Promise.resolve()).then(() => el.play())
    osc.start()
    setTimeout(() => {
      osc.stop()
      void ctx.close()
    }, 800)
  }
  return (
    <Card title="Service audio" desc={`Audio items (and the church's walk-in music) play through this device. Video sound plays through the ${OS.name} default output.`}>
      <Field label="Output device">
        <Select value={s.audio.outputDeviceId} onChange={(e) => save({ audio: { outputDeviceId: e.target.value } })}>
          {devices.length === 0 && <option value="default">System default</option>}
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || (d.deviceId === 'default' ? 'System default' : 'Audio device')}</option>
          ))}
        </Select>
      </Field>
      <Field label="Default volume">
        <Slider value={s.audio.defaultVolume} onChange={(v) => save({ audio: { defaultVolume: v } })} format={(v) => `${Math.round(v * 100)}%`} />
      </Field>
      <div><Button icon={Volume2} onClick={testTone}>Play test tone</Button></div>
    </Card>
  )
}

function KeyboardTab() {
  const [s, save] = useSettings()
  const [capturing, setCapturing] = useState<ShortcutAction | null>(null)
  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (['MetaLeft', 'MetaRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight'].includes(e.code)) return
      const combo = eventCombo(e)
      const conflict = (Object.entries(s.shortcuts) as [ShortcutAction, string[]][]).find(([a, list]) => a !== capturing && list.includes(combo))
      if (conflict) toast.warning(`${comboLabel(combo)} was used for “${SHORTCUT_LABELS[conflict[0]]}” — moved to “${SHORTCUT_LABELS[capturing]}”.`)
      const next = { ...s.shortcuts }
      if (conflict) next[conflict[0]] = next[conflict[0]].filter((c) => c !== combo)
      next[capturing] = [...new Set([...next[capturing], combo])]
      save({ shortcuts: next })
      setCapturing(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing, s.shortcuts]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card title="Live keyboard shortcuts" desc="These work in the Live view, and anywhere in the app while the output is open (except when typing in a text field). They also work if the output window has focus.">
      <div className="divide-y divide-line">
        {(Object.keys(SHORTCUT_LABELS) as ShortcutAction[]).map((a) => (
          <div key={a} className="flex items-center gap-3 py-2">
            <span className="w-48 text-[13px]">{SHORTCUT_LABELS[a]}</span>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {s.shortcuts[a].map((c) => (
                <span key={c} className="inline-flex items-center gap-1">
                  <Kbd>{comboLabel(c)}</Kbd>
                  <button type="button" className="text-dim hover:text-danger" aria-label={`Remove ${c}`} onClick={() => save({ shortcuts: { ...s.shortcuts, [a]: s.shortcuts[a].filter((x) => x !== c) } })}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <Button size="sm" variant={capturing === a ? 'primary' : 'secondary'} onClick={() => setCapturing(capturing === a ? null : a)}>
              {capturing === a ? 'Press a key…' : 'Add key'}
            </Button>
          </div>
        ))}
      </div>
      <div><Button icon={RotateCcw} onClick={() => save({ shortcuts: DEFAULT_SHORTCUTS })}>Restore defaults</Button></div>
    </Card>
  )
}

function DatabaseTab() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    void api('app:info').then(setInfo)
    void api('dashboard:get').then((d) => setCounts(d.counts))
  }, [])
  return (
    <>
      <Card title="Local database" desc={`Everything is stored on this ${OS.computer} in a crash-safe SQLite database. No internet or account is needed.`}>
        {info && <div className="rounded bg-panel-2 p-2 font-mono text-[11px] break-all text-muted">{info.dbPath}</div>}
        {counts && (
          <div className="grid grid-cols-5 gap-2 text-center">
            {Object.entries(counts).map(([k, v]) => (
              <div key={k} className="rounded bg-panel-2 p-2"><div className="text-lg font-semibold">{v}</div><div className="text-[11px] text-muted capitalize">{k}</div></div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button icon={HardDrive} onClick={() => info && void api('app:showInFolder', info.dbPath)}>{OS.showInFolder}</Button>
          <Button
            icon={Trash2}
            variant="danger"
            onClick={async () => {
              if (!(await confirmDialog({ title: 'Remove all demo content?', message: 'Demo services, demo songs not used in your own services, and demo media are removed.', danger: true, confirmLabel: 'Remove demo content' }))) return
              const r = await api('app:removeDemo')
              toast.success(`Removed ${r.removed} demo items`)
            }}
          >
            Remove demo content
          </Button>
        </div>
      </Card>
    </>
  )
}

function MediaTab() {
  return (
    <Card title="Media files" desc={`Media stays where it is on your ${OS.computer} — FaithCast stores a reference and a small thumbnail. If you move or rename files, use “Check files” to find them again.`}>
      <div className="flex gap-2">
        <Button onClick={async () => {
          const r = await api('media:checkMissing')
          useContent.getState().invalidateMedia()
          toast.info(r.missing.length ? `${r.missing.length} of ${r.checked} files are missing — see the Media page.` : `All ${r.checked} files are available.`)
        }}>Check all media files</Button>
        <Button onClick={() => useApp.getState().navigate('media')}>Open media library</Button>
      </div>
      <p className="text-[12px] text-muted">
        {IS_MAC
          ? 'Supported: JPEG, PNG, GIF, WebP, HEIC (converted), MP4/MOV (H.264, HEVC), WebM, MP3, M4A, WAV, AAC, FLAC. AVI/WMV are not playable on macOS without conversion.'
          : 'Supported: JPEG, PNG, GIF, WebP, BMP, MP4/MOV (H.264; HEVC needs the HEVC Video Extensions from the Microsoft Store), WebM, MP3, M4A, WAV, AAC, FLAC. Save HEIC/TIFF photos as JPEG first; AVI/WMV need converting to MP4.'}
      </p>
    </Card>
  )
}

function ThemesTab() {
  const [s, save] = useSettings()
  return (
    <Card title="Default theme" desc="Used by services and items that don't choose their own theme.">
      <ThemeSelect value={s.defaultThemeId} onChange={(v) => save({ defaultThemeId: v })} />
      <div><Button onClick={() => useApp.getState().navigate('themes')}>Edit themes</Button></div>
    </Card>
  )
}

function ChurchTab() {
  const church = useApp((x) => x.church)
  const [local, setLocal] = useState(church)
  useEffect(() => setLocal(church), [church])
  const commit = (patch: Partial<typeof church>) => {
    setLocal({ ...local, ...patch })
    void useApp.getState().saveChurch(patch)
  }
  const text = (k: 'name' | 'address' | 'website' | 'phone' | 'email', label: string) => (
    <Field label={label}>
      <Input value={local[k]} onChange={(e) => setLocal({ ...local, [k]: e.target.value })} onBlur={(e) => commit({ [k]: e.target.value })} />
    </Field>
  )
  return (
    <>
      <Card title="Church profile">
        {text('name', 'Church name')}
        <MediaField label="Logo" type="image" mediaId={local.logoMediaId} onChange={(id) => commit({ logoMediaId: id })} />
        <p className="-mt-1 text-[11px] text-dim">Shown with the Logo button during live presentation, and on slides whose theme enables it.</p>
        {text('address', 'Address')}
        <div className="grid grid-cols-2 gap-3">
          {text('website', 'Website')}
          {text('phone', 'Phone')}
        </div>
        {text('email', 'Email')}
      </Card>
      <Card title="Social media">
        {(['facebook', 'instagram', 'youtube', 'x'] as const).map((k) => (
          <Field key={k} label={k === 'x' ? 'X (Twitter)' : k[0].toUpperCase() + k.slice(1)}>
            <Input value={local.social[k] ?? ''} onChange={(e) => setLocal({ ...local, social: { ...local.social, [k]: e.target.value } })} onBlur={() => commit({ social: local.social })} />
          </Field>
        ))}
      </Card>
    </>
  )
}

function BackupTab() {
  const [s, save] = useSettings()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const reload = () => void api('backup:list').then(setBackups)
  useEffect(reload, [])
  async function restore(b: BackupInfo) {
    const ok = await confirmDialog({
      title: 'Restore this backup?',
      message: `Everything will be returned to how it was ${relativeTime(b.createdAt)}. A safety backup of the current data is taken first. FaithCast will restart.`,
      danger: true,
      confirmLabel: 'Restore and restart'
    })
    if (ok) await api('backup:restore', b.file).catch(toast.error)
  }
  return (
    <>
      <Card title="Automatic backups" desc="A backup is taken once a day when FaithCast starts, and before any database upgrade.">
        <Toggle checked={s.backup.autoBackup} onChange={(v) => save({ backup: { autoBackup: v } })} label="Back up automatically" />
        <Field label="Automatic backups to keep">
          <Slider value={s.backup.keep} min={3} max={60} step={1} onChange={(v) => save({ backup: { keep: v } })} format={(v) => String(v)} />
        </Field>
        <p className="text-[12px] text-muted">Last backup: {relativeTime(s.backup.lastBackupAt)}</p>
      </Card>
      <Card title="Backups">
        <div className="flex gap-2">
          <Button variant="primary" onClick={async () => { const b = await api('backup:create').catch(toast.error); if (b) { toast.success('Backup created'); reload() } }}>Back up now</Button>
          <Button icon={Upload} onClick={() => void api('backup:restoreFromFile').catch(toast.error)}>Restore from file…</Button>
          <Button icon={HardDrive} onClick={() => void api('backup:openFolder')}>Open backups folder</Button>
        </div>
        <div className="divide-y divide-line rounded border border-line">
          {backups.map((b) => (
            <div key={b.file} className="flex items-center gap-3 px-3 py-2">
              <Archive size={15} className="text-muted" />
              <div className="flex-1">
                <div className="text-[13px]">{new Date(b.createdAt).toLocaleString()}</div>
                <div className="text-[11px] text-dim">{b.reason} · {bytes(b.size)}</div>
              </div>
              <Button size="sm" onClick={() => void restore(b)}>Restore</Button>
              <Button size="sm" variant="ghost" icon={Trash2} onClick={async () => { if (await confirmDialog({ title: 'Delete this backup?', danger: true, confirmLabel: 'Delete' })) { await api('backup:delete', b.file); reload() } }} />
            </div>
          ))}
          {backups.length === 0 && <div className="p-4 text-center text-[12px] text-dim">No backups yet.</div>}
        </div>
      </Card>
    </>
  )
}

function AdvancedTab() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => void api('app:info').then(setInfo), [])
  return (
    <>
      <Card title="About">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <span className="text-[12px] text-muted">{BRAND.tagline}</span>
        </div>
        {info && (
          <div className="grid grid-cols-2 gap-y-1 text-[12px]">
            <span className="text-muted">Version</span><span>{info.name} {info.version}</span>
            <span className="text-muted">Platform</span><span>{IS_MAC ? `macOS · ${info.arch === 'arm64' ? 'Apple Silicon' : 'Intel'}` : `${OS.name} · ${info.arch}`}</span>
            <span className="text-muted">Engine</span><span>Electron {info.electron} · Chromium {info.chrome}</span>
            <span className="text-muted">Build</span><span>{info.isPackaged ? 'Installed app' : 'Development'}</span>
            <span className="text-muted">Data folder</span><span className="break-all">{info.dataDir}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Button icon={HardDrive} onClick={() => info && void api('app:showInFolder', info.dbPath)}>Open data folder</Button>
          <Button onClick={() => void api('app:relaunch')}>Restart FaithCast</Button>
        </div>
      </Card>
      <Card title="Setup">
        <div><Button icon={RotateCcw} onClick={() => void useApp.getState().saveSettings({ setupComplete: false })}>Run the setup wizard again</Button></div>
      </Card>
    </>
  )
}
