#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/Users/uchida/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const workerSource = fs.readFileSync(path.join(dist, '_worker.js'), 'utf8');
const { createHomeWorker, default: generatedWorker } = await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`);
const schedule = {
  page: 'blackfriday', startAt: '2026-11-20T18:00:00+09:00', endAt: '2026-12-01T00:00:00+09:00',
  offer: { regularPrice: 20340, salePrice: 11980, savings: 8360, percent: 41 },
};
assert.ok(workerSource.includes(`export default createHomeWorker(${JSON.stringify(schedule)});`), 'The emitted schedule must match the confirmed sale');
const start = Date.parse(schedule.startAt);
const end = Date.parse(schedule.endAt);
let serverNow = start - 1000;
const worker = createHomeWorker(schedule, () => serverNow);
const mime = { '.html': 'text/html', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
const requestedAssets = [];
const env = { ASSETS: { async fetch(request) {
  const url = new URL(request.url);
  requestedAssets.push(url);
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!path.extname(pathname)) pathname += '.html';
  const filename = path.resolve(dist, '.' + pathname);
  if (!filename.startsWith(dist + path.sep) || !fs.existsSync(filename)) return new Response('Not found', { status: 404 });
  return new Response(request.method === 'HEAD' ? null : fs.readFileSync(filename), { headers: {
    'Content-Type': mime[path.extname(filename)] || 'application/octet-stream',
    'Cache-Control': 'public, max-age=3600', ETag: 'fixture-etag',
  } });
} } };

assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dist, '_routes.json'))), {
  version: 1, include: ['/', '/index', '/index.html'], exclude: [],
});
assert.throws(() => createHomeWorker({ ...schedule, endAt: schedule.startAt }));
assert.throws(() => createHomeWorker({ ...schedule, startAt: 'invalid' }));
for (const now of [start - 1, start, start + 60000, end - 1, end, end + 1]) {
  serverNow = now;
  const active = now >= start && now < end;
  for (const alias of ['/', '/index', '/index.html']) {
    for (const method of ['GET', 'HEAD']) {
      const request = new Request(`https://promo.import-language.com${alias}?utm_campaign=fixture&gclid=fixture`, {
        method, headers: { 'If-None-Match': 'fixture-etag' },
      });
      const response = await worker.fetch(request, env);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
      assert.equal(response.headers.get('ETag'), null);
      assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
      const asset = requestedAssets.at(-1);
      assert.equal(asset.pathname, active ? '/blackfriday' : '/');
      assert.equal(asset.search, '?utm_campaign=fixture&gclid=fixture');
      const html = await response.text();
      if (method === 'HEAD') assert.equal(html, '');
      else {
        assert.equal(html.includes('data-lp-variant="blackfriday"'), active);
        assert.ok(!html.includes('<meta name="robots" content="noindex" />'));
        assert.ok(html.includes('window.IMPORT_SALE_CLOCK'));
        const initialPrices = [...html.matchAll(/data-sale-price-plain>([^<]+)</g)].map(match => match[1]);
        assert.ok(initialPrices.length > 0);
        assert.ok(initialPrices.every(value => value === (active ? '11,980' : '14,980')));
      }
    }
  }
}
assert.equal((await generatedWorker.fetch(new Request('https://promo.import-language.com/'), env)).status, 200);
const direct = await worker.fetch(new Request('https://promo.import-language.com/blackfriday'), env);
assert.ok((await direct.text()).includes('<meta name="robots" content="noindex" />'));
assert.equal((await worker.fetch(new Request('https://promo.import-language.com/images/hero-pc-bf.webp'), env)).headers.get('Content-Type'), 'image/webp');
console.log('OK emitted Worker: 36 boundary/alias/method cases, no-store, noindex, asset forwarding, query preservation');

// Local ASSETS adapter: tests Worker logic without deploying to Cloudflare.
const server = http.createServer(async (req, res) => {
  try {
    const response = await worker.fetch(new Request(`http://127.0.0.1${req.url}`, { method: req.method }), env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { res.writeHead(500); res.end(error.message); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let browser;
try {
  browser = await chromium.launch(fs.existsSync(chrome) ? { executablePath: chrome } : {});
  for (const width of [320, 390, 1440]) {
    for (const boundary of [start, end]) {
      serverNow = boundary - 1000;
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/Los_Angeles' });
      const page = await context.newPage();
      // A deliberately wrong device clock must not affect the homepage or its price.
      await page.clock.install({ time: new Date('2025-01-01T00:00:00Z') });
      await page.clock.pauseAt(new Date('2025-01-01T00:00:00Z'));
      await page.route('**/*', route => {
        if (new URL(route.request().url()).origin !== origin || route.request().resourceType() === 'media') return route.abort();
        return route.continue();
      });
      const url = `${origin}/?utm_campaign=bf-home-fixture&gclid=fixture#bundle`;
      await page.goto(url, { waitUntil: 'load' });
      const before = boundary === start ? 14980 : 11980;
      assert.equal(await page.evaluate(() => window.IMPORT_CURRENT_SALE.salePrice), before);
      assert.equal(await page.evaluate(() => document.body.dataset.lpVariant || 'index'), boundary === start ? 'index' : 'blackfriday');
      serverNow = boundary;
      const navigation = page.waitForEvent('load');
      await page.clock.runFor(1100);
      await navigation;
      assert.equal(page.url(), url);
      assert.equal(await page.evaluate(() => window.IMPORT_CURRENT_SALE.salePrice), boundary === start ? 11980 : 14980);
      assert.equal(await page.evaluate(() => document.body.dataset.lpVariant || 'index'), boundary === start ? 'blackfriday' : 'index');
      const ctas = await page.locator('[data-purchase-cta]').evaluateAll(els => els.map(el => el.href));
      assert.equal(ctas.length, 6);
      for (const href of ctas) {
        const link = new URL(href);
        assert.equal(link.searchParams.get('lp_page'), '/');
        assert.equal(link.searchParams.get('utm_campaign'), 'bf-home-fixture');
        assert.equal(link.searchParams.get('gclid'), 'fixture');
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1));
      // Restoring a tab from the back/forward cache forces a fresh server decision.
      const restore = page.waitForEvent('load');
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await restore;
      assert.equal(page.url(), url);
      console.log(`OK homepage ${width}px ${boundary === start ? 'start' : 'end'}: live reload, wrong device clock, UTM/hash/CTA, restored tab`);
      await context.close();
    }
  }
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
