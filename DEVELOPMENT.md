# Development

## Setup

```bash
npm install
npm run dev
```

`npm run dev` opens the app straight from the source code: no build step. Edits to anything in `src/renderer` (screens, components, styles) show up instantly in the open window. Edits to `src/main` or `src/preload` make the app restart by itself within a few seconds. Only run `npm run dist` when you want an updated installed app.

The dev app keeps its data in `~/Library/Application Support/FaithCast Dev` (`%APPDATA%\FaithCast Dev` on Windows), separate from the installed app's `FaithCast` folder. So it can run while the installed app is open, and experiments never touch the church's real songs, services or Bibles. To work with a copy of the real data, run `npm run dev:copy-data` (safe while the installed app is open; it replaces the dev copy). Tests use their own temporary folders.

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
npm run dist       # installer for the OS you're on
npm run dist:mac   # release/FaithCast-<v>-x64.dmg and -arm64.dmg, plus .app folders
npm run dist:win   # release/FaithCast-Setup-<v>.exe (NSIS, x64), plus release/win-unpacked
npm run dist:dir   # unpacked app only, for the current OS (faster)
```

Configuration is in `electron-builder.yml`. Bundled resources (`resources/`) are copied to `resources/resources` inside the app. better-sqlite3 is unpacked from the asar archive so its `.node` binary can load. better-sqlite3's prebuilds cover macOS x64/arm64 and Windows x64/arm64, so no native compiler is needed: both Mac architectures build from either Mac, and the Windows installer builds on a Mac too (no Wine needed). To test it, copy the `.exe` to a Windows PC; `release/win-unpacked/FaithCast.exe` runs without installing.

The Windows installer is per-user (no admin prompt), lets the user pick the folder, and leaves the church's data in `%APPDATA%\FaithCast` on uninstall.

### Platform differences

The code is shared; these are the places that differ by OS:

| Area | macOS | Windows |
|---|---|---|
| Window chrome (`main/index.ts`) | `hiddenInset` title bar, traffic lights inside the header | `hidden` title bar with `titleBarOverlay`: native caption buttons over the header, recoloured with the appearance (`app:titleBar`) |
| Menu (`main/menu.ts`) | Menu bar with the app menu | No menu bar; the ☰ button in the header pops up the same menu (`app:popupMenu`). Accelerators still work. Settings and Exit are in File, About in Help, Help is F1 |
| Shortcuts (`renderer/src/lib/shortcuts.ts`) | ⌘ | Ctrl. Bindings are stored as `Mod+…`, so they carry over between the two (older `Meta+…` bindings are read as `Mod`). Use `isMod(e)` from `lib/platform.ts` instead of `e.metaKey` |
| Text in the UI | Finder, Mac, macOS | File Explorer, PC, Windows (`OS` in `lib/platform.ts`) |
| Fonts | Theme fonts as chosen | Mac-only theme fonts fall back to the closest Windows font (`fontStack` in `FitText.tsx`); the font list shows Windows fonts |
| HEIC/TIFF import | Converted to JPEG | Not supported (no decoder); the import error says to save as JPEG/PNG |
| Image thumbnails | `nativeImage` | GIF/WebP/BMP etc. are drawn by the renderer, since `nativeImage` only decodes PNG/JPEG there |

The Windows build is made and checked on a Mac, but the app hasn't yet been run on a Windows PC. Check the title bar, a real projector and video playback there first.

### Code signing and notarisation

Builds are **ad-hoc signed** (`identity: "-"`). That's enough for macOS to launch the app by double-click on the Mac that built it, and Apple Silicon requires at least an ad-hoc signature to run at all. On *other* Macs, the first launch still needs **System Settings → Privacy & Security → Open Anyway**. For proper distribution:

1. Join the Apple Developer Program and create a "Developer ID Application" certificate in Keychain.
2. In `electron-builder.yml`, replace `identity: "-"` with your certificate name (or remove it and set `CSC_NAME`), set `hardenedRuntime: true`, and add `notarize: true`.
3. Export `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`, then run `npm run dist:mac`.

**Windows** builds are unsigned, so SmartScreen warns on first run ("More info → Run anyway"). To sign, buy a code-signing certificate (an EV or Azure Trusted Signing certificate avoids the SmartScreen reputation warm-up) and set `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` (or `win.azureSignOptions`) before `npm run dist:win`.

## Brand assets

| File | Use |
|---|---|
| `brand/faithcast-logo-original.png` | The logo as supplied (mark + wordmark on white) |
| `brand/faithcast-logo.png` | Same, transparent background (README, documents) |
| `brand/faithcast-mark.png` | The mark alone, transparent, 1024 px tall — the source for everything below |
| `build/icon.icns` | macOS app icon: the mark on a white rounded tile (Big Sur grid, with shadow) |
| `build/icon.ico` | Windows app/installer icon, 16–256 px: the mark on a full-bleed white rounded tile |
| `build/icon.png` | 1024 px version of the macOS icon (Dock icon in `npm run dev`) |
| `src/renderer/src/assets/logo-mark.png` | In-app logo (header, setup wizard, Settings → About) and window favicon |

Colours (from the logo, defined as tokens in `src/renderer/src/styles.css`): brand blue `#0B6CF5`, deep blue `#002B8D`, ink navy `#0B1533`. The UI accent is `#0A5FE0` in light mode and `#2A74F5` in dark mode, slightly deeper than the brand blue so white button text stays readable. The wordmark is drawn by `components/Logo.tsx` ("Faith" in ink, "Cast" in accent) using `BRAND.wordmark`.

