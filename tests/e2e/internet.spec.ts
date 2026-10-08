/// <reference lib="dom" />
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { rmSync } from 'node:fs'
import { completeWizard, launch, nav, newDataDir, shots } from './helpers'

const dataDir = newDataDir()
test.afterAll(() => rmSync(dataDir, { recursive: true, force: true }))

async function online(): Promise<boolean> {
  try {
    const r = await fetch('https://example.com', { signal: AbortSignal.timeout(8000) })
    return r.ok
  } catch {
    return false
  }
}

/** URLs/titles of all <webview> guests (operator browser and output web slides). */
async function guests(app: ElectronApplication) {
  return app.evaluate(({ webContents }) =>
    webContents
      .getAllWebContents()
      .filter((w) => w.getType() === 'webview')
      .map((w) => ({ id: w.id, url: w.getURL(), title: w.getTitle(), host: w.hostWebContents?.getURL().split('/').pop() ?? '' }))
  )
}

async function inGuest<T>(app: ElectronApplication, urlPart: string, code: string): Promise<T> {
  return app.evaluate(
    async ({ webContents }, [part, js]) => {
      const g = webContents.getAllWebContents().find((w) => w.getType() === 'webview' && w.getURL().includes(part))
      if (!g) throw new Error(`no guest for ${part}`)
      return g.executeJavaScript(js)
    },
    [urlPart, code] as const
  ) as Promise<T>
}

async function output(app: ElectronApplication): Promise<Page> {
  for (let i = 0; i < 50; i++) {
    const p = app.windows().find((w) => w.url().includes('output.html'))
    if (p) return p
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('output window did not open')
}

test('Internet section: browse, show on screen, capture, import lyrics, save pictures', async () => {
  test.skip(!(await online()), 'No internet connection')
  const { app, page } = await launch(dataDir)
  page.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text().slice(0, 300)))
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))
  await completeWizard(page)
  await nav(page, 'Internet')
  await expect(page.getByTestId('internet-view')).toBeVisible()

  // Browse
  const address = page.getByLabel('Web address')
  await address.fill('example.com')
  await address.press('Enter')
  await expect.poll(async () => (await guests(app)).some((g) => g.title === 'Example Domain'), { timeout: 20_000 }).toBe(true)
  await expect(address).toHaveValue(/example\.com/)

  // Security: websites get no access to the app
  const exposure = await inGuest<string>(app, 'example.com', '[typeof window.fc, typeof require, typeof process].join(",")')
  expect(exposure).toBe('undefined,undefined,undefined')

  // Capture to screen → picture on the projector
  await page.getByTestId('web-capture').click()
  const out = await output(app)
  await expect(out.locator('img[src*="fcmedia://media"]').first()).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: `${shots}/50-internet.png` })

  // Show the live page on screen → a second guest (in the output window) loads it
  await page.getByTestId('web-show-page').click()
  await expect.poll(async () => (await guests(app)).filter((g) => g.url.includes('example.com')).length, { timeout: 15_000 }).toBe(2)
  await out.screenshot({ path: `${shots}/51-output-web.png` })

  // YouTube links become the clean embed player on the output
  await address.fill('https://www.youtube.com/watch?v=jNQXAC9IVRw')
  await address.press('Enter')
  await expect(page.getByTestId('web-show-page')).toHaveText(/Play video on screen/, { timeout: 20_000 })
  await page.getByTestId('web-show-page').click()
  await expect.poll(async () => (await guests(app)).some((g) => g.url.includes('youtube.com/embed/jNQXAC9IVRw')), { timeout: 20_000 }).toBe(true)
  // Report (not assert) whether playback started — depends on the network and YouTube.
  await new Promise((r) => setTimeout(r, 6000))
  const playing = await inGuest<number>(app, 'youtube.com/embed', '(document.querySelector("video")||{currentTime:-1}).currentTime').catch(() => -1)
  console.log(`YouTube embed playback position after 6s: ${playing}`)
  await out.screenshot({ path: `${shots}/52-output-youtube.png` })

  // Import highlighted text as a song
  await address.fill('example.com')
  await address.press('Enter')
  await expect.poll(async () => (await guests(app)).some((g) => g.title === 'Example Domain' && !g.url.includes('embed')), { timeout: 20_000 }).toBe(true)
  await expect
    .poll(
      () =>
        inGuest<boolean>(app, 'example.com', 'const r=document.createRange(); r.selectNodeContents(document.body); getSelection().removeAllRanges(); getSelection().addRange(r); getSelection().toString().length > 0').catch(() => false),
      { timeout: 15_000 }
    )
    .toBe(true)
  await page.getByTestId('web-import-lyrics').click()
  await expect(page.getByRole('dialog')).toContainText('Import as a new song')
  await page.getByRole('button', { name: 'Import song' }).click()
  await expect(page.getByLabel('Song title')).toHaveValue('Example Domain')
  await expect(page.getByLabel('Lyrics')).toHaveValue(/This domain is for use/)

  // Save a web picture into Media; refuse a link that isn't a picture
  const saved = await page.evaluate(() => window.fc.invoke('web:saveMedia', { url: 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png', kind: 'image' }))
  expect(saved.type).toBe('image')
  expect(saved.folder).toBe('Web')
  const refused = await page.evaluate(() => window.fc.invoke('web:saveMedia', { url: 'https://example.com/', kind: 'image' }).then(() => 'saved', (e: Error) => e.message))
  expect(refused).toMatch(/not a downloadable image/)
  const blocked = await page.evaluate(() => window.fc.invoke('web:saveMedia', { url: 'file:///etc/passwd', kind: 'image' }).then(() => 'saved', (e: Error) => e.message))
  expect(blocked).toMatch(/Only files from web/)
  await app.close()
})
