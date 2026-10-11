import { Logo } from '@/components/Logo'

/**
 * Full-window loading screen, shown while the operator window fetches its first data.
 * Normally hidden behind the launch splash (main/windows/splash.ts); it's seen when the
 * window reloads, e.g. after a renderer crash.
 */
export function LoadingSplash({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-bg" role="status" aria-live="polite">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 left-1/2 h-[80%] w-[90%] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent)' }}
      />
      <div className="relative flex flex-col items-center" style={{ animation: 'fc-pop 0.5s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
        <Logo size={40} />
        <div className="mt-6 h-[3px] w-44 overflow-hidden rounded-full bg-line">
          <div className="fc-splash-bar h-full w-1/3 rounded-full bg-accent" />
        </div>
        <p className="mt-3 text-[13px] text-muted">{label}</p>
      </div>
    </div>
  )
}
