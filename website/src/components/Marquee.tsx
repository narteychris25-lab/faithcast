const items = ['Sunday Service', 'Midweek Bible Study', 'Youth Night', 'Prayer Meeting', 'Conferences', 'Weddings', 'Thanksgiving', 'Crusades', 'Choir Rehearsal', 'Funerals', 'Watch Night', 'Easter & Christmas']

export function Marquee() {
  return (
    <section aria-label="Made for every kind of service" className="relative border-y border-line bg-night-2/60 py-6">
      <p className="sr-only">Made for every kind of service: {items.join(', ')}.</p>
      <div aria-hidden className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="flex shrink-0 animate-marquee items-center gap-10 pr-10">
          {[...items, ...items].map((t, i) => (
            <span key={i} className="flex items-center gap-10 whitespace-nowrap">
              <span className="display text-3xl text-ink/80 italic sm:text-4xl">{t}</span>
              <span className="size-1.5 rounded-full bg-blue" />
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
