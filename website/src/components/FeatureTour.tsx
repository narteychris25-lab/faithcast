'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, LayoutList, MonitorPlay, Music, Palette, LayoutDashboard } from 'lucide-react'
import { AppWindow, SectionHeading } from './ui'

const features = [
  { icon: LayoutList, title: 'Service Planner', body: 'Build the whole order of service in minutes. Drag in songs, scripture, videos, offering slides and announcements, then rearrange as plans change.', shot: '/screens/planner.jpg', alt: 'The service planner with a Sunday order of service' },
  { icon: MonitorPlay, title: 'Live control', body: 'See what’s on screen and what’s next, side by side. Press → or Space to move on, B for black, C to clear. Calm, even when the service changes.', shot: '/screens/live.jpg', alt: 'The live view with live and next previews' },
  { icon: BookOpen, title: 'Bible', body: 'Type a reference, click a verse, and it’s live. Line up the day’s readings ahead of time in the scripture schedule.', shot: '/screens/bible.jpg', alt: 'The Bible page with John 3:16 live' },
  { icon: Music, title: 'Songs', body: 'Paste lyrics from anywhere. FaithCast splits them into clean slides by verse and chorus, and you see every slide as you type.', shot: '/screens/songs.jpg', alt: 'The song editor with a slide preview' },
  { icon: Palette, title: 'Themes', body: 'Beautiful built-in themes for songs, scripture and announcements. Change fonts, colours and backgrounds, or make your own.', shot: '/screens/themes.jpg', alt: 'The themes gallery' },
  { icon: LayoutDashboard, title: 'Dashboard', body: 'Your services, songs and media at a glance, with one-click Quick Presentation for when something comes up mid-service.', shot: '/screens/dashboard.jpg', alt: 'The FaithCast dashboard' }
]

export function FeatureTour() {
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLLIElement | null)[]>([])

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i))
      },
      { rootMargin: '-45% 0px -45% 0px' }
    )
    refs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Everything for Sunday"
          title={<>One app for the <span className="accent-italic">whole service</span></>}
          intro="Songs, scripture, media and announcements live together, so you’re never juggling three programs while the congregation waits."
        />

        <div className="mt-20 grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <ol className="space-y-4 lg:space-y-0">
            {features.map((f, i) => {
              const on = i === active
              return (
                <li
                  key={f.title}
                  ref={(el) => {
                    refs.current[i] = el
                  }}
                  data-i={i}
                  className="lg:flex lg:min-h-[44vh] lg:items-center"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActive(i)
                      refs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                    className={`w-full rounded-2xl border p-6 text-left transition-all duration-500 ${on ? 'card border-blue/30' : 'border-transparent lg:opacity-40 lg:hover:opacity-70'}`}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`grid size-10 place-items-center rounded-xl transition-colors ${on ? 'bg-blue text-white' : 'bg-ink/5 text-muted'}`}>
                        <f.icon className="size-5" />
                      </span>
                      <span className="text-xl font-semibold text-ink">{f.title}</span>
                    </span>
                    <span className="mt-3 block text-[15px] leading-relaxed text-muted">{f.body}</span>
                  </button>
                  {/* on phones the screenshot sits under each item */}
                  <div className="mt-4 lg:hidden">
                    <AppWindow src={f.shot} alt={f.alt} />
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="relative hidden lg:block">
            <div className="sticky top-[calc(50vh-210px)]">
              <div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(42_116_245/0.14),transparent)] blur-2xl" />
              <div className="grid">
                <AnimatePresence initial={false}>
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 24, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.99 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="[grid-area:1/1]"
                  >
                    <AppWindow src={features[active].shot} alt={features[active].alt} />
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="mt-6 flex justify-center gap-2">
                {features.map((f, i) => (
                  <span key={f.title} className={`h-1 rounded-full transition-all duration-500 ${i === active ? 'w-8 bg-blue' : 'w-3 bg-ink/15'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
