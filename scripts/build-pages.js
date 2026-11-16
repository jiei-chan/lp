#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const maxSize = 25 * 1024 * 1024;
const files = ['index.html'];
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
fs.copyFileSync(path.join(root, 'cloudflare/_headers'), path.join(output, '_headers'));
console.log(`Built ${files.length} public files and _headers in dist/ (each <= 25 MiB).`);
