import { protocol } from 'electron'
import { createReadStream, statSync, existsSync } from 'node:fs'
import { extname, join } from 'node:path'
import { Readable } from 'node:stream'
import { BRAND } from '@shared/brand'
import { paths } from '../paths'
import { mimeFor } from './types'

/**
 * fcmedia://media/<id>  → the media file registered in the database
 * fcmedia://thumb/<id>  → its cached thumbnail
 *
 * Only ids known to the database are served — arbitrary filesystem paths
 * can never be requested. Range requests are supported so video can seek
 * and stream without loading whole files into memory.
 */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: BRAND.mediaScheme,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
    }
  ])
}

export function handleMediaProtocol(pathOf: (id: string) => string | null, onMissing: (id: string) => void): void {
  protocol.handle(BRAND.mediaScheme, (request) => {
    try {
      const url = new URL(request.url)
      const id = decodeURIComponent(url.pathname.replace(/^\//, ''))
      if (!/^[\w-]{1,100}$/.test(id)) return new Response('Bad request', { status: 400 })

      if (url.host === 'thumb') {
        const file = join(paths.thumbnails(), `${id}.jpg`)
        if (!existsSync(file)) return new Response('Not found', { status: 404 })
        return serveFile(file, request, 'image/jpeg', 'public, max-age=31536000')
      }
      if (url.host === 'media') {
        const file = pathOf(id)
        if (!file || !existsSync(file)) {
          if (file) onMissing(id)
          return new Response('Media file unavailable', { status: 404 })
        }
        return serveFile(file, request, mimeFor(extname(file)))
      }
      return new Response('Not found', { status: 404 })
    } catch (e) {
      return new Response(String(e), { status: 500 })
    }
  })
}

function serveFile(file: string, request: Request, type: string, cache = 'no-cache'): Response {
  const size = statSync(file).size
  const range = request.headers.get('range')
  // CORS header lets the app draw frames to a canvas (thumbnail capture). The scheme only serves registered library media.
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': cache, 'Access-Control-Allow-Origin': '*' }

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    let start = m && m[1] ? Number(m[1]) : 0
    let end = m && m[2] ? Number(m[2]) : size - 1
    if (m && !m[1] && m[2]) {
      // suffix range: last N bytes
      start = Math.max(0, size - Number(m[2]))
      end = size - 1
    }
    if (start >= size || end < start) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    }
    end = Math.min(end, size - 1)
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream
    return new Response(stream, {
      status: 206,
      headers: { ...base, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${size}` }
    })
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream
  return new Response(stream, { status: 200, headers: { ...base, 'Content-Length': String(size) } })
}
