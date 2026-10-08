import { Globe } from 'lucide-react'
import { youtubeId } from '@shared/web'

/**
 * A web page on a slide. In operator previews it is a static card so
 * thumbnails never load websites or play sound. (The live page on the
 * audience output is rendered by OutputApp — see LiveWebPage.)
 */
export function WebSlide({ url, title, live }: { url: string; title: string; live: boolean }) {
  // On the output the page is drawn by OutputApp at real pixel size: web views
  // don't render correctly inside the CSS-scaled slide canvas.
  if (live) return null
  const yt = youtubeId(url)
  let host = ''
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    /* ignore */
  }
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {yt && <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} />}
      <div style={{ position: 'relative', textAlign: 'center', color: '#fff', fontFamily: '-apple-system, Helvetica, sans-serif', padding: 80 }}>
        <Globe width={140} height={140} strokeWidth={1.2} style={{ opacity: 0.85 }} />
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 30, textShadow: '0 4px 20px rgba(0,0,0,.8)' }}>{title || host}</div>
        <div style={{ fontSize: 40, opacity: 0.75, marginTop: 10 }}>{yt ? 'YouTube video' : host}</div>
      </div>
    </div>
  )
}
