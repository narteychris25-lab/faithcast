# FaithCast user guide

This guide is for the volunteer running presentation on a Sunday. Everything described here also appears in the app under **Help**.

## 1. First launch

A five-step setup wizard runs the first time:

1. **Church name**
2. **Church logo** (optional)
3. **Displays**: shows your connected screens
4. **Default theme**
5. **First service**: you can also load clearly labelled demo content

You can change all of these later in **Settings**. To run the wizard again, go to Settings → Advanced.

The pages (Dashboard, Bible, Songs, Themes, Service Planner, Live, Media, Internet) are in the bar along the top of the window, with **Settings** and **Help** at its right end. On a narrow window the bar shows icons only; point at one to see its name.

**Light or dark?** FaithCast starts in Light. To change it, choose Dark, Light or Match macOS (Match Windows on a PC) in **Settings → General → Appearance**. This changes only your control screen; the projector always shows your slide themes. Dark is easier on the eyes in a dim sanctuary.

## 2. Plan a service

1. Go to **Dashboard → New service** and give it a name. The date defaults to next Sunday.
2. In the **Service Planner**, use the left panel to add content:
   - **Song**: search your library, then double-click or drag a song into the service.
   - **Bible**: type `John 3:16-18` and press Return.
   - **Image / Video / Audio**: pick from the library, or drop files from Finder (File Explorer on Windows) straight into the list.
   - **Announcement, Slides, Sermon, Offering, Prayer, Section, Other**: click to add.
3. Drag the handle (⋮⋮) to reorder, or use ⌥↑ / ⌥↓ (Alt+↑ / Alt+↓ on Windows).
4. Right-click an item for **Rename, Duplicate, Hide, Lock, Move up/down, Delete**.
5. Select an item to edit it on the right: its text, song arrangement for this service, Bible verses per slide, media options (loop, volume, fade), theme, background and transition.
6. **Service settings** (top right) sets the theme and background for the whole service.

Changes save instantly. The indicator beside the service name shows **Saved**, **Saving…** or **Unsaved changes**.

## 3. Songs

Songs → **New**. Type the lyrics with section names in brackets:

```
[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me

[Chorus]
…
```

- A blank line inside a section starts a new slide. Long sections split automatically.
- **Arrangement** sets the order sections are shown in (e.g. V1 C V2 C) without retyping them.
- **Import** accepts .song, plain text or CCLI SongSelect .txt, JSON, and OpenLyrics .xml.
- ⌘-click (Ctrl-click on Windows) several songs, then right-click to export them.
- Enter copyright and CCLI details; they appear on the first slide (configurable in Settings → General).

## 4. Bible

- **Type the reference, EasyWorship-style:** there are three boxes, **Book**, **Chapter** and **Verse**. Start typing a book and it completes automatically. `jo` suggests **Joshua**, `joh` gives **John**, `ps` gives **Psalms**, and `1 co` gives **1 Corinthians**. Press Space, or just type the chapter number, to accept the book and move to the Chapter box. Type `:` or Space to move to the Verse box (a single verse like `16`, or a range like `16-18`), then press **Return** to open it. Typing `joh3:16-18` fills **John · 3 · 16-18**. On the Bible page the passage also opens as you type. Backspace in an empty box goes back to the previous one.
  - ↑ / ↓ choose a different suggested book, Backspace removes the suggestion, Esc closes the list.
  - The same box is used when adding a Bible passage in the planner, and when editing a Bible item's reference.
- **Switch versions in one click:** the version buttons (**KJV**, **NKJV**, **ESV**…) sit under the Bible heading. You can also press ⌥1 (Alt+1 on Windows) for the first version, ⌥2 for the second, and so on. If a verse from the chapter you're viewing is on screen, it changes to the new version straight away, and → still continues to the next verse. The Bible page remembers the version you used last. Choosing **Make default** in Settings → Bibles resets it to that version. The planner's Bible panel has the same buttons.
- **Click a verse to present it immediately.** With **Present on click** switched on (above the verses, on by default), clicking a verse puts it on screen. Press → for the next verse, or Shift-click another verse to present a range. The verse on screen is marked **LIVE**, and a small live monitor with Next, Black and Clear appears on the right, so you can stay on the Bible page. Switch it off when you only want to prepare without going live.
- **Managing Bible versions:** go to **Settings → Bibles** (or click **Versions** on the Bible page).
  - **Installed** lists your versions. Click **Make default** to choose the version the Bible page and planner open with. Click **Remove** to delete a version; you're told first if any service items or scheduled passages use it. You can't remove your last version.
  - **Free versions you can install** lists 12 more English Bibles (public domain or openly licensed), including the ASV, World English Bible, Young's Literal, Geneva, Darby and Douay-Rheims. Click **Install**; no internet is needed. Free versions you remove, including KJV and BSB, appear here again so you can reinstall them.
  - For a copyrighted version (NIV, ESV, NKJV…), click **Import from file…** and choose its file, for example a JSON or XML file from github.com/thiagobodruk/bible. Only do this if your church has the publisher's permission; the app shows a reminder.
