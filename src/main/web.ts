import { app, session } from 'electron'
import { createWriteStream, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { MediaItem, MediaType } from '@shared/types'
import type { Repos } from './db/repos'
import { importMedia } from './media/importer'
import { paths } from './paths'
import { log } from './log'

/**
 * Internet section sandbox. Websites run in <webview> guests that are
 * isolated from the app: their own session, no preload/Node, sandboxed, no
 * camera/microphone/notifications, no automatic downloads, and no
 * navigation to non-web URLs.
 */
export const WEB_PARTITION = 'persist:web'

export function setupWebSandbox(): void {
  const ses = session.fromPartition(WEB_PARTITION)
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'fullscreen'))
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'fullscreen')
  ses.on('will-download', (e) => e.preventDefault()) // saving media goes through our own validated download
  // Some sites (and Google sign-in) reject unknown browsers: present as plain Chrome.
  ses.setUserAgent(ses.getUserAgent().replace(/\s(?:WorshipFlow|Electron)\/\S+/g, ''))

  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (event, prefs, params) => {
      delete prefs.preload
      prefs.nodeIntegration = false
      prefs.nodeIntegrationInSubFrames = false
      prefs.contextIsolation = true
      prefs.sandbox = true
      prefs.webSecurity = true
      prefs.partition = WEB_PARTITION
      prefs.autoplayPolicy = 'no-user-gesture-required'
      params.partition = WEB_PARTITION
      if (params.src && !/^https?:\/\//i.test(params.src) && params.src !== 'about:blank') event.preventDefault()
    })
    if (contents.getType() === 'webview') {
      // Pop-ups open in the same view instead of new windows.
      contents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) void contents.loadURL(url)
        return { action: 'deny' }
      })
      contents.on('will-navigate', (e, url) => {
        if (!/^(https?:\/\/|about:blank)/i.test(url)) e.preventDefault()
      })
    }
  })
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg'
}
const LIMITS: Record<MediaType, number> = { image: 50 * 1024 * 1024, video: 2 * 1024 * 1024 * 1024, audio: 300 * 1024 * 1024 }

function webDir(): string {
  const dir = join(paths.library(), 'web')
  mkdirSync(dir, { recursive: true })
  return dir
}

const safeName = (s: string) => s.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'web'

/** Download an image/video/audio file from a web page into the media library. */
export async function saveWebMedia(repos: Repos, url: string, kind: MediaType, name?: string): Promise<MediaItem> {
  if (!/^https?:\/\//i.test(url)) throw new Error('Only files from web (http/https) addresses can be saved. Streaming videos such as YouTube cannot be downloaded — use “Show on screen” instead.')
  const res = await session.fromPartition(WEB_PARTITION).fetch(url)
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`)
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const urlExt = /\.(\w{2,5})(?:$|[?#])/.exec(new URL(url).pathname)?.[1]?.toLowerCase()
  const ext = EXT_BY_TYPE[type] ?? urlExt ?? ''
  const typeKind = type.split('/')[0]
  if (typeKind && typeKind !== kind && !(typeKind === 'application' && urlExt)) {
    throw new Error(`That link is not a downloadable ${kind} file.`)
  }
  if (!ext) throw new Error('Unrecognised file type')
  const limit = LIMITS[kind]
  if (Number(res.headers.get('content-length') ?? 0) > limit) throw new Error('File is too large')
  const base = safeName(name || decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '').replace(/\.\w+$/, '') || kind)
  const file = join(webDir(), `${base}-${Date.now()}.${ext}`)
  let bytes = 0
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      bytes += chunk.length
      cb(bytes > limit ? new Error('File is too large') : null, chunk)
    }
  })
  try {
    await pipeline(Readable.fromWeb(res.body as never), counter, createWriteStream(file))
  } catch (e) {
    try {
      unlinkSync(file)
    } catch {
      /* ignore */
    }
    throw e
  }
  const r = await importMedia(repos, [file], 'Web')
  if (!r.ids[0]) {
    unlinkSync(file)
    throw new Error(r.errors[0] ?? 'Could not add the file to the media library')
  }
  log.info('saved web media', url, statSync(file).size)
  return repos.media.get(r.ids[0])!
}

/** Save a snapshot of a web page (data URL from webview.capturePage) as an image. */
export async function saveWebCapture(repos: Repos, dataUrl: string, title: string): Promise<MediaItem> {
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl)
  if (!m) throw new Error('Invalid capture')
  const file = join(webDir(), `${safeName(title || 'web-page')}-${Date.now()}.${m[1] === 'png' ? 'png' : 'jpg'}`)
  writeFileSync(file, Buffer.from(m[2], 'base64'))
  const r = await importMedia(repos, [file], 'Web')
  if (!r.ids[0]) throw new Error(r.errors[0] ?? 'Could not save the capture')
  const item = repos.media.get(r.ids[0])!
  return title ? repos.media.update(item.id, { name: title.slice(0, 120) }) : item
}
