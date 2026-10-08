import { useEffect, useState } from 'react'
import { MonitorPlay, Search, Music2 } from 'lucide-react'
import { BRAND } from '@shared/brand'
import { api, onEvent } from '@/lib/api'
import { cx } from '@/lib/format'
import { isTyping, matchAction } from '@/lib/shortcuts'
import { useApp, type View } from '@/stores/app'
import { useLive, effectiveDisplayId } from '@/stores/live'
import { useAudio } from '@/stores/audio'
import { useContent } from '@/stores/content'
import { useService } from '@/stores/service'
import { Spinner } from '@/components/ui/controls'
import { ContextMenuHost, DialogHost, ToastHost, TooltipHost, confirmDialog, toast } from '@/components/ui/overlays'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SearchPalette } from '@/components/SearchPalette'
import { Dashboard } from '@/views/Dashboard'
import { Planner, createService, exportService } from '@/views/planner/Planner'
import { LiveView } from '@/views/live/LiveView'
import { SongsView } from '@/views/songs/SongsView'
import { BibleView } from '@/views/bible/BibleView'
import { MediaView } from '@/views/media/MediaView'
import { InternetView, internetActiveClass } from '@/views/internet/InternetView'
import { ThemesView } from '@/views/themes/ThemesView'
import { SettingsView } from '@/views/settings/SettingsView'
import { HelpView } from '@/views/HelpView'
import { SetupWizard } from '@/views/SetupWizard'
import { RecoveryPrompt } from '@/components/RecoveryPrompt'
import { NAV, NavBar } from '@/components/NavBar'

function runShortcut(action: ReturnType<typeof matchAction>) {
  const live = useLive.getState()
  switch (action) {
    case 'next':
      return void live.next()
    case 'previous':
      return void live.previous()
    case 'firstSlide':
      return live.first()
    case 'lastSlide':
      return live.last()
    case 'nextItem':
      return void live.nextItem()
    case 'previousItem':
      return void live.previousItem()
    case 'black':
      return live.toggleMode('black')
    case 'clear':
      return live.toggleMode('clear')
    case 'logo':
      return useApp.getState().church.logoMediaId ? live.toggleMode('logo') : toast.info('Add a church logo in Settings → Church first.')
    case 'pause':
      return live.togglePause()
    case 'exit':
      return void live.exit()
    case 'search':
      return useApp.getState().setSearchOpen(true)
  }
}

async function handleMenu(command: string) {
  const app = useApp.getState()
  if (command.startsWith('nav:')) {
    const target = command.slice(4)
    if (target === 'help-shortcuts') return app.navigate('help', 'shortcuts')
    if (target === 'services') return app.navigate('planner')
    return app.navigate(target as View)
  }
  switch (command) {
    case 'service:new':
      return createService()
    case 'service:import': {
      const svc = await api('services:import', null).catch((e) => toast.error(e))
      if (svc) {
        toast.success(`Imported “${svc.name}”`)
        app.openService(svc.id)
      }
      return
    }
    case 'service:export':
      return app.currentServiceId ? exportService(app.currentServiceId) : toast.info('Open a service first.')
    case 'songs:import': {
      const r = await api('songs:import', null)
      if (r.imported) toast.success(`Imported ${r.imported} songs`)
      if (r.errors.length) toast.warning(r.errors.slice(0, 3).join('\n'))
      return app.navigate('songs')
    }
    case 'media:import': {
      const r = await api('media:import', { paths: null })
      if (r.imported) toast.success(`Imported ${r.imported} files`)
      useContent.getState().invalidateMedia()
      return app.navigate('media')
    }
    case 'backup:create': {
      const b = await api('backup:create').catch((e) => toast.error(e))
      if (b) toast.success(`Backup saved (${b.name})`)
      return
    }
    case 'search:open':
      return app.setSearchOpen(true)
    case 'output:open':
      return useLive.getState().startOutput()
    case 'output:close':
      return app.setOutput(await api('output:close'))
    case 'output:identify':
      return api('output:identify')
    case 'live:black':
      return runShortcut('black')
    case 'live:clear':
      return runShortcut('clear')
    case 'live:logo':
      return runShortcut('logo')
  }
}

