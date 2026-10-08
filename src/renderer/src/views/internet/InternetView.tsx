import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Clapperboard, Download, Globe, Home, Images, ListPlus, MonitorPlay, Music, RotateCw, Square, Type, WifiOff } from 'lucide-react'
import type { MediaItem } from '@shared/types'
import { parseLyrics } from '@shared/lyrics'
import { isWebUrl, songTitleFromPage, toUrl, youtubeId } from '@shared/web'
import { DEFAULT_MEDIA_SETTINGS } from '@shared/defaults'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'
import { useApp } from '@/stores/app'
import { useContent } from '@/stores/content'
import { useLive } from '@/stores/live'
import { Button, IconButton, Input, Spinner } from '@/components/ui/controls'
import { openContextMenu, promptDialog, toast, type MenuEntry } from '@/components/ui/overlays'
import { addToCurrentService, quickItem } from '@/views/songs/SongsView'
import type { WebviewEl } from '@/webview'

const HOME = 'https://www.youtube.com/'
const START_KEY = 'wf.internet.lastUrl'

function startUrl(): string {
  try {
    const u = localStorage.getItem(START_KEY)
    return u && isWebUrl(u) ? u : HOME
  } catch {
    return HOME
  }
}

interface ContextParams {
  x: number
  y: number
  linkURL: string
  srcURL: string
  mediaType: 'none' | 'image' | 'audio' | 'video' | 'canvas' | 'file' | 'plugin'
  selectionText: string
}

/**
 * Built-in web browser: find lyrics, YouTube videos and pictures, then put
 * them on the audience screen or into the library. Websites run in an
 * isolated sandbox (main/web.ts).
 */
