import { BRAND } from '@shared/brand'
import { cx } from '@/lib/format'
import mark from '@/assets/logo-mark.png'

/** The FaithCast logo: the mark, plus the two-tone wordmark ("Faith" in ink, "Cast" in brand blue). */
export function Logo({ size = 20, wordmark = true, className }: { size?: number; wordmark?: boolean; className?: string }) {
  const [first, second] = BRAND.wordmark
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1.5', className)} role="img" aria-label={BRAND.name}>
      <img src={mark} alt="" draggable={false} style={{ height: size }} />
      {wordmark && (
        <span className="leading-none font-bold tracking-tight" style={{ fontSize: Math.round(size * 0.78) }} aria-hidden>
          <span className="text-fg">{first}</span>
          <span className="text-accent">{second}</span>
        </span>
      )}
    </span>
  )
}
