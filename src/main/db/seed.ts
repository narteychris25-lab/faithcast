import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { DEFAULT_BACKGROUND, DEFAULT_MEDIA_SETTINGS } from '@shared/defaults'
import { parseLyrics } from '@shared/lyrics'
import type { Repos } from './repos'
import type { FcBibleFile } from './repos/bible'
import { paths } from '../paths'
import { log } from '../log'

/** Install bundled public-domain Bibles once. */
/**
 * Demo media lives inside the app bundle, so its stored paths break when the
 * app moves or is renamed (e.g. WorshipFlow.app → FaithCast.app). Point any
 * missing demo file back at this copy of the app's resources.
 */
export function relinkDemoMedia(repos: Repos): void {
  const demoDir = join(paths.resources(), 'demo')
  const rows = repos.db.prepare('SELECT id, path FROM media WHERE demo = 1').all() as { id: string; path: string }[]
  const update = repos.db.prepare('UPDATE OR IGNORE media SET path = ?, missing = 0 WHERE id = ?')
  for (const r of rows) {
    if (existsSync(r.path)) continue
    const here = join(demoDir, basename(r.path))
    if (here !== r.path && existsSync(here)) update.run(here, r.id)
  }
}

export function seedBibles(repos: Repos): void {
  if (repos.settings.getState('biblesSeeded', false)) return
  const dir = join(paths.resources(), 'bibles')
  if (!existsSync(dir)) return
  const t0 = Date.now()
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.fcbible.json.gz')).sort()) {
    try {
      const data = JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString('utf8')) as FcBibleFile
      if (!repos.bible.hasTranslation(data.abbreviation)) repos.bible.importTranslation(data, true)
    } catch (e) {
      log.error('bible seed failed', f, e)
    }
  }
  const translations = repos.bible.translations()
  const settings = repos.settings.get()
  if (!settings.bible.defaultTranslationId && translations[0]) {
    repos.settings.save({ bible: { defaultTranslationId: translations.find((t) => t.abbreviation === 'KJV')?.id ?? translations[0].id } })
  }
  repos.settings.setState('biblesSeeded', true)
  log.info(`bibles seeded in ${Date.now() - t0}ms`)
}