export function InternetView({ active }: { active: boolean }) {
  const ref = useRef<WebviewEl>(null)
  const [initial] = useState(startUrl)
  const [address, setAddress] = useState(initial)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [nav, setNav] = useState({ back: false, forward: false })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const wv = () => ref.current
  /** Run script in the page. Never throws: the webview rejects calls synchronously while a page is still loading. */
  const inPage = <T,>(code: string, fallback: T): Promise<T> => {
    try {
      return wv()?.executeJavaScript<T>(code).catch(() => fallback) ?? Promise.resolve(fallback)
    } catch {
      return Promise.resolve(fallback)
    }
  }
  // The page's URL/title as reported by navigation events. (webview.getURL()/getTitle()
  // can return a stale value after navigations on single-page sites such as YouTube.)
  const pageUrl = useRef(initial)
  const [shownUrl, setShownUrl] = useState(initial)
  const pageTitle = useRef('')
  const currentUrl = () => pageUrl.current || address
  const currentTitle = () => pageTitle.current || title || currentUrl()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onNav = (e: Event) => {
      const url = (e as Event & { url: string }).url
      if (!isWebUrl(url)) return
      if ((e as Event & { isMainFrame?: boolean }).isMainFrame === false) return
      pageUrl.current = url
      setShownUrl(url)
      setAddress(url)
      setError(null)
      setNav({ back: el.canGoBack(), forward: el.canGoForward() })
      try {
        localStorage.setItem(START_KEY, url)
      } catch {
        /* ignore */
      }
    }
    const onTitle = (e: Event) => {
      const t = (e as Event & { title: string }).title
      pageTitle.current = t
      setTitle(t)
    }
    const onStart = () => setLoading(true)
    const onStop = () => {
      setLoading(false)
      setNav({ back: el.canGoBack(), forward: el.canGoForward() })
    }
    const onFail = (e: Event) => {
      const ev = e as Event & { errorCode: number; errorDescription: string; isMainFrame: boolean }
      if (!ev.isMainFrame || ev.errorCode === -3) return // -3 = navigation aborted (normal)
      setError(ev.errorCode === -106 || ev.errorCode === -105 ? 'offline' : ev.errorDescription || 'This page could not be loaded.')
    }
    const onContext = (e: Event) => showMenu((e as Event & { params: ContextParams }).params)
    el.addEventListener('did-navigate', onNav)
    el.addEventListener('did-navigate-in-page', onNav)
    el.addEventListener('page-title-updated', onTitle)
    el.addEventListener('did-start-loading', onStart)
    el.addEventListener('did-stop-loading', onStop)
    el.addEventListener('did-fail-load', onFail)
    el.addEventListener('context-menu', onContext)
    return () => {
      el.removeEventListener('did-navigate', onNav)
      el.removeEventListener('did-navigate-in-page', onNav)
      el.removeEventListener('page-title-updated', onTitle)
      el.removeEventListener('did-start-loading', onStart)
      el.removeEventListener('did-stop-loading', onStop)
      el.removeEventListener('did-fail-load', onFail)
      el.removeEventListener('context-menu', onContext)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Silence the operator's copy (e.g. when the video moves to the projector, or this page is hidden). */
  const pauseMedia = useCallback(() => {
    void inPage('document.querySelectorAll("video,audio").forEach(m => m.pause())', undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!active) pauseMedia()
  }, [active, pauseMedia])

  function go(input: string) {
    const url = toUrl(input)
    setError(null)
    void wv()?.loadURL(url).catch(() => undefined)
  }

  async function search(kind: 'lyrics' | 'images' | 'youtube') {
    const q = await promptDialog({
      title: kind === 'lyrics' ? 'Find song lyrics' : kind === 'images' ? 'Find pictures' : 'Search YouTube',
      placeholder: kind === 'lyrics' ? 'Song title' : kind === 'images' ? 'e.g. cross sunrise background' : 'Song or video name',
      confirmLabel: 'Search'
    })
    if (!q) return
    if (kind === 'lyrics') go(`https://www.google.com/search?q=${encodeURIComponent(`${q} lyrics`)}`)
    else if (kind === 'images') go(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`)
    else go(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`)
  }

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(label)
    try {
      return await fn()
    } catch (e) {
      toast.error(e)
      return undefined
    } finally {
      setBusy(null)
    }
  }

  // ------------------------------------------------------------ actions

  async function showPage(url = currentUrl(), name = currentTitle()) {
    if (!isWebUrl(url)) return toast.info('Open a web page first.')
    pauseMedia()
    await useLive.getState().presentQuick(quickItem({ type: 'web', title: name, data: { web: { url, title: name } } }), { stay: true })
    toast.success(youtubeId(url) ? 'Playing the video on screen' : 'Page shown on screen')
  }

  async function capture() {
    const el = wv()
    if (!el) return
    await run('Capturing…', async () => {
      const img = await el.capturePage()
      if (img.isEmpty()) throw new Error('Nothing to capture yet — wait for the page to load.')
      const media = await api('web:saveCapture', { dataUrl: img.toDataURL(), title: currentTitle() })
      useContent.getState().invalidateMedia()
      await presentMedia(media)
    })
  }

  async function presentMedia(m: MediaItem) {
    if (m.type === 'audio') return toast.success(`Saved “${m.name}” to Media. Add it to a service to play it.`)
    await useLive.getState().presentQuick(
      quickItem({ type: m.type, title: m.name, data: { mediaId: m.id, media: { ...DEFAULT_MEDIA_SETTINGS, fit: m.type === 'image' ? 'contain' : 'contain' } } }),
      { stay: true }
    )
  }

  async function saveMedia(url: string, kind: 'image' | 'video' | 'audio', present: boolean) {
    const m = await run(present ? 'Preparing…' : 'Saving…', () => api('web:saveMedia', { url, kind }))
    if (!m) return
    useContent.getState().invalidateMedia()
    if (present) await presentMedia(m)
    else toast.success(`Saved “${m.name}” to Media (folder “Web”)`)
  }

  async function selectedText(): Promise<string> {
    return (await inPage<string>('window.getSelection().toString()', '')).trim()
  }

  async function importLyrics(text?: string) {
    const lyrics = text ?? (await selectedText())
    if (!lyrics) return toast.info('Highlight the song lyrics on the page first (click and drag over them), then try again.')
    const sections = parseLyrics(lyrics)
    if (!sections.length) return toast.warning('No lyrics found in the highlighted text.')
    const name = await promptDialog({ title: 'Import as a new song', message: `${sections.length} section${sections.length === 1 ? '' : 's'} found. You can edit everything afterwards.`, defaultValue: songTitleFromPage(currentTitle()), confirmLabel: 'Import song' })
    if (!name) return
    const song = await run('Importing…', () => api('songs:save', { title: name, sections, notes: `Imported from ${currentUrl()}` }))
    if (!song) return
    useContent.getState().setSong(song)
    toast.success(`“${song.title}” added to Songs. Check the section labels and copyright details.`)
    useApp.getState().navigate('songs', song.id)
  }

  async function showText(text?: string) {
    const body = text ?? (await selectedText())
    if (!body) return toast.info('Highlight some text on the page first.')
    await useLive.getState().presentQuick(quickItem({ type: 'other', title: 'Text from the web', data: { body } }), { stay: true })
  }

  function addPage(url = currentUrl(), name = currentTitle()) {
    if (!isWebUrl(url)) return
    void addToCurrentService({ type: 'web', title: name, data: { web: { url, title: name } } })
  }

  function showMenu(p: ContextParams) {
    const rect = ref.current?.getBoundingClientRect()
    const at = { clientX: (rect?.left ?? 0) + p.x, clientY: (rect?.top ?? 0) + p.y, preventDefault: () => undefined }
    const items: MenuEntry[] = []
    const isFile = (u: string) => isWebUrl(u) // blob:/data: streams (e.g. YouTube) can't be saved
    if (p.mediaType === 'image' && p.srcURL) {
      items.push({ label: 'Show picture on screen', icon: MonitorPlay, onSelect: () => void saveMedia(p.srcURL, 'image', true), disabled: !isFile(p.srcURL) })
      items.push({ label: 'Save picture to Media', icon: Download, onSelect: () => void saveMedia(p.srcURL, 'image', false), disabled: !isFile(p.srcURL) })
    }
    if ((p.mediaType === 'video' || p.mediaType === 'audio') && p.srcURL) {
      if (youtubeId(currentUrl())) items.push({ label: 'Play this video on screen', icon: MonitorPlay, onSelect: () => void showPage() })
      items.push({
        label: isFile(p.srcURL) ? `Save ${p.mediaType} to Media` : `This ${p.mediaType} streams and can't be saved`,
        icon: Download,
        disabled: !isFile(p.srcURL),
        onSelect: () => void saveMedia(p.srcURL, p.mediaType as 'video' | 'audio', false)
      })
    }
    if (p.linkURL && isWebUrl(p.linkURL)) {
      if (youtubeId(p.linkURL)) {
        items.push({ label: 'Play this video on screen', icon: MonitorPlay, onSelect: () => void showPage(p.linkURL, 'YouTube video') })
        items.push({ label: 'Add video to service', icon: ListPlus, onSelect: () => addPage(p.linkURL, 'YouTube video') })
      }
      items.push({ label: 'Open link', icon: Globe, onSelect: () => go(p.linkURL) })
    }
    if (p.selectionText.trim()) {
      if (items.length) items.push('separator')
      items.push({ label: 'Import selection as song lyrics', icon: Music, onSelect: () => void importLyrics(p.selectionText) })
      items.push({ label: 'Show selected text on screen', icon: Type, onSelect: () => void showText(p.selectionText) })
    }
    if (items.length) items.push('separator')
    items.push({ label: youtubeId(currentUrl()) ? 'Play video on screen' : 'Show page on screen', icon: MonitorPlay, onSelect: () => void showPage() })
    items.push({ label: 'Capture page to screen', icon: Camera, onSelect: () => void capture() })
    items.push({ label: 'Add page to service', icon: ListPlus, onSelect: () => addPage() })
    items.push('separator')
    items.push({ label: 'Back', icon: ArrowLeft, disabled: !wv()?.canGoBack(), onSelect: () => wv()?.goBack() })
    items.push({ label: 'Reload', icon: RotateCw, onSelect: () => wv()?.reload() })
    openContextMenu(at, items)
  }

  const isYouTube = !!youtubeId(shownUrl)

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="internet-view">
      <header className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-2">
        <IconButton icon={ArrowLeft} label="Back" disabled={!nav.back} onClick={() => wv()?.goBack()} />
        <IconButton icon={ArrowRight} label="Forward" disabled={!nav.forward} onClick={() => wv()?.goForward()} />
        <IconButton icon={loading ? Square : RotateCw} label={loading ? 'Stop' : 'Reload'} onClick={() => (loading ? wv()?.stop() : wv()?.reload())} />
        <IconButton icon={Home} label="YouTube home" onClick={() => go(HOME)} />
        <form
          className="relative min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            go(address)
          }}
        >
          <Globe size={14} className="absolute top-2 left-2.5 text-dim" />
          <Input
            aria-label="Web address"
            className="pl-8"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="Search the web or type an address"
          />
          {loading && <span className="absolute top-2 right-2.5"><Spinner size={14} /></span>}
        </form>
        <Button size="sm" icon={Clapperboard} onClick={() => void search('youtube')}>YouTube</Button>
        <Button size="sm" icon={Music} onClick={() => void search('lyrics')}>Lyrics</Button>
        <Button size="sm" icon={Images} onClick={() => void search('images')}>Pictures</Button>
      </header>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line bg-panel px-3 py-1.5">
        <Button size="sm" variant="live" icon={MonitorPlay} onClick={() => void showPage()} data-testid="web-show-page">
          {isYouTube ? 'Play video on screen' : 'Show page on screen'}
        </Button>
        <Button size="sm" icon={Camera} onClick={() => void capture()} tip="Take a snapshot of what you see and show it on screen" data-testid="web-capture">
          Capture to screen
        </Button>
        <Button size="sm" icon={Music} onClick={() => void importLyrics()} tip="Highlight lyrics on the page, then click to create a song" data-testid="web-import-lyrics">
          Import highlighted lyrics
        </Button>
        <Button size="sm" icon={ListPlus} onClick={() => addPage()} tip="Add this page or video to the current service">
          Add to service
        </Button>
        <span className="flex-1" />
        {busy && <span className="flex items-center gap-1.5 text-[12px] text-muted"><Spinner size={12} /> {busy}</span>}
        <span className="hidden truncate text-[11px] text-dim xl:inline">Right-click pictures, videos or text for more · only project content your church is licensed to use</span>
      </div>
      <div className="relative min-h-0 flex-1 bg-white">
        <webview ref={ref as never} src={initial} partition="persist:web" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg p-8 text-center">
            <WifiOff size={32} className="text-muted" />
            <div className="text-sm font-semibold">{error === 'offline' ? 'No internet connection' : 'This page could not be loaded'}</div>
            <div className="max-w-md text-[13px] text-muted">
              {error === 'offline' ? 'The Internet section needs a connection. Everything else in WorshipFlow keeps working offline.' : error}
            </div>
            <Button icon={RotateCw} onClick={() => wv()?.reload()}>Try again</Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function internetActiveClass(active: boolean) {
  return cx('absolute inset-0', active ? 'z-10' : 'invisible pointer-events-none')
}
