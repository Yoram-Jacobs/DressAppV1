# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> App visual appearance - Post Login
- Location: tests\app.spec.ts:3:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('text=Stylist').first()
    - locator resolved to <p class="text-sm text-muted-foreground max-w-md">Catalog your wardrobe. Ask the AI stylist. Swap, …</p>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    49 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - link "Skip to main content" [ref=e3] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e4]:
    - button "Change language" [ref=e6] [cursor=pointer]:
      - img
    - generic [ref=e7]:
      - generic [ref=e8]:
        - generic [ref=e9]:
          - img "DressApp" [ref=e10]
          - generic [ref=e11]: DressApp
        - generic [ref=e12]: Sign in
      - generic [ref=e14]:
        - heading "Welcome back" [level=1] [ref=e15]
        - paragraph [ref=e16]: Sign in to your closet and stylist.
        - generic [ref=e17]:
          - button "Continue with Google" [ref=e18] [cursor=pointer]:
            - img
            - text: Continue with Google
          - generic [ref=e19] [cursor=pointer]:
            - checkbox "Also connect my calendar" [ref=e20]
            - generic [ref=e21]: Also connect my calendar
        - generic [ref=e24]: or
        - generic [ref=e26]:
          - generic [ref=e27]:
            - text: Email
            - textbox "Email" [ref=e28]:
              - /placeholder: you@domain.com
          - generic [ref=e29]:
            - text: Password
            - textbox "Password" [ref=e30]
          - button "Sign in" [ref=e31] [cursor=pointer]
        - button "Continue as dev user" [ref=e32] [cursor=pointer]:
          - img
          - text: Continue as dev user
        - paragraph [ref=e33]:
          - text: No account?
          - link "Create one" [ref=e34] [cursor=pointer]:
            - /url: /register
  - region "Notifications alt+T"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('App visual appearance - Post Login', async ({ page }) => {
  4  |   await page.goto('/');
  5  | 
  6  |   // Wait for the main page to render
  7  |   await page.waitForLoadState('networkidle');
  8  | 
  9  |   // Click the dev login button
  10 |   await page.click('text=Continue as dev user');
  11 |   await page.waitForLoadState('networkidle');
  12 | 
  13 |   // Wait for a navigation or the main interface to load
  14 |   await page.waitForTimeout(2000); 
  15 | 
  16 |   // Take a screenshot of the main dashboard
  17 |   await page.screenshot({ path: 'tests/screenshots/dashboard.png', fullPage: true });
  18 | 
  19 |   // Try navigating to marketplace
  20 |   const marketplaceLink = page.locator('text=Marketplace');
  21 |   if (await marketplaceLink.count() > 0) {
  22 |     await marketplaceLink.first().click();
  23 |     await page.waitForTimeout(1000); 
  24 |     await page.screenshot({ path: 'tests/screenshots/marketplace.png', fullPage: true });
  25 |   }
  26 | 
  27 |   // Try navigating to AI Stylist
  28 |   const stylistLink = page.locator('text=Stylist');
  29 |   if (await stylistLink.count() > 0) {
> 30 |     await stylistLink.first().click();
     |                               ^ Error: locator.click: Test timeout of 30000ms exceeded.
  31 |     await page.waitForTimeout(1000); 
  32 |     await page.screenshot({ path: 'tests/screenshots/stylist.png', fullPage: true });
  33 |   }
  34 | });
  35 | 
```