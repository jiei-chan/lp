#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/Users/uchida/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}

const targetUrl = process.argv[2] || 'http://localhost:4173';
const target = new URL(targetUrl);
assert(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Use a local fixture server only.');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const storageKey = 'import_lp_attribution';

(async () => {
  const browser = await chromium.launch(fs.existsSync(chrome) ? { executablePath: chrome } : {});
  try {
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      let interceptedPurchase = '';
      await context.route('**/*', route => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.origin === target.origin) return route.continue();
        if (requestUrl.hostname === 'www.import-language.com' && route.request().isNavigationRequest()) {
          interceptedPurchase = requestUrl.toString();
          return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Local fixture: purchase navigation intercepted.</p>' });
        }
        return route.abort();
      });
      await context.addInitScript(() => {
        window.fixtureGa = [];
        window.fixtureMeta = [];
        window.gtag = (...args) => window.fixtureGa.push(args);
        window.fbq = (...args) => window.fixtureMeta.push(args);
        window.IMPORT_SALE_NOW = '2026-09-14T12:00:00+09:00';
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(targetUrl, { waitUntil: 'networkidle' });
      for (const channel of ['chatgpt', 'ly']) {
        await page.evaluate(key => localStorage.setItem(key, JSON.stringify({
          utm_source: 'meta', utm_campaign: 'fixture-old-campaign', utm_content: 'fixture-old-ad',
          utm_term: 'fixture-old-term', fbclid: 'fixture-old-fb', gclid: 'fixture-old-g',
          captured_at: new Date().toISOString()
        })), storageKey);
        const clickKey = channel === 'chatgpt' ? 'oppref' : 'yclid';
        const current = { utm_source: channel, utm_medium: 'cpc', utm_campaign: 'fixture-current-campaign', utm_content: 'fixture-current-ad', [clickKey]: 'fixture-current-click' };
        const visit = new URL(targetUrl);
        visit.search = new URLSearchParams(current).toString();
        await page.goto(visit.toString(), { waitUntil: 'networkidle' });
        const snapshot = await page.evaluate(key => ({
          ctas: [...document.querySelectorAll('[data-purchase-cta]')].map(link => ({ id: link.dataset.purchaseCta, href: link.href })),
          storeLinks: [...document.querySelectorAll('a[href^="https://www.import-language.com"]:not([data-purchase-cta])')].map(link => link.href),
          storage: JSON.parse(localStorage.getItem(key)),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        }), storageKey);
        assert.equal(snapshot.ctas.length, 6);
        assert(snapshot.storeLinks.length > 0);
        assert(snapshot.overflow <= 1);
        for (const { id, href } of snapshot.ctas) {
          const params = Object.fromEntries(new URL(href).searchParams);
          assert.deepEqual(params, { lp_cta: id, lp_page: target.pathname, ...current });
        }
        for (const href of snapshot.storeLinks) assert.deepEqual(Object.fromEntries(new URL(href).searchParams), current);
        const { [clickKey]: transient, ...persistent } = current;
        assert(transient);
        const { captured_at: timestamp, ...saved } = snapshot.storage;
        assert(timestamp);
        assert.deepEqual(saved, persistent);

        // Modified clicks exercise every actual listener without leaving the LP.
        await page.evaluate(() => {
          document.querySelectorAll('[data-purchase-cta]').forEach(link => {
            // Cancel the browser default after the production listener runs.
            link.addEventListener('click', event => event.preventDefault(), { once: true });
            link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true }));
          });
        });
        const events = await page.evaluate(() => ({
          data: window.dataLayer.filter(item => item.event === 'purchase_cta_click'),
          ga: window.fixtureGa.filter(item => item[0] === 'event'),
          meta: window.fixtureMeta.filter(item => item[0] === 'trackCustom'),
          pageViews: window.fixtureMeta.filter(item => item[0] === 'track' && item[1] === 'PageView')
        }));
        assert.equal(events.pageViews.length, 1);
        for (const list of [events.data, events.ga, events.meta]) assert.equal(list.length, 6);
        events.data.forEach((event, index) => {
          assert.equal(event.cta_id, snapshot.ctas[index].id);
          assert.equal(event.purchase_url, snapshot.ctas[index].href);
          assert.equal(event.value, 10665);
          assert.equal(event.currency, 'JPY');
          assert.equal(events.ga[index][1], 'purchase_cta_click');
          assert.equal(events.ga[index][2].value, 10665);
          assert.equal(events.meta[index][1], 'PurchaseCtaClick');
          assert.equal(events.meta[index][2].value, 10665);
        });
        await page.goto(targetUrl, { waitUntil: 'networkidle' });
        const revisit = await page.evaluate(key => ({
          href: document.querySelector('[data-purchase-cta]').href,
          storage: JSON.parse(localStorage.getItem(key))
        }), storageKey);
        const params = new URL(revisit.href).searchParams;
        assert.deepEqual(revisit.storage, snapshot.storage);
        assert.equal(params.get(clickKey), null);
        assert.equal(params.get('utm_source'), channel);
        assert.equal(params.get('fbclid'), null);

        // Fulfill the outgoing navigation locally; Shopify is never contacted.
        await page.evaluate(() => document.querySelector('[data-purchase-cta]').click());
        await page.waitForURL(url => url.hostname === 'www.import-language.com');
        assert.equal(interceptedPurchase, revisit.href);
        await page.goto(targetUrl, { waitUntil: 'networkidle' });
        console.log(`OK browser ${width}px ${channel}: six CTAs, store links, events, revisit, navigation`);
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
