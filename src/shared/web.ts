/** Helpers for the Internet section and web slides. */

const YT_HOSTS = /^(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)$/i

/** Extract a YouTube video id from watch, short, embed or youtu.be links. */
export function youtubeId(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (!YT_HOSTS.test(u.hostname)) return null
  const id =
    u.hostname.endsWith('youtu.be')
      ? u.pathname.slice(1)
      : u.searchParams.get('v') ?? /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(u.pathname)?.[1] ?? null
  return id && /^[\w-]{6,20}$/.test(id) ? id : null
}

/** Start time in seconds from t= / start= ("90", "1m30s"). */
function startSeconds(u: URL): number {
  const t = u.searchParams.get('t') ?? u.searchParams.get('start')
  if (!t) return 0
  if (/^\d+$/.test(t)) return Number(t)
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t)
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0
}

/**
 * URL to load on the audience output: YouTube videos become the clean
 * full-screen embed player (autoplay); other pages are shown as they are.
 */
export function outputUrl(url: string): string {
  const id = youtubeId(url)
  if (!id) return url
  const start = startSeconds(new URL(url))
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1${start ? `&start=${start}` : ''}`
}

/** Address-bar input → URL: full URLs, bare domains, or a web search. */
export function toUrl(input: string): string {
  const s = input.trim()
  if (!s) return 'about:blank'
  if (/^https?:\/\//i.test(s)) return s
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s) && !/\s/.test(s)) return `https://${s}`
  return `https://www.google.com/search?q=${encodeURIComponent(s)}`
}

export function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/** Tidy a lyrics page title into a song title: "Amazing Grace Lyrics - Hymn | Site" → "Amazing Grace". */
export function songTitleFromPage(title: string): string {
  return title
    .split(/\s[|–—-]\s/)[0]
    .replace(/\s*\(?\blyrics?\b\)?\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
