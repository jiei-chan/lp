#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const codexPlaywrightPath = '/Users/uchida/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const defaultChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(codexPlaywrightPath));
}

const targetUrl = process.argv[2] || process.env.LP_URL || 'http://localhost:4173';
const cases = [
  ['week-1', '2026-08-17T13:00:00+09:00', 10080, 6280, 38, true],
  ['week-2', '2026-08-24T09:00:00+09:00', 10230, 6130, 37, true],
  ['week-3', '2026-08-31T09:00:00+09:00', 10380, 5980, 36, true],
  ['week-4', '2026-09-07T09:00:00+09:00', 10530, 5830, 35, true],
  ['week-5', '2026-09-14T09:00:00+09:00', 10665, 5695, 34, true],
  ['september-offer', '2026-09-21T09:00:00+09:00', 10765, 5595, 34, true],
  ['september-offer', '2026-09-24T08:59:59+09:00', 10765, 5595, 34, true],
];

// These fixtures express the approved prices independently of the page configuration.
const autumnSchedule = [
  ['2026-09-24', '2026-10-05', 10965, 33],
  ['2026-10-05', '2026-10-12', 11099, 32],
  ['2026-10-12', '2026-10-19', 11199, 31],
  ['2026-10-19', '2026-10-26', 11399, 30],
  ['2026-10-26', '2026-11-02', 11499, 29],
  ['2026-11-02', '2026-11-09', 11699, 28],
  ['2026-11-09', '2026-11-16', 11999, 26],
  ['2026-11-16', '2026-11-24', 12099, 26],
];
for (const [start, end, price, percent] of autumnSchedule) {
  const deadline = `${end}T09:00:00+09:00`;
  for (const now of [`${start}T09:00:00+09:00`, `${end}T08:59:59+09:00`]) {
    cases.push([`autumn-${start.slice(5)}`, now, price, 16360 - price, percent, true, deadline]);
  }
}
cases.push(['autumn-09-24', '2026-09-28T12:00:00+09:00', 10965, 5395, 33, true, '2026-10-05T09:00:00+09:00']);
cases.push(['after-ladder', '2026-11-24T09:00:00+09:00', 12199, 4161, 25, false]);
cases.push(['after-ladder', '2026-12-01T09:00:00+09:00', 12199, 4161, 25, false]);