// Public-domain hymn texts used for demo content.
const DEMO_SONGS: { title: string; author: string; lyrics: string; order?: string[] }[] = [
  {
    title: 'Amazing Grace',
    author: 'John Newton (1779)',
    lyrics: `[Verse 1]
Amazing grace! How sweet the sound
That saved a wretch like me!
I once was lost, but now am found;
Was blind, but now I see.

[Verse 2]
'Twas grace that taught my heart to fear,
And grace my fears relieved;
How precious did that grace appear
The hour I first believed.

[Verse 3]
Through many dangers, toils and snares,
I have already come;
'Tis grace hath brought me safe thus far,
And grace will lead me home.

[Verse 4]
The Lord has promised good to me,
His Word my hope secures;
He will my Shield and Portion be,
As long as life endures.

[Verse 5]
When we've been there ten thousand years,
Bright shining as the sun,
We've no less days to sing God's praise
Than when we'd first begun.`
  },
  {
    title: 'Holy, Holy, Holy',
    author: 'Reginald Heber (1826)',
    lyrics: `[Verse 1]
Holy, holy, holy! Lord God Almighty!
Early in the morning our song shall rise to Thee;
Holy, holy, holy, merciful and mighty!
God in three Persons, blessed Trinity!

[Verse 2]
Holy, holy, holy! All the saints adore Thee,
Casting down their golden crowns around the glassy sea;
Cherubim and seraphim falling down before Thee,
Which wert, and art, and evermore shalt be.

[Verse 3]
Holy, holy, holy! Though the darkness hide Thee,
Though the eye of sinful man Thy glory may not see;
Only Thou art holy; there is none beside Thee,
Perfect in power, in love, and purity.

[Verse 4]
Holy, holy, holy! Lord God Almighty!
All Thy works shall praise Thy name, in earth, and sky, and sea;
Holy, holy, holy; merciful and mighty!
God in three Persons, blessed Trinity!`
  },
  {
    title: 'It Is Well with My Soul',
    author: 'Horatio G. Spafford (1873)',
    lyrics: `[Verse 1]
When peace like a river attendeth my way,
When sorrows like sea billows roll;
Whatever my lot, Thou hast taught me to say,
It is well, it is well with my soul.

[Chorus]
It is well (it is well)
With my soul (with my soul),
It is well, it is well with my soul.

[Verse 2]
Though Satan should buffet, though trials should come,
Let this blest assurance control,
That Christ has regarded my helpless estate,
And hath shed His own blood for my soul.

[Verse 3]
My sin, oh, the bliss of this glorious thought!
My sin, not in part but the whole,
Is nailed to the cross, and I bear it no more,
Praise the Lord, praise the Lord, O my soul!

[Verse 4]
And Lord, haste the day when my faith shall be sight,
The clouds be rolled back as a scroll;
The trump shall resound, and the Lord shall descend,
Even so, it is well with my soul.`,
    order: ['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Verse 3', 'Chorus', 'Verse 4', 'Chorus']
  },
  {
    title: 'Blessed Assurance',
    author: 'Fanny J. Crosby (1873)',
    lyrics: `[Verse 1]
Blessed assurance, Jesus is mine!
O what a foretaste of glory divine!
Heir of salvation, purchase of God,
Born of His Spirit, washed in His blood.

[Chorus]
This is my story, this is my song,
Praising my Savior all the day long;
This is my story, this is my song,
Praising my Savior all the day long.

[Verse 2]
Perfect submission, perfect delight,
Visions of rapture now burst on my sight;
Angels descending bring from above
Echoes of mercy, whispers of love.

[Verse 3]
Perfect submission, all is at rest;
I in my Savior am happy and blest,
Watching and waiting, looking above,
Filled with His goodness, lost in His love.`,
    order: ['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Verse 3', 'Chorus']
  },
  {
    title: 'Be Thou My Vision',
    author: 'Irish hymn, tr. Mary E. Byrne (1905), vers. Eleanor H. Hull (1912)',
    lyrics: `[Verse 1]
Be Thou my Vision, O Lord of my heart;
Naught be all else to me, save that Thou art.
Thou my best Thought, by day or by night,
Waking or sleeping, Thy presence my light.

[Verse 2]
Be Thou my Wisdom, and Thou my true Word;
I ever with Thee and Thou with me, Lord;
Thou my great Father, I Thy true son;
Thou in me dwelling, and I with Thee one.

[Verse 3]
Riches I heed not, nor man's empty praise,
Thou mine Inheritance, now and always:
Thou and Thou only, first in my heart,
High King of Heaven, my Treasure Thou art.

[Verse 4]
High King of Heaven, my victory won,
May I reach Heaven's joys, O bright Heaven's Sun!
Heart of my own heart, whatever befall,
Still be my Vision, O Ruler of all.`
  },
  {
    title: 'Come, Thou Fount of Every Blessing',
    author: 'Robert Robinson (1758)',
    lyrics: `[Verse 1]
Come, Thou Fount of every blessing,
Tune my heart to sing Thy grace;
Streams of mercy, never ceasing,
Call for songs of loudest praise.
Teach me some melodious sonnet,
Sung by flaming tongues above;
Praise the mount! I'm fixed upon it,
Mount of Thy redeeming love.

[Verse 2]
Here I raise mine Ebenezer;
Hither by Thy help I'm come;
And I hope, by Thy good pleasure,
Safely to arrive at home.
Jesus sought me when a stranger,
Wandering from the fold of God;
He, to rescue me from danger,
Interposed His precious blood.

[Verse 3]
O to grace how great a debtor
Daily I'm constrained to be!
Let Thy goodness, like a fetter,
Bind my wandering heart to Thee.
Prone to wander, Lord, I feel it,
Prone to leave the God I love;
Here's my heart, O take and seal it,
Seal it for Thy courts above.`
  }
]

function nextSunday(): string {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function nextWeekday(day: number): string {
  const d = new Date()
  d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7 || 7))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Create clearly-labelled demo content. Returns the demo Sunday service id. */
