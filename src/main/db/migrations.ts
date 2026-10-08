import type Database from 'better-sqlite3'

export interface Migration {
  version: number
  name: string
  up: (db: Database.Database) => void
}

/**
 * Ordered, append-only list of schema migrations. Never edit a shipped
 * migration — add a new one. The current version is stored in
 * PRAGMA user_version.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE church (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'operator',
          created_at TEXT NOT NULL
        );

        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE app_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE themes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          builtin INTEGER NOT NULL DEFAULT 0,
          settings TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE songs (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          author TEXT NOT NULL DEFAULT '',
          copyright TEXT NOT NULL DEFAULT '',
          ccli TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT '',
          tags TEXT NOT NULL DEFAULT '[]',
          notes TEXT NOT NULL DEFAULT '',
          arrangement TEXT NOT NULL DEFAULT '[]',
          theme_id TEXT REFERENCES themes(id) ON DELETE SET NULL,
          demo INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_songs_title ON songs(title COLLATE NOCASE);

        CREATE TABLE song_sections (
          id TEXT PRIMARY KEY,
          song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          type TEXT NOT NULL,
          label TEXT NOT NULL,
          text TEXT NOT NULL
        );
        CREATE INDEX idx_song_sections_song ON song_sections(song_id, position);

        CREATE VIRTUAL TABLE songs_fts USING fts5(
          song_id UNINDEXED, title, author, lyrics,
          tokenize = 'unicode61 remove_diacritics 2'
        );

        CREATE TABLE services (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          date TEXT NOT NULL,
          time TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          theme_id TEXT REFERENCES themes(id) ON DELETE SET NULL,
          background TEXT,
          demo INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_services_date ON services(date);

        CREATE TABLE service_items (
          id TEXT PRIMARY KEY,
          service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          ref_id TEXT,
          data TEXT NOT NULL DEFAULT '{}',
          theme_id TEXT REFERENCES themes(id) ON DELETE SET NULL,
          background TEXT,
          transition TEXT,
          hidden INTEGER NOT NULL DEFAULT 0,
          locked INTEGER NOT NULL DEFAULT 0,
          notes TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_service_items_service ON service_items(service_id, position);
        CREATE INDEX idx_service_items_ref ON service_items(ref_id);

        CREATE TABLE recent_services (
          service_id TEXT PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
          opened_at TEXT NOT NULL
        );

        CREATE TABLE media (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('image','video','audio')),
          path TEXT NOT NULL UNIQUE,
          size INTEGER NOT NULL DEFAULT 0,
          width INTEGER,
          height INTEGER,
          duration REAL,
          tags TEXT NOT NULL DEFAULT '[]',
          folder TEXT NOT NULL DEFAULT '',
          has_thumbnail INTEGER NOT NULL DEFAULT 0,
          missing INTEGER NOT NULL DEFAULT 0,
          demo INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_media_type ON media(type);

        CREATE TABLE bible_translations (
          id TEXT PRIMARY KEY,
          abbreviation TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          language TEXT NOT NULL DEFAULT 'en',
          license TEXT NOT NULL DEFAULT '',
          builtin INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE bible_verses (
          translation_id TEXT NOT NULL REFERENCES bible_translations(id) ON DELETE CASCADE,
          book INTEGER NOT NULL,
          chapter INTEGER NOT NULL,
          verse INTEGER NOT NULL,
          text TEXT NOT NULL,
          PRIMARY KEY (translation_id, book, chapter, verse)
        ) WITHOUT ROWID;

        CREATE VIRTUAL TABLE bible_fts USING fts5(
          translation_id UNINDEXED, ref UNINDEXED, text,
          tokenize = 'unicode61 remove_diacritics 2'
        );

        CREATE TABLE bible_passages (
          id TEXT PRIMARY KEY,
          translation_id TEXT NOT NULL,
          book INTEGER NOT NULL,
          chapter INTEGER NOT NULL,
          verse_start INTEGER NOT NULL,
          verse_end INTEGER NOT NULL,
          label TEXT NOT NULL,
          used_at TEXT NOT NULL,
          UNIQUE (translation_id, book, chapter, verse_start, verse_end)
        );

        CREATE TABLE slides (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE favorites (
          kind TEXT NOT NULL,
          ref_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (kind, ref_id)
        );

        CREATE TABLE drafts (
          key TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `)
    }
  },
  {
    version: 2,
    name: 'scripture schedule',
    up: (db) => {
      db.exec(`
        CREATE TABLE scripture_schedule (
          id TEXT PRIMARY KEY,
          position INTEGER NOT NULL,
          translation_id TEXT NOT NULL,
          book INTEGER NOT NULL,
          chapter INTEGER NOT NULL,
          verse_start INTEGER NOT NULL,
          verse_end INTEGER NOT NULL,
          verses_per_slide INTEGER NOT NULL DEFAULT 1,
          label TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX idx_scripture_schedule_position ON scripture_schedule(position);
      `)
    }
  }
]

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version

export function currentVersion(db: Database.Database): number {
  return db.pragma('user_version', { simple: true }) as number
}

/** Applies pending migrations, each inside its own transaction. Returns the versions applied. */
export function migrate(db: Database.Database): number[] {
  const from = currentVersion(db)
  if (from > LATEST_VERSION) {
    throw new Error(
      `Database schema v${from} is newer than this app supports (v${LATEST_VERSION}). Please update FaithCast.`
    )
  }
  const applied: number[] = []
  for (const m of MIGRATIONS) {
    if (m.version <= from) continue
    db.transaction(() => {
      m.up(db)
      db.pragma(`user_version = ${m.version}`)
    })()
    applied.push(m.version)
  }
  return applied
}
