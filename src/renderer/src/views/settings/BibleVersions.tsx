import { useEffect, useMemo, useState } from 'react'
import { Download, FileUp, Search, Star, Trash2 } from 'lucide-react'
import type { BibleLibraryEntry, BibleTranslation } from '@shared/types'
import { api } from '@/lib/api'
import { useApp } from '@/stores/app'
import { Badge, Button, Input, Spinner } from '@/components/ui/controls'
import { confirmDialog, toast } from '@/components/ui/overlays'
import { VERSION_PREF } from '@/components/VersionPicker'

/** Import Bible files (WorshipFlow, thiagobodruk/bible JSON/XML, Zefania, CSV); reports licence reminders. */
export async function importBibleFiles(): Promise<number> {
  const r = await api('bible:import', null).catch((e) => {
    toast.error(e)
    return null
  })
  if (!r) return 0
  // One message per import: the licence reminder goes underneath the "Installed" line
  const reminder = r.warnings.join('\n') || undefined
  if (r.imported.length) toast.success(`Installed ${r.imported.map((t) => t.abbreviation).join(', ')}`, reminder)
  else if (reminder) toast.warning(reminder)
  if (r.errors.length) toast.error(r.errors.slice(0, 4).join('\n'))
  if (r.imported.length) await useApp.getState().reloadTranslations()
  return r.imported.length
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Settings → Bibles: install the free English versions that ship with
 * WorshipFlow, import licensed files, choose the default, remove.
 */
export function BibleVersions() {
  const translations = useApp((s) => s.translations)
  const defaultId = useApp((s) => s.settings.bible.defaultTranslationId)
  const [library, setLibrary] = useState<BibleLibraryEntry[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const reloadLibrary = () => void api('bible:library').then(setLibrary).catch(toast.error)
  useEffect(reloadLibrary, [translations])

  const available = useMemo(
    () => (library ?? []).filter((e) => !e.installed && `${e.name} ${e.abbreviation}`.toLowerCase().includes(q.trim().toLowerCase())),
    [library, q]
  )
  const effectiveDefault = translations.some((t) => t.id === defaultId) ? defaultId : translations[0]?.id

  async function install(e: BibleLibraryEntry) {
    setBusy(e.abbreviation)
    try {
      const t = await api('bible:installLibrary', e.abbreviation)
      await useApp.getState().reloadTranslations()
      toast.success(`Installed ${t.name}`)
    } catch (err) {
      toast.error(err)
    } finally {
      setBusy(null)
    }
  }

  async function remove(t: BibleTranslation) {
    if (translations.length <= 1) return toast.warning('Keep at least one Bible version — install another one before removing this.')
    const use = await api('bible:usage', t.id).catch(() => ({
      serviceItems: 0,
      schedule: 0
    }))
    const affected = [
      use.serviceItems && `${plural(use.serviceItems, 'service item')} will show “Passage unavailable” until you pick another version for them.`,
      use.schedule && `${plural(use.schedule, 'passage')} in the scripture schedule will be removed.`
    ].filter(Boolean)
    const free = library?.find((e) => e.abbreviation === t.abbreviation)
    const ok = await confirmDialog({
      title: `Remove ${t.abbreviation} — ${t.name}?`,
      message: (
        <>
          {affected.map((a) => (
            <p key={String(a)} className="mb-1.5 text-warn">
              {a}
            </p>
          ))}
          <p>{free ? 'You can reinstall it from this page at any time.' : 'To get it back you will need to import its file again.'}</p>
        </>
      ),
      danger: true,
      confirmLabel: 'Remove'
    })
    if (!ok) return
    setBusy(t.id)
    try {
      await api('bible:deleteTranslation', t.id)
      const [settings] = await Promise.all([api('settings:get'), useApp.getState().reloadTranslations()])
      useApp.setState({ settings })
      toast.success(`Removed ${t.abbreviation}`)
    } catch (err) {
      toast.error(err)
    } finally {
      setBusy(null)
    }
  }

  async function makeDefault(t: BibleTranslation) {
    await useApp.getState().saveSettings({ bible: { defaultTranslationId: t.id } })
    try {
      localStorage.removeItem(VERSION_PREF)
    } catch {
      /* storage unavailable */
    }
    toast.success(`${t.abbreviation} is now the default version`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h2 className="text-[15px] font-semibold">Bibles</h2>
          <p className="mt-0.5 text-[12px] text-muted">Install, import and remove Bible versions, and choose the default.</p>
        </div>
        <Button icon={FileUp} onClick={() => void importBibleFiles()} tip="Import a Bible file your church is licensed to use">
          Import from file…
        </Button>
      </div>
      <section aria-labelledby="installed-h">
        <h2 id="installed-h" className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">
          Installed · {translations.length}
        </h2>
        <ul className="divide-y divide-line rounded-lg border border-line bg-panel" data-testid="installed-bibles">
          {translations.map((t) => {
            const isDefault = t.id === effectiveDefault
            return (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    <span className="truncate">{t.name}</span>
                    <span className="font-mono text-[11px] text-dim">{t.abbreviation}</span>
                    {isDefault && <Badge tone="accent">Default</Badge>}
                  </div>
                  <div className="truncate text-[11px] text-dim">
                    {t.license || 'No licence information'} · {t.verseCount.toLocaleString()} verses
                  </div>
                </div>
                {!isDefault && (
                  <Button size="sm" variant="ghost" icon={Star} onClick={() => void makeDefault(t)} aria-label={`Make ${t.abbreviation} the default`}>
                    Make default
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={busy === t.id ? undefined : Trash2}
                  disabled={!!busy}
                  className="text-danger"
                  onClick={() => void remove(t)}
                  aria-label={`Remove ${t.abbreviation}`}
                >
                  {busy === t.id ? 'Removing…' : 'Remove'}
                </Button>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="available-h">
        <div className="mb-2 flex items-center gap-3">
          <h2 id="available-h" className="flex-1 text-[11px] font-bold tracking-wider text-muted uppercase">
            Free versions you can install
          </h2>
          <div className="relative w-64">
            <Search size={14} className="absolute top-2 left-2.5 text-dim" />
            <Input className="pl-8" placeholder="Filter versions" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-muted">
          Public-domain and openly licensed English Bibles that come with WorshipFlow. They install instantly and work offline.
        </p>
        {!library ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : available.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line bg-panel" data-testid="bible-library">
            {available.map((e) => (
              <li key={e.abbreviation} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    <span className="truncate">{e.name}</span>
                    <span className="font-mono text-[11px] text-dim">{e.abbreviation}</span>
                  </div>
                  <div className="truncate text-[11px] text-dim">
                    {e.license} · {e.verses.toLocaleString()} verses
                  </div>
                </div>
                <Badge tone={e.status === 'open' ? 'accent' : 'ok'}>{e.status === 'open' ? 'Open licence' : 'Public domain'}</Badge>
                <Button
                  size="sm"
                  className="w-24"
                  icon={busy === e.abbreviation ? undefined : Download}
                  disabled={!!busy}
                  onClick={() => void install(e)}
                  aria-label={`Install ${e.name}`}
                >
                  {busy === e.abbreviation ? 'Installing…' : 'Install'}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-line p-6 text-center text-[12px] text-dim">
            {q ? 'No versions match.' : 'All the free versions are installed.'}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 text-[12px] leading-relaxed text-muted">
        <div className="mb-1 font-medium text-fg">Other versions (NIV, ESV, NKJV, NLT…)</div>
        These are copyrighted, so they aren't included. If your church has the publisher's permission, click <b>Import from file…</b> and choose the
        file. Supported: WorshipFlow Bible, thiagobodruk/bible JSON or XML, Zefania XML and CSV. You can choose several files at once.
      </section>
    </div>
  )
}
