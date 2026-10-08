// Copies the installed app's data (database, thumbnails, imported media) into
// the separate folder `npm run dev` uses, so development runs against a copy
// of the church's real songs, services and Bibles — never the originals.
// Safe while FaithCast is open: the database is copied with SQLite's backup API.
//
// Usage: npm run dev:copy-data
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'

// Electron's appData folder for each OS
const support =
  process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Application Support')
    : process.platform === 'win32'
      ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      : process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
const from = join(support, 'FaithCast')
const to = join(support, 'FaithCast Dev')

if (!existsSync(join(from, 'faithcast.db'))) {
  console.error(`No installed FaithCast data found in ${from}`)
  process.exit(1)
}
// Replacing the database under a running dev app would lose its writes
const devDb = join(to, 'faithcast.db')
function devDbInUse() {
  if (!existsSync(devDb)) return false
  if (process.platform === 'win32') {
    // Windows won't rename a file another process has open
    try {
      renameSync(devDb, `${devDb}.check`)
      renameSync(`${devDb}.check`, devDb)
      return false
    } catch {
      return true
    }
  }
  try {
    return execFileSync('lsof', ['-t', devDb], { encoding: 'utf8' }).trim() !== ''
  } catch {
    return false // lsof exits 1 when nothing has the file open
  }
}
if (devDbInUse()) {
  const quit = process.platform === 'darwin' ? '⌘Q' : 'Alt+F4'
  console.error(`The dev app is running. Quit it (${quit} in its window, or Ctrl+C in its terminal), then run this again.`)
  process.exit(1)
}
mkdirSync(to, { recursive: true })
for (const f of ['faithcast.db', 'faithcast.db-wal', 'faithcast.db-shm']) rmSync(join(to, f), { force: true })

const src = new Database(join(from, 'faithcast.db'), { readonly: true, fileMustExist: true })
await src.backup(join(to, 'faithcast.db'))
src.close()
// The installed app may be open right now; don't let the copy look like a crashed session
const copy = new Database(join(to, 'faithcast.db'))
copy.prepare("UPDATE app_state SET value = 'false' WHERE key = 'session.running'").run()
copy.close()
for (const dir of ['thumbnails', 'library']) {
  if (existsSync(join(from, dir))) cpSync(join(from, dir), join(to, dir), { recursive: true, force: true })
}
console.log(`Copied your FaithCast data to ${to}\nStart the dev app with: npm run dev`)
