# Architecture

## Stack and why

| Layer | Choice | Reason |
|---|---|---|
| Shell | Electron 44 | Chromium provides hardware-accelerated H.264/HEVC/VP9 playback on macOS and Windows, a reliable multi-window model, and `screen` APIs with hot-plug events. One codebase covers macOS (Intel and Apple Silicon) and Windows (x64). |
| UI | React 19, TypeScript, Tailwind 4 | Fast, typed, component-based UI; zustand for state; dnd-kit for sorting. |
| Data | SQLite via better-sqlite3 13 | Synchronous, transactional, crash-safe (WAL + `synchronous=FULL`), FTS5 full-text search, built-in online backup. It ships Node-API prebuilds, so there is no native compilation. |
| Validation | zod | Every IPC argument and every imported file is validated in the main process. |
| Packaging | electron-builder | macOS: `.app` + `.dmg`, x64 and arm64. Windows: NSIS installer, x64. |

FFmpeg is deliberately **not** used. Thumbnails come from macOS QuickLook or the Windows shell (`nativeImage.createThumbnailFromPath`), or from a frame captured in the renderer for formats the OS can't read. Playback uses Chromium's decoders, so no extra software is needed.

## Processes

```
┌──────────────────────── main process (Node) ────────────────────────┐
│ db/        SQLite connection, migrations, repositories, seed         │
│ ipc/       allow-listed, zod-validated handlers                      │
│ windows/   operator window, OutputManager, display detection         │
│ media/     fcmedia:// protocol (range requests), importer, thumbs    │
│ io/        songs / themes / bible / service-package import-export    │
│ backup.ts  VACUUM INTO backups, validate, restore                    │
│ index.ts   lifecycle, crash flag, live snapshot, menu                │
└───────────▲──────────────────────────────────────────▲──────────────┘
            │ window.fc (preload, contextBridge)        │
┌───────────┴───────────┐                   ┌───────────┴───────────┐
│ Operator renderer     │  live:update ──►   │ Output renderer       │
│ (planner, live brain) │  ◄── video status  │ (audience, no chrome) │
└───────────────────────┘      key relay     └───────────────────────┘
```

- **The operator renderer is the presentation brain.** `stores/live.ts` decides what is live, builds `LiveState`, and sends it through `live:update`.
- **The main process relays and persists.** It forwards state to the output window, and every second (always including the latest state) it saves a snapshot (service, item, slide) for crash recovery.
- **The output renderer only draws.** It receives fully resolved `RenderSlide` objects, so it never touches the database. Keys pressed while it has focus are relayed to the operator, and it reports video progress back.

## Slide pipeline

`shared/slides.ts#buildSlides(item, context)` is a pure function. It turns a service item plus its content (song, verses, media, themes, settings) into `RenderSlide[]`. Theme resolution order: item → song → service → default. Background resolution order: item → service → theme.

`components/slide/SlideView.tsx` renders a slide on a fixed logical canvas (1920×1080 for 16:9, 1440×1080 for 4:3, 1920×1200 for 16:10), scaled with a CSS transform. Because text is measured in logical pixels (`FitText` shrinks it to fit with a binary search, and results are cached), thumbnails, the LIVE monitor and a 4K projector all wrap text identically.

The output uses two `TransitionStack`s:

- **Background stack**, keyed by `backgroundKey`. A background video therefore keeps playing seamlessly across slides that share it.
- **Foreground stack**, keyed by slide key. Transitions use the Web Animations API with opacity and transform only, which is GPU-composited and cheap on Intel MacBooks. At most 3 layers exist, so rapid clicking never piles up video decoders.

## Output window

`windows/output.ts` (OutputManager) handles the audience window:

- **Target display selected (not the operator's screen):** a frameless window at the display's bounds, `alwaysOnTop('screen-saver')`, visible on all Spaces (macOS), with `backgroundThrottling: false`. Optionally uses native OS fullscreen instead.
- **No second display:** a resizable 16:9 preview window.
- **Display removed:** the output falls back to a preview window. The requested display is remembered, and output is restored when that display is reconnected.
- **Resilience:** a `powerSaveBlocker` prevents display sleep while output is open. If the output renderer crashes, it reloads automatically.

## Security

- `contextIsolation`, `sandbox: true`, no `nodeIntegration`. The preload exposes only allow-listed channels.
- Handlers verify that the sender frame is our own file:// (or dev-server) page, and validate all input with zod.
- Strict CSP (no remote scripts). Navigation is blocked, and external links open in the system browser (http/https/mailto only).
- `fcmedia://` serves only media registered in the database, by id. Arbitrary paths can never be requested.
- Imported files have size limits, schema validation and zip-entry filtering. React escapes all text, and no user HTML is ever rendered.
- Export destinations are chosen through native save dialogs in the main process.

## Internet section

`views/internet/InternetView.tsx` hosts websites in an Electron `<webview>`. `main/web.ts` hardens every guest in `will-attach-webview`:

- removes any preload and forces `sandbox`, `contextIsolation` and no Node integration
- uses a dedicated session (`persist:web`) that denies camera, microphone, notifications and geolocation, and cancels automatic downloads
- allows only http(s) navigation, and opens pop-ups in the same view

Saving pictures or videos goes through `web:saveMedia`, a validated download with type checks and size limits.

Live web pages on the projector (`RenderSlide.kind === 'web'`) are drawn by `OutputApp` at real pixel size, because guest views don't render correctly inside the CSS-scaled slide canvas. YouTube links are converted to the embed player (`shared/web.ts#outputUrl`). Operator previews show a static card, so thumbnails never load sites or play sound.

## Directory map

```
src/shared      types, defaults/themes, lyrics parser, slide builder, bible books, IPC contract
src/main        main process (see above)
src/preload     contextBridge bridge
src/renderer    index.html (operator), output.html (audience)
  src/stores    app, service (autosave), content cache, live, audio
  src/views     dashboard, planner/, live/, songs/, bible/, media/, themes/, settings/, slide-editor/, help, setup wizard
  src/components ui kit, slide renderer, editors, search palette, recovery prompt, error boundary
resources       bundled public-domain Bibles, generated demo media
scripts         Bible converter, demo-media generator
tests           unit/, db/ (Vitest), e2e/ (Playwright + Electron)
```
