/**
 * Domain model shared by the main process, preload and renderers.
 * Everything here must be plain serialisable data (it crosses IPC).
 */

// ---------------------------------------------------------------- styling

export type HAlign = 'left' | 'center' | 'right'
export type VAlign = 'top' | 'middle' | 'bottom'
export type TransitionType = 'cut' | 'fade' | 'crossfade' | 'dissolve' | 'slide'
export type MediaFit = 'cover' | 'contain' | 'stretch'

export interface TextStyle {
  fontFamily: string
  fontSize: number // logical px on a 1920-wide canvas
  fontWeight: number
  italic: boolean
  uppercase: boolean
  color: string
  align: HAlign
  vAlign: VAlign
  lineHeight: number // multiplier
  letterSpacing: number // px
  shadow: { enabled: boolean; color: string; blur: number; x: number; y: number }
  outline: { enabled: boolean; color: string; width: number }
  /** Semi-transparent box behind the text block, useful over busy video. */
  box: { enabled: boolean; color: string; opacity: number; radius: number; padding: number }
  /** Shrink text to fit the text area when it would overflow. */
  autoFit: boolean
  minFontSize: number
}

/** Rectangle expressed as percentages (0–100) of the canvas. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Background {
  kind: 'none' | 'color' | 'gradient' | 'image' | 'video'
  color: string
  gradient: { from: string; to: string; angle: number }
  mediaId: string | null
  fit: MediaFit
  /** Focal point in percent, used for cover/contain positioning. */
  posX: number
  posY: number
  blur: number // px
  /** Black dimming layer opacity 0..1 — keeps text readable. */
  dim: number
  overlayColor: string
  overlayOpacity: number // 0..1
  opacity: number // media opacity 0..1
  video: { loop: boolean; muted: boolean; volume: number }
}

export interface Transition {
  type: TransitionType
  duration: number // ms
}

