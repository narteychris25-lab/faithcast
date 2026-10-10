import type {
  AppSettings,
  Background,
  Church,
  ItemMediaSettings,
  TextStyle,
  ThemeSettings
} from './types'

export const CANVAS_WIDTH = 1920

export function canvasSize(aspect: AppSettings['presentation']['aspectRatio']): { w: number; h: number } {
  switch (aspect) {
    case '4:3':
      return { w: 1440, h: 1080 }
    case '16:10':
      return { w: 1920, h: 1200 }
    default:
      return { w: 1920, h: 1080 }
  }
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Helvetica Neue',
  fontSize: 84,
  fontWeight: 700,
  italic: false,
  uppercase: false,
  color: '#FFFFFF',
  align: 'center',
  vAlign: 'middle',
  lineHeight: 1.25,
  letterSpacing: 0,
  shadow: { enabled: true, color: 'rgba(0,0,0,0.85)', blur: 12, x: 0, y: 3 },
  outline: { enabled: false, color: '#000000', width: 2 },
  box: { enabled: false, color: '#000000', opacity: 0.45, radius: 16, padding: 32 },
  autoFit: true,
  minFontSize: 36
}

export const DEFAULT_BACKGROUND: Background = {
  kind: 'color',
  color: '#000000',
  gradient: { from: '#1e293b', to: '#020617', angle: 160 },
  mediaId: null,
  fit: 'cover',
  posX: 50,
  posY: 50,
  blur: 0,
  dim: 0,
  overlayColor: '#000000',
  overlayOpacity: 0,
  opacity: 1,
  video: { loop: true, muted: true, volume: 0 }
}

export const DEFAULT_MEDIA_SETTINGS: ItemMediaSettings = {
  loop: false,
  volume: 1,
  muted: false,
  fit: 'contain',
  autoPlay: true,
  fadeIn: 0,
  fadeOut: 0
}

function text(overrides: Partial<TextStyle> = {}): TextStyle {
  return {
    ...DEFAULT_TEXT_STYLE,
    ...overrides,
    shadow: { ...DEFAULT_TEXT_STYLE.shadow, ...overrides.shadow },
    outline: { ...DEFAULT_TEXT_STYLE.outline, ...overrides.outline },
    box: { ...DEFAULT_TEXT_STYLE.box, ...overrides.box }
  }
}

function bg(overrides: Partial<Background> = {}): Background {
  return {
    ...DEFAULT_BACKGROUND,
    ...overrides,
    gradient: { ...DEFAULT_BACKGROUND.gradient, ...overrides.gradient },
    video: { ...DEFAULT_BACKGROUND.video, ...overrides.video }
  }
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  text: text(),
  subtext: text({ fontSize: 40, fontWeight: 500, color: '#E5E7EB', autoFit: false, minFontSize: 20 }),
  title: text({ fontSize: 110, fontWeight: 800, uppercase: true, letterSpacing: 2 }),
  textArea: { x: 6, y: 8, w: 88, h: 76 },
  subtextPosition: 'bottom',
  background: bg({ kind: 'gradient' }),
  transition: { type: 'fade', duration: 400 },
  maxLines: 4,
  showLogo: false,
  logoPosition: 'bottom-right'
}

export function themeSettings(overrides: {
  text?: Partial<TextStyle>
  subtext?: Partial<TextStyle>
  title?: Partial<TextStyle>
  background?: Partial<Background>
  rest?: Partial<Omit<ThemeSettings, 'text' | 'subtext' | 'title' | 'background'>>
}): ThemeSettings {
  return {
    ...DEFAULT_THEME_SETTINGS,
    ...overrides.rest,
    text: text({ ...DEFAULT_THEME_SETTINGS.text, ...overrides.text }),
    subtext: text({ ...DEFAULT_THEME_SETTINGS.subtext, ...overrides.subtext }),
    title: text({ ...DEFAULT_THEME_SETTINGS.title, ...overrides.title }),
    background: bg({ ...DEFAULT_THEME_SETTINGS.background, ...overrides.background })
  }
}

