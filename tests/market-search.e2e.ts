import { test, expect } from "@playwright/test";

/**
 * E2E tests for the market search command palette.
 * Run against the local dev server or a Vercel preview deployment.
 */

test.describe("Market Search Command Palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("opens with Cmd+K shortcut", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("combobox")).toBeVisible();
  });

  test("opens with Ctrl+K shortcut", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("combobox")).toBeVisible();
  });

  test("closes with Escape key", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("combobox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("combobox")).not.toBeVisible();
  });

  test("shows results after typing a query", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const input = page.getByRole("combobox");
    await input.fill("btc");

    // Wait for debounce + network
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 2000 });
    const items = page.getByRole("option");
    await expect(items.first()).toBeVisible();
  });

  test("navigates to market page on Enter", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const input = page.getByRole("combobox");
    await input.fill("btc");

    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 2000 });
    await page.keyboard.press("Enter");

    // Should have navigated away from home.
    await expect(page).not.toHaveURL("/");
  });

  test("shows empty state for unrecognised query", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const input = page.getByRole("combobox");
    await input.fill("zzznotarealmarket");

    await expect(page.getByText(/No markets found/i)).toBeVisible({
      timeout: 2000,
    });
  });
});

