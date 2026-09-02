const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function runCrawler() {
  const targetUrl = 'https://dressapp.co';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotsDir = path.join(__dirname, 'Screenshots', timestamp);

  fs.mkdirSync(screenshotsDir, { recursive: true });
  console.log(`Created screenshots directory: ${screenshotsDir}`);

  // Launch browser with mobile simulation
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Emulate mobile viewport (e.g., iPhone X touch size)
  await page.setViewport({
    width: 375,
    height: 812,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`[Browser Console Error]: ${msg.text()}`);
    }
  });

  // Helper function to capture screenshots
  async function capture(name) {
    await new Promise(resolve => setTimeout(resolve, 2500)); // wait for transitions/animations/load
    const filename = `${name}.png`;
    const screenshotPath = path.join(screenshotsDir, filename);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Saved screenshot: ${screenshotPath}`);
  }

  // Helper function to wait and click
  async function safeClick(selector, timeout = 8000) {
    try {
      await page.waitForSelector(selector, { visible: true, timeout });
      await page.click(selector);
      console.log(`Clicked: ${selector}`);
      return true;
    } catch (err) {
      console.log(`Could not click: ${selector} - ${err.message}`);
      return false;
    }
  }

  console.log(`\n1. Initializing and Authenticating...`);
  await page.goto(`${targetUrl}/login`, { waitUntil: 'networkidle2' });
  await capture('login_page');

  try {
    // Click 'Continue as dev user' using trusted Puppeteer click
    await page.waitForSelector('[data-testid="login-dev-bypass-button"]', { timeout: 5000 });
    await page.click('[data-testid="login-dev-bypass-button"]');
    
    // Wait for SPA navigation to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('Successfully bypassed authentication.');
  } catch (err) {
    console.log('Authentication flow failed or skipped:', err.message);
  }

  // 2. Home Dashboard Interactions
  console.log(`\n2. Crawling Home Dashboard...`);
  await page.goto(`${targetUrl}/home`, { waitUntil: 'networkidle2' });
  await capture('home_dashboard_en');

  // 3. Closet Interactions
  console.log(`\n3. Crawling Closet...`);
  const hasClosetTab = await safeClick('[data-testid="bottom-tab-closet"]');
  if (!hasClosetTab) {
    await page.goto(`${targetUrl}/closet`, { waitUntil: 'networkidle2' });
  }
  await capture('closet_en');

  // Search input typing
  console.log('Testing Closet search bar...');
  try {
    await page.waitForSelector('[data-testid="closet-search-input"]', { visible: true, timeout: 5000 });
    await page.type('[data-testid="closet-search-input"]', 'shirt');
    await safeClick('[data-testid="closet-search-button"]');
    await capture('closet_search_en');

    // Clear search
    await safeClick('[data-testid="closet-search-clear"]');
    await capture('closet_search_cleared_en');
  } catch (err) {
    console.log('Search testing failed:', err.message);
  }

  // Select category filter
  console.log('Testing Closet category dropdown...');
  try {
    await safeClick('[data-testid="closet-category-select"]');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Click category "top" (tops) inside Radix Select content
    const clickedTop = await page.evaluate(async () => {
      for (let i = 0; i < 15; i++) {
        const options = Array.from(document.querySelectorAll('[role="option"]'));
        if (options.length > 0) {
          const topOpt = options.find(el => {
            const val = el.getAttribute('data-value') || '';
            const txt = el.textContent || '';
            return val.toLowerCase() === 'top' || txt.toLowerCase().includes('tops') || txt.toLowerCase() === 'top' || txt.includes('עליונית');
          });
          if (topOpt) {
            const txt = topOpt.textContent || '';
            topOpt.click();
            return `Success: clicked ${txt}`;
          }
        }
        await new Promise(r => setTimeout(r, 200));
      }
      const allElements = Array.from(document.querySelectorAll('[role="option"], [role="listbox"]')).map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        text: el.textContent,
        dataValue: el.getAttribute('data-value')
      }));
      return `Failed. Available options: ${JSON.stringify(allElements)}`;
    });
    console.log(`Category Select Result: ${clickedTop}`);
    await capture('closet_category_filter_en');
  } catch (err) {
    console.log('Category filter testing failed:', err.message);
  }

  // 4. Add Item Page
  console.log(`\n4. Crawling Add Item Page...`);
  const hasCaptureTab = await safeClick('[data-testid="bottom-tab-capture"]');
  if (!hasCaptureTab) {
    await page.goto(`${targetUrl}/closet/add`, { waitUntil: 'networkidle2' });
  }
  await capture('closet_add_en');

  // 5. Stylist Interactions
  console.log(`\n5. Crawling Stylist...`);
  const hasStylistTab = await safeClick('[data-testid="bottom-tab-stylist"]');
  if (!hasStylistTab) {
    await page.goto(`${targetUrl}/stylist`, { waitUntil: 'networkidle2' });
  }
  await capture('stylist_chat_en');

  // Outfits tab cycle
  console.log('Switching to Stylist: Outfits (shuffle) tab...');
  await safeClick('[id$="-trigger-shuffle"]');
  await capture('stylist_outfits_en');

  // Daily suggestion tab cycle
  console.log('Switching to Stylist: Daily Suggestion (match) tab...');
  await safeClick('[id$="-trigger-match"]');
  await capture('stylist_suggestion_en');

  // Go back to Chat and type something
  console.log('Switching back to Stylist: Chat tab...');
  await safeClick('[id$="-trigger-chat"]');
  try {
    await page.waitForSelector('[data-testid="stylist-composer-textarea"]', { visible: true, timeout: 5000 });
    await page.type('[data-testid="stylist-composer-textarea"]', 'Suggest a matching outfit for a rainy day.');
    await safeClick('[data-testid="stylist-include-calendar-switch"]');
    await capture('stylist_chat_typed_en');
  } catch (err) {
    console.log('Stylist input typing failed:', err.message);
  }

  // 6. Marketplace Interactions
  console.log(`\n6. Crawling Marketplace...`);
  const hasMarketTab = await safeClick('[data-testid="bottom-tab-market"]');
  if (!hasMarketTab) {
    await page.goto(`${targetUrl}/market`, { waitUntil: 'networkidle2' });
  }
  await capture('marketplace_en');

  // Click 'My listings' tab
  console.log('Switching to Marketplace: My listings tab...');
  await safeClick('[data-testid="marketplace-tab-mine"]');
  await capture('marketplace_mine_en');

  // 7. Profile Interactions
  console.log(`\n7. Crawling Profile...`);
  const hasMeTab = await safeClick('[data-testid="bottom-tab-me"]');
  if (!hasMeTab) {
    await page.goto(`${targetUrl}/me`, { waitUntil: 'networkidle2' });
  }
  await capture('profile_en');

  // Go to Wardrobe Stats
  console.log('Navigating to Wardrobe Stats page...');
  const hasStatsLink = await safeClick('[data-testid="explore-stats"]');
  if (!hasStatsLink) {
    await page.goto(`${targetUrl}/me/stats`, { waitUntil: 'networkidle2' });
  }
  await capture('profile_stats_en');

  // 8. Locale Switcher (i18n & RTL layouts test)
  console.log(`\n8. Testing Language Switching (i18n & RTL) on Home Page...`);
  await page.goto(`${targetUrl}/home`, { waitUntil: 'networkidle2' });
  
  // Click language picker trigger
  const hasLangPicker = await safeClick('[data-testid="language-picker-trigger-home"]');
  if (hasLangPicker) {
    // Click Hebrew option
    const clickedHe = await safeClick('[data-testid="language-picker-option-he"]');
    if (clickedHe) {
      console.log('Switched to Hebrew (RTL). Taking screenshots...');
      await capture('home_he');

      // Go to Closet in Hebrew
      await safeClick('[data-testid="bottom-tab-closet"]');
      await capture('closet_he');

      // Go to Stylist in Hebrew
      await safeClick('[data-testid="bottom-tab-stylist"]');
      await capture('stylist_he');

      // Go to Marketplace in Hebrew
      await safeClick('[data-testid="bottom-tab-market"]');
      await capture('marketplace_he');
    }
  }

  console.log(`\n9. Errors detected in browser console during run: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log(consoleErrors);
  }

  await browser.close();
  console.log('\nCrawler finished.');
}

runCrawler().catch(err => {
  console.error('Crawler failed with error:', err);
  process.exit(1);
});
