import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Monitor, Upload } from 'lucide-react'
import type { RenderSlide } from '@shared/types'
import { BRAND } from '@shared/brand'
import { api, thumbUrl } from '@/lib/api'
import { cx, nextSundayISO } from '@/lib/format'
import { useApp } from '@/stores/app'
import { Button, Field, Input, Segmented, Toggle } from '@/components/ui/controls'
import { toast } from '@/components/ui/overlays'
import { SlidePreview } from '@/components/slide/SlideCanvas'

const STEPS = ['Church name', 'Church logo', 'Displays', 'Default theme', 'First service']

/** First-run wizard: five short steps, then the dashboard. */
export function SetupWizard() {
  const app = useApp()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(app.church.name)
  const [logoId, setLogoId] = useState<string | null>(app.church.logoMediaId)
  const [themeId, setThemeId] = useState(app.settings.defaultThemeId ?? app.themes[0]?.id ?? null)
  const [serviceName, setServiceName] = useState('Sunday Service')
  const [demo, setDemo] = useState(true)
  const [busy, setBusy] = useState(false)

  async function pickLogo() {
    const files = await api('dialog:openFiles', { kind: 'image', multiple: false })
    if (!files.length) return
    const r = await api('media:import', { paths: files, folder: 'Branding' })
    if (r.ids[0]) setLogoId(r.ids[0])
    else toast.error(r.errors[0] ?? 'Could not import that image')
  }

  async function finish() {
    setBusy(true)
    try {
      await app.saveChurch({ name: name.trim(), logoMediaId: logoId })
      await app.saveSettings({ defaultThemeId: themeId })
      let openId: string | null = null
      if (demo) openId = (await api('app:loadDemo')).serviceId
      if (serviceName.trim()) {
        const svc = await api('services:create', { name: serviceName.trim(), date: nextSundayISO(), themeId })
        openId = svc.id
      }
      await app.saveSettings({ setupComplete: true })
      if (openId) useApp.setState({ currentServiceId: openId })
      try {
        if (openId) localStorage.setItem('wf.currentService', openId)
      } catch {
        /* ignore */
      }
      app.navigate('dashboard')
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  const sample = (id: string): RenderSlide | null => {
    const t = app.themes.find((x) => x.id === id)
    if (!t) return null
    return { key: id, kind: 'text', label: '', group: '', text: 'Amazing grace! How sweet the sound\nThat saved a wretch like me!', subtext: '', title: '', theme: t.settings, background: t.settings.background, media: null, elements: [], logoMediaId: null }
  }

  return (
    <div className="drag flex h-full items-center justify-center bg-gradient-to-br from-accent/15 to-bg p-8">
      <div className="no-drag flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line-strong bg-panel shadow-2xl">
        <div className="border-b border-line px-8 pt-7 pb-5">
          <div className="text-[12px] font-bold tracking-widest text-accent uppercase">Welcome to {BRAND.name}</div>
          <div className="mt-3 flex gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div className={cx('h-1 rounded-full', i <= step ? 'bg-accent' : 'bg-line')} />
                <div className={cx('mt-1.5 text-[11px]', i === step ? 'text-fg' : 'text-dim')}>{i + 1}. {s}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="min-h-[340px] overflow-auto px-8 py-6">
          {step === 0 && (
            <>
              <h2 className="mb-1 text-lg font-semibold">What's your church called?</h2>
              <p className="mb-4 text-[13px] text-muted">Used on the dashboard and available for slides. You can change it later in Settings.</p>
              <Field label="Church name">
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Glory House Chapel" className="h-10 text-[15px]" onKeyDown={(e) => e.key === 'Enter' && setStep(1)} />
              </Field>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="mb-1 text-lg font-semibold">Add your church logo</h2>
              <p className="mb-4 text-[13px] text-muted">Shown full-screen with the Logo button during services, and optionally in a corner of slides. PNG with a transparent background works best.</p>
              <div className="flex items-center gap-4">
                <div className="flex h-32 w-56 items-center justify-center rounded-lg border border-line bg-black">
                  {logoId ? <img src={thumbUrl(logoId)} className="max-h-full max-w-full object-contain" alt="Logo" /> : <span className="text-[12px] text-dim">No logo</span>}
                </div>
                <div className="flex flex-col gap-2">
                  <Button icon={Upload} onClick={() => void pickLogo()}>{logoId ? 'Choose another…' : 'Choose image…'}</Button>
                  {logoId && <Button variant="ghost" onClick={() => setLogoId(null)}>Remove</Button>}
                  <span className="text-[11px] text-dim">Optional — you can skip this.</span>
                </div>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="mb-1 text-lg font-semibold">Your displays</h2>
              <p className="mb-4 text-[13px] text-muted">
                {app.displays.length > 1
                  ? 'A second display is connected. The audience output will use it automatically; your Mac screen keeps the operator view.'
                  : 'Only this screen is connected. The output will open in a preview window until you connect a projector or TV — WorshipFlow will detect it and offer to switch.'}
              </p>
              <div className="flex flex-col gap-2">
                {app.displays.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-md border border-line p-3">
                    <Monitor size={18} className={d.primary ? 'text-accent' : 'text-live'} />
                    <div className="flex-1 text-[13px]">
                      <div className="font-medium">{d.label}</div>
                      <div className="text-[11px] text-muted">{d.width}×{d.height} · {Math.round(d.refreshRate)} Hz</div>
                    </div>
                    <span className="text-[11px] text-muted">{d.primary ? 'Operator' : 'Presentation'}</span>
                  </div>
                ))}
              </div>
              <Button className="mt-3" onClick={() => void api('output:identify')}>Identify displays</Button>
            </>
          )}
          {step === 3 && (
            <>
              <div className="mb-5 flex items-center gap-3">
                <span className="text-[13px] text-muted">Interface appearance</span>
                <Segmented
                  value={app.settings.appearance}
                  onChange={(v) => void app.saveSettings({ appearance: v })}
                  options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'Match macOS' }]}
                />
              </div>
              <h2 className="mb-1 text-lg font-semibold">Choose a default theme for slides</h2>
              <p className="mb-4 text-[13px] text-muted">The look of your lyrics and Bible slides. You can create your own later.</p>
              <div className="grid grid-cols-4 gap-3">
                {app.themes.map((t) => (
                  <button key={t.id} type="button" onClick={() => setThemeId(t.id)} className={cx('overflow-hidden rounded-lg border-2 text-left', themeId === t.id ? 'border-accent' : 'border-line')}>
                    <SlidePreview slide={sample(t.id)} aspect="16:9" />
                    <div className="flex items-center gap-1 px-2 py-1 text-[12px]">{themeId === t.id && <Check size={12} className="text-accent" />}{t.name}</div>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <h2 className="mb-1 text-lg font-semibold">Create your first service</h2>
              <p className="mb-4 text-[13px] text-muted">We'll create it for next Sunday. Leave blank to skip.</p>
              <Field label="Service name">
                <Input autoFocus value={serviceName} onChange={(e) => setServiceName(e.target.value)} className="h-10 text-[15px]" />
              </Field>
              <div className="mt-5 rounded-lg border border-line p-3">
                <Toggle checked={demo} onChange={setDemo} label="Also load demo content (sample songs, service, announcement and media)" />
                <p className="mt-1 pl-11 text-[11px] text-dim">Clearly labelled “Demo”. Remove it any time in Settings → Database.</p>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-line px-8 py-4">
          {step > 0 && <Button icon={ChevronLeft} onClick={() => setStep(step - 1)}>Back</Button>}
          <span className="flex-1" />
          {step < 4 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)} data-testid="wizard-next">
              Continue <ChevronRight size={15} />
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void finish()} disabled={busy} data-testid="wizard-finish">
              {busy ? 'Setting up…' : 'Finish setup'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
