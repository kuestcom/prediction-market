import { expect, test } from '@playwright/test'

test.describe('Market Search Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('opens with Cmd+K shortcut', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('opens with Ctrl+K shortcut', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('closes with Escape key', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('shows results after typing a query', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.getByPlaceholder('Search markets…').fill('btc')
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 2000 })
  })

  test('navigates to market page on Enter', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.getByPlaceholder('Search markets…').fill('btc')
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 2000 })
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page).not.toHaveURL('/')
  })

  test('shows empty state for unrecognised query', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.getByPlaceholder('Search markets…').fill('zzznotarealmarket')
    await expect(page.getByText(/No markets found/i)).toBeVisible({ timeout: 2000 })
  })
})
