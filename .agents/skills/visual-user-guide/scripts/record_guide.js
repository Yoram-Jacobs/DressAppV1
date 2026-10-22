const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try {
  ({ chromium } = require('C:\\DressApp_AG\\node_modules\\playwright'));
} catch (_) {
  ({ chromium } = require('C:\\DressApp_AG\\apps\\web\\node_modules\\@playwright\\test'));
}

const BUILD_DIR = 'C:\\DressApp_AG\\apps\\web\\build';
const SCRATCH_DIR = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\6e985e9e-fea6-470e-942e-ae5a77527d5b\\scratch';
const VIDEO_DIR = path.join(SCRATCH_DIR, 'video_raw');

if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

const rawSheetPath = path.join(SCRATCH_DIR, 'red_tshirt_sheet.jpg');
const cleanJpgPath = path.join(SCRATCH_DIR, 'red_tshirt_clean.jpg');
const rawSheetB64 = fs.readFileSync(rawSheetPath).toString('base64');
const cleanCutoutB64 = fs.readFileSync(cleanJpgPath).toString('base64');

function makeSvgGarmentDataUrl(bgHex, garmentSvg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
    <rect width="600" height="800" fill="${bgHex}"/>
    ${garmentSvg}
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const blazerThumb = makeSvgGarmentDataUrl(
  '#ffffff',
  `<g transform="translate(110, 120)">
    <path d="M95,20 L145,20 L190,130 L235,20 L285,20 L355,95 L320,460 L270,450 L280,170 L265,510 L115,510 L100,170 L110,450 L60,460 L25,95 Z" fill="#d6cab8" stroke="#a89882" stroke-width="5" stroke-linejoin="round"/>
    <path d="M145,20 L190,165 L235,20" fill="#f5f2eb" stroke="#a89882" stroke-width="4"/>
    <circle cx="190" cy="240" r="8" fill="#786652"/>
    <circle cx="190" cy="310" r="8" fill="#786652"/>
  </g>`
);

const jeansThumb = makeSvgGarmentDataUrl(
  '#ffffff',
  `<g transform="translate(150, 110)">
    <path d="M45,20 L255,20 L275,560 L175,560 L150,210 L125,560 L25,560 Z" fill="#2b4c7e" stroke="#1e3557" stroke-width="5" stroke-linejoin="round"/>
    <path d="M45,20 L255,20 L258,65 L42,65 Z" fill="#233f68" stroke="#1e3557" stroke-width="4"/>
    <line x1="150" y1="20" x2="150" y2="210" stroke="#1e3557" stroke-width="4"/>
    <path d="M50,95 Q90,115 110,70" fill="none" stroke="#eab308" stroke-width="3" stroke-dasharray="6,4"/>
    <path d="M250,95 Q210,115 190,70" fill="none" stroke="#eab308" stroke-width="3" stroke-dasharray="6,4"/>
  </g>`
);

const sneakersThumb = makeSvgGarmentDataUrl(
  '#ffffff',
  `<g transform="translate(95, 270)">
    <path d="M30,180 Q35,90 120,85 L210,145 L335,155 Q395,165 395,220 L395,250 L25,250 Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="5" stroke-linejoin="round"/>
    <path d="M25,235 L395,235 L395,265 Q210,270 25,265 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="4"/>
    <path d="M110,165 L240,195" stroke="#1f5c45" stroke-width="14" stroke-linecap="round"/>
  </g>`
);

const INITIAL_CLOSET_ITEMS = [
  {
    id: 'item-existing-1',
    user_id: 'user-guide-1',
    source: 'Private',
    name: 'Sand Linen Blazer',
    title: 'Sand Linen Blazer',
    category: 'Outerwear',
    sub_category: 'blazers',
    item_type: 'blazer',
    brand: 'Massimo Dutti',
    gender: 'unisex',
    dress_code: 'smart_casual',
    season: ['spring', 'summer'],
    size: 'M',
    color: 'Beige',
    colors: [{ name: 'Beige', weight: 100 }],
    fabric_materials: [{ name: 'Linen', weight: 100 }],
    pattern: 'solid',
    state: 'used',
    condition: 'excellent',
    quality: 'high',
    price_cents: 12000,
    currency: 'USD',
    marketplace_intent: 'own',
    clean_image_url: blazerThumb,
    clean_image_status: 'ready',
    original_image_url: blazerThumb,
    thumbnail_data_url: blazerThumb,
    created_at: '2026-10-18T10:00:00Z',
    updated_at: '2026-10-18T10:00:00Z',
  },
  {
    id: 'item-existing-2',
    user_id: 'user-guide-1',
    source: 'Private',
    name: 'Classic Indigo Jeans',
    title: 'Classic Indigo Jeans',
    category: 'Bottom',
    sub_category: 'jeans',
    item_type: 'straight_jeans',
    brand: "Levi's",
    gender: 'unisex',
    dress_code: 'casual',
    season: ['all'],
    size: '32',
    color: 'Blue',
    colors: [{ name: 'Indigo Blue', weight: 100 }],
    fabric_materials: [{ name: 'Cotton Denim', weight: 100 }],
    pattern: 'solid',
    state: 'used',
    condition: 'good',
    quality: 'high',
    price_cents: 8500,
    currency: 'USD',
    marketplace_intent: 'own',
    clean_image_url: jeansThumb,
    clean_image_status: 'ready',
    original_image_url: jeansThumb,
    thumbnail_data_url: jeansThumb,
    created_at: '2026-10-17T10:00:00Z',
    updated_at: '2026-10-17T10:00:00Z',
  },
  {
    id: 'item-existing-3',
    user_id: 'user-guide-1',
    source: 'Private',
    name: 'White Court Sneakers',
    title: 'White Court Sneakers',
    category: 'Footwear',
    sub_category: 'sneakers',
    item_type: 'low_top_sneakers',
    brand: 'Veja',
    gender: 'unisex',
    dress_code: 'casual',
    season: ['all'],
    size: '42',
    color: 'White',
    colors: [{ name: 'White', weight: 90 }, { name: 'Green', weight: 10 }],
    fabric_materials: [{ name: 'Leather', weight: 100 }],
    pattern: 'solid',
    state: 'used',
    condition: 'excellent',
    quality: 'high',
    price_cents: 15000,
    currency: 'USD',
    marketplace_intent: 'own',
    clean_image_url: sneakersThumb,
    clean_image_status: 'ready',
    original_image_url: sneakersThumb,
    thumbnail_data_url: sneakersThumb,
    created_at: '2026-10-16T10:00:00Z',
    updated_at: '2026-10-16T10:00:00Z',
  },
];

let currentClosetItems = [...INITIAL_CLOSET_ITEMS];

const MOCK_USER = {
  id: 'user-guide-1',
  email: 'alex@dressapp.co',
  name: 'Alex Rivera',
  full_name: 'Alex Rivera',
  gender: 'unisex',
  tier: 'pro',
  subscription_tier: 'pro',
  plan: 'pro',
  roles: ['tester'],
  subscription: {
    is_active: true,
    plan_type: 'pro',
    tier: 'pro',
    is_tester: true,
  },
  credits_balance: 500,
  preferred_currency: 'USD',
  onboarding_completed: true,
  migration_flag: 'New',
  body_measurements: { height_cm: 175, weight_kg: 70 },
  style_profile: { aesthetics: ['minimalist', 'casual'] },
};

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

let activeAnalyzeRes = null;

function emitMatteFrame() {
  if (!activeAnalyzeRes) return;
  const matteFrame = {
    type: 'matte',
    index: 0,
    crop_base64: cleanCutoutB64,
    crop_mime: 'image/jpeg',
  };
  activeAnalyzeRes.write(JSON.stringify(matteFrame) + '\n');
}

function emitItemAndDoneFrame() {
  if (!activeAnalyzeRes) return;
  const itemFrame = {
    type: 'item',
    index: 0,
    crop_base64: cleanCutoutB64,
    crop_mime: 'image/jpeg',
    analysis: {
      name: 'Red DressApp Logo T-Shirt',
      title: 'Red DressApp Logo T-Shirt',
      caption: 'Vibrant red cotton crew-neck T-shirt featuring the official DressApp logo print on the chest.',
      category: 'Top',
      sub_category: 't_shirts',
      item_type: 'short_sleeve_t_shirt',
      brand: 'DressApp',
      size: 'M',
      gender: 'unisex',
      dress_code: 'casual',
      pattern: 'printed',
      season: ['summer', 'spring'],
      color: 'Red',
      colors: [
        { name: 'Crimson Red', weight: 90 },
        { name: 'White', weight: 10 },
      ],
      fabric_materials: [{ name: '100% Combed Cotton', weight: 100 }],
      state: 'new',
      condition: 'excellent',
      quality: 'high',
      price_cents: 3500,
      currency: 'USD',
      marketplace_intent: 'own',
      tags: ['dressapp', 'logo-tee', 'red', 'cotton', 'casual'],
    },
  };
  activeAnalyzeRes.write(JSON.stringify(itemFrame) + '\n');
  activeAnalyzeRes.write(JSON.stringify({ type: 'done', count: 1 }) + '\n');
  activeAnalyzeRes.end();
  activeAnalyzeRes = null;
}

function startServer(port) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const parsedUrl = new URL(req.url, `http://127.0.0.1:${port}`);
      const pathname = parsedUrl.pathname;

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (pathname.startsWith('/api/v1/')) {
        if (pathname === '/api/v1/auth/me' || pathname === '/api/v1/users/me') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(MOCK_USER));
          return;
        }
        if (pathname === '/api/v1/closet' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              items: currentClosetItems,
              total: currentClosetItems.length,
              ids: currentClosetItems.map((i) => i.id),
            })
          );
          return;
        }
        if (pathname === '/api/v1/closet/check-duplicates' && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ matches: [] }));
          return;
        }
        if (pathname === '/api/v1/closet/analyze' && req.method === 'POST') {
          res.writeHead(200, {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
          activeAnalyzeRes = res;

          setTimeout(() => {
            if (!activeAnalyzeRes) return;
            const detectFrame = {
              type: 'detect',
              items_meta: [
                {
                  image_index: 0,
                  crop_base64: rawSheetB64,
                  crop_mime: 'image/jpeg',
                  label: 'short_sleeve_t_shirt',
                  pipeline_mode: 'single',
                },
              ],
            };
            activeAnalyzeRes.write(JSON.stringify(detectFrame) + '\n');
          }, 80);
          return;
        }
        if (pathname === '/api/v1/closet' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => (bodyStr += chunk));
          req.on('end', () => {
            let parsed = {};
            try {
              parsed = JSON.parse(bodyStr || '{}');
            } catch (_) {}
            const created = {
              id: 'item-red-dressapp-tee',
              user_id: 'user-guide-1',
              source: 'Private',
              name: parsed.name || 'Red DressApp Logo T-Shirt',
              title: parsed.title || 'Red DressApp Logo T-Shirt',
              caption:
                parsed.caption ||
                'Vibrant red cotton crew-neck T-shirt featuring the official DressApp logo print.',
              category: parsed.category || 'Top',
              sub_category: parsed.sub_category || 't_shirts',
              item_type: parsed.item_type || 'short_sleeve_t_shirt',
              brand: parsed.brand || 'DressApp',
              size: parsed.size || 'M',
              gender: parsed.gender || 'unisex',
              dress_code: parsed.dress_code || 'casual',
              pattern: parsed.pattern || 'printed',
              season: parsed.season || ['summer', 'spring'],
              color: 'Red',
              colors: parsed.colors || [
                { name: 'Crimson Red', weight: 90 },
                { name: 'White', weight: 10 },
              ],
              fabric_materials: parsed.fabric_materials || [{ name: 'Cotton', weight: 100 }],
              state: 'new',
              condition: 'excellent',
              quality: 'high',
              price_cents: 3500,
              currency: 'USD',
              marketplace_intent: 'own',
              clean_image_url: `data:image/jpeg;base64,${cleanCutoutB64}`,
              clean_image_status: 'ready',
              original_image_url: `data:image/jpeg;base64,${cleanCutoutB64}`,
              thumbnail_data_url: `data:image/jpeg;base64,${cleanCutoutB64}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            currentClosetItems = [created, ...INITIAL_CLOSET_ITEMS];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(created));
          });
          return;
        }
        if ((req.headers.accept || '').includes('text/event-stream') || pathname.includes('/sync') || pathname.includes('/stream')) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
          res.write(': connected\n\n');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, items: [], data: [] }));
        return;
      }

      let filePath = path.join(BUILD_DIR, pathname === '/' ? 'index.html' : pathname);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(BUILD_DIR, 'index.html');
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_MAP[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`Mock server listening on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

(async () => {
  const PORT = 8788;
  const server = await startServer(PORT);

  const browser = await chromium.launch({
    headless: true,
    executablePath:
      'C:\\Users\\User\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    recordVideo: {
      dir: VIDEO_DIR,
      size: { width: 390, height: 844 },
    },
  });

  const contextStartMs = Date.now();
  const page = await context.newPage();

  await page.route('**/api/v1/**', async (route) => {
    try {
      const reqUrl = new URL(route.request().url());
      if (reqUrl.port !== String(PORT)) {
        const targetUrl = `http://127.0.0.1:${PORT}${reqUrl.pathname}${reqUrl.search}`;
        const resp = await page.request.fetch(targetUrl, {
          method: route.request().method(),
          headers: route.request().headers(),
          data: route.request().postDataBuffer(),
        });
        await route.fulfill({ response: resp });
      } else {
        await route.continue();
      }
    } catch (_) {}
  });

  await page.addInitScript(
    ({ user, sheetB64 }) => {
      localStorage.setItem('dressapp.token', 'guide-jwt-token-pro-2026');
      localStorage.setItem('dressapp.user', JSON.stringify(user));
      localStorage.setItem('dressapp.onboarding_completed', 'done');
      localStorage.setItem('i18nextLng', 'en');
      sessionStorage.setItem('dressapp_dismissed_login_reminder', 'true');
      sessionStorage.setItem('dressapp_dismissed_migration', 'true');
      window.__GUIDE_SHEET_B64 = sheetB64;
    },
    { user: MOCK_USER, sheetB64: rawSheetB64 }
  );

  console.log('Navigating to /closet/add...');
  await page.goto(`http://127.0.0.1:${PORT}/closet/add`, { waitUntil: 'domcontentloaded' });
  const takePhotoBtn = page.locator('[data-testid="add-item-open-camera-button"]');
  await takePhotoBtn.waitFor({ state: 'visible', timeout: 10000 });

  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      header + div[class*="relative"],
      div[class*="PageHeroBanner"] {
        max-height: 105px !important;
        overflow: hidden !important;
      }
      section.w-full.overflow-hidden {
        padding-top: 12px !important;
        padding-bottom: 24px !important;
      }
      h1 {
        font-size: 22px !important;
        line-height: 28px !important;
        margin-bottom: 4px !important;
      }
      h1 + p {
        display: none !important;
      }
      /* Hide floating bulk-select / work progress floater during guide recording */
      button[aria-label*="Help"],
      [data-testid="closet-select-mode-button"],
      [data-testid="closet-add-item-floater-button"],
      div[class*="fixed"][class*="bottom-"][class*="start-"] {
        display: none !important;
      }
      /* Keep card photo frame size & object-fit 100% fixed so the garment never jumps in size */
      [data-testid="add-item-card-photo"] img {
        object-fit: cover !important;
        width: 100% !important;
        height: 100% !important;
      }
      /* Make closet card image background pure studio white */
      [data-testid="closet-item-card"] div[class*="bg-[#ddd]"] {
        background-color: #ffffff !important;
      }
      /* Slow, clear touch tap indicator */
      @keyframes guideTapPulse {
        0% { transform: translate(-50%, -50%) scale(0.45); opacity: 1; }
        50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
        80% { transform: translate(-50%, -50%) scale(1.25); opacity: 0.85; }
        100% { transform: translate(-50%, -50%) scale(1.55); opacity: 0; }
      }
      .guide-tap-ring {
        position: fixed;
        width: 58px;
        height: 58px;
        border-radius: 9999px;
        background: rgba(220, 38, 38, 0.36);
        border: 3px solid #ffffff;
        box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.92), 0 6px 20px rgba(0,0,0,0.35);
        pointer-events: none;
        z-index: 999999;
        animation: guideTapPulse 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      /* Step callout pill docked neatly above bottom tab bar */
      #guide-step-pill {
        position: fixed;
        bottom: 86px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999990;
        background: rgba(17, 24, 39, 0.94);
        color: #ffffff;
        padding: 7px 15px;
        border-radius: 9999px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.2px;
        box-shadow: 0 10px 26px rgba(0,0,0,0.32);
        border: 1px solid rgba(255,255,255,0.22);
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
        transition: all 0.25s ease;
      }
      #guide-step-pill .step-badge {
        background: #1f5c45;
        color: #fff;
        font-size: 10px;
        font-weight: 800;
        padding: 2.5px 8px;
        border-radius: 999px;
        text-transform: uppercase;
      }
      /* Native Mobile Camera Viewfinder Overlay — fixed viewpoint & frame size (no zoom/shake) */
      #guide-camera-overlay {
        position: fixed;
        inset: 0;
        background: #000;
        z-index: 999980;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.28s ease;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
      #guide-camera-overlay.open {
        opacity: 1;
      }
      #guide-camera-viewfinder {
        position: relative;
        flex: 1;
        overflow: hidden;
        background: #111;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #guide-camera-viewfinder img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .cam-grid-line-v1, .cam-grid-line-v2 {
        position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.22);
      }
      .cam-grid-line-v1 { left: 33.33%; }
      .cam-grid-line-v2 { left: 66.66%; }
      .cam-grid-line-h1, .cam-grid-line-h2 {
        position: absolute; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.22);
      }
      .cam-grid-line-h1 { top: 33.33%; }
      .cam-grid-line-h2 { top: 66.66%; }
      @keyframes focusLock {
        0% { transform: translate(-50%, -50%) scale(1.25); border-color: rgba(255,255,255,0.9); }
        60% { transform: translate(-50%, -50%) scale(0.96); border-color: #facc15; }
        100% { transform: translate(-50%, -50%) scale(1.0); border-color: #facc15; }
      }
      #cam-focus-box {
        position: absolute;
        top: 47%;
        left: 50%;
        width: 96px;
        height: 96px;
        border: 2px solid #facc15;
        border-radius: 8px;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 12px rgba(250, 204, 21, 0.35);
        animation: focusLock 0.9s ease-out forwards;
      }
      #cam-flash {
        position: absolute;
        inset: 0;
        background: #ffffff;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.16s ease;
      }
    `;
    document.head.appendChild(style);

    const pill = document.createElement('div');
    pill.id = 'guide-step-pill';
    pill.innerHTML = `<span class="step-badge">Step 1/5</span><span>Tap "Take photo" on Add Item</span>`;
    document.body.appendChild(pill);

    window.__setGuideStep = (stepText, descText) => {
      const p = document.getElementById('guide-step-pill');
      if (p) {
        p.innerHTML = `<span class="step-badge">${stepText}</span><span>${descText}</span>`;
      }
    };

    window.__showTapAt = (x, y) => {
      const ring = document.createElement('div');
      ring.className = 'guide-tap-ring';
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 1150);
    };

    window.__slowScrollBy = (deltaY, durationMs = 900) => {
      return new Promise((resolve) => {
        const startY = window.scrollY;
        const startTime = performance.now();
        function step(now) {
          const t = Math.min(1, (now - startTime) / durationMs);
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          window.scrollTo(0, startY + deltaY * ease);
          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    };

    const cam = document.createElement('div');
    cam.id = 'guide-camera-overlay';
    cam.innerHTML = `
      <div style="height:56px;background:#000;display:flex;align-items:center;justify-content:space-between;padding:12px 20px 0;color:#fff;font-size:13px;">
        <span>⚡ Auto</span>
        <span style="color:#facc15;font-weight:600;font-size:11px;letter-spacing:0.8px;">FLAT-LAY · WHITE SHEET</span>
        <span>HDR</span>
      </div>
      <div id="guide-camera-viewfinder">
        <img src="data:image/jpeg;base64,${window.__GUIDE_SHEET_B64}" alt="Camera Viewfinder" />
        <div class="cam-grid-line-v1"></div>
        <div class="cam-grid-line-v2"></div>
        <div class="cam-grid-line-h1"></div>
        <div class="cam-grid-line-h2"></div>
        <div id="cam-focus-box"></div>
        <div id="cam-flash"></div>
      </div>
      <div style="height:145px;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding-bottom:14px;">
        <div style="display:flex;gap:22px;font-size:11px;font-weight:700;letter-spacing:1px;color:rgba(255,255,255,0.6);">
          <span>VIDEO</span>
          <span style="color:#facc15;">PHOTO</span>
          <span>PORTRAIT</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-around;width:100%;padding:0 36px;">
          <div style="width:42px;height:42px;border-radius:8px;background:#222;border:1px solid #444;"></div>
          <div id="guide-shutter-btn" style="width:72px;height:72px;border-radius:999px;border:4px solid #fff;padding:4px;display:flex;align-items:center;justify-content:center;">
            <div id="guide-shutter-inner" style="width:100%;height:100%;border-radius:999px;background:#fff;transition:transform 0.14s ease;"></div>
          </div>
          <div style="width:42px;height:42px;border-radius:999px;background:#222;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;">↻</div>
        </div>
      </div>
    `;
    document.body.appendChild(cam);
  });

  await page.evaluate(() => {
    const stepper = document.querySelector('[data-testid="add-item-stepper"]');
    if (stepper) {
      const rect = stepper.getBoundingClientRect();
      window.scrollBy({ top: rect.top - 58, behavior: 'instant' });
    }
  });
  await page.waitForTimeout(250);

  // Record exact start offset inside the 25fps WebM video
  const sceneStartOffsetSec = Math.max(0, (Date.now() - contextStartMs) / 1000);
  const sceneStartMs = Date.now();

  // --- SCENE 1 (0.0s - 3.4s): AddItem Screen & Tap "Take photo" ---
  await page.waitForTimeout(2000);
  const btnBox = await takePhotoBtn.boundingBox();
  if (btnBox) {
    await page.evaluate(({ x, y }) => window.__showTapAt(x, y), {
      x: btnBox.x + btnBox.width / 2,
      y: btnBox.y + btnBox.height / 2,
    });
  }
  await page.waitForTimeout(1400);

  // --- SCENE 2 (3.4s - 7.6s): Fixed Mobile Camera Viewfinder framing Red DressApp T-shirt on white sheet ---
  await page.evaluate(() => {
    window.__setGuideStep('Step 2/5', 'Lay flat on white sheet & snap photo');
    const cam = document.getElementById('guide-camera-overlay');
    if (cam) cam.classList.add('open');
  });
  await page.waitForTimeout(2600);

  // Tap shutter button + flash
  await page.evaluate(() => {
    const shutter = document.getElementById('guide-shutter-btn');
    const inner = document.getElementById('guide-shutter-inner');
    const flash = document.getElementById('cam-flash');
    if (shutter) {
      const r = shutter.getBoundingClientRect();
      window.__showTapAt(r.left + r.width / 2, r.top + r.height / 2);
    }
    if (inner) inner.style.transform = 'scale(0.84)';
    if (flash) flash.style.opacity = '0.95';
    setTimeout(() => {
      if (inner) inner.style.transform = 'scale(1)';
      if (flash) flash.style.opacity = '0';
    }, 220);
  });
  await page.waitForTimeout(1300);

  // --- SCENE 3 (7.6s - 13.6s): Background Removal & AI Scanning on AddItem Screen ---
  await page.evaluate(() => {
    const cam = document.getElementById('guide-camera-overlay');
    if (cam) cam.classList.remove('open');
    window.__setGuideStep('Step 3/5', 'AI removes background & scans item');
  });

  // Trigger file drop with in-memory File
  await page.evaluate(() => {
    const b64 = window.__GUIDE_SHEET_B64;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const file = new File([bytes], 'red_tshirt_sheet.jpg', { type: 'image/jpeg' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const dz = document.querySelector('[data-testid="add-item-dropzone"]');
    if (dz) {
      const dropEvt = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      });
      dz.dispatchEvent(dropEvt);
    }
  });

  const itemCard = page.locator('[data-testid="add-item-card"]').first();
  await itemCard.waitFor({ state: 'visible', timeout: 5000 });
  await page.evaluate(async () => {
    const actionBar = document.querySelector('[data-testid="add-item-action-bar"]');
    if (actionBar) {
      const r = actionBar.getBoundingClientRect();
      await window.__slowScrollBy(r.top - 64, 800);
    }
  });

  // Hold on white-sheet photo while scanning (2.4s)
  await page.waitForTimeout(2400);

  // Emit the matte (background-removed cutout) frame while keeping exact same frame size & garment scale
  emitMatteFrame();
  await page.evaluate((cleanB64) => {
    const img = document.querySelector('[data-testid="add-item-card-photo"] img');
    if (img) {
      img.style.transition = 'opacity 0.3s ease';
      img.src = `data:image/jpeg;base64,${cleanB64}`;
    }
  }, cleanCutoutB64);
  await page.waitForTimeout(2400);

  // --- SCENE 4 (13.6s - 18.8s): Emit AI Analysis Results, Slow Vertical Scroll to View ---
  emitItemAndDoneFrame();
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    window.__setGuideStep('Step 4/5', 'Review auto-filled details & tap Save');
  });

  await page.evaluate(async () => {
    const nameInput = document.querySelector('[data-testid="add-item-name"]');
    if (nameInput) {
      const r = nameInput.getBoundingClientRect();
      await window.__slowScrollBy(r.top - 180, 950);
    }
  });
  await page.waitForTimeout(3600);

  // --- SCENE 5 (18.8s - 22.4s): Slow Vertical Scroll Back Up to Save Button & Tap Save ---
  await page.evaluate(async () => {
    const actionBar = document.querySelector('[data-testid="add-item-action-bar"]');
    if (actionBar) {
      const r = actionBar.getBoundingClientRect();
      await window.__slowScrollBy(r.top - 68, 950);
    }
  });
  await page.waitForTimeout(1000);

  const saveBtn = page.locator('[data-testid="add-item-save-all"]');
  const saveBox = await saveBtn.boundingBox();
  if (saveBox) {
    await page.evaluate(({ x, y }) => window.__showTapAt(x, y), {
      x: saveBox.x + saveBox.width / 2,
      y: saveBox.y + saveBox.height / 2,
    });
  }
  await page.waitForTimeout(1200);
  await saveBtn.click();

  // --- SCENE 6 (22.4s - 26.8s): Closet Screen showing the new Red DressApp Logo T-Shirt card ---
  await page.waitForURL('**/closet', { timeout: 5000 });
  await page.evaluate(() => {
    window.__setGuideStep('Step 5/5', 'Saved! New item card in My Closet');
  });
  await page.waitForTimeout(400);

  await page.evaluate(async () => {
    const firstCard = document.querySelector('[data-testid="closet-item-card"]');
    if (firstCard) {
      firstCard.style.boxShadow = '0 0 0 3px #1f5c45, 0 12px 28px rgba(31, 92, 69, 0.28)';
    }
    const bar = document.querySelector('[data-testid="closet-view-mode-bar"]');
    if (bar) {
      const r = bar.getBoundingClientRect();
      await window.__slowScrollBy(r.top - 64, 900);
    }
  });

  await page.waitForTimeout(3600);

  const totalDurationSec = (Date.now() - sceneStartMs) / 1000;
  console.log(`Recorded active guide over ${totalDurationSec.toFixed(2)}s (startOffset=${sceneStartOffsetSec.toFixed(2)}s)`);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const videoObj = page.video();
  await context.close();
  const webmPath = videoObj ? await videoObj.path() : null;
  fs.writeFileSync(
    path.join(SCRATCH_DIR, 'capture_meta.json'),
    JSON.stringify({ webmPath, startOffsetSec: sceneStartOffsetSec, durationSec: totalDurationSec }, null, 2)
  );
  await browser.close();
  server.close();
  process.exit(0);
})();
