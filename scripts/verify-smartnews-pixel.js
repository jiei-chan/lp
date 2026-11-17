#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/<script>\s*(\(function initSmartNewsPageView\(\)\{[\s\S]*?)<\/script>/)[1];
const pixelId = 'ea7ac8b73db4d3663fc7db75';
function fixture(hostname = 'promo.import-language.com', existingPixel) {
  const scripts = [];
  const firstScript = { parentNode: { insertBefore: script => scripts.push(script) } };
  const window = { location: { hostname } };
  if (existingPixel) window.SmartnewsAds = { p: existingPixel };
  const context = { window, document: {
    createElement: () => ({}), getElementsByTagName: () => [firstScript]
  } };
  vm.runInNewContext(source, context);
  return { scripts, window, context };
}
test('head bootstrap queues only one PageView and loads one asynchronous SDK, including re-execution', () => {
  assert(html.indexOf(source) < html.indexOf('</head>'));
  assert.equal((html.match(/cdn\.smartnews-ads\.com\/i\/pixel\.js/g) || []).length, 1);
  const f = fixture();
  vm.runInNewContext(source, f.context);
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].src, 'https://cdn.smartnews-ads.com/i/pixel.js');
  assert.equal(f.scripts[0].async, true);
  assert.deepEqual(Array.from(f.window.SmartnewsAds.p.queue, args => Array.from(args)), [[pixelId, 'PageView']]);
});
test('reuses an existing SDK without replacing it or loading it twice', () => {
  const events = [];
  const p = (...args) => events.push(args);
  const f = fixture(undefined, p);
  vm.runInNewContext(source, f.context);
  assert.equal(f.window.SmartnewsAds.p, p);
  assert.equal(f.scripts.length, 0);
  assert.deepEqual(events, [[pixelId, 'PageView']]);
});
for (const host of ['localhost', '127.0.0.1', '', 'preview.vercel.app', 'www.import-language.com']) {
  test(`does not initialize on ${host || 'file preview'}`, () => {
    const f = fixture(host);
    assert.equal(f.scripts.length, 0);
    assert.equal(f.window.SmartnewsAds, undefined);
  });
}
test('every inline script parses (this plain HTML repository has no typecheck/lint setup)', () => {
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
