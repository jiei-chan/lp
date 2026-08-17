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
  ['week-1', '2026-08-17T13:00:00+09:00', 10080, 3880, 27, true],
  ['week-2', '2026-08-24T09:00:00+09:00', 10230, 3730, 26, true],
  ['week-3', '2026-08-31T09:00:00+09:00', 10380, 3580, 25, true],
  ['week-4', '2026-09-07T09:00:00+09:00', 10530, 3430, 24, true],
  ['week-5', '2026-09-14T09:00:00+09:00', 10665, 3295, 23, true],
  ['after-ladder', '2026-09-21T09:00:00+09:00', 10700, 3260, 23, false],
];

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
    for (const [phase, now, price, savings, percent, scheduled] of cases) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await page.addInitScript((value) => {
        window.IMPORT_SALE_NOW = value;
      }, now);
      await page.goto(targetUrl, { waitUntil: 'networkidle' });

      const actual = await page.evaluate(() => ({
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

      assert(actual.phase === phase, 'phase mismatch', { phase, actual });
      assert(actual.price === price, 'price mismatch', { phase, actual });
      assert(actual.savings === savings, 'savings mismatch', { phase, actual });
      assert(actual.percent === percent, 'percent mismatch', { phase, actual });
      assert(actual.prices.every((value) => value === price.toLocaleString('ja-JP')), 'rendered price mismatch', { phase, actual });
      assert(actual.regularPrices.every((value) => value === '¥13,960'), 'regular price mismatch', { phase, actual });
      assert(actual.savingsPrices.every((value) => value === `¥${savings.toLocaleString('ja-JP')}`), 'rendered savings mismatch', { phase, actual });
      assert(actual.savingsYen.every((value) => value === `${savings.toLocaleString('ja-JP')}円`), 'rendered savings yen mismatch', { phase, actual });
      assert(actual.percents.every((value) => value === String(percent)), 'rendered percent mismatch', { phase, actual });
      assert(scheduled ? actual.bodyClass.includes('sale-mode-scheduled') : actual.bodyClass.includes('sale-mode-discount-only'), 'sale mode mismatch', { phase, actual });
      assert(scheduled ? actual.countdownDisplay !== 'none' : actual.countdownDisplay === 'none', 'countdown visibility mismatch', { phase, actual });
      assert(actual.overflow <= 1, 'desktop horizontal overflow', { phase, actual });

      console.log(`OK ${phase}: ¥${price.toLocaleString('ja-JP')} / ¥${savings.toLocaleString('ja-JP')} OFF / ${percent}%`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
