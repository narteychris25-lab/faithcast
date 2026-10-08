/// <reference lib="dom" />
import { test, expect } from '@playwright/test'
import { rmSync } from 'node:fs'
import { completeWizard, launch, nav, newDataDir, shots } from './helpers'

const dataDir = newDataDir()
test.afterAll(() => rmSync(dataDir, { recursive: true, force: true }))

test('every screen performs real work', async () => {
  const { app, page } = await launch(dataDir)
  await completeWizard(page)
  await page.screenshot({ path: `${shots}/10-dashboard.png` })

  // Songs: create, type lyrics, autosave, slide preview
  await nav(page, 'Songs')
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByLabel('Song title').fill('Test Hymn')
  await page.getByLabel('Lyrics').fill('[Verse 1]\nLine one\nLine two\n\n[Chorus]\nChorus line\n\n[Verse 2]\nAnother verse')
  await expect(page.getByTestId('song-save-status')).toHaveText(/Saved/, { timeout: 5000 })
  await expect(page.getByText('Slides preview (3)')).toBeVisible()
  await page.screenshot({ path: `${shots}/11-songs.png` })

  // Bible: select John 3:16-18
  await nav(page, 'Bible')
  await page.getByTestId('verse-16').click()
  await page.getByTestId('verse-18').click({ modifiers: ['Shift'] })
  await expect(page.getByText('3 slides')).toBeVisible()
  await page.getByLabel('Bible search').fill('begotten son')
  await page.getByLabel('Bible search').press('Enter')
  await expect(page.getByText(/results? for/)).toBeVisible()
  // EasyWorship-style entry: [Book] [Chapter] : [Verse], typed key by key
  const book = page.getByLabel('Scripture reference')
  const chapter = page.getByLabel('Chapter', { exact: true })
  const verse = page.getByLabel('Verse', { exact: true })
  const clearBook = async () => {
    await book.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
  }
  await book.click()
  await page.keyboard.type('jo')
  await expect(book).toHaveValue('Joshua') // inline completion of the first match
  await expect(page.getByRole('listbox')).toContainText('John')
  await page.screenshot({ path: `${shots}/12a-bible-autocomplete.png` })
  await page.keyboard.type('h')
  await expect(book).toHaveValue('John')
  await page.keyboard.type('3') // a number accepts the book and starts the chapter box
  await expect(book).toHaveValue('John')
  await expect(chapter).toHaveValue('3')
  await expect(chapter).toBeFocused()
  await page.keyboard.type(':16-17') // ":" jumps to the verse box
  await expect(verse).toHaveValue('16-17')
  await expect(verse).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('2 slides')).toBeVisible() // opened and selected the verses
  await page.screenshot({ path: `${shots}/12b-bible-fields.png` })

  // Book + Space → chapter box; Return opens the chapter
  await clearBook()
  await expect(chapter).toHaveValue('')
  await page.keyboard.type('ps 23')
  await expect(book).toHaveValue('Psalms')
  await expect(chapter).toHaveValue('23')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('verse-6')).toBeVisible()

  // Numbered books, then the verse box via Space
  await clearBook()
  await page.keyboard.type('1 co 13 4-7')
  await expect(book).toHaveValue('1 Corinthians')
  await expect(chapter).toHaveValue('13')
  await expect(verse).toHaveValue('4-7')
  await page.keyboard.press('Enter')
  await expect(page.getByText('4 slides')).toBeVisible()

  // Backspace in an empty box steps back; ↑/↓ choose another book; Backspace drops the suggestion
  await verse.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await expect(chapter).toBeFocused()
  await clearBook()
  await page.keyboard.type('jo')
  await page.keyboard.press('ArrowDown')
  await expect(book).toHaveValue('Job')
  await page.keyboard.press('Backspace')
  await expect(book).toHaveValue('Jo') // completion removed, typed letters kept
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await page.screenshot({ path: `${shots}/12-bible.png` })

  // Media: thumbnails, including a frame captured for the WebM video
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))
  page.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text().slice(0, 300)))
  await nav(page, 'Media')
  await expect(page.getByText('Demo — motion loop')).toBeVisible()
  await page.waitForTimeout(6000)
  await page.screenshot({ path: `${shots}/13-media.png` })
  await expect.poll(async () => page.locator('img[src*="fcmedia://thumb"]').count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(4)
  await page.screenshot({ path: `${shots}/13-media.png` })

  // Themes: edit a built-in theme directly, then reset it; duplicating still works
  await nav(page, 'Themes')
  const themeName = page.getByLabel('Theme name')
  const original = await themeName.inputValue()
  const reset = page.getByRole('button', { name: 'Reset to original' })
  await expect(reset).toBeDisabled()
  await themeName.fill(`${original} (ours)`)
  await expect(page.getByText('✓ Saved')).toBeVisible()
  await expect(page.getByText(`${original} (ours)`, { exact: true })).toBeVisible()
  await expect(page.getByText('Edited', { exact: true })).toBeVisible()
  await page.screenshot({ path: `${shots}/14-themes.png` })
  await reset.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reset' }).click()
  await expect(themeName).toHaveValue(original)
  await expect(page.getByText('Edited', { exact: true })).toHaveCount(0)
  await expect(reset).toBeDisabled()
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
  await expect(themeName).toHaveValue(/Copy/)

  // Planner: custom slides via the slide editor
  await nav(page, 'Service Planner')
  await page.locator('[data-tip^="Add custom slides"]').click()
  await page.getByRole('button', { name: 'Open slide editor' }).click()
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await page.getByLabel('Element text').fill('Welcome to church!')
  await page.screenshot({ path: `${shots}/15-slide-editor.png` })
  await page.getByTestId('slide-editor-done').click()
  await expect(page.locator('[data-item-id]').filter({ hasText: 'Custom Slides' })).toContainText('1 slide')
  await page.screenshot({ path: `${shots}/16-planner-custom.png` })

  // Settings: create a backup
  await nav(page, 'Settings')
  await page.getByRole('button', { name: 'Backup' }).click()
  await page.getByRole('button', { name: 'Back up now' }).click()
  await expect(page.getByText(/manual ·/)).toBeVisible()
  await page.getByRole('button', { name: 'Displays' }).click()
  await page.screenshot({ path: `${shots}/17-settings-displays.png` })

  // Global search
  await page.keyboard.press('ControlOrMeta+KeyK')
  await page.getByPlaceholder(/Search songs, lyrics/).fill('john 3:16')
  await expect(page.getByRole('dialog', { name: 'Search' }).getByText('John 3:16').first()).toBeVisible()
  // No focus ring drawn around the search box (it spilled past the dialog's edges)
  expect(await page.getByPlaceholder(/Search songs, lyrics/).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none')
  await page.screenshot({ path: `${shots}/18-search.png` })
  // Choosing a scripture opens it on the Bible page with the verse selected
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('verse-16')).toBeVisible()
  await expect(page.getByRole('button', { name: /Present John 3:16/ })).toBeVisible()
  // …also when already on the Bible page, and a whole chapter just opens that chapter
  await page.keyboard.press('ControlOrMeta+KeyK')
  await page.getByPlaceholder(/Search songs, lyrics/).fill('john 10')
  await page.getByRole('dialog', { name: 'Search' }).getByText('John 10:1-42').click()
  await expect(page.getByTestId('verse-1')).toContainText('He that entereth not by the door into the sheepfold')
  await expect(page.getByText('Select verses to add').first()).toBeVisible()

  await nav(page, 'Help')
  await page.screenshot({ path: `${shots}/19-help.png` })

  // Top bar: on a narrow window it shows icons only (with tooltips) and still fits
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.isVisible())!.setSize(900, 700))
  const bar = page.locator('nav[aria-label="Main"]')
  await expect(bar.getByText('Songs', { exact: true })).toHaveClass(/sr-only|max-lg/)
  expect(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await bar.getByRole('button', { name: 'Songs', exact: true }).hover()
  await expect(page.getByText('Songs', { exact: true }).last()).toBeVisible()
  await nav(page, 'Songs')
  await page.screenshot({ path: `${shots}/22-narrow-topbar.png` })
  await app.close()
})