/** Original built-in themes. Stable ids so demo data and settings can reference them. */
export const BUILTIN_THEMES: { id: string; name: string; settings: ThemeSettings }[] = [
  {
    id: 'theme-classic',
    name: 'Classic',
    settings: themeSettings({
      text: { fontFamily: 'Georgia', fontWeight: 700, fontSize: 80 },
      subtext: { fontFamily: 'Georgia', italic: true },
      title: { fontFamily: 'Georgia', uppercase: false },
      background: { kind: 'gradient', gradient: { from: '#1f3a5f', to: '#0b1320', angle: 180 } }
    })
  },
  {
    id: 'theme-modern',
    name: 'Modern',
    settings: themeSettings({
      text: { fontFamily: 'Avenir Next', fontWeight: 600, fontSize: 88, letterSpacing: 0.5 },
      subtext: { fontFamily: 'Avenir Next' },
      title: { fontFamily: 'Avenir Next' },
      background: { kind: 'gradient', gradient: { from: '#4338ca', to: '#0f172a', angle: 135 } },
      rest: { transition: { type: 'crossfade', duration: 500 } }
    })
  },
  {
    id: 'theme-minimal',
    name: 'Minimal',
    settings: themeSettings({
      text: { fontFamily: 'Helvetica Neue', fontWeight: 400, fontSize: 78, shadow: { enabled: false, color: '#000', blur: 0, x: 0, y: 0 } },
      subtext: { fontFamily: 'Helvetica Neue', color: '#A3A3A3' },
      title: { fontFamily: 'Helvetica Neue', fontWeight: 300 },
      background: { kind: 'color', color: '#0A0A0A' },
      rest: { transition: { type: 'fade', duration: 250 } }
    })
  },
  {
    id: 'theme-worship',
    name: 'Worship',
    settings: themeSettings({
      text: { fontFamily: 'Avenir Next', fontWeight: 700, fontSize: 90 },
      background: { kind: 'gradient', gradient: { from: '#7c2d12', to: '#1c0a05', angle: 200 }, dim: 0.1 },
      rest: { transition: { type: 'dissolve', duration: 700 } }
    })
  },
  {
    id: 'theme-dark',
    name: 'Dark',
    settings: themeSettings({
      text: { color: '#F5F5F5' },
      background: { kind: 'color', color: '#000000' },
      rest: { transition: { type: 'fade', duration: 300 } }
    })
  },
  {
    id: 'theme-elegant',
    name: 'Elegant',
    settings: themeSettings({
      text: { fontFamily: 'Baskerville', fontWeight: 600, fontSize: 82, italic: false, color: '#FDF6E3' },
      subtext: { fontFamily: 'Baskerville', italic: true, color: '#D6C7A1' },
      title: { fontFamily: 'Baskerville', color: '#E7C873', uppercase: false },
      background: { kind: 'gradient', gradient: { from: '#2b2118', to: '#0d0a07', angle: 170 } },
      rest: { transition: { type: 'crossfade', duration: 800 } }
    })
  },
  {
    id: 'theme-youth',
    name: 'Youth',
    settings: themeSettings({
      text: { fontFamily: 'Futura', fontWeight: 800, fontSize: 92, uppercase: true, letterSpacing: 1, box: { enabled: true, color: '#000000', opacity: 0.35, radius: 24, padding: 36 } },
      subtext: { fontFamily: 'Futura', uppercase: true },
      title: { fontFamily: 'Futura', color: '#FACC15' },
      background: { kind: 'gradient', gradient: { from: '#db2777', to: '#312e81', angle: 120 } },
      rest: { transition: { type: 'slide', duration: 350 } }
    })
  },
  {
    id: 'theme-lower-third',
    name: 'Lower Third',
    settings: themeSettings({
      text: { fontSize: 64, vAlign: 'bottom', box: { enabled: true, color: '#000000', opacity: 0.6, radius: 12, padding: 28 } },
      background: { kind: 'none' },
      rest: { textArea: { x: 5, y: 62, w: 90, h: 32 }, maxLines: 2, subtextPosition: 'below' }
    })
  }
]

export const DEFAULT_THEME_ID = 'theme-modern'

export const DEFAULT_SHORTCUTS: AppSettings['shortcuts'] = {
  next: ['ArrowRight', 'Space', 'ArrowDown', 'PageDown'],
  previous: ['ArrowLeft', 'ArrowUp', 'PageUp'],
  firstSlide: ['Home'],
  lastSlide: ['End'],
  nextItem: ['Shift+ArrowRight', 'KeyN'],
  previousItem: ['Shift+ArrowLeft', 'KeyP'],
  black: ['KeyB', 'Period'],
  clear: ['KeyC'],
  logo: ['KeyL'],
  pause: ['KeyK'],
  exit: ['Escape'],
  search: ['Mod+KeyK', 'Mod+KeyF']
}

export const SHORTCUT_LABELS: Record<keyof AppSettings['shortcuts'], string> = {
  next: 'Next slide',
  previous: 'Previous slide',
  firstSlide: 'First slide',
  lastSlide: 'Last slide',
  nextItem: 'Next service item',
  previousItem: 'Previous service item',
  black: 'Black screen',
  clear: 'Clear text',
  logo: 'Show logo',
  pause: 'Pause / resume media',
  exit: 'Exit presentation',
  search: 'Global search'
}

export const DEFAULT_SETTINGS: AppSettings = {
  setupComplete: false,
  defaultThemeId: DEFAULT_THEME_ID,
  appearance: 'light',
  uiScale: 1,
  highContrast: false,
  autoAdvanceToNextItem: true,
  confirmExitPresentation: true,
  presentation: {
    aspectRatio: '16:9',
    outputDisplayId: null,
    fullscreenMode: 'borderless',
    previewWindowScale: 0.5,
    defaultTransition: { type: 'fade', duration: 400 },
    showLogoOnBlack: false,
    backgroundThemeId: null
  },
  audio: { outputDeviceId: 'default', defaultVolume: 0.8 },
  bible: { defaultTranslationId: null, versesPerSlide: 1, showReference: true },
  songs: { maxLinesPerSlide: 4, showCopyrightOnFirstSlide: true, showCopyrightOnLastSlide: false },
  backup: { autoBackup: true, keep: 14, lastBackupAt: null },
  shortcuts: DEFAULT_SHORTCUTS
}

export const DEFAULT_CHURCH: Church = {
  name: '',
  logoMediaId: null,
  address: '',
  website: '',
  phone: '',
  email: '',
  social: { facebook: '', instagram: '', youtube: '', x: '' }
}

/** Deep-merge stored settings over defaults so new keys added in updates get defaults. */
export function mergeSettings(stored: unknown): AppSettings {
  return deepMerge(DEFAULT_SETTINGS, stored) as AppSettings
}

export function deepMerge<T>(base: T, over: unknown): T {
  if (over === undefined) return base
  // null may clear a scalar/nullable value, but never replaces an object.
  if (over === null) return (base !== null && typeof base === 'object' ? base : null) as T
  if (Array.isArray(base) || typeof base !== 'object' || base === null) {
    return (typeof over === typeof base || base === null ? over : base) as T
  }
  if (typeof over !== 'object' || Array.isArray(over)) return base
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k]
    out[k] = b === undefined ? v : deepMerge(b, v)
  }
  return out as T
}
