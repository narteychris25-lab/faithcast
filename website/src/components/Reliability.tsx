'use client'

import { motion } from 'motion/react'
import { Command, DatabaseBackup, Globe, Megaphone, MonitorSmartphone, RotateCcw, WifiOff } from 'lucide-react'
import { SectionHeading } from './ui'

const ease = [0.22, 1, 0.36, 1] as const

function Tile({ className = '', delay = 0, children }: { className?: string; delay?: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8%' }}
      transition={{ duration: 0.8, delay, ease }}
      className={`card relative overflow-hidden rounded-3xl p-7 ${className}`}
    >
      {children}
    </motion.div>
  )
}

function TileText({ icon: Icon, title, body }: { icon: typeof WifiOff; title: string; body: string }) {
  return (
    <>
      <span className="grid size-10 place-items-center rounded-xl bg-blue/15 text-sky">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-5 text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
    </>
  )
}

const keys = [
  ['→', 'Next'],
  ['←', 'Previous'],
  ['B', 'Black'],
  ['C', 'Clear'],
  ['L', 'Logo'],
  ['Esc', 'Exit']
]

export function Reliability() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Dependable"
          title={<>Built so Sunday <span className="accent-italic">never goes dark</span></>}
          intro="Church tech should be the last thing anyone worries about. FaithCast is designed to keep going, whatever happens."
        />

        <div className="mt-16 grid gap-4 md:grid-cols-6">
          <Tile className="md:col-span-4 md:min-h-[22rem]">
            <div className="relative z-10 max-w-sm">
              <TileText icon={WifiOff} title="Works completely offline" body="Bibles, songs, themes and media all live on your computer. No internet, no login, no buffering in the middle of worship." />
            </div>
            {/* radiating rings */}
            <div aria-hidden className="absolute top-1/2 right-[-4rem] -translate-y-1/2 sm:right-8">
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  key={i}
                  className="absolute top-1/2 left-1/2 rounded-full border border-blue/40"
                  style={{ width: 120, height: 120, x: '-50%', y: '-50%' }}
                  animate={{ scale: [1, 3.2], opacity: [0.6, 0] }}
                  transition={{ duration: 4, repeat: Infinity, delay: i, ease: 'easeOut' }}
                />
              ))}
              <span className="relative grid size-28 place-items-center rounded-full bg-gradient-to-b from-blue to-brand shadow-[0_0_60px_6px_rgb(42_116_245/0.35)]">
                <WifiOff className="size-11 text-white" />
              </span>
            </div>
          </Tile>

          <Tile className="md:col-span-2" delay={0.08}>
            <TileText icon={RotateCcw} title="Picks up where it left off" body="If the computer restarts mid-service, FaithCast reopens on the same service and slide, ready to carry on." />
          </Tile>

          <Tile className="md:col-span-3" delay={0.05}>
            <TileText icon={Command} title="Run it from the keyboard" body="Every action has a key, so your eyes stay on the stage." />
            <ul className="mt-6 grid grid-cols-3 gap-2">
              {keys.map(([k, label], i) => (
                <motion.li
                  key={k}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.06 }}
                  className="flex items-center gap-2 rounded-xl border border-ink/10 bg-ink/[0.03] p-2"
                >
                  <kbd className="grid h-8 min-w-8 place-items-center rounded-lg border border-ink/10 border-b-2 border-b-ink/20 bg-white px-2 shadow-sm font-mono text-sm text-ink">{k}</kbd>
                  <span className="text-sm text-muted">{label}</span>
                </motion.li>
              ))}
            </ul>
          </Tile>

          <Tile className="md:col-span-3" delay={0.12}>
            <TileText icon={MonitorSmartphone} title="Any projector or TV" body="Plug in HDMI and choose the screen. Press Identify to check you have the right one, and watch a preview of the output on your own screen." />
          </Tile>

          <Tile className="md:col-span-2" delay={0.05}>
            <TileText icon={Globe} title="YouTube & websites" body="Show a YouTube video or any website full screen from the Internet tab." />
          </Tile>
          <Tile className="md:col-span-2" delay={0.1}>
            <TileText icon={Megaphone} title="Announcements & slides" body="Ready-made announcement slides plus a slide editor for anything else." />
          </Tile>
          <Tile className="md:col-span-2" delay={0.15}>
            <TileText icon={DatabaseBackup} title="Automatic backups" body="Your library is backed up automatically, and restoring takes one click." />
          </Tile>
        </div>
      </div>
    </section>
  )
}
