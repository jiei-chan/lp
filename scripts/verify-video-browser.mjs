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
const names = ['essential-verbs', 'toeic-vocab', 'nativedose'];
let origin = process.argv[2];
let server;
let browser;

try {
  if (!origin) {
    const source = fs.readFileSync(path.join(dist, '_worker.js'), 'utf8');
    const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const routes = JSON.parse(fs.readFileSync(path.join(dist, '_routes.json'))).include;
    const mime = { '.html': 'text/html', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
    const env = { ASSETS: { fetch(request) {
      let pathname = new URL(request.url).pathname;
      if (pathname === '/') pathname = '/index.html';
      else if (!path.extname(pathname)) pathname += '.html';
      const filename = path.resolve(dist, '.' + pathname);
      if (!filename.startsWith(dist + path.sep) || !fs.existsSync(filename)) return new Response(null, { status: 404 });
      const bytes = fs.readFileSync(filename);
      // Deliberately ignore Range, just like the Pages response that caused the defect.
      return new Response(request.method === 'HEAD' ? null : bytes, { headers: {
        'Content-Type': mime[path.extname(filename)] || 'application/octet-stream',
        'Content-Length': String(bytes.length), ETag: '"fixture"',
      } });
    } } };
    server = http.createServer(async (req, res) => {
      try {
        const request = new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers: req.headers });
        const response = await (routes.includes(new URL(request.url).pathname) ? worker.fetch(request, env) : env.ASSETS.fetch(request));
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) { res.writeHead(500); res.end(error.message); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  origin = new URL(origin).origin;
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch(fs.existsSync(chrome) ? { executablePath: chrome } : {});
  const context = await browser.newContext();
  // Only the LP and its own assets may be requested. Never send fixture analytics.
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  for (const name of names) {
    const file = `videos/preview-${name}.mp4`;
    const response = await context.request.get(`${origin}/${file}`, { headers: { Range: 'bytes=1048576-1049599' } });
    assert.equal(response.status(), 206, `${name}: partial response`);
    const expected = fs.readFileSync(path.join(root, file));
    assert.equal(response.headers()['content-range'], `bytes 1048576-1049599/${expected.length}`);
    assert.deepEqual(await response.body(), expected.subarray(1048576, 1049600));
  }
  console.log('OK real video fragments: 206, Content-Range, exact bytes for all three previews');
  for (const width of [390, 1440]) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/blackfriday`, { waitUntil: 'load' });
    for (const name of names) {
      const card = page.locator(`.inside-product[data-modal-src="videos/preview-${name}.mp4"]`);
      await card.scrollIntoViewIfNeeded();
      await page.waitForFunction(name => {
        const v = document.querySelector(`[data-modal-src="videos/preview-${name}.mp4"] video`);
        return v && !v.paused && v.currentTime > 0;
      }, name, { timeout: 15000 });
      await card.click();
      await page.waitForFunction(() => {
        const v = document.querySelector('.video-modal-player');
        return !v.paused && v.currentTime > 0.3 && v.readyState >= 2;
      }, null, { timeout: 15000 });
      const video = page.locator('.video-modal-player');
      const duration = await video.evaluate(v => { v.pause(); return v.duration; });
      for (const target of [duration * 0.75, 3]) {
        await video.evaluate((v, target) => { v.currentTime = target; }, target);
        await page.waitForFunction(target => {
          const v = document.querySelector('.video-modal-player');
          return !v.seeking && v.readyState >= 2 && Math.abs(v.currentTime - target) < 0.5;
        }, target, { timeout: 15000 });
      }
      assert.equal(await video.evaluate(v => v.error), null);
      await page.keyboard.press('Escape');
      console.log(`OK ${width}px ${name}: inline play, modal play, seek to 75%, seek back to 3s, close`);
    }
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
