'use client'

import { motion } from 'motion/react'
import { Apple, ArrowDown, Info } from 'lucide-react'
import { downloads, VERSION, type Platform } from '@/lib/site'
import { useDetectedOS } from './DownloadButton'
import { SectionHeading } from './ui'

function WindowsLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M3 5.1 10.4 4v7.1H3V5.1Zm0 13.8 7.4 1.1v-7H3v5.9Zm8.3 1.2L21 21.5v-8.4h-9.7v7Zm0-16.2v7.2H21V2.5l-9.7 1.4Z" />
    </svg>
  )
}

const order: Platform[] = ['windows', 'mac-arm', 'mac-intel']

export function Download() {
  const os = useDetectedOS()
  return (
    <section id="download" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={`Version ${VERSION}`} title={<>Download <span className="accent-italic">FaithCast</span></>} intro="Choose your computer. Installing takes about a minute, and no account is needed." />

        <ul className="mt-16 grid gap-4 md:grid-cols-3">
          {order.map((p, i) => {
            const d = downloads[p]
            const suggested = (os === 'windows' && p === 'windows') || (os === 'mac' && p !== 'windows')
            return (
              <motion.li
                key={p}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <a
                  href={d.href}
                  className={`card group flex h-full flex-col rounded-3xl p-7 transition hover:-translate-y-1 hover:border-blue/40 hover:shadow-[0_30px_80px_-30px_rgb(42_116_245/0.45)] ${suggested ? 'border-blue/40' : ''}`}
                >
                  <span className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-2xl bg-ink/5 text-ink">
                      {p === 'windows' ? <WindowsLogo className="size-6" /> : <Apple className="size-6" />}
                    </span>
                    {suggested && <span className="rounded-full bg-blue/15 px-3 py-1 text-xs font-semibold text-sky">For this computer</span>}
                  </span>
                  <span className="mt-6 text-xl font-semibold text-ink">{d.label}</span>
                  <span className="mt-1 text-sm text-muted">{d.detail}</span>
                  <span className="mt-8 flex items-center justify-between border-t border-ink/10 pt-5 text-sm">
                    <span className="text-dim">
                      {d.file.endsWith('.exe') ? '.exe installer' : '.dmg disk image'} · {d.size}
                    </span>
                    <span className="grid size-9 place-items-center rounded-full bg-blue text-white transition group-hover:translate-y-0.5">
                      <ArrowDown className="size-4" />
                    </span>
                  </span>
                </a>
              </motion.li>
            )
          })}
        </ul>

        <div className="mx-auto mt-10 grid max-w-4xl gap-4 text-sm text-muted md:grid-cols-2">
          <p className="flex gap-3 rounded-2xl border border-ink/10 p-5">
            <Info className="mt-0.5 size-4 shrink-0 text-sky" />
            <span>
              <strong className="text-ink">Windows:</strong> if you see &ldquo;Windows protected your PC&rdquo;, click <strong className="text-ink">More info</strong>, then <strong className="text-ink">Run anyway</strong>. This appears because FaithCast is new and not yet code-signed.
            </span>
          </p>
          <p className="flex gap-3 rounded-2xl border border-ink/10 p-5">
            <Info className="mt-0.5 size-4 shrink-0 text-sky" />
            <span>
              <strong className="text-ink">Mac:</strong> drag FaithCast into Applications. If macOS blocks the first open, go to <strong className="text-ink">System Settings → Privacy &amp; Security</strong> and click <strong className="text-ink">Open Anyway</strong>.
            </span>
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-dim">
          Not sure which Mac you have? Open the Apple menu → <span className="text-muted">About This Mac</span>. &ldquo;Chip: Apple M…&rdquo; means Apple silicon.{' '}
          <a href="/releases" className="text-sky underline-offset-4 hover:underline">
            All versions and release notes
          </a>
        </p>
      </div>
    </section>
  )
}
