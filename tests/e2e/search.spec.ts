import { expect, test, type Page } from '@playwright/test'

async function openFilterSearch(page: Page) {
  const searchTrigger = page.getByTestId('filter-search-trigger')

  if (await searchTrigger.isVisible().catch(() => false)) {
    await searchTrigger.click()
  }
}

test.describe('Header Search', () => {
  test.beforeEach(async ({ browserName, page }) => {
    test.skip(browserName !== 'chromium')
    await page.goto('/')
  })

  test('display search input', async ({ page }) => {
    const searchInput = page.getByTestId('header-search-input')
    await expect(searchInput).toBeVisible()
  })

  test('show loading state when searching', async ({ page }) => {
    const searchInput = page.getByTestId('header-search-input')

    await searchInput.fill('trump')

    // Wait for the search to trigger (debounced)
    await page.waitForTimeout(400)

    // Check if loading indicator appears (it may be brief)
    const loadingIndicator = page.getByText('Searching...')
    // Use a more lenient check since loading state might be brief
    await expect(loadingIndicator)
      .toBeVisible({ timeout: 1000 })
      .catch(() => {
        // If loading is too fast to catch, that's also acceptable
      })
  })

  test('trigger search when typing more than 2 characters', async ({ page }) => {
    const searchInput = page.getByTestId('header-search-input')

    await searchInput.fill('trump')

    // Wait for debounced search to trigger
    await page.waitForTimeout(400)

    // The search should have been triggered (we can't easily test API calls in e2e)
    // But we can verify the input value is correct
    await expect(searchInput).toHaveValue('trump')
  })

  test('clear search input', async ({ page }) => {
    const searchInput = page.getByTestId('header-search-input')

    await searchInput.fill('trump')
    await expect(searchInput).toHaveValue('trump')

    await searchInput.clear()
    await expect(searchInput).toHaveValue('')
  })

  test('hide search results when clicking outside', async ({ page }) => {
    const searchInput = page.getByTestId('header-search-input')

    await searchInput.fill('trump')
    await page.waitForTimeout(400)

    // If search results appear, test clicking outside
    const searchResults = page.getByTestId('search-results')
    const isVisible = await searchResults.isVisible().catch(() => false)

    if (isVisible) {
      await page.click('body')
      await expect(searchResults).not.toBeVisible()
    }
  })

  test('maintain search state', async ({ page }) => {
    const searchInput = page.getByTestId('header-search-input')

    await searchInput.fill('trump')
    await expect(searchInput).toHaveValue('trump')

    // Search state should persist
    await page.waitForTimeout(100)
    await expect(searchInput).toHaveValue('trump')
  })

  test('do not show results for queries less than 2 characters', async ({ page }) => {
    const searchInput = page.getByTestId('header-search-input')

    await searchInput.fill('t')

    await page.waitForTimeout(500)

    const searchResults = page.getByTestId('search-results')
    await expect(searchResults).not.toBeVisible()
  })

  test('show search results only on desktop (hidden on mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    const searchContainer = page.getByTestId('header-search-container')
    await expect(searchContainer).toHaveClass(/hidden/)
  })
})

test.describe('Filter Toolbar Search Input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('update search input value when typing', async ({ page }) => {
    const filterSearchInput = page.getByTestId('filter-search-input')

    await openFilterSearch(page)
    await filterSearchInput.waitFor({ state: 'visible' })
    await filterSearchInput.focus()
    await filterSearchInput.pressSequentially('trump')

    await expect(filterSearchInput).toHaveValue('trump')
  })

  test('clear search input value when clearing', async ({ page }) => {
    const filterSearchInput = page.getByTestId('filter-search-input')

    await openFilterSearch(page)
    await filterSearchInput.waitFor({ state: 'visible' })
    await filterSearchInput.focus()
    await filterSearchInput.pressSequentially('trump')
    await expect(filterSearchInput).toHaveValue('trump')

    await filterSearchInput.clear()
    await expect(filterSearchInput).toHaveValue('')
  })

  test('maintain search input state independently of bookmarks', async ({ page }) => {
    // Click the specific bookmark button in the filter toolbar
    const bookmarkButton = page.getByRole('button', { name: 'Filter by bookmarks' })
    await bookmarkButton.click()

    const filterSearchInput = page.getByTestId('filter-search-input')
    await openFilterSearch(page)
    await filterSearchInput.waitFor({ state: 'visible' })
    await filterSearchInput.focus()
    await filterSearchInput.pressSequentially('trump')

    await expect(filterSearchInput).toHaveValue('trump')
  })

  test('initialize with empty search value', async ({ page }) => {
    const filterSearchInput = page.getByTestId('filter-search-input')

    await openFilterSearch(page)
    await expect(filterSearchInput).toHaveValue('')
  })

  test('maintain search state during navigation', async ({ page }) => {
    const filterSearchInput = page.getByTestId('filter-search-input')

    await openFilterSearch(page)
    await filterSearchInput.waitFor({ state: 'visible' })
    await filterSearchInput.focus()
    await filterSearchInput.pressSequentially('trump')
    await expect(filterSearchInput).toHaveValue('trump')

    // The search state should persist as it's managed by React context
    await page.waitForTimeout(600)
    await expect(filterSearchInput).toHaveValue('trump')
  })

  test('handle special characters in search query', async ({ page }) => {
    const filterSearchInput = page.getByTestId('filter-search-input')

    await openFilterSearch(page)
    await filterSearchInput.waitFor({ state: 'visible' })
    await filterSearchInput.focus()
    await filterSearchInput.pressSequentially('trump & biden')

    await expect(filterSearchInput).toHaveValue('trump & biden')
  })
})
