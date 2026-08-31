import { test, expect } from '@playwright/test';

test('App visual appearance - Post Login', async ({ page }) => {
  await page.goto('/');

  // Wait for the main page to render
  await page.waitForLoadState('networkidle');

  // Click the dev login button
  await page.click('text=Continue as dev user');
  await page.waitForLoadState('networkidle');

  // Wait for a navigation or the main interface to load
  await page.waitForTimeout(2000); 

  // Take a screenshot of the main dashboard
  await page.screenshot({ path: 'tests/screenshots/dashboard.png', fullPage: true });

  // Try navigating to marketplace
  const marketplaceLink = page.locator('text=Marketplace');
  if (await marketplaceLink.count() > 0) {
    await marketplaceLink.first().click();
    await page.waitForTimeout(1000); 
    await page.screenshot({ path: 'tests/screenshots/marketplace.png', fullPage: true });
  }

  // Try navigating to AI Stylist
  const stylistLink = page.locator('text=Stylist');
  if (await stylistLink.count() > 0) {
    await stylistLink.first().click();
    await page.waitForTimeout(1000); 
    await page.screenshot({ path: 'tests/screenshots/stylist.png', fullPage: true });
  }
});
