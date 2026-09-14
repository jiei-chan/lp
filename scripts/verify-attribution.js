#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Execute the real analytics IIFE with synthetic storage, DOM and event sinks.
// No browser, network, real click identifiers or analytics services are used.
const html = fs.readFileSync(process.env.LP_ATTRIBUTION_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('(function(){\n  const config = window.IMPORT_ANALYTICS_CONFIG;');
assert(start >= 0);
const source = html.slice(start, html.indexOf('</script>', start));
const storageKey = 'import_lp_attribution';
const now = Date.parse('2026-09-14T03:00:00Z');
const ttl = 90 * 24 * 60 * 60 * 1000;
const captured = new Date(now - 86400000).toISOString();
const oldMeta = { utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'fixture-old-campaign', utm_content: 'fixture-old-ad', utm_term: 'fixture-old-term', utm_id: 'fixture-old-id', fbclid: 'fixture-old-fb', captured_at: captured };
const oldGoogle = { ...oldMeta, utm_source: 'google', fbclid: undefined, gclid: 'fixture-old-g', gbraid: 'fixture-old-gb', wbraid: 'fixture-old-wb' };
const clone = value => JSON.parse(JSON.stringify(value));

function run(query = '', stored, blocked = '') {
  let raw = stored === undefined ? null : typeof stored === 'string' ? stored : JSON.stringify(stored);
  let writes = 0;
  const ga = [], meta = [], timers = [], scripts = [];
  const links = [...html.matchAll(/<a\b([^>]+)>/g)].flatMap((match) => {
    const href = match[1].match(/href="([^"]+)"/)?.[1];
    if (!href?.startsWith('https://www.import-language.com')) return [];
    const id = match[1].match(/data-purchase-cta="([^"]+)"/)?.[1];
    return [{ href, originalHref: href, id, target: '', listeners: {}, getAttribute: () => id,
      addEventListener(type, handler) { this.listeners[type] = handler; } }];
  });
  const window = {
    IMPORT_ANALYTICS_CONFIG: { ga4MeasurementId: 'fixture-ga', metaPixelId: 'fixture-meta' },
    IMPORT_GET_CURRENT_SALE: () => ({ salePrice: 10665 }),
    dataLayer: [], gtag: (...args) => ga.push(args), fbq: (...args) => meta.push(args),
    location: { search: query, protocol: 'https:', pathname: '/', href: 'fixture-lp' },
    setTimeout: (callback, delay) => timers.push({ callback, delay }),
    localStorage: {
      getItem() { if (blocked === 'all') throw new Error('fixture storage denied'); return raw; },
      setItem(key, value) { assert.equal(key, storageKey); if (blocked) throw new Error('fixture storage denied'); raw = value; writes++; }
    }
  };
  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  vm.runInNewContext(source, { window, URL, URLSearchParams, Date: FixtureDate,
    document: {
      createElement: () => ({}), head: { appendChild: script => scripts.push(script) },
      querySelectorAll: selector => selector === '[data-purchase-cta]' ? links.filter(link => link.id) : links.filter(link => !link.id)
    }
  });
  return { window, links, ctas: links.filter(link => link.id), ga, meta, timers, scripts, writes, raw };
}

function expectAttribution(result, expected) {
  for (const link of result.links) {
    const actual = Object.fromEntries(new URL(link.href).searchParams);
    if (link.id) {
      assert.equal(actual.lp_cta, link.id);
      assert.equal(actual.lp_page, '/');
      delete actual.lp_cta;
      delete actual.lp_page;
    }
    assert.deepEqual(actual, expected);
    assert.equal(new URL(link.href).pathname, new URL(link.originalHref).pathname);
  }
}

for (const [label, previous, current] of [
  ['Meta to OpenAI', oldMeta, { utm_source: 'chatgpt', utm_medium: 'cpc', utm_campaign: 'fixture-openai-campaign', utm_content: 'fixture-openai-ad', oppref: 'fixture-oppref' }],
  ['Google to LY', oldGoogle, { utm_source: 'ly', utm_medium: 'cpc', utm_campaign: 'fixture-ly-campaign', utm_content: 'fixture-ly-ad', yclid: 'fixture-yclid' }],
  ['Meta to LY without click ID', oldMeta, { utm_source: 'ly', utm_medium: 'cpc' }],
  ['Google to OpenAI without click ID', oldGoogle, { utm_source: 'chatgpt', utm_medium: 'cpc' }],
  ['same medium new ad', oldMeta, { utm_source: 'meta', utm_content: 'fixture-new-ad', fbclid: 'fixture-new-fb' }],
  ['same medium partial campaign', oldGoogle, { utm_campaign: 'fixture-new-campaign' }],
  ['click ID alone', oldMeta, { gclid: 'fixture-new-g' }],
  ['TikTok to OpenAI', { ...oldMeta, ttclid: 'fixture-old-tt' }, { utm_source: 'chatgpt' }],
  ['current conflicting IDs are not guessed away', oldMeta, { oppref: 'fixture-oppref', yclid: 'fixture-yclid' }]
]) {
  test(label, () => {
    const result = run('?' + new URLSearchParams(current), previous);
    expectAttribution(result, current);
    const saved = JSON.parse(result.raw);
    const expectedSaved = { ...current, captured_at: new Date(now).toISOString() };
    delete expectedSaved.oppref;
    delete expectedSaved.yclid;
    assert.deepEqual(saved, expectedSaved);
    assert.equal(result.writes, 1);
    delete expectedSaved.captured_at;
    const revisit = run('', saved);
    expectAttribution(revisit, expectedSaved);
    assert.equal(revisit.writes, 0);
  });
}