## Renaming the app

The app was renamed from **WorshipFlow** to **FaithCast**. The name lives in:

- `src/shared/brand.ts`: display name, wordmark, slug, app ID, URL scheme, file extensions, and `legacy` (the previous name).
- `package.json`: `name`, `productName`.
- `electron-builder.yml`: `appId`, `productName`, `copyright`, `dmg.title`, `nsis.shortcutName`, `fileAssociations`. `appId` must match `BRAND.appId`.
- Icons and logo: see [Brand assets](#brand-assets).

The data folder follows `productName`. So that a church upgrading from WorshipFlow keeps everything, `src/main/legacy.ts` runs on the first launch under the new name: it copies the old data folder (`WorshipFlow` → `FaithCast`, and `WorshipFlow Dev` → `FaithCast Dev`), turns `worshipflow.db` into `faithcast.db`, and re-points media paths that were inside the old folder. The old folder is left untouched. Demo media paths that pointed into the old app bundle are fixed at startup (`relinkDemoMedia`), and remembered UI state (`wf.*` localStorage keys) is moved to `fc.*`.

Files from before the rename still open: `worshipflow-song`, `worshipflow-service`, `worshipflow-theme` and `worshipflow-bible` formats, `.wfbible` Bible files, and `worshipflow-*.db` backups. New files are written with the `faithcast-*` formats and `.fcbible`.

To rename again, change the places above, set `BRAND.legacy` to the name you're leaving, and update `legacy.ts` if more than one previous name must be supported.

## Adding features

- **A new IPC call**: add it to `IpcContract` and `CHANNELS` in `src/shared/ipc.ts`, add a handler with zod validation in `src/main/ipc/handlers.ts`, then call `api('channel', arg)` from the renderer. The TypeScript types flow end to end.
- **A new service item type**: extend `ServiceItemType` (types.ts) and `ItemTypeSchema` (validation.ts), add metadata in `renderer/src/lib/items.ts`, add a case in `shared/slides.ts#buildSlides`, and add a properties section in `views/planner/ItemProperties.tsx`. Add a unit test in `tests/unit/slides.test.ts`.
- **A schema change**: append a migration (see DATABASE.md) and update the repository in `src/main/db/repos/`.
- **A new setting**: add it to `AppSettings` and `DEFAULT_SETTINGS`. Stored settings are deep-merged over defaults, so existing installs pick it up automatically.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Electron failed to install correctly` | `node node_modules/electron/install.js` |
| App launches as Node / prints Node version | `ELECTRON_RUN_AS_NODE` is set; use the npm scripts (they run through `scripts/without-run-as-node.mjs`) |
| Blank window in dev | Check the terminal for Vite errors; `npm run typecheck` |
| Output on the wrong screen | Live view → display menu, or Settings → Displays; use Identify |
| Video won't play | Unsupported codec (AVI/WMV/ProRes RAW); convert to MP4 H.264 |
| Database error at startup | The dialog shows the backups folder; restore from Settings → Backup, or copy a backup over `faithcast.db` |
| Logs | `~/Library/Application Support/FaithCast/logs/main.log` (macOS), `%APPDATA%\FaithCast\logs\main.log` (Windows) |

## Regenerating bundled resources

```bash
node scripts/build-bibles.mjs <scrollmapper-json> KJV "King James Version (1769)" "Public domain"
node scripts/build-bible-library.mjs <folder of thiagobodruk/bible json files>   # bundled free English versions (+ KJV/BSB entries)
npx electron scripts/make-demo-media.cjs   # regenerates resources/demo (original, generated artwork/audio)
```