export function App() {
  const { ready, init, view, navigate, church, output, settings, setSearchOpen } = useApp()
  const audioPlaying = useAudio((s) => s.playing)
  const [internetOpened, setInternetOpened] = useState(false)
  useEffect(() => {
    if (view === 'internet') setInternetOpened(true)
  }, [view])
  const audioTitle = useAudio((s) => s.title)

  useEffect(() => {
    void init().catch((e) => toast.error(e))
    const offs = [
      onEvent('displays:changed', async (displays) => {
        const before = useApp.getState().displays
        useApp.getState().setDisplays(displays)
        const added = displays.find((d) => !d.primary && !before.some((b) => b.id === d.id))
        const out = useApp.getState().output
        if (added && (!out.open || out.previewMode)) {
          const ok = await confirmDialog({
            title: 'New display connected',
            message: `${added.label} (${added.width}×${added.height}) is now available. Use it for the presentation output?`,
            confirmLabel: 'Present on this display'
          })
          if (ok) {
            await useApp.getState().saveSettings({ presentation: { outputDisplayId: added.id } })
            useApp.getState().setOutput(await api('output:open', { displayId: effectiveDisplayId() }))
          }
        }
      }),
      onEvent('output:status', useApp.getState().setOutput),
      onEvent('video:status', useLive.getState().setVideoStatus),
      onEvent('media:changed', () => useContent.getState().invalidateMedia()),
      onEvent('app:notice', (n) => (n.level === 'warning' ? toast.warning(n.message) : n.level === 'error' ? toast.error(n.message) : toast.info(n.message))),
      onEvent('live:remoteKey', (k) => runShortcut(matchAction(k, useApp.getState().settings.shortcuts))),
      onEvent('app:menu', (c) => void handleMenu(c))
    ]
    return () => offs.forEach((o) => o())
  }, [init])

  // Appearance and accessibility: light/dark (or follow macOS), UI scale, high contrast.
  useEffect(() => {
    const root = document.documentElement
    root.style.zoom = String(settings.uiScale)
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal'
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const next = settings.appearance === 'system' ? (media.matches ? 'dark' : 'light') : settings.appearance
      if (root.dataset.theme === next) return
      root.classList.add('theme-switching')
      root.dataset.theme = next
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')))
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings.uiScale, settings.highContrast, settings.appearance])

  // Live control shortcuts: active in the Live view, or anywhere while output is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useApp.getState()
      const action = matchAction(e, s.settings.shortcuts)
      if (!action) return
      if (action === 'search') {
        e.preventDefault()
        return setSearchOpen(true)
      }
      if (isTyping(e.target) || document.querySelector('[data-modal]') || s.searchOpen) return
      if (s.view !== 'live' && !s.output.open) return
      // Arrow keys in the planner list should navigate the list, not the slides.
      if (s.view === 'planner' && (e.target as HTMLElement)?.closest?.('[aria-label="Service items"]')) return
      e.preventDefault()
      runShortcut(action)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearchOpen])

  // Flush pending edits before the window closes.
  useEffect(() => {
    const flush = () => useService.getState().flush()
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={24} />
      </div>
    )
  }
  if (!settings.setupComplete) {
    return (
      <>
        <SetupWizard />
        <DialogHost />
        <ToastHost />
      </>
    )
  }

  const Current = { dashboard: Dashboard, planner: Planner, live: LiveView, songs: SongsView, bible: BibleView, media: MediaView, internet: null, themes: ThemesView, settings: SettingsView, help: HelpView }[view]

  return (
    <div className="flex h-full flex-col">
      <header className="drag flex h-11 shrink-0 items-center gap-3 border-b border-line bg-panel pr-3 pl-20">
        <span className="text-[13px] font-semibold">{BRAND.name}</span>
        {church.name && <span className="truncate text-[12px] text-muted">· {church.name}</span>}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="no-drag mx-auto flex h-7 w-80 items-center gap-2 rounded-md border border-line bg-panel-2 px-2.5 text-[12px] text-dim hover:border-line-strong"
        >
          <Search size={13} /> Search songs, Bible, services, media… <span className="ml-auto font-mono">⌘K</span>
        </button>
        {audioPlaying && (
          <button type="button" onClick={() => navigate('live')} className="no-drag flex max-w-52 items-center gap-1.5 rounded-md bg-audio/15 px-2 py-1 text-[12px] text-audio" data-tip="Audio playing — open Live view">
            <Music2 size={13} className="live-dot" />
            <span className="truncate">{audioTitle}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate('live')}
          className={cx('no-drag flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px]', output.open ? 'bg-live text-white' : 'text-muted hover:bg-panel-3')}
          data-tip={output.open ? `Output on ${output.displayLabel}` : 'Output closed'}
        >
          <MonitorPlay size={13} />
          {output.open ? 'LIVE' : 'Off air'}
        </button>
      </header>
      <NavBar />
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 overflow-hidden">
          {Current && (
            <ErrorBoundary key={view} label={NAV.find((n) => n.view === view)?.label ?? view}>
              <Current />
            </ErrorBoundary>
          )}
          {/* The browser stays alive between visits so the page isn't lost; it is hidden (and muted) when not in view. */}
          {internetOpened && (
            <div className={internetActiveClass(view === 'internet')}>
              <ErrorBoundary label="Internet">
                <InternetView active={view === 'internet'} />
              </ErrorBoundary>
            </div>
          )}
        </main>
      </div>
      <SearchPalette />
      <RecoveryPrompt />
      <DialogHost />
      <ContextMenuHost />
      <ToastHost />
      <TooltipHost />
    </div>
  )
}