export interface ThemeSettings {
  text: TextStyle
  /** Secondary text: Bible reference, song copyright footer, announcement details. */
  subtext: TextStyle
  /** Title text used by announcements. */
  title: TextStyle
  textArea: Rect
  subtextPosition: 'below' | 'bottom' | 'top'
  background: Background
  transition: Transition
  maxLines: number
  showLogo: boolean
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export interface Theme {
  id: string
  name: string
  builtin: boolean
  settings: ThemeSettings
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------- songs

export type SectionType =
  | 'verse'
  | 'chorus'
  | 'pre-chorus'
  | 'bridge'
  | 'tag'
  | 'intro'
  | 'ending'
  | 'other'

export interface SongSection {
  id: string
  type: SectionType
  label: string // "Verse 1", "Chorus"
  text: string // lines separated by \n; a blank line forces a slide break
}

export interface Song {
  id: string
  title: string
  author: string
  copyright: string
  ccli: string
  category: string
  tags: string[]
  notes: string
  sections: SongSection[]
  /** Ordered list of section ids; empty = sections in natural order. */
  arrangement: string[]
  themeId: string | null
  demo: boolean
  createdAt: string
  updatedAt: string
}

export type SongSummary = Pick<
  Song,
  'id' | 'title' | 'author' | 'category' | 'tags' | 'demo' | 'updatedAt' | 'createdAt'
> & { firstLine: string }

// ---------------------------------------------------------------- media

export type MediaType = 'image' | 'video' | 'audio'

export interface MediaItem {
  id: string
  name: string
  type: MediaType
  path: string
  size: number
  width: number | null
  height: number | null
  duration: number | null // seconds
  tags: string[]
  favorite: boolean
  folder: string
  hasThumbnail: boolean
  missing: boolean
  demo: boolean
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------- bible

export interface BibleTranslation {
  id: string
  abbreviation: string
  name: string
  language: string
  license: string
  builtin: boolean
  verseCount: number
}

export interface BibleVerse {
  book: number // 1..66
  chapter: number
  verse: number
  text: string
}

export interface BibleReference {
  translationId: string
  book: number
  chapter: number
  verseStart: number
  verseEnd: number
}

/** A Bible version shipped with the app that can be installed with one click. */
export interface BibleLibraryEntry {
  code: string
  abbreviation: string
  name: string
  language: string
  license: string
  status: 'public-domain' | 'open'
  verses: number
  installed: boolean
  /** KJV and BSB: installed on first launch, reinstallable from here if removed. */
  core?: boolean
}

export interface BibleImportResult {
  imported: BibleTranslation[]
  errors: string[]
  /** e.g. licence reminders for copyrighted versions. */
  warnings: string[]
}

/** A passage saved in the Bible page's scripture schedule, ready to present with one click. */
export interface ScheduledPassage extends BibleReference {
  id: string
  position: number
  versesPerSlide: number
  label: string // "John 3:16-18 (KJV)"
}

export interface BiblePassage extends BibleReference {
  id: string
  label: string // "John 3:16-18 (KJV)"
  favorite: boolean
  usedAt: string
}

// ---------------------------------------------------------------- custom slides

export type SlideElementKind = 'text' | 'image' | 'video' | 'shape' | 'line' | 'icon'

export interface SlideElement {
  id: string
  kind: SlideElementKind
  // Geometry in logical canvas px (1920×1080 for 16:9)
  x: number
  y: number
  w: number
  h: number
  rotation: number
  opacity: number
  locked?: boolean
  // text
  text?: string
  style?: Partial<TextStyle>
  // image / video
  mediaId?: string | null
  fit?: MediaFit
  loop?: boolean
  muted?: boolean
  // shape / line
  shape?: 'rect' | 'ellipse' | 'triangle'
  fill?: string
  stroke?: string
  strokeWidth?: number
  radius?: number
  // icon (from a built-in, original SVG path set)
  icon?: string
}

export interface CustomSlide {
  id: string
  label: string
  background: Background | null // null = use theme background
  elements: SlideElement[]
  notes: string
}

// ---------------------------------------------------------------- services

export type ServiceItemType =
  | 'song'
  | 'bible'
  | 'image'
  | 'video'
  | 'audio'
  | 'announcement'
  | 'custom'
  | 'sermon'
  | 'offering'
  | 'prayer'
  | 'header'
  | 'web'
  | 'other'

export interface AnnouncementData {
  title: string
  description: string
  date: string
  time: string
  location: string
  imageMediaId: string | null
}

export interface ItemMediaSettings {
  loop: boolean
  volume: number // 0..1
  muted: boolean
  fit: MediaFit
  autoPlay: boolean
  fadeIn: number // seconds (audio)
  fadeOut: number // seconds (audio)
}

/** Type-specific payload of a service item. Only the relevant keys are set. */
export interface ServiceItemData {
  bible?: BibleReference & { versesPerSlide: number }
  mediaId?: string
  media?: ItemMediaSettings
  announcement?: AnnouncementData
  slides?: CustomSlide[]
  /** Plain text body for sermon / prayer / offering / other items. */
  body?: string
  /** Song arrangement override for this service only. */
  arrangement?: string[]
  /** Web page shown on the output (Internet items). */
  web?: { url: string; title: string }
}

export interface ServiceItem {
  id: string
  serviceId: string
  position: number
  type: ServiceItemType
  title: string
  refId: string | null // song id etc.
  data: ServiceItemData
  themeId: string | null
  background: Background | null
  transition: Transition | null
  hidden: boolean
  locked: boolean
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Service {
  id: string
  name: string
  date: string // YYYY-MM-DD
  time: string
  notes: string
  themeId: string | null
  background: Background | null
  demo: boolean
  createdAt: string
  updatedAt: string
  openedAt: string | null
}

export interface ServiceSummary extends Service {
  itemCount: number
}

export interface ServiceWithItems extends Service {
  items: ServiceItem[]
}

// ---------------------------------------------------------------- church & settings

export interface Church {
  name: string
  logoMediaId: string | null
  address: string
  website: string
  phone: string
  email: string
  social: { facebook: string; instagram: string; youtube: string; x: string }
}

export type ShortcutAction =
  | 'next'
  | 'previous'
  | 'firstSlide'
  | 'lastSlide'
  | 'nextItem'
  | 'previousItem'
  | 'black'
  | 'clear'
  | 'logo'
  | 'pause'
  | 'exit'
  | 'search'

export interface AppSettings {
  setupComplete: boolean
  defaultThemeId: string | null
  /** Operator interface appearance (default light). The audience output is unaffected. */
  appearance: 'dark' | 'light' | 'system'
  uiScale: number
  highContrast: boolean
  autoAdvanceToNextItem: boolean
  confirmExitPresentation: boolean
  presentation: {
    aspectRatio: '16:9' | '16:10' | '4:3'
    outputDisplayId: number | null
    fullscreenMode: 'borderless' | 'native'
    previewWindowScale: number
    defaultTransition: Transition
    showLogoOnBlack: boolean
  }
  audio: { outputDeviceId: string; defaultVolume: number }
  bible: { defaultTranslationId: string | null; versesPerSlide: number; showReference: boolean }
  songs: { maxLinesPerSlide: number; showCopyrightOnFirstSlide: boolean; showCopyrightOnLastSlide: boolean }
  backup: { autoBackup: boolean; keep: number; lastBackupAt: string | null }
  shortcuts: Record<ShortcutAction, string[]>
}

// ---------------------------------------------------------------- rendering & live

export type RenderSlideKind = 'text' | 'media' | 'custom' | 'announcement' | 'web' | 'blank'

/**
 * A fully resolved slide: everything the output window needs to draw it,
 * with no further database lookups. Media are referenced by id and loaded
 * through the wfmedia:// protocol.
 */
export interface RenderSlide {
  key: string
  kind: RenderSlideKind
  label: string
  group: string // section label e.g. "Chorus"
  text: string
  subtext: string
  title: string
  theme: ThemeSettings
  background: Background
  media: { mediaId: string; type: 'image' | 'video'; settings: ItemMediaSettings } | null
  elements: SlideElement[]
  logoMediaId: string | null
  /** For kind 'web': the page to show (YouTube links are converted to the embed player). */
  web?: { url: string; title: string }
}

export type OutputMode = 'normal' | 'black' | 'clear' | 'logo'

export interface LiveState {
  serviceId: string | null
  itemId: string | null
  itemTitle: string
  slideIndex: number
  slideCount: number
  slide: RenderSlide | null
  nextSlide: RenderSlide | null
  mode: OutputMode
  paused: boolean
  transition: Transition
  aspectRatio: AppSettings['presentation']['aspectRatio']
  logoMediaId: string | null
  /** Incremented to ask the output to restart the current video. */
  videoCommand: { seq: number; action: 'play' | 'pause' | 'restart' | 'seek'; time?: number; volume?: number; muted?: boolean }
}

export interface VideoStatus {
  mediaId: string | null
  playing: boolean
  currentTime: number
  duration: number
  error: string | null
  muted?: boolean
  volume?: number
}

export interface DisplayInfo {
  id: number
  label: string
  width: number
  height: number
  scaleFactor: number
  refreshRate: number
  primary: boolean
  internal: boolean
  bounds: { x: number; y: number; width: number; height: number }
}

export interface OutputStatus {
  open: boolean
  displayId: number | null
  displayLabel: string
  fullscreen: boolean
  width: number
  height: number
  previewMode: boolean
}

export interface RecoveryInfo {
  crashed: boolean
  lastLive: { serviceId: string; itemId: string | null; slideIndex: number; at: string } | null
  drafts: { key: string; label: string; updatedAt: string }[]
}

export interface BackupInfo {
  file: string
  name: string
  size: number
  createdAt: string
  reason: string
}

export interface SearchResult {
  kind: 'song' | 'service' | 'media' | 'theme' | 'bible' | 'slide'
  id: string
  title: string
  subtitle: string
  /** For bible hits. */
  ref?: BibleReference
  /** For slide hits: the owning service. */
  serviceId?: string
}

export interface DashboardData {
  recent: ServiceSummary[]
  today: ServiceSummary[]
  upcoming: ServiceSummary[]
  counts: { songs: number; services: number; media: number; themes: number; translations: number }
}
