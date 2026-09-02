const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
  });

  page.on('pageerror', exception => {
    console.log(`BROWSER CRASH: ${exception.message}`);
  });

  const target = 'http://178.105.144.142';
  console.log(`Navigating to ${target}...`);
  try {
    await page.goto(target, { waitUntil: 'networkidle2' });
  } catch (err) {
    console.log(`Failed to navigate to ${target}: ${err.message}`);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('Clicking "Continue as dev user"...');
  try {
    await page.waitForSelector('[data-testid="login-dev-bypass-button"]', { timeout: 5000 });
    await page.click('[data-testid="login-dev-bypass-button"]');
    console.log('Bypassed login');
  } catch (err) {
    console.log(`Dev bypass click failed: ${err.message}`);
  }

  await new Promise(resolve => setTimeout(resolve, 4000));

  console.log('Navigating to /stylist...');
  try {
    await page.goto(`${target}/stylist`, { waitUntil: 'networkidle2' });
  } catch (err) {
    console.log(`Navigation to stylist failed: ${err.message}`);
  }

  await new Promise(resolve => setTimeout(resolve, 4000));

  console.log('Taking screenshot...');
  try {
    await page.screenshot({ path: 'C:/Users/User/.gemini/antigravity/brain/0a7083a5-2307-48cf-87fd-5b06202c3a6b/scratch/stylist_debug_puppeteer.png' });
    console.log('Screenshot saved');
  } catch (err) {
    console.log(`Screenshot failed: ${err.message}`);
  }

  await browser.close();
  console.log('Done');
})();
