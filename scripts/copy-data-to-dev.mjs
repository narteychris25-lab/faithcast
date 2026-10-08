// Copies the installed app's data (database, thumbnails, imported media) into
// the separate folder `npm run dev` uses, so development runs against a copy
// of the church's real songs, services and Bibles — never the originals.
// Safe while WorshipFlow is open: the database is copied with SQLite's backup API.
//
// Usage: npm run dev:copy-data
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const support = join(homedir(), 'Library', 'Application Support')
const from = join(support, 'WorshipFlow')
const to = join(support, 'WorshipFlow Dev')

if (!existsSync(join(from, 'worshipflow.db'))) {
  console.error(`No installed WorshipFlow data found in ${from}`)
  process.exit(1)
}
// Replacing the database under a running dev app would lose its writes
const devDb = join(to, 'worshipflow.db')
let openBy = ''
try {
  if (existsSync(devDb)) openBy = execFileSync('lsof', ['-t', devDb], { encoding: 'utf8' }).trim()
} catch {
  /* lsof exits 1 when nothing has the file open */
}
if (openBy) {
  console.error('The dev app is running. Quit it (⌘Q in its window, or Ctrl+C in its terminal), then run this again.')
  process.exit(1)
}
mkdirSync(to, { recursive: true })
for (const f of ['worshipflow.db', 'worshipflow.db-wal', 'worshipflow.db-shm']) rmSync(join(to, f), { force: true })

const src = new Database(join(from, 'worshipflow.db'), { readonly: true, fileMustExist: true })
await src.backup(join(to, 'worshipflow.db'))
src.close()
// The installed app may be open right now; don't let the copy look like a crashed session
const copy = new Database(join(to, 'worshipflow.db'))
copy.prepare("UPDATE app_state SET value = 'false' WHERE key = 'session.running'").run()
copy.close()
for (const dir of ['thumbnails', 'library']) {
  if (existsSync(join(from, dir))) cpSync(join(from, dir), join(to, dir), { recursive: true, force: true })
}
console.log(`Copied your WorshipFlow data to ${to}\nStart the dev app with: npm run dev`)
