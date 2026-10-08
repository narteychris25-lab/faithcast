# Database, file formats, backup and recovery

## Location

`~/Library/Application Support/WorshipFlow/`

| Path | Contents |
|---|---|
| `worshipflow.db` (+ `-wal`, `-shm`) | The SQLite database |
| `backups/` | `worshipflow-<timestamp>-<reason>.db` (reason: auto, manual, premigration, prerestore) |
| `thumbnails/` | Cached JPEG thumbnails, named `<mediaId>.jpg` |
| `library/` | Media extracted from imported service packages or themes, and converted HEIC/TIFF images |
| `logs/main.log` | Rotating log (about 2 MB, with one previous file kept) |

Set `WORSHIPFLOW_DATA_DIR` to use a different folder. The automated tests use this.

## Integrity settings

- `journal_mode=WAL`, `synchronous=FULL`, `foreign_keys=ON`, and a `quick_check` on every start.
- Every multi-row write (saving a song, reordering, importing) runs inside a transaction.
- On clean quit the app runs `wal_checkpoint(TRUNCATE)` and closes the database.

## Schema (migrations v1–v2)

| Table | Purpose |
|---|---|
| `church` | Single row (id=1) holding the church profile as JSON |
| `users` | Operator accounts (reserved for future multi-user support) |
| `settings` | Key/value JSON; the `app` key holds all app settings |
| `app_state` | Runtime flags: `session.running` (crash detection), `live.snapshot` (resume point), `biblesSeeded` |
| `themes` | id, name, builtin, settings (JSON) |
| `songs` | Metadata, tags (JSON), arrangement (JSON array of section ids), theme_id, demo flag |
| `song_sections` | song_id → position, type, label, text (CASCADE on delete) |
| `songs_fts` | FTS5 index of title, author and lyrics |
| `services` | name, date, time, notes, theme_id, background (JSON), demo flag |
| `service_items` | service_id, position, type, title, ref_id, data (JSON), theme_id, background, transition, hidden, locked, notes |
| `recent_services` | service_id, opened_at |
| `media` | name, type, path (unique), size, width, height, duration, tags, folder, has_thumbnail, missing, demo |
| `bible_translations` | abbreviation (unique), name, language, license, builtin |
| `bible_verses` | (translation_id, book, chapter, verse) primary key → text |
| `bible_fts` | FTS5 index of verse text |
| `bible_passages` | Recently used passages (unique per reference) |
| `slides` | Reusable custom slide decks (JSON) |
| `scripture_schedule` | Bible-page scripture schedule: position, translation, reference, verses per slide (migration v2) |
| `favorites` | (kind, ref_id), where kind is media, passage, song, theme or service |
| `drafts` | Unsaved editor content kept for crash recovery |

### Migrations

`src/main/db/migrations.ts` is an append-only list, with the version stored in `PRAGMA user_version`. Before an existing database is migrated, a `premigration` backup is written automatically. A database from a *newer* app version is refused with a clear message rather than being damaged.

To add a migration, append `{ version: 2, name: '…', up: (db) => db.exec('ALTER TABLE …') }` and never edit a released migration.

## Backup

- **Automatic**: once per day at startup (if there is content), and before migrations. Only the newest *N* automatic backups are kept (Settings → Backup); manual backups are never pruned.
- **Manual**: Settings → Backup → **Back up now**, or File → Back Up Now.
- Backups are produced with `VACUUM INTO`, so they are consistent even while the app is writing.
- Media files are *not* inside the database backup. Back up your media folders separately, for example with Time Machine.

## Restore

Settings → Backup → **Restore** (or **Restore from file…**):

1. The file is opened read-only, checked with `quick_check`, and confirmed to contain WorshipFlow tables.
2. A `prerestore` backup of the current data is taken.
3. The output closes and the database closes.
4. The backup is copied next to the database and atomically renamed over it, and the WAL files are removed.
5. The app relaunches.

## Crash recovery

- `session.running` is set to true at start and false on clean quit. If it is still true at the next start, the app knows it crashed.
- While presenting, `live.snapshot` stores `{serviceId, itemId, slideIndex}`, written at most once a second and always including the latest state. After a crash, the **Resume presentation** button reopens the service, goes live on that slide, and reopens the output.
- Song and slide editors write `drafts` while you type. If the app crashes, the draft is offered when that song or deck is next opened.

## File formats

All are UTF-8 JSON unless noted, and include `format` and `version` fields so future versions can migrate them.

### `.song`
```json
{ "format": "worshipflow-song", "version": 1,
  "songs": [{ "title": "…", "author": "…", "copyright": "…", "ccli": "…", "category": "…", "tags": [],
              "notes": "", "sections": [{ "type": "verse", "label": "Verse 1", "text": "line\nline" }],
              "arrangement": [0, 1, 0] }] }
```
`arrangement` holds indexes into `sections`. Section types: verse, chorus, pre-chorus, bridge, tag, intro, ending, other. A blank line inside `text` forces a slide break.

### `.theme`
```json
{ "format": "worshipflow-theme", "version": 1, "name": "…", "settings": { /* ThemeSettings */ },
  "backgroundImage": { "name": "bg.jpg", "data": "<base64>" } }
```

### `.churchservice` (ZIP)
- `manifest.json`: `{ format: "worshipflow-service", version: 1, service, items, songs: [{id, song}], themes, media: [{id, name, type, originalPath, file}], translations: [{id, abbreviation}] }`
- `media/<id>.<ext>`: optional embedded media, stored without compression.

On import, ids are remapped. Songs are matched by title and author, themes by name, and translations by abbreviation. Embedded media is extracted to `library/`. Media that isn't embedded is linked by its original path, or marked missing.

### Bible (`.wfbible` / `.json`, optionally gzipped)
```json
{ "format": "worshipflow-bible", "version": 1, "abbreviation": "KJV", "name": "…", "language": "en",
  "license": "…", "books": [{ "number": 1, "chapters": [["verse 1 text", "verse 2 text"]] }] }
```
Also accepted:

- **[thiagobodruk/bible](https://github.com/thiagobodruk/bible)** JSON (`[{abbrev, name, chapters: string[][]}]`) and XML (`<bible><b id><c n><v n>`). The file name (e.g. `en_asv.json`) is matched against `src/shared/bible-catalog.json` for the version's proper name, language and copyright status. A licence reminder is shown when a copyrighted or unverified version is imported. Books are matched by position when all 66 are present, and otherwise by their (Portuguese) book codes.
- Zefania XML, and CSV rows of `book,chapter,verse,text`, where `book` is either 1–66 or a book name.

### Bundled Bible library

`resources/bibles/library/` contains 12 additional English versions from thiagobodruk/bible that are public domain or openly licensed (CC BY-SA 4.0). They're installed on demand from Settings → Bibles. `catalog.json` lists them, plus KJV and BSB (`core: true`, read from `resources/bibles/`) so those can be reinstalled after being removed. The catalogue is built by `scripts/build-bible-library.mjs`, which refuses to bundle any version not marked public-domain or open in the catalogue. Copyrighted versions (NIV, ESV, NKJV, NLT, NASB, CSB, RVR1960 and others) are never bundled.

### Text exports
- Songs as TXT: `Title:/Author:/Copyright:/CCLI:` header lines, followed by `[Section]` blocks.
- Songs as CSV: Title, Author, Copyright, CCLI, Category, Tags, Lyrics.
- Service as TXT/CSV/JSON: the running order, with details for each item.
