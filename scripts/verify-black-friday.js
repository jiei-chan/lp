#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/Users/uchida/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'blackfriday.html'), 'utf8');
const localUrl = new URL(process.argv[2] || 'http://127.0.0.1:4187');
const start = Date.parse('2026-11-20T18:00:00+09:00');
const end = Date.parse('2026-12-01T00:00:00+09:00');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function check(page, now, label) {
  const active = now >= start && now < end;
  const price = active ? 11980 : 14980;
  const savings = 20340 - price;
  const actual = await page.evaluate(() => {
    const text = selector => [...document.querySelectorAll(selector)].map(el => el.textContent.trim());
    const shown = selector => getComputedStyle(document.querySelector(selector)).display !== 'none';
    return {
      phase: window.IMPORT_CURRENT_SALE.phase,
      price: window.IMPORT_CURRENT_SALE.salePrice,
      prices: text('[data-sale-price-plain]'),
      yenPrices: text('[data-sale-price]'),
      regular: text('[data-sale-regular-price]'),
      savings: text('[data-sale-savings-price]'),
      savingsYen: text('[data-sale-savings-yen]'),
      percent: text('[data-sale-percent]'),
      deadlines: text('[data-sale-deadline-long]'),
      scheduled: document.body.classList.contains('sale-mode-scheduled'),
      timersVisible: ['.offer-urgency', '.sticky-count-wrap'].map(shown),
      finalTimerVisible: shown('.final-countdown'),
      bannerVisible: shown('.bf-banner'),
      timers: [
        ['sticky-cd-days', 'sticky-cd-hours', 'sticky-cd-min', 'sticky-cd-sec'],
        ['cd-days', 'cd-hours', 'cd-min', 'cd-sec'],
        ['cd-d', 'cd-h', 'cd-m', 'cd-s'],
      ].map(ids => ids.map(id => Number(document.getElementById(id).textContent))),
      ctas: [...document.querySelectorAll('[data-purchase-cta]')].map(el => ({ id: el.dataset.purchaseCta, href: el.href })),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  const all = (values, expected) => {
    assert.ok(values.length > 0, `${label}: missing price elements`);
    assert.ok(values.every(value => value === expected), `${label}: expected ${expected}, got ${values}`);
  };
  assert.equal(actual.price, price, label);
  assert.equal(actual.phase, active ? 'black-friday' : 'after-ladder', label);
  all(actual.prices, price.toLocaleString('ja-JP'));
  all(actual.yenPrices, `¥${price.toLocaleString('ja-JP')}`);
  all(actual.regular, '¥20,340');
  all(actual.savings, `¥${savings.toLocaleString('ja-JP')}`);
  all(actual.savingsYen, `${savings.toLocaleString('ja-JP')}円`);
  all(actual.percent, String(Math.round(savings / 20340 * 100)));
  all(actual.deadlines, active ? '11/30（月）23:59まで' : '');
  assert.equal(actual.scheduled, active, label);
  assert.deepEqual(actual.timersVisible, [active, active], label);
  assert.equal(actual.finalTimerVisible, false, 'The final duplicate timer stays hidden by design');
  assert.equal(actual.bannerVisible, active, `${label}: the sale banner must only appear during the sale`);
  if (active) {
    const seconds = Math.floor((end - now) / 1000);
    const expected = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
    actual.timers.forEach(timer => assert.deepEqual(timer, expected, label));
  }
  assert.equal(actual.ctas.length, 6, 'All purchase entry points remain available');
  for (const cta of actual.ctas) {
    const url = new URL(cta.href);
    assert.equal(url.origin, 'https://www.import-language.com');
    assert.equal(decodeURI(url.pathname), '/ja/products/import完全版-premium-complete-edition-lp用割引');
    assert.equal(url.searchParams.get('lp_cta'), cta.id);
    assert.equal(url.searchParams.get('lp_page'), '/blackfriday');
    assert.equal(url.searchParams.get('utm_campaign'), 'bf-fixture');
  }
  assert.ok(actual.overflow <= 1, `${label}: horizontal overflow ${actual.overflow}`);
}

(async () => {
  const browser = await chromium.launch(fs.existsSync(chrome) ? { executablePath: chrome } : {});
  try {
    for (const width of [320, 390, 1440]) {
      for (const boundary of [start, end]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/Los_Angeles' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.install({ time: new Date(boundary - 1000) });
        await page.clock.pauseAt(new Date(boundary - 1000));
        // Use the production hostname with local content; never contact production or analytics.
        await page.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.hostname !== 'promo.import-language.com') return route.abort();
          if (url.pathname === '/blackfriday') return route.fulfill({ contentType: 'text/html', body: source });
          if (route.request().resourceType() === 'media') return route.abort();
          return route.fulfill({ response: await route.fetch({ url: new URL(url.pathname, localUrl).href }) });
        });
        await page.goto('https://promo.import-language.com/blackfriday?utm_campaign=bf-fixture', { waitUntil: 'load' });
        await check(page, boundary - 1000, `${width}: before ${new Date(boundary).toISOString()}`);
        await page.clock.runFor(1000);
        await check(page, boundary, `${width}: at boundary`);
        await page.clock.runFor(1000);
        await check(page, boundary + 1000, `${width}: after boundary`);
        assert.deepEqual(errors, [], 'No browser script errors');
        console.log(`OK ${width}px ${boundary === start ? 'start' : 'end'}: price, all timers, live transition, CTA, overflow`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
