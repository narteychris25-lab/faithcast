# FaithCast website

The marketing site for FaithCast. It's a single static page built with Next.js 16, Tailwind CSS 4 and Motion, and hosted on Vercel.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

## Releasing a new version of the app

The download buttons point at the public repo [narteychris25-lab/faithcast-releases](https://github.com/narteychris25-lab/faithcast-releases), which holds only the installers. For a new version:

1. In the app folder, run `npm run dist` and `npm run dist:win`.
2. `gh release create v<version> --repo narteychris25-lab/faithcast-releases release/FaithCast-Setup-<version>.exe release/FaithCast-<version>-arm64.dmg release/FaithCast-<version>-x64.dmg`
3. In `src/lib/site.ts`, update `VERSION` and the file sizes, then redeploy with `vercel deploy --prod`.

## Where things are

| Path | What |
|---|---|
| `src/lib/site.ts` | Version, download links and sizes, nav links, site URL |
| `src/app/page.tsx` | The order of the sections |
| `src/components/` | One file per section (Hero, ScriptureDemo, FeatureTour…) |
| `public/screens/` | App screenshots, taken from the real app with its demo content |
| `src/app/globals.css` | Colours, fonts and shared styles |
