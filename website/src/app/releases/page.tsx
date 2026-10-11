import type { Metadata } from 'next'
import { ArrowDown, Check } from 'lucide-react'
import { Footer } from '@/components/Closing'
import { Nav } from '@/components/Nav'
import { Eyebrow, Reveal } from '@/components/ui'
import { download, formatDate, platformOrder, releases, type Release } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Releases',
  description: 'Every version of FaithCast, what changed in each one, and downloads for Windows and Mac.'
}

function ReleaseCard({ release, isLatest }: { release: Release; isLatest: boolean }) {
  return (
    <article className={`card relative rounded-3xl p-7 sm:p-9 ${isLatest ? 'border-blue/30' : ''}`}>
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-ink">Version {release.version}</h2>
        {isLatest && <span className="rounded-full bg-blue px-3 py-1 text-xs font-semibold text-white">Latest</span>}
        <time dateTime={release.date} className="text-sm text-dim sm:ml-auto">
          {formatDate(release.date)}
        </time>
      </header>
      <p className="display mt-4 text-3xl text-ink sm:text-4xl">{release.title}</p>
      <p className="mt-2 text-muted">{release.summary}</p>

      <ul className="mt-6 space-y-3">
        {release.changes.map((c) => (
          <li key={c} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink/90">
            <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-blue/15 text-sky">
              <Check className="size-3" strokeWidth={3} />
            </span>
            {c}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-2 border-t border-line pt-6">
        {platformOrder.map((p) => {
          const d = download(release, p)
          return (
            <a
              key={p}
              href={d.href}
              className={`group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                isLatest ? 'bg-blue text-white hover:bg-[#3b82ff]' : 'border border-ink/15 text-ink hover:border-ink/30 hover:bg-ink/[0.03]'
              }`}
            >
              <ArrowDown className="size-3.5 transition group-hover:translate-y-0.5" />
              {d.short}
              <span className={isLatest ? 'text-white/70' : 'text-dim'}>· {d.size}</span>
            </a>
          )
        })}
      </div>
    </article>
  )
}

export default function ReleasesPage() {
  return (
    <>
      <Nav />
      <main className="relative isolate overflow-x-clip pt-36 pb-24 sm:pt-44">
        <div aria-hidden className="grid-bg absolute inset-x-0 top-0 -z-10 h-[600px]" />
        <div aria-hidden className="absolute top-[-200px] left-1/2 -z-10 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(42_116_245/0.16),transparent)] blur-3xl" />

        <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Eyebrow>Release notes</Eyebrow>
          <h1 className="display mt-6 text-5xl sm:text-7xl">
            What&rsquo;s new in <span className="accent-italic">FaithCast</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
            Every version, what changed, and its downloads. Updates are free, and installing a new version keeps your songs, services and settings.
          </p>
        </Reveal>

        <ol className="relative mx-auto mt-16 max-w-3xl px-4 sm:px-6">
          {/* timeline */}
          <span aria-hidden className="absolute top-4 bottom-4 left-[2.4rem] hidden w-px bg-gradient-to-b from-blue/50 via-line to-transparent md:block" />
          {releases.map((r, i) => (
            <li key={r.version} className="relative pb-8 last:pb-0 md:pl-16">
              <span aria-hidden className={`absolute top-9 left-2 hidden size-3.5 rounded-full ring-4 ring-white md:block ${i === 0 ? 'bg-blue shadow-[0_0_0_6px_rgb(42_116_245/0.15)]' : 'bg-ink/20'}`} />
              <Reveal delay={i * 0.08}>
                <ReleaseCard release={r} isLatest={i === 0} />
              </Reveal>
            </li>
          ))}
        </ol>
      </main>
      <Footer />
    </>
  )
}
