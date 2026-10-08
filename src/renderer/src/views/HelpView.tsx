import { useState, type ReactNode } from 'react'
import { SHORTCUT_LABELS } from '@shared/defaults'
import type { ShortcutAction } from '@shared/types'
import { comboLabel } from '@/lib/shortcuts'
import { cx } from '@/lib/format'
import { useApp } from '@/stores/app'
import { Kbd } from '@/components/ui/controls'

interface Article {
  id: string
  title: string
  body: () => ReactNode
}

const P = ({ children }: { children: ReactNode }) => <p className="mb-3 leading-relaxed text-muted">{children}</p>
const Steps = ({ items }: { items: ReactNode[] }) => (
  <ol className="mb-4 list-decimal space-y-2 pl-5 leading-relaxed">
    {items.map((s, i) => (
      <li key={i}>{s}</li>
    ))}
  </ol>
)
const B = ({ children }: { children: ReactNode }) => <b className="text-fg">{children}</b>

const ARTICLES: Article[] = [
  {
    id: 'service',
    title: 'Creating a service',
    body: () => (
      <>
        <P>A service is the running order for a meeting: songs, readings, announcements, media and slides, in sequence.</P>
        <Steps
          items={[
            <>On the <B>Dashboard</B>, click <B>New service</B> and give it a name.</>,
            <>The <B>Service Planner</B> opens. Use the left panel to add items: pick a type, then click (or drag) content into the service list.</>,
            <>Drag items by their handle to reorder, or use <Kbd>⌥↑</Kbd>/<Kbd>⌥↓</Kbd>. Right-click an item to rename, duplicate, hide, lock or delete it.</>,
            <>Select an item to edit its properties on the right: text, theme, background, transition and media settings.</>,
            <>Click <B>Service settings</B> to set the date, the theme for the whole service, and a service-wide background.</>,
            <>Everything saves automatically — watch the <B>Saved</B> indicator next to the service name.</>
          ]}
        />
        <P>Use <B>Section</B> items (e.g. “Worship”, “Word”) to organise long services; they are skipped during presentation. Hidden items stay in the plan but are skipped live.</P>
      </>
    )
  },
  {
    id: 'songs',
    title: 'Adding songs',
    body: () => (
      <>
        <Steps
          items={[
            <>Open <B>Songs</B> and click <B>New</B>.</>,
            <>Type the title, author, copyright and CCLI number.</>,
            <>Type or paste lyrics. Mark sections with brackets: <code>[Verse 1]</code>, <code>[Chorus]</code>, <code>[Bridge]</code>. The buttons above the lyrics insert them for you.</>,
            <>A blank line inside a section starts a new slide. Long sections split automatically (Settings → General → maximum lines).</>,
            <>Set the <B>Arrangement</B> to repeat choruses (e.g. V1 C V2 C B C) without retyping them.</>,
            <>The right side shows exactly how each slide will look. Changes save automatically.</>
          ]}
        />
        <P>Import songs with <B>Import</B>: WorshipFlow .song files, plain text (including CCLI SongSelect .txt exports), JSON and OpenLyrics XML.</P>
      </>
    )
  },
  {
    id: 'bible',
    title: 'Adding Bible passages',
    body: () => (
      <>
        <Steps
          items={[
            <>In the planner, choose <B>Bible</B> in the left panel and start typing the book: <code>jo</code> completes to <B>Joshua</B>, <code>joh</code> to <B>John</B>. Press <Kbd>Space</Kbd> or just type the chapter number to accept it and move to the <B>Chapter</B> box, then <Kbd>:</Kbd> to move to the <B>Verse</B> box — e.g. <code>joh3:16-18</code> fills John · 3 · 16-18. Press Return to add it.</>,
            <>Use <Kbd>↑</Kbd>/<Kbd>↓</Kbd> to pick a different suggested book, <Kbd>Backspace</Kbd> to remove the suggestion, <Kbd>Esc</Kbd> to dismiss the list. Numbered books work too: <code>1 co</code> → 1 Corinthians.</>,
            <>On the <B>Bible</B> page, the same box jumps to the passage as you type. Or choose a book and chapter, click a verse, and Shift-click another to select a range. Use the <B>Search words</B> box to find verses by their text.</>,
            <><B>Switch versions in one click:</B> the version buttons (e.g. <B>KJV</B> <B>NKJV</B> <B>ESV</B>) are under the Bible heading, or press <Kbd>⌥1</Kbd>–<Kbd>⌥9</Kbd>. If a verse from the chapter you're viewing is on screen, it changes to the new version straight away. The Bible page remembers the version you used last.</>,
            <><B>Click a verse to put it on screen straight away</B> (the <B>Present on click</B> switch above the verses). Press <Kbd>→</Kbd> for the next verse, or Shift-click to present a range. The verse on screen is marked <B>LIVE</B>, and a small live monitor with Next/Black/Clear appears on the right — no need to leave the Bible page.</>,
            <><B>Scripture schedule:</B> before the service, select each reading and click <B>Add to schedule</B>. During the service, click a passage in the <B>Schedule</B> tab to present it. Reorder or remove with the buttons beside each passage; <B>Add all to service</B> copies them into the running order. The schedule is saved.</>,
            <>Choose how many verses per slide, then <B>Add to service</B> or <B>Present</B>.</>,
            <>Star passages to keep them in <B>Favourites</B>; recently used passages are listed automatically.</>
          ]}
        />
        <P>The King James Version and Berean Standard Bible are installed. Go to <B>Settings → Bibles</B> (or click <B>Versions</B> on the Bible page) to manage versions: install any of 12 more free English versions with one click (no internet needed), choose the default version, or remove a version you don't use. Removing a version also removes its scripture-schedule entries, and you are told first if any service items use it; free versions can be reinstalled at any time. For copyrighted versions (NIV, ESV, NKJV…), use <B>Import from file…</B> only if your church has the publisher's permission. Supported files: WorshipFlow .wfbible/JSON, JSON or XML from github.com/thiagobodruk/bible, Zefania XML and CSV (book, chapter, verse, text).</P>
      </>
    )
  },
  {
    id: 'projector',
    title: 'Connecting a projector or TV',
    body: () => (
      <>
        <Steps
          items={[
            <>Connect the projector/TV to your Mac (HDMI, or a USB-C/Thunderbolt adapter) and switch it on.</>,
            <>macOS should show your desktop on it. If it mirrors your screen, open <B>System Settings → Displays</B> and turn off mirroring (“Extend” the display).</>,
            <>WorshipFlow detects the new display and asks whether to present on it. Click <B>Present on this display</B>.</>,
            <>Not sure which screen is which? Click <B>Identify</B> in the Live view — each screen shows its number.</>,
            <>Your MacBook screen keeps the operator view; the audience only sees the output.</>
          ]}
        />
        <P>If the display is unplugged during a service, the output moves to a preview window and nothing is lost. Plug it back in and the output returns automatically.</P>
        <P>Tip: keep your Mac plugged into power. WorshipFlow prevents the display from sleeping while the output is open.</P>
      </>
    )
  },
  {
    id: 'dual',
    title: 'Using dual displays & presenting',
    body: () => (
      <>
        <Steps
          items={[
            <>Open your service and click <B>Present</B> (or go to <B>Live</B> and click <B>Open output</B>).</>,
            <>Click an item in the left list to see its slides. Click a slide to put it on screen — it gets a red LIVE border.</>,
            <>Press <Kbd>→</Kbd> or <Kbd>Space</Kbd> for the next slide. At the end of an item, Next continues into the next item.</>,
            <>The right side shows <B>LIVE</B> (what the audience sees) and <B>NEXT</B> (what comes next).</>,
            <><B>Black</B> blanks the screen, <B>Clear</B> removes text but keeps the background, <B>Logo</B> shows your church logo. Press again to return.</>,
            <><B>Pause</B> freezes videos. Videos have their own play/pause/seek controls under the LIVE monitor.</>,
            <><B>Exit</B> (or <Kbd>Esc</Kbd>) ends the presentation.</>
          ]}
        />
        <P>No second display? The output opens as a preview window you can resize or move — useful for rehearsal.</P>
      </>
    )
  },
  {
    id: 'themes',
    title: 'Creating themes',
    body: () => (
      <>
        <P>Themes control fonts, colours, text position, shadows, backgrounds and transitions. You can edit any theme, including the built-in ones. If you change a built-in theme and want it back the way it was, select it and click <B>Reset to original</B>. Use <B>Duplicate</B> to keep the original and make your own variation.</P>
        <Steps
          items={[
            <>Open <B>Themes</B> and click <B>New theme</B> (it starts from the selected theme).</>,
            <>Adjust main text, text area, background, reference text, announcement title and transition. The preview updates live — switch between Song, Bible and Announcement samples.</>,
            <>Use <B>Make default</B>, or choose the theme per service (Service settings) or per item.</>,
            <>Export a theme as a .theme file to share with another computer; image backgrounds are embedded.</>
          ]}
        />
        <P>Readability tips: use a Darken of 30–50% over photos and video, keep text shadows on, and use 4 lines or fewer per slide.</P>
      </>
    )
  },
  {
    id: 'media',
    title: 'Adding media',
    body: () => (
      <>
        <Steps
          items={[
            <>Open <B>Media</B> and click <B>Import</B>, or drag files/folders from Finder onto the window.</>,
            <>Add media to a service from the planner's Image/Video/Audio panels, or drag files straight into the service list.</>,
            <>Use an image or video as a background in any theme, item or custom slide (Background → Image/Video).</>,
            <>Audio items play without changing the screen, with fade in/out and loop options. A purple indicator shows audio is playing.</>
          ]}
        />
        <P>Files are not copied; WorshipFlow remembers where they are. If a file is moved, it shows “Media file unavailable” and the service carries on. Right-click it → <B>Locate missing file…</B> to fix it.</P>
      </>
    )
  },
  {
    id: 'internet',
    title: 'Internet: lyrics, YouTube & pictures',
    body: () => (
      <>
        <P>The <B>Internet</B> page is a built-in browser. It needs an internet connection; everything else in WorshipFlow works offline.</P>
        <Steps
          items={[
            <><B>YouTube:</B> click <B>YouTube</B>, find the video, open it, then click <B>Play video on screen</B>. It plays full-screen on the projector (without YouTube's page around it) and the copy on your screen pauses so the sound isn't doubled. Black, Clear and Pause work as usual.</>,
            <><B>Song lyrics:</B> click <B>Lyrics</B> and type the song title. Open a lyrics page, highlight the lyrics with your mouse, then click <B>Import highlighted lyrics</B>. A new song is created in Songs — check the section labels, author and copyright.</>,
            <><B>Pictures:</B> click <B>Pictures</B> and search. Right-click a picture → <B>Show picture on screen</B> or <B>Save picture to Media</B> (saved in the “Web” folder).</>,
            <><B>Anything else:</B> <B>Show page on screen</B> puts the live page on the projector; <B>Capture to screen</B> shows a snapshot of exactly what you see. Right-click text to show it on screen as a slide.</>,
            <><B>Add to service</B> saves the page or video as a “Web” item in your running order.</>
          ]}
        />
        <P>Web pages run in a sealed-off sandbox with no access to your files, database, camera or microphone. Only project lyrics, pictures and videos your church is licensed to use (for example under CCLI / CVLI licences).</P>
      </>
    )
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    body: () => <ShortcutTable />
  },
  {
    id: 'backup',
    title: 'Backing up data',
    body: () => (
      <>
        <P>WorshipFlow backs up automatically once a day and before upgrades (Settings → Backup). Backups include every service, song, theme, setting and the media library list.</P>
        <Steps
          items={[
            <>For an extra copy, open <B>Settings → Backup</B> and click <B>Back up now</B>.</>,
            <>Click <B>Open backups folder</B> and copy the newest file to a USB drive or cloud folder.</>,
            <>Media files themselves are not inside the backup — keep your media folder backed up too (e.g. Time Machine).</>,
            <>To move a single service to another computer, use <B>Export package</B> in the planner's ⋯ menu and include media.</>
          ]}
        />
      </>
    )
  },
  {
    id: 'restore',
    title: 'Restoring data',
    body: () => (
      <>
        <Steps
          items={[
            <>Open <B>Settings → Backup</B>.</>,
            <>Click <B>Restore</B> next to a backup, or <B>Restore from file…</B> to use a copy from elsewhere.</>,
            <>WorshipFlow takes a safety backup of the current data first, restores, and restarts.</>
          ]}
        />
        <P>If WorshipFlow ever closes unexpectedly, it reopens with your data intact and offers to resume the presentation at the same slide. Unsaved edits to songs and slides are recovered too.</P>
      </>
    )
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    body: () => (
      <>
        <P><B>The output appears on the wrong screen.</B> Click Identify, then choose the right display in the Live view's display menu.</P>
        <P><B>The projector shows my desktop mirrored.</B> System Settings → Displays → set the projector to “Extended display”, not mirrored.</P>
        <P><B>A video won't play.</B> The format isn't supported by macOS (e.g. AVI/WMV). Convert it to MP4 (H.264) with a free tool such as HandBrake.</P>
        <P><B>Text is too small.</B> Reduce lines per slide, widen the theme's text area, or lower the text length. Auto-fit shrinks text only as far as the theme's minimum size.</P>
        <P><B>“WorshipFlow cannot be opened because the developer cannot be verified.”</B> This development build isn't signed. Open System Settings → Privacy & Security and click “Open Anyway”.</P>
      </>
    )
  }
]

function ShortcutTable() {
  const shortcuts = useApp((s) => s.settings.shortcuts)
  return (
    <>
      <P>Live shortcuts work in the Live view, and anywhere while the output is open (not while typing). Change them in Settings → Keyboard.</P>
      <table className="mb-4 w-full text-[13px]">
        <tbody className="divide-y divide-line">
          {(Object.keys(SHORTCUT_LABELS) as ShortcutAction[]).map((a) => (
            <tr key={a}>
              <td className="py-1.5">{SHORTCUT_LABELS[a]}</td>
              <td className="py-1.5">
                <span className="flex flex-wrap gap-1">{shortcuts[a].map((c) => <Kbd key={c}>{comboLabel(c)}</Kbd>)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <P>Planner: <Kbd>↑</Kbd>/<Kbd>↓</Kbd> select items, <Kbd>⌥↑</Kbd>/<Kbd>⌥↓</Kbd> move, <Kbd>⌘D</Kbd> duplicate, <Kbd>⌫</Kbd> delete, <Kbd>Return</Kbd> edit. App: <Kbd>⌘N</Kbd> new service, <Kbd>⌘1</Kbd>–<Kbd>⌘7</Kbd> switch pages, <Kbd>⌘,</Kbd> settings. Bible page: <Kbd>⌥1</Kbd>–<Kbd>⌥9</Kbd> switch version.</P>
      <P>Slide editor: arrows nudge (<Kbd>⇧</Kbd> for 10px), <Kbd>⌘Z</Kbd> undo, <Kbd>⇧⌘Z</Kbd> redo, <Kbd>⌘D</Kbd> duplicate, <Kbd>⌫</Kbd> delete, hold <Kbd>⌥</Kbd> while dragging to disable snapping.</P>
    </>
  )
}

export function HelpView() {
  const param = useApp((s) => s.viewParam)
  const [id, setId] = useState(ARTICLES.some((a) => a.id === param) ? param! : 'service')
  const article = ARTICLES.find((a) => a.id === id) ?? ARTICLES[0]
  return (
    <div className="grid h-full min-h-0 grid-cols-[240px_minmax(0,1fr)]">
      <nav className="flex flex-col gap-0.5 overflow-auto border-r border-line bg-panel p-2">
        <h1 className="px-2 py-2 text-[15px] font-semibold">Help</h1>
        {ARTICLES.map((a) => (
          <button key={a.id} type="button" onClick={() => setId(a.id)} className={cx('rounded-md px-2.5 py-1.5 text-left text-[13px]', id === a.id ? 'bg-accent/20 text-fg' : 'text-muted hover:bg-panel-3 hover:text-fg')}>
            {a.title}
          </button>
        ))}
      </nav>
      <article className="min-h-0 overflow-auto">
        <div className="p-8 text-[14px]">
          <h2 className="mb-4 text-xl font-semibold">{article.title}</h2>
          {article.body()}
        </div>
      </article>
    </div>
  )
}
