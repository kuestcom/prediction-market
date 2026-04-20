import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

async function expectAppKitModal(page: Page) {
  const modal = page.getByTestId('w3m-modal-card')
  await expect(modal).toBeVisible({ timeout: 15_000 })
}

test.describe('desktop and mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('has title', async ({ page }) => {
    await expect(page).toHaveTitle('Kuest | Decentralized Prediction Markets')
  })

  test('shows appkit modal with log in button', async ({ page }) => {
    await page.getByTestId('header-login-button').click()

    await expectAppKitModal(page)
  })

  test('shows appkit modal with sign up button', async ({ page }) => {
    await page.getByTestId('header-signup-button').click()

    await expectAppKitModal(page)
  })

  test('redirects to docs from header menu', async ({ page }) => {
    await page.getByTestId('header-menu-button').click()
    const docsLink = page.getByTestId('header-docs-link')
    await docsLink.waitFor({ state: 'visible' })

    await Promise.all([
      page.waitForURL('**/docs', { waitUntil: 'domcontentloaded' }),
      docsLink.click(),
    ])

    expect(page.url()).toContain('/docs')
  })

  test('redirects to terms from header menu', async ({ page }) => {
    await page.getByTestId('header-menu-button').click()
    const termsLink = page.getByTestId('header-terms-link')
    await termsLink.waitFor({ state: 'visible' })

    await Promise.all([
      page.waitForURL('**/terms-of-use', { waitUntil: 'domcontentloaded' }),
      termsLink.click(),
    ])

    expect(page.url()).toContain('/terms-of-use')
  })
})

test.describe('desktop only', () => {
  test.beforeEach(async ({ browserName, page }) => {
    test.skip(browserName !== 'chromium')
    await page.goto('/')
  })

  test('shows how it works dialog on desktop trigger click', async ({ page }) => {
    // Click the desktop trigger (hidden on mobile)
    await page.getByTestId('how-it-works-trigger-desktop').click()

    // Verify dialog is visible
    const dialog = page.getByTestId('how-it-works-dialog')
    await expect(dialog).toBeVisible()

    // Verify first step content
    await expect(page.getByText('1. Choose a Market')).toBeVisible()
    await expect(page.getByTestId('how-it-works-next-button')).toHaveText('Next')
  })

  test('navigates through all steps in how it works dialog', async ({ page }) => {
    // Open dialog
    await page.getByTestId('how-it-works-trigger-desktop').click()
    const dialog = page.getByTestId('how-it-works-dialog')
    await expect(dialog).toBeVisible()

    // Step 1
    await expect(page.getByText('1. Choose a Market')).toBeVisible()
    await expect(page.getByTestId('how-it-works-next-button')).toHaveText('Next')
    await page.getByTestId('how-it-works-next-button').click()

    // Step 2
    await expect(page.getByText('2. Make Your Trade')).toBeVisible()
    await expect(page.getByText('Add funds with crypto, card, or bank transfer')).toBeVisible()
    await expect(page.getByTestId('how-it-works-next-button')).toHaveText('Next')
    await page.getByTestId('how-it-works-next-button').click()

    // Step 3 (final step)
    await expect(page.getByText('3. Cash Out 🤑')).toBeVisible()
    await expect(page.getByTestId('how-it-works-next-button')).toHaveText('Get Started')

    // Click "Get Started" should close dialog and open auth modal
    await page.getByTestId('how-it-works-next-button').click()

    // Dialog should be closed
    await expect(dialog).not.toBeVisible()

    // Auth modal should open
    await expectAppKitModal(page)
  })

  test('resets to first step when dialog is reopened', async ({ page }) => {
    await page.goto('/')

    // Open dialog and navigate to step 2
    await page.getByTestId('how-it-works-trigger-desktop').click()
    await page.getByTestId('how-it-works-next-button').click()
    await expect(page.getByText('2. Make Your Trade')).toBeVisible()

    // Close dialog by clicking outside or pressing escape
    await page.keyboard.press('Escape')
    const dialog = page.getByTestId('how-it-works-dialog')
    await expect(dialog).not.toBeVisible()

    // Reopen dialog
    await page.getByTestId('how-it-works-trigger-desktop').click()

    // Should be back to step 1
    await expect(page.getByText('1. Choose a Market')).toBeVisible()
  })
})

test.describe('mobile only', () => {
  test.beforeEach(async ({ browserName, page }) => {
    test.skip(browserName !== 'webkit')
    await page.goto('/')
  })

  test('shows mobile banner and opens dialog on mobile', async ({ page }) => {
    const mobileBanner = page.getByTestId('how-it-works-mobile-banner')
    await expect(mobileBanner).toBeVisible()

    await page.getByTestId('how-it-works-trigger-mobile').click()

    const dialog = page.getByTestId('how-it-works-dialog')
    await expect(dialog).toBeVisible()
  })

  test('dismisses mobile banner and persists dismissal', async ({ page }) => {
    const mobileBanner = page.getByTestId('how-it-works-mobile-banner')
    await expect(mobileBanner).toBeVisible()

    await page.getByTestId('how-it-works-dismiss-banner').click()

    await expect(mobileBanner).not.toBeVisible()

    await page.reload()
    await expect(mobileBanner).not.toBeVisible()
  })
})
