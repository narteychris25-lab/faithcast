'use client'

import { Check } from 'lucide-react'
import { DownloadButton } from './DownloadButton'
import { Reveal, SectionHeading } from './ui'

const included = [
  'Unlimited services, songs and media',
  '14 English Bible versions',
  'Service planner and live control',
  'Themes and a custom slide editor',
  'Announcements, YouTube and websites',
  'Automatic backups and crash recovery',
  'Windows and Mac',
  'Every future update'
]

export function Pricing() {
  return (
    <section id="pricing" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Pricing"
          title={<>Free. <span className="accent-italic">Really.</span></>}
          intro="Every church deserves a great screen on Sunday, whatever its size or budget. FaithCast costs nothing: no trial, no subscription, no watermark."
        />
        <Reveal className="relative mx-auto mt-16 max-w-4xl">
          <div aria-hidden className="absolute -inset-px -z-10 rounded-[2rem] bg-gradient-to-b from-blue/50 via-blue/10 to-blue/5" />
          <div className="noise relative grid gap-10 overflow-hidden rounded-[2rem] bg-night-2 p-8 sm:p-12 md:grid-cols-[1fr_1.2fr]">
            <div aria-hidden className="absolute -top-40 -left-20 size-96 rounded-full bg-blue/10 blur-3xl" />
            <div className="relative">
              <span className="rounded-full bg-blue/15 px-3 py-1 text-sm font-semibold text-sky">Everything included</span>
              <p className="mt-6 flex items-end gap-2">
                <span className="display text-8xl text-ink">$0</span>
                <span className="pb-3 text-muted">forever</span>
              </p>
              <p className="mt-4 text-muted">For one church or a hundred campuses.</p>
              <DownloadButton className="mt-8 w-full sm:w-auto" />
            </div>
            <ul className="relative grid content-center gap-3.5 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
              {included.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] text-ink/90">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-blue/20 text-sky">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