- **Scripture schedule:** before the service, select each reading and click **Add to schedule**. During the service, open the **Schedule** tab and click a passage to present it. Use the arrows beside a passage to reorder it, × to remove it, and **Add all to service** to copy the whole list into the running order. The schedule is saved, so it's still there tomorrow.
- Use the **Search words** box to find verses by their text (`shepherd`).
- **Add to service** or **Present now**. Star a passage to save it to **Favourites**.

## 5. Media

- Media → **Import**, or drag files or folders onto the window. Files stay where they are on your computer.
- Right-click an item to add it to the service, present it, favourite it, rename it, tag it, move it to a folder, locate it if missing, or show it in Finder / File Explorer.
- If a file is moved, it's marked **Media file unavailable**. The service still runs; that slide simply shows nothing. Use **Locate missing file…** to fix it.

## 5b. Internet: lyrics, YouTube and pictures

The **Internet** page is a built-in web browser. It needs an internet connection; everything else works offline.

- **YouTube:** click **YouTube**, find the video, open it, then click **Play video on screen**. It plays full-screen on the projector without YouTube's page around it, and your copy pauses so the sound isn't doubled. Black, Clear and Pause work as usual.
- **Lyrics:** click **Lyrics**, type the song title, open a lyrics page, highlight the lyrics, then click **Import highlighted lyrics**. A new song is created in Songs; check the section labels and copyright.
- **Pictures:** click **Pictures** and search, then right-click a picture and choose **Show picture on screen** or **Save picture to Media** (it goes into the "Web" folder).
- **Show page on screen** puts the live page on the projector; **Capture to screen** shows a snapshot of what you see; right-clicking highlighted text can show it as a slide.
- **Add to service** saves the page or video as a "Web" item in your running order.

Web pages run in a sealed sandbox with no access to your files, database, camera or microphone. Only project content your church is licensed to use (CCLI / CVLI).

## 6. Themes and backgrounds

- Every theme can be edited, including the built-in ones; changes save automatically and update slides straight away. A changed built-in theme is marked **Edited**, and **Reset to original** undoes your changes. Built-in themes can't be deleted. To keep the original and make your own version, click **Duplicate**.
- For readability over photos or video: set **Darken** to 30–50%, keep **Shadow** on, and use 4 lines or fewer per slide.
- Backgrounds can be a colour, gradient, image or video. They can be set per theme, per service, per item, or per custom slide.
- If consecutive slides share the same background video, it keeps playing smoothly between them.

## 7. Connecting a projector or TV

1. Connect it with HDMI or a USB-C adapter and switch it on.
2. If your computer mirrors its screen: on a Mac, go to **System Settings → Displays** and choose **Extended display**; on Windows, press **Win+P** and choose **Extend**.
3. FaithCast detects the display and asks **Present on this display?** Click yes.
4. Not sure which screen is which? Click **Identify** in the Live view.

If the cable comes out mid-service, the output moves to a preview window. Reconnect the display and output returns to it automatically.

## 8. Running the service

1. Open the service and click **Present**. The output opens on the projector.
2. Left column: service items. Middle: the selected item's slides. **Click a slide to put it live.**
3. Right column: **LIVE** (what the audience sees) and **NEXT**.
4. **Next** (→ / Space) continues automatically into the next item.
5. Other controls:
   - **Black** (B): blank screen.
   - **Clear** (C): hide text but keep the background.
   - **Logo** (L): show your logo.
   - **Pause** (K): freeze videos.
6. Videos show play, pause, restart, seek and mute under LIVE.
7. Audio items play without changing the picture. A purple indicator shows audio is playing, with volume, loop and stop controls.
8. **Exit** (Esc) ends the presentation.

**Quick Presentation**: present a song, verse, image, video or announcement from the Dashboard, the Songs page, the Bible page or ⌘K search (Ctrl+K on Windows), without adding it to a service.

## 9. Backups and safety

- A backup is made automatically every day. For an extra copy, go to **Settings → Backup → Back up now**, then **Open backups folder** and copy the file to a USB drive.
- **Restore** returns everything to a backup (a safety copy is taken first) and restarts the app.
- If FaithCast ever closes unexpectedly, reopen it and click **Resume presentation** to go straight back to the same slide.
- To move a service to another computer, use the planner's ⋯ menu → **Export package** (include media), then **Import service** on the other computer (Mac or Windows).

## 10. Tips for Sunday

- Keep the computer on power. FaithCast stops the display from sleeping while output is open.
- Test the projector and your videos before the service starts.
- Turn on Do Not Disturb so notifications can't appear.
- Lock finished items (right-click → Lock) so they can't be changed by accident.
