#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const maxSize = 25 * 1024 * 1024;
const variants = require('./variants.config.js');
const { home, scheduledPage } = require('./pages.config.js');
let homeSchedule;
if (home === 'scheduled') {
  const def = variants[scheduledPage];
  const period = def?.sale?.periods?.[0];
  if (!def || def.placeholder || def.sale?.mode !== 'scheduled' || def.sale.periods.length !== 1
    || !Number.isFinite(Date.parse(period?.startAt)) || !Number.isFinite(Date.parse(period?.endAt))
    || Date.parse(period.startAt) >= Date.parse(period.endAt)) {
    throw new Error('Scheduled home requires one confirmed sale period with valid startAt/endAt');
  }
  const regularPrice = def.sale.regularPrice;
  const salePrice = period.salePrice;
  const savings = regularPrice - salePrice;
  const percent = Math.round(savings / regularPrice * 100);
  if (!Number.isInteger(regularPrice) || !Number.isInteger(salePrice) || salePrice <= 0 || savings < 0
    || (period.savings !== undefined && period.savings !== savings)
    || (period.percent !== undefined && period.percent !== percent)) throw new Error('Inconsistent scheduled sale prices');
  homeSchedule = {
    page: scheduledPage, startAt: period.startAt, endAt: period.endAt,
    offer: { regularPrice, salePrice, savings, percent },
  };
} else if (home !== 'index' && (!variants[home] || variants[home].placeholder)) {
  throw new Error(`Invalid or placeholder homepage: ${home}`);
}
// Never publish stale prices or omit a newly generated variant.
require('node:child_process').execFileSync(process.execPath, [path.join(__dirname, 'build-variants.js'), '--check'], { stdio: 'inherit' });
// ペルソナ別ページ（scripts/build-variants.js の生成物）も公開対象。定義から列挙する。
const variantPages = Object.keys(require('./variants.config.js')).map(name => `${name}.html`);
const files = ['index.html', ...variantPages];
const extensions = {
  images: new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg', '.ico']),
  videos: new Set(['.mp4', '.webm']),
};

// Only explicitly supported public assets may enter the deployment directory.
function collect(directory, allowed) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const relative = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink is not a public asset: ${relative}`);
    if (entry.isDirectory()) collect(relative, allowed);
    else if (allowed.has(path.extname(entry.name).toLowerCase())) files.push(relative);
    else throw new Error(`Unsupported public asset: ${relative}`);
  }
}
for (const [directory, allowed] of Object.entries(extensions)) collect(directory, allowed);

for (const relative of [...files, 'cloudflare/_headers']) {
  const stat = fs.lstatSync(path.join(root, relative));
  if (!stat.isFile() || stat.size > maxSize) throw new Error(`Invalid asset or exceeds 25 MiB: ${relative}`);
}

// This directory is generated, ignored by Git, and never contains source files.
if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) {
  throw new Error('Refusing to build into a symlink: dist');
}
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output);
for (const relative of files) {
  const destination = path.join(output, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, relative), destination);
}

// トップ（/）の差し替え。派生ページは広告用に noindex 付きなので、/ に出すときは外す。
if (home !== 'index' && home !== 'scheduled') {
  if (!variants[home]) throw new Error(`pages.config.js: home "${home}" is not defined in variants.config.js`);
  if (variants[home].placeholder) throw new Error(`pages.config.js: "${home}" still has placeholder values and cannot be published as /`);
  const noindex = '<meta name="robots" content="noindex" />\n';
  const html = fs.readFileSync(path.join(root, `${home}.html`), 'utf8');
  if (html.split(noindex).length !== 2) throw new Error(`Expected exactly one noindex meta in ${home}.html`);
  fs.writeFileSync(path.join(output, 'index.html'), html.replace(noindex, ''));
  console.log(`Home (/) is served from ${home}.html.`);
}
// Keep video seeking available even when the homepage is pinned to a static version.
const videoPaths = files.filter(file => file.startsWith('videos/')).map(file => `/${file}`);
const videoSource = fs.readFileSync(path.join(root, 'cloudflare/video-worker.mjs'), 'utf8');
const homeSource = homeSchedule ? fs.readFileSync(path.join(root, 'cloudflare/home-worker.mjs'), 'utf8') : '';
const nextWorker = homeSchedule ? `createHomeWorker(${JSON.stringify(homeSchedule)})`
  : '{ fetch: (request, env) => env.ASSETS.fetch(request) }';
fs.writeFileSync(path.join(output, '_worker.js'), `${homeSource}\n${videoSource}\nexport default createVideoWorker(${nextWorker}, ${JSON.stringify(videoPaths)});\n`);
fs.writeFileSync(path.join(output, '_routes.json'), JSON.stringify({
  version: 1, include: [...(homeSchedule ? ['/', '/index', '/index.html'] : []), ...videoPaths], exclude: [],
}, null, 2) + '\n');
if (homeSchedule) {
  console.log(`Home (/) switches to ${homeSchedule.page} from ${homeSchedule.startAt} until ${homeSchedule.endAt}.`);
}
fs.copyFileSync(path.join(root, 'cloudflare/_headers'), path.join(output, '_headers'));
console.log(`Built ${files.length} public files and _headers in dist/ (each <= 25 MiB).`);
