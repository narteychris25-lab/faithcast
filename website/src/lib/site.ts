// Everything that changes between releases lives here. To publish a new version, upload
// its installers to the faithcast-releases repo and add an entry to the top of `releases`.
const RELEASES = 'https://github.com/narteychris25-lab/faithcast-releases/releases'

export type Platform = 'windows' | 'mac-arm' | 'mac-intel'

export interface Release {
  version: string
  date: string // ISO date
  title: string
  summary: string
  changes: string[]
  /** Installer sizes, as shown on the download buttons */
  sizes: Record<Platform, string>
}

export const releases: Release[] = [
  {
    version: '0.2.0',
    date: '2026-10-10',
    title: 'Background button and splash screen',
    summary: 'Change the look of the screen in one click, and a clear welcome while FaithCast starts.',
    changes: [
      'New Background button in the top bar: switch the projection background in one click, from any page.',
      'New splash screen while FaithCast starts, showing what it’s doing: opening your library, preparing Bibles, backing up.',
      'The main window now appears only once it’s fully loaded, so there’s no blank window at startup.'
    ],
    sizes: { windows: '143 MB', 'mac-arm': '164 MB', 'mac-intel': '171 MB' }
  },
  {
    version: '0.1.0',
    date: '2026-10-08',
    title: 'First release',
    summary: 'Everything a church needs on Sunday, on Windows and Mac.',
    changes: [
      'Service planner: build the order of service with songs, scripture, media, offering slides and announcements.',
      'Live control with live and next previews, and a key for every action (→ next, B black, C clear, L logo).',
      'Bible with 14 free English versions and EasyWorship-style entry: type joh3:16 and press Enter.',
      'Songs: paste lyrics and FaithCast splits them into slides by verse and chorus.',
      'Themes, a custom slide editor, media library, and YouTube and websites on screen.',
      'Works offline, with automatic backups and crash recovery.'
    ],
    sizes: { windows: '143 MB', 'mac-arm': '164 MB', 'mac-intel': '171 MB' }
  }
]

export const latest = releases[0]
export const VERSION = latest.version

const platforms: Record<Platform, { label: string; short: string; detail: string; file: (v: string) => string }> = {
  windows: { label: 'Windows', short: 'Windows', detail: 'Windows 10 or 11, 64-bit', file: (v) => `FaithCast-Setup-${v}.exe` },
  'mac-arm': { label: 'Mac with Apple silicon', short: 'Mac (Apple silicon)', detail: 'M1 or newer · macOS 11+', file: (v) => `FaithCast-${v}-arm64.dmg` },
  'mac-intel': { label: 'Mac with Intel', short: 'Mac (Intel)', detail: 'Intel processor · macOS 11+', file: (v) => `FaithCast-${v}-x64.dmg` }
}

export const platformOrder: Platform[] = ['windows', 'mac-arm', 'mac-intel']

/** Download details for one platform of one release. */
export function download(release: Release, p: Platform) {
  const file = platforms[p].file(release.version)
  return { ...platforms[p], file, size: release.sizes[p], href: `${RELEASES}/download/v${release.version}/${file}` }
}

/** The latest release's downloads, used by the home page. */
export const downloads = Object.fromEntries(platformOrder.map((p) => [p, download(latest, p)])) as Record<Platform, ReturnType<typeof download>>

export const site = {
  name: 'FaithCast',
  url: 'https://faithcast.vercel.app',
  tagline: 'Worship presentation software anyone can run',
  description:
    'FaithCast is free worship presentation software for Windows and Mac. Put lyrics, scripture, media and announcements on screen from one calm, simple app that works offline.',
  releasesUrl: `${RELEASES}/latest`
}

// Links start with "/" so they also work from the Releases page.
export const nav = [
  { label: 'Features', href: '/#features' },
  { label: 'Bible', href: '/#bible' },
  { label: 'How it works', href: '/#how' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Releases', href: '/releases' },
  { label: 'FAQ', href: '/#faq' }
]

export function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
