#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/Users/uchida/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const origin = 'https://promo.import-language.com';

(async () => {
  const browser = await chromium.launch(fs.existsSync(chrome) ? { executablePath: chrome } : {});
  try {
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      const sdkRequests = [], navigations = [], errors = [];
      // Every request is fulfilled from a file/fixture or aborted, never continued.
      await context.route('**/*', async route => {
        if (route.request().resourceType() === 'media') return route.abort();
        const url = new URL(route.request().url());
        if (url.origin === origin) {
          if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html });
          const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
          if (file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ path: file });
          return route.abort();
        }
        if (url.origin === 'https://analytics.tiktok.com') {
          sdkRequests.push(url.toString());
          // No real SDK: keep the official bootstrap queue observable.
          return route.fulfill({ contentType: 'text/javascript', body: '/* SDK network fixture */' });
        }
        if (url.origin === 'https://www.import-language.com' && route.request().isNavigationRequest()) {
          navigations.push(url.toString());
          return route.fulfill({ contentType: 'text/html', body: '<p>Shopify navigation fixture</p>' });
        }
        return route.abort();
      });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      const attribution = { ttclid: 'fixture+tt/id=', utm_source: 'tiktok', utm_medium: 'paid_social', utm_campaign: '日本語 & sale', utm_content: '動画 1', utm_term: 'fixture-term', utm_id: 'fixture-id' };
      await page.goto(origin + '/?' + new URLSearchParams(attribution), { waitUntil: 'networkidle' });
      assert.equal(sdkRequests.length, 1);
      assert.deepEqual(await page.evaluate(() => [...window.ttq]), [['page']]);
      assert.equal(await page.locator('#tiktok-consent').count(), 0);
      const ctas = await page.locator('[data-purchase-cta]').evaluateAll(links => links.map(a => ({ href: a.href, id: a.dataset.purchaseCta })));
      assert.equal(ctas.length, 6);
      for (const cta of ctas) assert.deepEqual(Object.fromEntries(new URL(cta.href).searchParams), { lp_cta: cta.id, lp_page: '/', ...attribution });
      // Exercise every CTA, retaining the page so event queues remain inspectable.
      await page.evaluate(() => {
        document.querySelectorAll('[data-purchase-cta]').forEach(link => {
          link.addEventListener('click', e => e.preventDefault(), { capture: true, once: true });
          link.click();
        });
      });
      assert.deepEqual(await page.evaluate(() => [...window.ttq]), [['page']]);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.goto(origin, { waitUntil: 'networkidle' });
      assert.equal(sdkRequests.length, 2);
      assert.deepEqual(await page.evaluate(() => [...window.ttq]), [['page']]);
      const directHref = await page.locator('[data-purchase-cta]').first().getAttribute('href');
      for (const [key, value] of Object.entries(attribution)) assert.equal(new URL(directHref).searchParams.get(key), value);
      // Exercise the real delayed navigation handler, intercepting Shopify entirely.
      await page.evaluate(() => document.querySelector('[data-purchase-cta]').click());
      await page.waitForURL('https://www.import-language.com/**');
      assert.equal(navigations.length, 1);
      assert.equal(navigations[0], directHref);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`OK ${width}px: automatic single page view, six CTAs, encoded attribution, revisit, intercepted navigation`);
    }
    // A real browser failure path must leave the purchase links usable.
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') && route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
    const page = await context.newPage();
    const warnings = [];
    page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
    await page.goto(origin + '/?ttclid=fixture-failure', { waitUntil: 'networkidle' });
    assert(warnings.some(message => message.includes('TikTok Pixel could not load')));
    assert.equal(new URL(await page.locator('[data-purchase-cta]').first().getAttribute('href')).searchParams.get('ttclid'), 'fixture-failure');
    await context.close();
    console.log('OK SDK failure preserves purchase routing; all external network requests blocked');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