function assert(condition, message, details) {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(details)}`);
}

(async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const forbiddenPricingCopy = /第[1-5]週|今週は|priceShiftNote|sticky-price-shift-note|9:00から\s*¥/;
  assert(!forbiddenPricingCopy.test(source), 'week or upcoming-price copy must stay out of the LP', {
    match: source.match(forbiddenPricingCopy)?.[0],
  });

  const launchOptions = fs.existsSync(defaultChromePath)
    ? { executablePath: defaultChromePath }
    : {};
  const browser = await chromium.launch(launchOptions);

  try {
    for (const [phase, now, price, savings, percent, scheduled, deadline] of cases) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await page.addInitScript((value) => {
        window.IMPORT_SALE_NOW = value;
      }, now);
      // Keep local checks from sending analytics to external services.
      await page.route('**/*', route => {
        // Video playback is unrelated to pricing and can keep networkidle pending.
        if (route.request().resourceType() === 'media') return route.abort();
        return new URL(route.request().url()).origin === new URL(targetUrl).origin
          ? route.continue()
          : route.abort();
      });
      await page.goto(targetUrl, { waitUntil: 'networkidle' });

      const actual = await page.evaluate(() => ({
        endAt: window.IMPORT_CURRENT_SALE?.endAt,
        deadlines: [...document.querySelectorAll('[data-sale-deadline-long]')].map(el => el.textContent),
        timers: [
          ['sticky-cd-days', 'sticky-cd-hours', 'sticky-cd-min', 'sticky-cd-sec'],
          ['cd-days', 'cd-hours', 'cd-min', 'cd-sec'],
          ['cd-d', 'cd-h', 'cd-m', 'cd-s'],
        ].map(ids => ids.map(id => Number(document.getElementById(id).textContent))),
        phase: window.IMPORT_CURRENT_SALE?.phase,
        price: window.IMPORT_CURRENT_SALE?.salePrice,
        savings: window.IMPORT_CURRENT_SALE?.savings,
        percent: window.IMPORT_CURRENT_SALE?.percent,
        bodyClass: document.body.className,
        prices: [...document.querySelectorAll('[data-sale-price-plain]')].map((el) => el.textContent.trim()),
        regularPrices: [...document.querySelectorAll('[data-sale-regular-price]')].map((el) => el.textContent.trim()),
        savingsPrices: [...document.querySelectorAll('[data-sale-savings-price]')].map((el) => el.textContent.trim()),
        savingsYen: [...document.querySelectorAll('[data-sale-savings-yen]')].map((el) => el.textContent.trim()),
        percents: [...document.querySelectorAll('[data-sale-percent]')].map((el) => el.textContent.trim()),
        countdownDisplay: getComputedStyle(document.querySelector('.final-countdown')).display,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));

      if (deadline) {
        assert(actual.endAt === deadline, 'deadline mismatch', { now, actual });
        const seconds = (new Date(deadline) - new Date(now)) / 1000;
        const expected = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
        assert(actual.timers.every(timer => JSON.stringify(timer) === JSON.stringify(expected)), 'countdown mismatch', { now, expected, actual });
        assert(actual.deadlines.every(value => value.includes('午前9:00まで')), 'deadline label mismatch', { now, actual });
      }
      assert(actual.phase === phase, 'phase mismatch', { phase, actual });
      assert(actual.price === price, 'price mismatch', { phase, actual });
      assert(actual.savings === savings, 'savings mismatch', { phase, actual });
      assert(actual.percent === percent, 'percent mismatch', { phase, actual });
      assert(actual.prices.every((value) => value === price.toLocaleString('ja-JP')), 'rendered price mismatch', { phase, actual });
      assert(actual.regularPrices.every((value) => value === '¥16,360'), 'regular price mismatch', { phase, actual });
      assert(actual.savingsPrices.every((value) => value === `¥${savings.toLocaleString('ja-JP')}`), 'rendered savings mismatch', { phase, actual });
      assert(actual.savingsYen.every((value) => value === `${savings.toLocaleString('ja-JP')}円`), 'rendered savings yen mismatch', { phase, actual });
      assert(actual.percents.every((value) => value === String(percent)), 'rendered percent mismatch', { phase, actual });
      assert(scheduled ? actual.bodyClass.includes('sale-mode-scheduled') : actual.bodyClass.includes('sale-mode-discount-only'), 'sale mode mismatch', { phase, actual });
      assert(scheduled ? actual.countdownDisplay !== 'none' : actual.countdownDisplay === 'none', 'countdown visibility mismatch', { phase, actual });
      assert(actual.overflow <= 1, 'desktop horizontal overflow', { phase, actual });

      console.log(`OK ${phase}: ¥${price.toLocaleString('ja-JP')} / ¥${savings.toLocaleString('ja-JP')} OFF / ${percent}%`);
      // Exercise the real interval-driven transition without a reload.
      if (deadline && now.includes('08:59:59')) {
        const next = cases.find(entry => entry[1] === deadline);
        assert(Boolean(next), 'missing next-boundary fixture', { deadline });
        await page.evaluate(value => { window.IMPORT_SALE_NOW = value; }, deadline);
        await page.waitForFunction(price => window.IMPORT_CURRENT_SALE.salePrice === price, next[2]);
        const mode = await page.evaluate(() => ({
          scheduled: document.body.classList.contains('sale-mode-scheduled'),
          countdownHidden: getComputedStyle(document.querySelector('.final-countdown')).display === 'none',
        }));
        assert(mode.scheduled === next[5] && mode.countdownHidden === !next[5], 'live transition mode mismatch', { deadline, mode });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