export function seedDemo(repos: Repos): string | null {
  return repos.db.transaction(() => {
    const songIds: Record<string, string> = {}
    for (const s of DEMO_SONGS) {
      const existing = repos.songs.list({ limit: 5000 }).find((x) => x.title === s.title && x.demo)
      if (existing) {
        songIds[s.title] = existing.id
        continue
      }
      const sections = parseLyrics(s.lyrics)
      const byLabel = new Map(sections.map((x) => [x.label, x.id]))
      const song = repos.songs.save({
        title: s.title,
        author: s.author,
        copyright: 'Public domain',
        category: 'Hymns',
        tags: ['demo', 'hymn'],
        notes: 'Demo content — public-domain hymn text.',
        sections,
        arrangement: (s.order ?? []).map((l) => byLabel.get(l)!).filter(Boolean),
        demo: true
      })
      songIds[s.title] = song.id
    }

    // Demo media (generated, original artwork) if bundled.
    const demoDir = join(paths.resources(), 'demo')
    const media: Record<string, string> = {}
    if (existsSync(demoDir)) {
      for (const f of readdirSync(demoDir)) {
        const type = /\.(png|jpe?g)$/i.test(f) ? 'image' : /\.(webm|mp4)$/i.test(f) ? 'video' : /\.(wav|mp3|m4a)$/i.test(f) ? 'audio' : null
        if (!type) continue
        const item = repos.media.insert({
          name: `Demo — ${f.replace(/\.\w+$/, '').replace(/[-_]/g, ' ')}`,
          type,
          path: join(demoDir, f),
          size: statSync(join(demoDir, f)).size,
          folder: 'Demo',
          demo: true
        })
        media[f] = item.id
      }
    }
    const findMedia = (prefix: string) => Object.entries(media).find(([f]) => f.startsWith(prefix))?.[1]

    const kjv = repos.bible.translations().find((t) => t.abbreviation === 'KJV') ?? repos.bible.translations()[0]
    const svc = repos.services.create({ name: 'Sunday Service (Demo)', date: nextSunday(), time: '10:00', themeId: 'theme-modern', demo: true })
    const add = repos.services.addItem.bind(repos.services, svc.id)

    add({ type: 'header', title: 'Welcome' })
    const welcomeImage = findMedia('welcome-background')
    if (welcomeImage) add({ type: 'image', title: 'Welcome Slide', data: { mediaId: welcomeImage, media: { ...DEFAULT_MEDIA_SETTINGS, fit: 'cover' } } })
    add({
      type: 'announcement',
      title: 'Youth Service',
      data: {
        announcement: { title: 'Youth Service', description: 'Games, worship and a message for ages 12–18', date: 'Friday', time: '6:00 PM', location: 'Main Hall', imageMediaId: null }
      }
    })
    add({ type: 'header', title: 'Worship' })
    add({ type: 'song', title: 'Amazing Grace', refId: songIds['Amazing Grace'] })
    const worshipBg = findMedia('worship-background')
    add({
      type: 'song',
      title: 'Holy, Holy, Holy',
      refId: songIds['Holy, Holy, Holy'],
      background: worshipBg ? { ...DEFAULT_BACKGROUND, kind: 'image', mediaId: worshipBg, dim: 0.25 } : null
    })
    const loop = findMedia('motion-loop')
    add({
      type: 'song',
      title: 'It Is Well with My Soul',
      refId: songIds['It Is Well with My Soul'],
      background: loop ? { ...DEFAULT_BACKGROUND, kind: 'video', mediaId: loop, dim: 0.35 } : null
    })
    if (kjv) {
      add({
        type: 'bible',
        title: 'John 3:16-18',
        data: { bible: { translationId: kjv.id, book: 43, chapter: 3, verseStart: 16, verseEnd: 18, versesPerSlide: 1 } }
      })
    }
    add({ type: 'offering', title: 'Offering', data: { body: 'Giving is an act of worship.\nThank you for your generosity.' } })
    const pad = findMedia('offering-pad')
    if (pad) add({ type: 'audio', title: 'Offering Music', data: { mediaId: pad, media: { ...DEFAULT_MEDIA_SETTINGS, loop: true, fadeIn: 2, fadeOut: 3 } } })
    add({ type: 'sermon', title: 'Sermon: The Love of God', data: { body: 'The Love of God\nJohn 3:16-18' } })
    if (loop) add({ type: 'video', title: 'Motion Background (Demo)', data: { mediaId: loop, media: { ...DEFAULT_MEDIA_SETTINGS, fit: 'cover', loop: true, muted: true } } })
    add({ type: 'song', title: 'Blessed Assurance', refId: songIds['Blessed Assurance'] })
    add({ type: 'prayer', title: 'Closing Prayer', data: { body: 'Closing Prayer' } })

    const mid = repos.services.create({ name: 'Wednesday Bible Study (Demo)', date: nextWeekday(3), time: '19:00', themeId: 'theme-classic', demo: true })
    repos.services.addItem(mid.id, { type: 'song', title: 'Be Thou My Vision', refId: songIds['Be Thou My Vision'] })
    if (kjv) {
      repos.services.addItem(mid.id, {
        type: 'bible',
        title: 'Psalm 23',
        data: { bible: { translationId: kjv.id, book: 19, chapter: 23, verseStart: 1, verseEnd: 6, versesPerSlide: 2 } }
      })
    }
    repos.services.addItem(mid.id, { type: 'prayer', title: 'Prayer Requests', data: { body: 'Prayer Requests' } })
    repos.services.addItem(mid.id, { type: 'song', title: 'Come, Thou Fount of Every Blessing', refId: songIds['Come, Thou Fount of Every Blessing'] })
    repos.services.markOpened(svc.id)
    return svc.id
  })()
}

export function removeDemo(repos: Repos): number {
  return repos.db.transaction(() => {
    let n = 0
    n += repos.db.prepare('DELETE FROM services WHERE demo = 1').run().changes
    // Keep demo songs that the user has since placed in their own services.
    const songs = repos.db
      .prepare(`SELECT id FROM songs WHERE demo = 1 AND id NOT IN (SELECT ref_id FROM service_items WHERE ref_id IS NOT NULL)`)
      .all() as { id: string }[]
    for (const s of songs) repos.songs.delete(s.id)
    n += songs.length
    n += repos.db.prepare('DELETE FROM media WHERE demo = 1').run().changes
    return n
  })()
}
