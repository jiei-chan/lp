#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const codexPlaywrightPath = '/Users/uchida/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const defaultChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  try {
    ({ chromium } = require(codexPlaywrightPath));
  } catch (fallbackError) {
    console.error('Playwright is required. Install it for this project, or run in the Codex runtime where bundled Playwright is available.');
    process.exit(1);
  }
}

const targetUrl = process.argv[2] || process.env.LP_URL || 'http://localhost:4173';
const screenshotDir = process.env.SCREENSHOT_DIR || '';
const chromeExecutablePath = process.env.CHROME_EXECUTABLE_PATH
  || (fs.existsSync(defaultChromePath) ? defaultChromePath : '');

const viewports = [
  { name: 'mobile-320', width: 320, height: 760 },
  { name: 'mobile-390', width: 390, height: 844 },
];

function fail(message, details = {}) {
  const suffix = Object.keys(details).length ? ` ${JSON.stringify(details)}` : '';
  throw new Error(`${message}${suffix}`);
}

(async () => {
  const launchOptions = chromeExecutablePath
    ? { executablePath: chromeExecutablePath }
    : {};

  const browser = await chromium.launch(launchOptions);

  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2,
        isMobile: true,
      });

      await page.goto(targetUrl, { waitUntil: 'networkidle' });

      const metrics = await page.evaluate(() => {
        const nav = document.querySelector('.nav');
        const hero = document.querySelector('.hero');
        const heroTitle = document.querySelector('.hero h1');
        const heroBelow = document.querySelector('.hero-below');
        const heroTagline = document.querySelector('.hero-tagline-m');
        const stickyCta = document.querySelector('.sticky-cta');
        const bodyWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;

        return {
          titleText: heroTitle ? heroTitle.innerText : '',
          navDisplay: nav ? getComputedStyle(nav).display : null,
          navPosition: nav ? getComputedStyle(nav).position : null,
          navBottom: nav ? nav.getBoundingClientRect().bottom : null,
          navCtaText: nav ? nav.querySelector('.nav-purchase')?.innerText.trim() : '',
          stickyVisibleInitially: stickyCta ? stickyCta.classList.contains('visible') : null,
          scrollOverflow: scrollWidth - bodyWidth,
          heroHeight: hero ? hero.getBoundingClientRect().height : 0,
          heroTop: hero ? hero.getBoundingClientRect().top : null,
          titleTop: heroTitle ? heroTitle.getBoundingClientRect().top : null,
          titleBottom: heroTitle ? heroTitle.getBoundingClientRect().bottom : null,
          heroBelowTop: heroBelow ? heroBelow.getBoundingClientRect().top : null,
          taglineTop: heroTagline ? heroTagline.getBoundingClientRect().top : null,
        };
      });

      if (!metrics.titleText.includes('英単語は忘れない')) {
        fail('Mobile hero title is missing the key copy.', { viewport: viewport.name, titleText: metrics.titleText });
      }
      if (metrics.navDisplay === 'none' || metrics.navPosition !== 'fixed') {
        fail('Mobile header CTA must stay visible and fixed without joining the hero layout flow.', {
          viewport: viewport.name,
          navDisplay: metrics.navDisplay,
          navPosition: metrics.navPosition,
        });
      }
      if (!metrics.navCtaText.includes('完全版を手に入れる')) {
        fail('Mobile header CTA copy is missing.', { viewport: viewport.name, navCtaText: metrics.navCtaText });
      }
      if (metrics.titleTop <= metrics.navBottom + 16) {
        fail('Mobile header CTA is too close to the hero title.', {
          viewport: viewport.name,
          navBottom: metrics.navBottom,
          titleTop: metrics.titleTop,
        });
      }
      if (metrics.stickyVisibleInitially !== true) {
        fail('Sticky offer CTA should be visible from the initial view.', { viewport: viewport.name, stickyVisibleInitially: metrics.stickyVisibleInitially });
      }
      if (metrics.scrollOverflow > 1) {
        fail('Mobile layout has horizontal overflow.', { viewport: viewport.name, scrollOverflow: metrics.scrollOverflow });
      }
      if (metrics.heroHeight < viewport.width * 2.35 || metrics.heroHeight > viewport.width * 2.45) {
        fail('Mobile hero height drifted from the locked 240vw image frame.', { viewport: viewport.name, heroHeight: metrics.heroHeight });
      }
      if (metrics.titleTop < 0 || metrics.titleTop > viewport.height * 0.24) {
        fail('Mobile hero title moved out of the intended upper area.', { viewport: viewport.name, titleTop: metrics.titleTop });
      }
      if (metrics.titleBottom > viewport.height * 0.4) {
        fail('Mobile hero title moved too close to the character/product area.', {
          viewport: viewport.name,
          titleBottom: metrics.titleBottom,
        });
      }
      if (metrics.taglineTop <= metrics.titleBottom + 120) {
        fail('Mobile lower copy is too close to the hero title.', {
          viewport: viewport.name,
          titleBottom: metrics.titleBottom,
          taglineTop: metrics.taglineTop,
        });
      }

      if (screenshotDir) {
        fs.mkdirSync(screenshotDir, { recursive: true });
        await page.screenshot({
          path: path.join(screenshotDir, `${viewport.name}.png`),
          fullPage: false,
        });
      }

      await page.close();
      console.log(`OK ${viewport.name}`);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
