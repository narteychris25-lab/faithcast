/// <reference lib="dom" />
import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export const shots = 'test-results/screens'

export function newDataDir(): string {
  return mkdtempSync(join(tmpdir(), 'wf-e2e-'))
}

export async function launch(dataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') env[k] = v
  env.WORSHIPFLOW_DATA_DIR = dataDir
  // WORSHIPFLOW_E2E_EXE lets the same tests drive the packaged .app
  const exe = process.env.WORSHIPFLOW_E2E_EXE
  const app = exe ? await electron.launch({ executablePath: exe, args: [], env }) : await electron.launch({ args: ['.'], env })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}

/** Complete the first-run wizard with demo content. */
export async function completeWizard(page: Page, church = 'Grace Test Church'): Promise<void> {
  await expect(page.getByText('Welcome to WorshipFlow')).toBeVisible()
  await page.getByPlaceholder('e.g. Glory House Chapel').fill(church)
  for (let i = 0; i < 4; i++) await page.getByTestId('wizard-next').click()
  await page.getByTestId('wizard-finish').click()
  await expect(page.getByText(`Welcome, ${church}`)).toBeVisible({ timeout: 30_000 })
}

export async function nav(page: Page, name: string): Promise<void> {
  await page.locator('nav[aria-label="Main"]').getByRole('button', { name, exact: true }).click()
}
