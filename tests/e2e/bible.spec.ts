/// <reference lib="dom" />
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { rmSync } from 'node:fs'
import { completeWizard, launch, nav, newDataDir, shots } from './helpers'

const dataDir = newDataDir()
test.afterAll(() => rmSync(dataDir, { recursive: true, force: true }))

async function output(app: ElectronApplication): Promise<Page> {
  for (let i = 0; i < 50; i++) {
    const p = app.windows().find((w) => w.url().includes('output.html'))
    if (p) return p
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('output window did not open')
}

async function goToChapter(page: Page, keys: string) {
  const book = page.getByLabel('Scripture reference')
  await book.click()
  await page.keyboard.press('Meta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(keys)
}

test('click a verse to present; scripture schedule', async () => {
  let { app, page } = await launch(dataDir)
  await completeWizard(page)
  await nav(page, 'Bible')
  await goToChapter(page, 'joh3')

  // 1. Click a verse → it goes live immediately (no Present button), staying on the Bible page
  await page.getByTestId('verse-16').click()
  const out = await output(app)
  await expect(out.locator('body')).toContainText('For God so loved the world', { timeout: 10_000 })
  await expect(page.getByTestId('verse-16')).toHaveAttribute('data-live', 'true')
  await expect(page.getByRole('heading', { name: 'Bible' })).toBeVisible()
  await expect(page.getByTestId('live-mini')).toBeVisible()

  // 2. → continues to the next verse; the live marker follows
  await page.keyboard.press('ArrowRight')
  await expect(out.locator('body')).toContainText('For God sent not his Son', { timeout: 5000 })
  await expect(page.getByTestId('verse-17')).toHaveAttribute('data-live', 'true')
  await expect(page.getByTestId('verse-16')).not.toHaveAttribute('data-live', 'true')

  // 3. Clicking another verse in the same chapter jumps straight to it
  await page.getByTestId('verse-3').click()
  await expect(out.locator('body')).toContainText('Except a man be born again', { timeout: 5000 })
  await page.screenshot({ path: `${shots}/40-bible-click-present.png` })

  // 3b. One click switches version, and the verse on screen follows into the new version
  const versions = page.getByRole('radiogroup', { name: 'Translation' })
  await versions.getByRole('radio', { name: /^BSB/ }).click()
  await expect(versions.getByRole('radio', { name: /^BSB/ })).toHaveAttribute('aria-checked', 'true')
  await expect(out.locator('body')).toContainText('Truly, truly', { timeout: 5000 })
  await expect(out.locator('body')).toContainText('BSB')
  await expect(page.getByTestId('verse-3')).toHaveAttribute('data-live', 'true')
  await page.screenshot({ path: `${shots}/40b-bible-versions.png` })
  // → still continues through the chapter in the new version
  await page.keyboard.press('ArrowRight')
  await expect(out.locator('body')).toContainText('How can a man be born when he is old', { timeout: 5000 })
  await expect(page.getByTestId('verse-4')).toHaveAttribute('data-live', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('verse-3')).toHaveAttribute('data-live', 'true')
  // ⌥2 = second version (KJV)
  await page.keyboard.press('Alt+Digit2')
  await expect(versions.getByRole('radio', { name: /^KJV/ })).toHaveAttribute('aria-checked', 'true')
  await expect(out.locator('body')).toContainText('Except a man be born again', { timeout: 5000 })

  // 4. Shift-click presents a range
  await page.getByTestId('verse-5').click({ modifiers: ['Shift'] })
  await expect(page.locator('[data-live="true"]')).toHaveCount(1) // 1 verse per slide: first of the range is live
  await expect(out.locator('body')).toContainText('John 3:3', { timeout: 5000 })

  // 5. Build a schedule
  await goToChapter(page, 'ps23')
  await page.getByTestId('verse-1').click()
  await page.getByTestId('verse-6').click({ modifiers: ['Shift'] })
  await page.getByRole('button', { name: 'Add to schedule' }).click()
  await goToChapter(page, 'rom8:28')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Add to schedule' }).click()
  const schedule = page.getByTestId('schedule-item')
  await expect(schedule).toHaveCount(2)
  await expect(schedule.nth(0)).toContainText('Psalms 23:1-6')
  await expect(schedule.nth(1)).toContainText('Romans 8:28')
  await page.screenshot({ path: `${shots}/41-bible-schedule.png` })

  // 6. Schedule (and the chosen version) survive a restart
  await page.keyboard.press('Alt+Digit1')
  await expect(versions.getByRole('radio', { name: /^BSB/ })).toHaveAttribute('aria-checked', 'true')
  await app.close()
  ;({ app, page } = await launch(dataDir))
  await expect(page.getByText(/Welcome, /)).toBeVisible({ timeout: 20_000 })
  await nav(page, 'Bible')
  await expect(page.getByTestId('schedule-item')).toHaveCount(2)
  await expect(page.getByRole('radiogroup', { name: 'Translation' }).getByRole('radio', { name: /^BSB/ })).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Alt+Digit2')

  // 7. Click a scheduled passage → it presents
  await page.getByTestId('schedule-item').nth(1).click()
  const out2 = await output(app)
  await expect(out2.locator('body')).toContainText('all things work together for good', { timeout: 10_000 })
  await expect(page.getByTestId('schedule-item').nth(1)).toContainText('LIVE')
  await page.getByTestId('schedule-item').nth(0).click()
  await expect(out2.locator('body')).toContainText('The Lord is my shepherd', { timeout: 5000 })

  // 8. Reorder and remove
  await page.getByTestId('schedule-item').nth(1).hover()
  await page.getByRole('button', { name: 'Move up' }).nth(1).click()
  await expect(page.getByTestId('schedule-item').nth(0)).toContainText('Romans 8:28')
  await page.getByTestId('schedule-item').nth(0).hover()
  await page.getByRole('button', { name: 'Remove from schedule' }).first().click()
  await expect(page.getByTestId('schedule-item')).toHaveCount(1)

  // 9. With "Present on click" off, clicking only selects
  await page.getByText('Present on click').click()
  await goToChapter(page, 'gen1')
  await page.getByTestId('verse-1').click()
  await page.waitForTimeout(500)
  await expect(out2.locator('body')).not.toContainText('In the beginning')
  await expect(page.getByRole('button', { name: /Present Genesis 1:1/ })).toBeVisible()
  await app.close()
})

test('Settings → Bibles: install, make default, remove, reinstall; import thiagobodruk files with licence reminder', async () => {
  const { writeFileSync, mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir2 = newDataDir()
  const { app, page } = await launch(dir2)
  await completeWizard(page)
  // The Bible page's Versions button opens Settings → Bibles
  await nav(page, 'Bible')
  await page.getByRole('button', { name: 'Versions' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  const installed = page.getByTestId('installed-bibles')
  const lib = page.getByTestId('bible-library')
  await expect(installed).toContainText('King James Version')
  await expect(installed).toContainText('Berean Standard Bible')
  // English only, and copyrighted versions are never offered
  await expect(lib).toContainText('American Standard Version 1901')
  await expect(lib).toContainText("Young's Literal Translation")
  await expect(lib).not.toContainText('Синодальный')
  await expect(lib).not.toContainText('Hindi')
  await expect(lib).not.toContainText('New International Version')
  await page.screenshot({ path: `${shots}/42-settings-bibles.png` })

  await lib.getByRole('button', { name: 'Install American Standard Version 1901' }).click()
  await expect(installed).toContainText('American Standard Version 1901', { timeout: 20_000 })
  await expect(lib).not.toContainText('American Standard Version 1901')
  await expect(page.getByRole('status')).toContainText('Installed American Standard Version 1901')

  // Make ASV the default, then read John 3:16 in it on the Bible page
  await installed.getByRole('button', { name: 'Make ASV the default' }).click()
  await expect(installed.locator('li', { hasText: 'American Standard Version 1901' })).toContainText('Default')
  await nav(page, 'Bible')
  await expect(page.getByRole('radiogroup', { name: 'Translation' }).getByRole('radio', { name: /^ASV/ })).toHaveAttribute('aria-checked', 'true')
  await goToChapter(page, 'joh3')
  await expect(page.getByTestId('verse-16')).toContainText('For God so loved the world, that he gave his only begotten Son, that whosoever believeth on him')
  await goToChapter(page, 'joh3:16')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Add to schedule' }).click()
  await expect(page.getByTestId('schedule-item')).toHaveCount(1)

  // Removing ASV warns about the schedule, then moves the default back to KJV (Settings → Bibles)
  await nav(page, 'Settings')
  await page.getByRole('button', { name: 'Bibles', exact: true }).click()
  await installed.getByRole('button', { name: 'Remove ASV' }).click()
  const confirm = page.getByRole('dialog')
  await expect(confirm).toContainText('1 passage in the scripture schedule will be removed')
  await expect(confirm).toContainText('reinstall it from this page')
  await page.screenshot({ path: `${shots}/43-bibles-remove.png` })
  await confirm.getByRole('button', { name: 'Remove' }).click()
  await expect(installed).not.toContainText('American Standard Version 1901')
  await expect(lib).toContainText('American Standard Version 1901')
  await expect(installed.locator('li', { hasText: 'King James Version' })).toContainText('Default')
  expect(await page.evaluate(() => window.wf.invoke('bible:schedule', undefined as never))).toHaveLength(0)

  // Even KJV can be removed and reinstalled; the last version can't be removed
  await installed.getByRole('button', { name: 'Remove KJV' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click()
  await expect(installed.locator('li')).toHaveCount(1)
  await expect(installed.locator('li', { hasText: 'Berean Standard Bible' })).toContainText('Default')
  await installed.getByRole('button', { name: 'Remove BSB' }).click()
  await expect(page.getByRole('status')).toContainText('Keep at least one Bible version')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.evaluate((id) => window.wf.invoke('bible:deleteTranslation', id), await page.evaluate(() => window.wf.invoke('bible:translations', undefined as never).then((t) => t[0].id)))).rejects.toThrow(/at least one/)
  await lib.getByRole('button', { name: /Install King James Version/ }).click()
  await expect(installed).toContainText('King James Version', { timeout: 20_000 })

  // Many versions: the version buttons stay on one row that scrolls sideways, with no visible scrollbar
  for (let n = 3; n <= 10; n++) {
    await lib.getByRole('button', { name: /^Install / }).first().click()
    await expect(installed.locator('li')).toHaveCount(n, { timeout: 20_000 })
  }
  await nav(page, 'Bible')
  const row = page.getByRole('radiogroup', { name: 'Translation' })
  const geo = () =>
    row.evaluate((el: HTMLElement) => ({
      tops: new Set([...el.children].map((c) => (c as HTMLElement).offsetTop)).size,
      overflow: el.scrollWidth > el.clientWidth,
      scrollbar: el.offsetHeight - el.clientHeight,
      left: el.scrollLeft
    }))
  expect(await geo()).toMatchObject({ tops: 1, overflow: true, scrollbar: 0, left: 0 })
  await row.hover()
  await page.mouse.wheel(0, 200)
  await expect.poll(async () => (await geo()).left).toBeGreaterThan(0)
  await page.screenshot({ path: `${shots}/40c-bible-versions-scroll.png` })
  await page.mouse.wheel(0, -1000)
  await expect.poll(async () => (await geo()).left).toBe(0)
  await page.keyboard.press('Alt+Digit9')
  const ninth = row.getByRole('radio').nth(8)
  await expect(ninth).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => ninth.evaluate((b) => {
    const r = b.getBoundingClientRect()
    const p = b.parentElement!.getBoundingClientRect()
    return r.left >= p.left && r.right <= p.right
  })).toBe(true)

  // Import files in the thiagobodruk format; copyrighted versions get a licence reminder
  const tmp = mkdtempSync(join(tmpdir(), 'wf-bib-'))
  const file = join(tmp, 'en_niv.xml')
  writeFileSync(file, `<?xml version='1.0' encoding='utf-8'?><bible><b id="gn" n="Gênesis"><c n="1"><v n="1">In the beginning God created the heavens and the earth.</v></c></b></bible>`)
  const r = await page.evaluate((p) => window.wf.invoke('bible:import', [p]), file)
  expect(r.imported[0].abbreviation).toBe('NIV')
  expect(r.warnings[0]).toMatch(/copyrighted .* permission/)
  const list = await page.evaluate(() => window.wf.invoke('bible:translations', undefined as never))
  expect(list.map((t) => t.abbreviation)).toContain('NIV')
  expect(list).toHaveLength(11)
  expect(list.find((t) => t.abbreviation === 'KJV')!.builtin).toBe(true)
  await app.close()
})