for (const key of ['yclid', 'oppref']) {
  test(`${key} alone clears old attribution without storing the new ID`, () => {
    const result = run(`?${key}=fixture-current`, oldMeta);
    expectAttribution(result, { [key]: 'fixture-current' });
    assert.deepEqual(JSON.parse(result.raw), { captured_at: new Date(now).toISOString() });
    expectAttribution(run('', result.raw), {});
  });
}

for (const query of ['', '?unrelated=fixture', '?utm_source=&oppref=']) {
  test(`direct revisit preserves attribution and original expiry (${query || 'no query'})`, () => {
    const result = run(query, oldMeta);
    const expected = clone(oldMeta);
    delete expected.captured_at;
    expectAttribution(result, expected);
    assert.equal(result.raw, JSON.stringify(oldMeta));
    assert.equal(result.writes, 0);
  });
}

for (const [label, stored] of [
  ['expired', { ...oldMeta, captured_at: new Date(now - ttl - 1).toISOString() }],
  ['no timestamp', { fbclid: 'fixture-old-fb' }],
  ['invalid timestamp', { ...oldMeta, captured_at: 'fixture-invalid' }],
  ['future timestamp', { ...oldMeta, captured_at: new Date(now + 1).toISOString() }],
  ['malformed JSON', '{fixture-invalid'], ['null JSON', 'null'], ['no storage', undefined]
]) {
  test(`${label} is not forwarded`, () => expectAttribution(run('', stored), {}));
}

test('exact 90-day boundary remains valid without extending expiry', () => {
  const stored = { utm_source: 'meta', captured_at: new Date(now - ttl).toISOString() };
  const result = run('', stored);
  expectAttribution(result, { utm_source: 'meta' });
  assert.equal(result.writes, 0);
});

test('stored allowlist excludes new IDs, unknown fields and non-string values', () => {
  expectAttribution(run('', { utm_source: 'chatgpt', oppref: 'fixture-old-op', yclid: 'fixture-old-y', extra: 'fixture-extra', fbclid: {}, captured_at: captured }), { utm_source: 'chatgpt' });
});

for (const blocked of ['all', 'write']) {
  test(`storage ${blocked} unavailable still forwards the current visit`, () => {
    const result = run('?utm_source=chatgpt&oppref=fixture-current', oldMeta, blocked);
    expectAttribution(result, { utm_source: 'chatgpt', oppref: 'fixture-current' });
    assert.equal(result.writes, 0);
  });
}
test('direct visit with inaccessible storage remains usable', () => expectAttribution(run('', oldMeta, 'all'), {}));

test('all six CTAs keep tracking payloads, sale price and delayed navigation', () => {
  const result = run('?utm_source=chatgpt&oppref=fixture-current', oldMeta);
  assert.deepEqual(result.ctas.map(link => link.id), ['header_sticky', 'hero_desktop', 'hero_mobile', 'bundle_anchor', 'final', 'sticky_offer']);
  assert.deepEqual(clone(result.meta), [['init', 'fixture-meta'], ['track', 'PageView']]);
  assert.equal(result.ga[0][0], 'js');
  assert.deepEqual(clone(result.ga[1]), ['config', 'fixture-ga']);
  for (const link of result.ctas) {
    let prevented = false;
    link.listeners.click({ button: 0, preventDefault() { prevented = true; } });
    assert(prevented);
    const payload = result.window.dataLayer.at(-1);
    assert.equal(payload.event, 'purchase_cta_click');
    assert.equal(payload.cta_id, link.id);
    assert.equal(payload.purchase_url, link.href);
    assert.equal(payload.value, 10665);
    assert.equal(payload.currency, 'JPY');
    assert.equal(result.ga.at(-1)[1], 'purchase_cta_click');
    assert.equal(result.ga.at(-1)[2].items[0].quantity, 1);
    assert.equal(result.meta.at(-1)[0], 'trackCustom');
    assert.equal(result.meta.at(-1)[1], 'PurchaseCtaClick');
    assert.equal(result.meta.at(-1)[2].value, 10665);
    const timer = result.timers.at(-1);
    assert.equal(timer.delay, 120);
    timer.callback();
    assert.equal(result.window.location.href, link.href);
  }
  assert.equal(result.window.dataLayer.length, 6);
  assert.equal(result.ga.length, 8);
  assert.equal(result.meta.length, 8);
});

test('modified clicks, prevented events and new tabs preserve native navigation', () => {
  const result = run();
  const link = result.ctas[0];
  for (const overrides of [{ button: 1 }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { defaultPrevented: true }, { target: '_blank' }]) {
    link.target = overrides.target || '';
    link.listeners.click({ button: 0, ...overrides, preventDefault() { assert.fail('native navigation was intercepted'); } });
  }
  assert.equal(result.timers.length, 0);
});
