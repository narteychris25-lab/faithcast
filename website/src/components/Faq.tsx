'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { SectionHeading } from './ui'

const faqs = [
  { q: 'Is FaithCast really free?', a: 'Yes. FaithCast is a free download for Windows and Mac, with no subscription, no trial period, no watermark and no account to create.' },
  { q: 'Do we need internet during the service?', a: 'No. Everything FaithCast needs, including Bibles, songs, themes and your media, is stored on your computer. You only need internet to show a website or YouTube video from the Internet tab.' },
  { q: 'Will it work with our projector or TV?', a: 'If your computer can connect to it, FaithCast can use it. Plug it in with HDMI (or an adapter), choose it as the output screen, and press Identify to make sure you picked the right one. Your controls stay on the computer screen.' },
  { q: 'Which Bible versions are included?', a: '14 free English versions come with FaithCast, including the KJV, Berean Standard Bible, ASV, World English Bible, Young’s Literal, Geneva and Darby. Copyrighted versions such as the NIV, ESV or NKJV can be imported from a file if your church has the publisher’s permission.' },
  { q: 'How do we get our songs in?', a: 'Paste the lyrics into a new song. FaithCast splits them into slides by verse and chorus automatically, and you can choose the order they’re sung in. Songs can also be exported and shared between computers.' },
  { q: 'Is it hard for new volunteers to learn?', a: 'FaithCast is designed for volunteers. A setup wizard and a ready-made demo service help on the first day, buttons are large and clearly labelled, and the built-in Help explains everything in plain language.' },
  { q: 'What if the computer crashes in the middle of a service?', a: 'Open FaithCast again and it offers to carry on from the same service and slide. Your library is also backed up automatically.' }
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <SectionHeading eyebrow="FAQ" title={<>Questions, <span className="accent-italic">answered</span></>} />
        <ul className="mt-14 space-y-3">
          {faqs.map((f, i) => {
            const on = open === i
            return (
              <li key={f.q} className={`rounded-2xl border transition-colors ${on ? 'card border-blue/25' : 'border-ink/10 hover:border-ink/20'}`}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={on}
                    onClick={() => setOpen(on ? null : i)}
                    className="flex w-full items-center justify-between gap-6 p-6 text-left text-lg font-semibold text-ink"
                  >
                    {f.q}
                    <motion.span animate={{ rotate: on ? 45 : 0 }} className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors ${on ? 'bg-blue text-white' : 'bg-ink/5 text-muted'}`}>
                      <Plus className="size-4" />
                    </motion.span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-6 leading-relaxed text-muted">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
