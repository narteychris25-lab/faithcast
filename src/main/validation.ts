import { z } from 'zod'

/**
 * Runtime validation for everything that enters the main process from a
 * renderer or from an imported file. Unknown keys are stripped.
 */

const str = (max = 500) => z.string().max(max)
const id = z.string().min(1).max(100)
const color = z.string().max(64)
const num = (min: number, max: number) => z.number().finite().min(min).max(max)

export const TextStyleSchema = z.object({
  fontFamily: str(120),
  fontSize: num(4, 600),
  fontWeight: num(100, 900),
  italic: z.boolean(),
  uppercase: z.boolean(),
  color,
  align: z.enum(['left', 'center', 'right']),
  vAlign: z.enum(['top', 'middle', 'bottom']),
  lineHeight: num(0.5, 4),
  letterSpacing: num(-20, 100),
  shadow: z.object({ enabled: z.boolean(), color, blur: num(0, 200), x: num(-200, 200), y: num(-200, 200) }),
  outline: z.object({ enabled: z.boolean(), color, width: num(0, 40) }),
  box: z.object({ enabled: z.boolean(), color, opacity: num(0, 1), radius: num(0, 400), padding: num(0, 400) }),
  autoFit: z.boolean(),
  minFontSize: num(4, 600)
})

export const RectSchema = z.object({ x: num(-100, 200), y: num(-100, 200), w: num(0, 300), h: num(0, 300) })

export const BackgroundSchema = z.object({
  kind: z.enum(['none', 'color', 'gradient', 'image', 'video']),
  color,
  gradient: z.object({ from: color, to: color, angle: num(-360, 720) }),
  mediaId: id.nullable(),
  fit: z.enum(['cover', 'contain', 'stretch']),
  posX: num(0, 100),
  posY: num(0, 100),
  blur: num(0, 100),
  dim: num(0, 1),
  overlayColor: color,
  overlayOpacity: num(0, 1),
  opacity: num(0, 1),
  video: z.object({ loop: z.boolean(), muted: z.boolean(), volume: num(0, 1) })
})

export const TransitionSchema = z.object({
  type: z.enum(['cut', 'fade', 'crossfade', 'dissolve', 'slide']),
  duration: num(0, 5000)
})

export const ThemeSettingsSchema = z.object({
  text: TextStyleSchema,
  subtext: TextStyleSchema,
  title: TextStyleSchema,
  textArea: RectSchema,
  subtextPosition: z.enum(['below', 'bottom', 'top']),
  background: BackgroundSchema,
  transition: TransitionSchema,
  maxLines: num(1, 20),
  showLogo: z.boolean(),
  logoPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
})

export const SectionSchema = z.object({
  id,
  type: z.enum(['verse', 'chorus', 'pre-chorus', 'bridge', 'tag', 'intro', 'ending', 'other']),
  label: str(80),
  text: str(20000)
})

export const SongInputSchema = z.object({
  id: id.optional(),
  title: str(300),
  author: str(500).optional(),
  copyright: str(1000).optional(),
  ccli: str(50).optional(),
  category: str(100).optional(),
  tags: z.array(str(60)).max(50).optional(),
  notes: str(10000).optional(),
  sections: z.array(SectionSchema).max(200),
  arrangement: z.array(id).max(500).optional(),
  themeId: id.nullable().optional()
})

export const SlideElementSchema = z.object({
  id,
  kind: z.enum(['text', 'image', 'video', 'shape', 'line', 'icon']),
  x: num(-10000, 10000),
  y: num(-10000, 10000),
  w: num(0, 20000),
  h: num(0, 20000),
  rotation: num(-3600, 3600),
  opacity: num(0, 1),
  locked: z.boolean().optional(),
  text: str(20000).optional(),
  style: TextStyleSchema.partial().optional(),
  mediaId: id.nullable().optional(),
  fit: z.enum(['cover', 'contain', 'stretch']).optional(),
  loop: z.boolean().optional(),
  muted: z.boolean().optional(),
  shape: z.enum(['rect', 'ellipse', 'triangle']).optional(),
  fill: color.optional(),
  stroke: color.optional(),
  strokeWidth: num(0, 200).optional(),
  radius: num(0, 2000).optional(),
  icon: str(60).optional()
})

