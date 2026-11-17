#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const maxSize = 25 * 1024 * 1024;
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
const { home } = require('./pages.config.js');
if (home !== 'index') {
  const variants = require('./variants.config.js');
  if (!variants[home]) throw new Error(`pages.config.js: home "${home}" is not defined in variants.config.js`);
  if (variants[home].placeholder) throw new Error(`pages.config.js: "${home}" still has placeholder values and cannot be published as /`);
  const noindex = '<meta name="robots" content="noindex" />\n';
  const html = fs.readFileSync(path.join(root, `${home}.html`), 'utf8');
  if (html.split(noindex).length !== 2) throw new Error(`Expected exactly one noindex meta in ${home}.html`);
  fs.writeFileSync(path.join(output, 'index.html'), html.replace(noindex, ''));
  console.log(`Home (/) is served from ${home}.html.`);
}
fs.copyFileSync(path.join(root, 'cloudflare/_headers'), path.join(output, '_headers'));
console.log(`Built ${files.length} public files and _headers in dist/ (each <= 25 MiB).`);
