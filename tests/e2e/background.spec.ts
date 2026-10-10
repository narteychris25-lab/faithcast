import { test, expect } from '@playwright/test'
import { completeWizard, launch, newDataDir, shots } from './helpers'

test('top-bar Background button switches the projection background', async () => {
  const { app, page } = await launch(newDataDir())
  try {
    await completeWizard(page)
    const button = page.locator('header').getByRole('button', { name: 'Background' })
    await button.click()
    const menu = page.getByRole('dialog', { name: 'Projection background' })
    await expect(menu).toBeVisible()
    await page.waitForTimeout(400) // let the open animation finish
    await page.screenshot({ path: `${shots}/background-menu.png` })

    await menu.getByRole('button', { name: 'Dark', exact: true }).click()
    await expect(menu).toBeHidden()
    await expect(page.locator('header').getByRole('button', { name: 'Dark' })).toBeVisible()
    expect(await page.evaluate(() => window.fc.invoke('settings:get', undefined as never).then((s) => s.presentation.backgroundThemeId))).toBe('theme-dark')

    await page.locator('header').getByRole('button', { name: 'Dark' }).click()
    await menu.getByRole('button', { name: 'Manage' }).click()
    await expect(page.getByRole('dialog').filter({ hasText: 'Manage backgrounds' })).toBeVisible()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${shots}/background-manage.png` })
    await page.keyboard.press('Escape')

    await page.locator('header').getByRole('button', { name: 'Dark' }).click()
    await menu.getByRole('button', { name: 'Automatic' }).click()
    await expect(button).toBeVisible()
  } finally {
    await app.close()
  }
})
