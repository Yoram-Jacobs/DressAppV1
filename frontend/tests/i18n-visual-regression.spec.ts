import { test, expect } from '@playwright/test';

const LANGUAGES = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'he', name: 'Hebrew', dir: 'rtl' },
  { code: 'ar', name: 'Arabic', dir: 'rtl' },
  { code: 'es', name: 'Spanish', dir: 'ltr' },
  { code: 'fr', name: 'French', dir: 'ltr' },
  { code: 'de', name: 'German', dir: 'ltr' },
  { code: 'it', name: 'Italian', dir: 'ltr' },
  { code: 'pt', name: 'Portuguese', dir: 'ltr' },
  { code: 'nl', name: 'Dutch', dir: 'ltr' },
  { code: 'ru', name: 'Russian', dir: 'ltr' },
  { code: 'zh', name: 'Chinese', dir: 'ltr' },
  { code: 'ja', name: 'Japanese', dir: 'ltr' },
  { code: 'hi', name: 'Hindi', dir: 'ltr' },
];

const SCREENS = [
  { name: 'home', path: '/home', label: 'Home' },
  { name: 'closet', path: '/closet', label: 'Closet' },
  { name: 'profile', path: '/me', label: 'Me' },
  { name: 'stylist', path: '/stylist', label: 'Stylist' },
  { name: 'marketplace', path: '/market', label: 'Market' },
];

async function loginAsDev(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const devBtn = page.locator('text=Continue as dev user');
  if (await devBtn.count() > 0) {
    await devBtn.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  }
}

async function setLanguage(page, langCode) {
  const langPicker = page.locator('[data-testid="language-picker-trigger"]');
  if (await langPicker.count() > 0) {
    await langPicker.first().click();
    await page.waitForTimeout(500);
    const option = page.locator(`[data-testid="language-picker-option-${langCode}"]`);
    if (await option.count() > 0) {
      await option.first().click();
      await page.waitForTimeout(1500);
    }
  }
}

async function takeScreenshotsForLanguage(page, langCode) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotsDir = `tests/screenshots/${timestamp}`;

  for (const screen of SCREENS) {
    await page.goto(screen.path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const filename = `${screen.name}_${langCode}.png`;
    await page.screenshot({
      path: `${screenshotsDir}/${filename}`,
      fullPage: true,
    });
  }
}

for (const lang of LANGUAGES) {
  test(`Visual regression - ${lang.name} (${lang.code})`, async ({ page }) => {
    await loginAsDev(page);
    await setLanguage(page, lang.code);

    const htmlDir = await page.getAttribute('html', 'dir');
    expect(htmlDir).toBe(lang.dir);

    await takeScreenshotsForLanguage(page, lang.code);
  });
}
