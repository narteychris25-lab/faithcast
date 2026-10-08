# Development

## Setup

```bash
npm install
npm run dev
```

`npm run dev` opens the app straight from the source code: no build step. Edits to anything in `src/renderer` (screens, components, styles) show up instantly in the open window. Edits to `src/main` or `src/preload` make the app restart by itself within a few seconds. Only run `npm run dist` when you want an updated app in /Applications.

The dev app keeps its data in `~/Library/Application Support/WorshipFlow Dev`, separate from the installed app's `WorshipFlow` folder. So it can run while the installed app is open, and experiments never touch the church's real songs, services or Bibles. To work with a copy of the real data, run `npm run dev:copy-data` (safe while the installed app is open; it replaces the dev copy). Tests use their own temporary folders.

The dev scripts strip `ELECTRON_RUN_AS_NODE`. VS Code sets that variable in some terminals, and it would otherwise make Electron behave like plain Node.

npm 11 blocks dependency install scripts until approved. If Electron or esbuild complains after a fresh install, run:

```bash
npm install-scripts approve better-sqlite3 esbuild
node node_modules/electron/install.js
```

No native compilation is needed: better-sqlite3 13 ships Node-API prebuilds that load in both Node (for tests) and Electron. This also means a project path containing spaces is fine.

## Tests

| Command | Scope |
|---|---|
| `npm test` | Vitest: lyrics parser, Bible reference parser, slide builder, settings merge (`tests/unit`); repositories, FTS search, 5,000-item library performance, import/export, service-package round trip, backup/restore, recovery state (`tests/db`) |
| `npm run test:e2e` | Playwright drives the **built** app with an isolated data folder (`tests/e2e`) |

The end-to-end suites are:

- **acceptance**: the full "final acceptance" workflow, including a restart.
- **reliability**: missing media during a live service, a SIGKILL mid-presentation, then recovery and resume.
- **screens**: every screen, doing real work.

Screenshots are written to `test-results/screens/`.

A physical projector can't be attached in automated tests, so e2e runs the output in preview-window mode. That uses the same renderer, IPC and state path; only window placement differs. Always check real external-display behaviour by hand (see USER_GUIDE.md → Connecting a projector).

## Building and packaging

```bash
npm run dist       # release/WorshipFlow-<v>-x64.dmg and -arm64.dmg, plus .app folders
npm run dist:dir   # .app only (faster)
```

Configuration is in `electron-builder.yml`. Bundled resources (`resources/`) are copied to `Contents/Resources/resources`. better-sqlite3 is unpacked from the asar archive so its `.node` binary can load. Both architectures build from either Mac because the prebuilds cover x64 and arm64.

### Code signing and notarisation

Builds are **ad-hoc signed** (`identity: "-"`). That's enough for macOS to launch the app by double-click on the Mac that built it, and Apple Silicon requires at least an ad-hoc signature to run at all. On *other* Macs, the first launch still needs **System Settings → Privacy & Security → Open Anyway**. For proper distribution:

1. Join the Apple Developer Program and create a "Developer ID Application" certificate in Keychain.
2. In `electron-builder.yml`, replace `identity: "-"` with your certificate name (or remove it and set `CSC_NAME`), set `hardenedRuntime: true`, and add `notarize: true`.
3. Export `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`, then run `npm run dist`.

## Renaming the app

Change the name in three places:

- `src/shared/brand.ts`: display name, slug, URL scheme, file extensions.
- `package.json`: `name`, `productName`.
- `electron-builder.yml`: `appId`, `productName`, `dmg.title`, `fileAssociations`.

The data folder follows `productName`, so data from the old name will not be picked up automatically. Copy `~/Library/Application Support/<Old>/` to the new name.

## Adding features

- **A new IPC call**: add it to `IpcContract` and `CHANNELS` in `src/shared/ipc.ts`, add a handler with zod validation in `src/main/ipc/handlers.ts`, then call `api('channel', arg)` from the renderer. The TypeScript types flow end to end.
- **A new service item type**: extend `ServiceItemType` (types.ts) and `ItemTypeSchema` (validation.ts), add metadata in `renderer/src/lib/items.ts`, add a case in `shared/slides.ts#buildSlides`, and add a properties section in `views/planner/ItemProperties.tsx`. Add a unit test in `tests/unit/slides.test.ts`.
- **A schema change**: append a migration (see DATABASE.md) and update the repository in `src/main/db/repos/`.
- **A new setting**: add it to `AppSettings` and `DEFAULT_SETTINGS`. Stored settings are deep-merged over defaults, so existing installs pick it up automatically.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Electron failed to install correctly` | `node node_modules/electron/install.js` |
| App launches as Node / prints Node version | `ELECTRON_RUN_AS_NODE` is set; use the npm scripts or `env -u ELECTRON_RUN_AS_NODE` |
| Blank window in dev | Check the terminal for Vite errors; `npm run typecheck` |
| Output on the wrong screen | Live view → display menu, or Settings → Displays; use Identify |
| Video won't play | Unsupported codec (AVI/WMV/ProRes RAW); convert to MP4 H.264 |
| Database error at startup | The dialog shows the backups folder; restore from Settings → Backup, or copy a backup over `worshipflow.db` |
| Logs | `~/Library/Application Support/WorshipFlow/logs/main.log` |

## Regenerating bundled resources

```bash
node scripts/build-bibles.mjs <scrollmapper-json> KJV "King James Version (1769)" "Public domain"
node scripts/build-bible-library.mjs <folder of thiagobodruk/bible json files>   # bundled free English versions (+ KJV/BSB entries)
npx electron scripts/make-demo-media.cjs   # regenerates resources/demo (original, generated artwork/audio)
```