export const CustomSlideSchema = z.object({
  id,
  label: str(200),
  background: BackgroundSchema.nullable(),
  elements: z.array(SlideElementSchema).max(200),
  notes: str(10000)
})

const MediaSettingsSchema = z.object({
  loop: z.boolean(),
  volume: num(0, 1),
  muted: z.boolean(),
  fit: z.enum(['cover', 'contain', 'stretch']),
  autoPlay: z.boolean(),
  fadeIn: num(0, 60),
  fadeOut: num(0, 60)
})

const BibleRefSchema = z.object({
  translationId: id,
  book: z.number().int().min(1).max(66),
  chapter: z.number().int().min(1).max(200),
  verseStart: z.number().int().min(1).max(200),
  verseEnd: z.number().int().min(1).max(200)
})

export const ItemDataSchema = z.object({
  bible: BibleRefSchema.extend({ versesPerSlide: z.number().int().min(0).max(20) }).optional(),
  mediaId: id.optional(),
  media: MediaSettingsSchema.optional(),
  announcement: z
    .object({
      title: str(300),
      description: str(5000),
      date: str(100),
      time: str(100),
      location: str(300),
      imageMediaId: id.nullable()
    })
    .optional(),
  slides: z.array(CustomSlideSchema).max(500).optional(),
  body: str(50000).optional(),
  arrangement: z.array(id).max(500).optional(),
  web: z.object({ url: z.string().max(4000).regex(/^https?:\/\//i, 'Only web (http/https) addresses are allowed'), title: str(300) }).optional()
})

export const ItemTypeSchema = z.enum([
  'song',
  'bible',
  'image',
  'video',
  'audio',
  'announcement',
  'custom',
  'sermon',
  'offering',
  'prayer',
  'header',
  'web',
  'other'
])

export const ItemInputSchema = z.object({
  type: ItemTypeSchema,
  title: str(300),
  refId: id.nullable().optional(),
  data: ItemDataSchema.optional(),
  themeId: id.nullable().optional(),
  background: BackgroundSchema.nullable().optional(),
  transition: TransitionSchema.nullable().optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  notes: str(10000).optional()
})

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

export const ServiceInputSchema = z.object({
  name: str(300),
  date: dateStr,
  time: str(20).optional(),
  notes: str(10000).optional(),
  themeId: id.nullable().optional(),
  background: BackgroundSchema.nullable().optional()
})

export const ChurchSchema = z
  .object({
    name: str(200),
    logoMediaId: id.nullable(),
    address: str(500),
    website: str(300),
    phone: str(60),
    email: str(200),
    social: z.object({ facebook: str(300), instagram: str(300), youtube: str(300), x: str(300) }).partial()
  })
  .partial()

export const RenderSlideSchema = z.any() // live payloads are produced by our own renderer; size-limited below

export const WfBibleSchema = z.object({
  format: z.literal('worshipflow-bible'),
  version: z.literal(1),
  abbreviation: z.string().min(1).max(12).regex(/^[\w-]+$/, 'Abbreviation may only contain letters, numbers, - and _'),
  name: z.string().min(1).max(200),
  language: z.string().max(20).optional(),
  license: z.string().max(1000).optional(),
  books: z
    .array(z.object({ number: z.number().int().min(1).max(66), chapters: z.array(z.array(z.string().max(5000)).max(200)).max(200) }))
    .min(1)
    .max(66)
})

export function parse<T>(schema: z.ZodType<T>, value: unknown, what = 'input'): T {
  const r = schema.safeParse(value)
  if (!r.success) {
    const issue = r.error.issues[0]
    throw new Error(`Invalid ${what}: ${issue.path.join('.') || 'value'} — ${issue.message}`)
  }
  return r.data
}

export { z }
