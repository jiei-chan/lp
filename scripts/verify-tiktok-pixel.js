#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('(function initTikTokPageView(){');
assert(start >= 0);
const source = html.slice(start, html.indexOf('\n})();', start) + '\n})();'.length);

// Execute the real integration with no browser or network and synthetic data only.
function fixture({ hostname = 'promo.import-language.com', protocol = 'https:', pixelId = 'fixture-pixel', existing, existingScript = false } = {}) {
  const scripts = [], warnings = [];
  const window = {
    location: { hostname, protocol }, IMPORT_ANALYTICS_CONFIG: { tiktokPixelId: pixelId },
    get localStorage() { throw Error('Pixel bootstrap must not read consent storage'); }
  };
  if (existing) window.ttq = existing;
  const context = { window, console: { warn: message => warnings.push(message) }, document: {
    querySelector: () => existingScript ? {} : null,
    createElement: () => ({}), head: { appendChild: script => scripts.push(script) }
  } };
  vm.runInNewContext(source, context);
  return { window, scripts, warnings, context, queue: () => JSON.parse(JSON.stringify(window.ttq || [])) };
}

test('production automatically loads the configured pixel and queues one page view', () => {
  const f = fixture();
  assert.equal(f.scripts.length, 1);
  const url = new URL(f.scripts[0].src);
  assert.equal(url.origin, 'https://analytics.tiktok.com');
  assert.equal(url.searchParams.get('sdkid'), 'fixture-pixel');
  assert.equal(f.scripts[0].async, true);
  assert.deepEqual(f.queue(), [['page']]);
  vm.runInNewContext(source, f.context);
  assert.equal(f.scripts.length, 1);
  assert.deepEqual(f.queue(), [['page']]);
});
for (const hostname of ['localhost', '127.0.0.1', '', 'preview.vercel.app', 'www.import-language.com', 'promo.import-language.com.evil.example']) {
  test(`no sending from ${hostname || 'file preview'}`, () => {
    const f = fixture({ hostname });
    assert.equal(f.scripts.length, 0);
    assert.equal(f.window.ttq, undefined);
  });
}
test('HTTP and empty configuration disable the pixel', () => {
  assert.equal(fixture({ protocol: 'http:' }).scripts.length, 0);
  assert.equal(fixture({ pixelId: '' }).scripts.length, 0);
});
for (const existing of [[], { page() { throw Error('must not call another install'); } }]) {
  test('does not replace an existing queue or SDK or send a duplicate page view', () => {
    const f = fixture({ existing });
    assert.equal(f.window.ttq, existing);
    assert.equal(f.scripts.length, 0);
    assert.match(f.warnings[0], /Existing/);
  });
}
test('an existing script is not loaded twice', () => {
  assert.equal(fixture({ existingScript: true }).scripts.length, 0);
});
test('SDK failure does not throw or retry', () => {
  const f = fixture();
  f.scripts[0].onerror();
  assert.match(f.warnings[0], /could not load/);
  vm.runInNewContext(source, f.context);
  assert.equal(f.scripts.length, 1);
});
test('one production pixel configuration; no commerce, identify or consent calls/UI', () => {
  assert.equal((html.match(/tiktokPixelId: "DBNU0BJC77UBRT4SAQK0"/g) || []).length, 1);
  assert(!/ttq\.(track|identify|holdConsent|grantConsent|revokeConsent)\s*\(/.test(html));
  assert(!html.includes('tiktok-consent'));
  assert(!html.includes('import_lp_tiktok_consent'));
});
