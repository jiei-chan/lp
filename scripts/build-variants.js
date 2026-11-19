#!/usr/bin/env node
// index.html（正本）からペルソナ別LPを生成する。index.html は読むだけで書き換えない。
//
//   node scripts/build-variants.js          # <name>.html を生成
//   node scripts/build-variants.js --check  # 生成物が index.html と定義に追従しているか検査
//
// 価格・締切・計測などは index.html を直してから再実行すれば全ページに反映される。
// 想定した箇所が index.html から消えていた場合は、黙って崩さずエラーで止まる。

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const variants = require('./variants.config.js');
const canonicalUrl = 'https://promo.import-language.com/';

const markerKeys = [
  ['NAV', 'nav'],
  ['HERO (DARK', 'hero'],
  ['HERO BELOW', 'heroBelow'],
  ['ACHIEVEMENT', 'achievement'],
  ['WHAT IS INSIDE', 'inside'],
  ['AUTHORITY', 'authority'],
  ['EMPATHY', 'empathy'],
  ['PROBLEM 3', 'problem3'],
  ['REAL PROBLEM', 'realProblem'],
  ['REALIZATION', 'realization'],
  ['SOLUTION', 'solution'],
  ['TEXTBOOK', 'textbook'],
  ['SCIENCE', 'science'],
  ['PRODUCTS', 'products'],
  ['BUNDLE', 'bundle'],
  ['COMMUNITY', 'community'],
  ['VOICES', 'voices'],
  ['FAQ', 'faq'],
  ['FINAL CTA', 'final'],
  ['FOOTER', 'footer'],
  ['STICKY', 'sticky'],
];
const fixedTail = ['footer', 'sticky'];

function fail(message) {
  throw new Error(message);
}

function splitSource(html) {
  const markers = [...html.matchAll(/<!-- ========== (.+?) ========== -->/g)];
  if (markers.length !== markerKeys.length) {
    fail(`セクション区切りコメントが ${markers.length} 個（想定 ${markerKeys.length} 個）。index.html の構成が変わっています。`);
  }
  const chunks = {};
  markers.forEach((marker, i) => {
    const [prefix, key] = markerKeys[i];
    if (!marker[1].startsWith(prefix)) {
      fail(`${i + 1} 番目の区切りが "${marker[1]}"（想定 "${prefix}…"）。`);
    }
    const end = i + 1 < markers.length ? markers[i + 1].index : html.length;
    chunks[key] = html.slice(marker.index, end);
  });
  return { head: html.slice(0, markers[0].index), chunks };
}

// pattern にちょうど1回一致する箇所を置き換える。
function replaceOnce(text, pattern, replacement, label) {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  const matches = [...text.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length !== 1) fail(`${label}: 一致が ${matches.length} 箇所（想定 1 箇所）。`);
  const match = matches[0];
  const value = typeof replacement === 'function' ? replacement(match) : replacement;
  return text.slice(0, match.index) + value + text.slice(match.index + match[0].length);
}

// 繰り返し要素（カード等）を order（1始まり）の順に並べ直す。order に無い要素は載らない。
function reorder(text, itemPattern, expected, order, label) {
  const items = [...text.matchAll(itemPattern)];
  if (items.length !== expected) fail(`${label}: 要素が ${items.length} 個（想定 ${expected} 個）。`);
  if (new Set(order).size !== order.length || order.some(n => !Number.isInteger(n) || n < 1 || n > expected)) {
    fail(`${label}: 並び順 [${order}] が不正（1〜${expected} を重複なしで）。`);
  }
  const start = items[0].index;
  const last = items[items.length - 1];
  const lineStart = text.lastIndexOf('\n', start) + 1;
  const indent = text.slice(lineStart, start);
  const picked = order.map(n => items[n - 1][0]).join('\n\n' + indent);
  return text.slice(0, start) + picked + text.slice(last.index + last[0].length);
}

function escapeAttr(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// salePreviewBeforeStart: 本番のドメイン以外では、まだ始まっていないセール期間を「開始済み」として扱う。
// 開始前にプレビューで価格とカウントダウンを確認するためのもの。本番（import-language.com とそのサブドメイン）では何もしない。
const previewBeforeStartScript = `
(function(){
  if (/(^|\\.)import-language\\.com$/.test(window.location.hostname)) return;
  var now = Date.now();
  window.IMPORT_SALE_CONFIG.periods.forEach(function(period){
    if (period.startAt && new Date(period.startAt).getTime() > now && new Date(period.endAt).getTime() > now) {
      period.startAt = '2000-01-01T00:00:00+09:00';
    }
  });
})();`;

function build(name, def, source) {
  const { chunks } = source;
  let head = source.head;
  const c = { ...chunks };
  // 派生ページ専用のセクション（index.html に無いもの）。{ キー: 'ファイル名' } を scripts/variant-sections/ から読む。
  Object.entries(def.extraSections || {}).forEach(([key, file]) => {
    if (key in c) fail(`${name}: extraSections のキー "${key}" は既存セクションと重複しています。`);
    c[key] = fs.readFileSync(path.join(__dirname, 'variant-sections', file), 'utf8');
  });
  const at = label => `${name}: ${label}`;

  // --- head ---
  head = replaceOnce(head, /<!DOCTYPE html>\n/, m =>
    `${m[0]}<!-- GENERATED: index.html から scripts/build-variants.js が生成（定義は scripts/variants.config.js）。直接編集しない。 -->\n`, at('doctype'));
  if (def.title) head = replaceOnce(head, /<title>[^<]*<\/title>/, `<title>${def.title}</title>`, at('title'));
  if (def.description) {
    head = replaceOnce(head, /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeAttr(def.description)}" />`, at('description'));
  }
  // 広告用の派生ページ。検索には正本だけを載せる。
  head = replaceOnce(head, /<\/title>\n/, m =>
    `${m[0]}<meta name="robots" content="noindex" />\n<link rel="canonical" href="${canonicalUrl}" />\n`, at('robots'));
  head = replaceOnce(head, /<body class="([^"]*)">/, m =>
    `<body class="${m[1]}${def.theme ? ` theme-${def.theme}` : ''}" data-lp-variant="${name}">` +
    (def.placeholder ? '\n<div class="variant-placeholder-note">仮の価格・期間です（未確定）</div>' : ''), at('body'));
  // テーマCSSは既存の <style> の後ろに足す（同じ詳細度なら後勝ち）。
  if (def.theme) {
    const css = fs.readFileSync(path.join(__dirname, 'variant-themes', `${def.theme}.css`), 'utf8');
    // 波かっこの対応を検査する。余分な } が1つあるだけで、ブラウザは直後の指定を黙って無視する。
    let depth = 0;
    css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).split('\n').forEach((line, i) => {
      for (const ch of line) {
        if (ch === '{') depth += 1;
        else if (ch === '}' && --depth < 0) fail(at(`テーマCSS ${def.theme}.css の ${i + 1} 行目に余分な } があります。`));
      }
    });
    if (depth !== 0) fail(at(`テーマCSS ${def.theme}.css に閉じていない { が ${depth} 個あります。`));
    head = replaceOnce(head, /<\/head>/, `<style>\n${css}</style>\n</head>`, at('theme'));
  }

  // --- hero ---
  if (def.eyebrow) {
    c.hero = replaceOnce(c.hero, /(<div class="hero-eyebrow">)[^<]*(<\/div>)/, m => m[1] + def.eyebrow + m[2], at('hero eyebrow'));
  }
  if (def.h1) {
    c.hero = replaceOnce(c.hero, /<h1>[\s\S]*?<\/h1>/, () =>
      `<h1>\n${def.h1.map(line => `        <span class="h1-line">${line}</span>`).join('\n')}\n      </h1>`, at('hero h1'));
  }
  if (def.tagline) {
    c.hero = replaceOnce(c.hero, /(<p class="hero-tagline desktop-only">)[\s\S]*?(<\/p>)/, m =>
      `${m[1]}\n        ${def.tagline}\n      ${m[2]}`, at('hero tagline'));
    c.heroBelow = replaceOnce(c.heroBelow, /(<p class="hero-tagline-m">)[\s\S]*?(<\/p>)/, m =>
      `${m[1]}\n    ${def.taglineMobile || def.tagline}\n  ${m[2]}`, at('hero tagline mobile'));
  }
  if (def.sub) {
    c.hero = replaceOnce(c.hero, /(<p class="hero-sub desktop-only">)[\s\S]*?(<\/p>)/, m =>
      `${m[1]}\n        ${def.sub}\n      ${m[2]}`, at('hero sub'));
    c.heroBelow = replaceOnce(c.heroBelow, /(<p class="hero-sub-m">)[\s\S]*?(<\/p>)/, m =>
      `${m[1]}\n    ${def.sub}\n  ${m[2]}`, at('hero sub mobile'));
  }
  // ヒーローの説明文のすぐ下に入れる要素（訴求を文章ではなくカード等で見せるためのもの）。
  // PCはヒーロー内、スマホは画像の下のブロックに、同じ中身を1つずつ入れる。
  if (def.heroExtra) {
    c.hero = replaceOnce(c.hero, /<p class="hero-sub desktop-only">[\s\S]*?<\/p>/, m =>
      `${m[0]}\n\n      <div class="hero-extra desktop-only">\n${def.heroExtra}\n      </div>`, at('hero extra'));
    c.heroBelow = replaceOnce(c.heroBelow, /<p class="hero-sub-m">[\s\S]*?<\/p>/, m =>
      `${m[0]}\n\n  <div class="hero-extra">\n${def.heroExtra}\n  </div>`, at('hero extra mobile'));
  }

  // --- 中身プレビュー / 共感 / 商品 / 声 / FAQ ---
  if (def.inside) {
    c.inside = reorder(c.inside, /<article class="inside-product[\s\S]*?<\/article>/g, 3, def.inside, at('inside'));
  }
  if (def.empathyTitle) {
    c.empathy = replaceOnce(c.empathy, /(<h2 class="section-title">)[\s\S]*?(<\/h2>)/, m =>
      `${m[1]}\n          ${def.empathyTitle.replace(/<span class="nb">/g, '<span style="display:inline-block">')}\n        ${m[2]}`, at('empathy title'));
  }
  if (def.bubbles) {
    c.empathy = reorder(c.empathy, /<article class="bubble [\s\S]*?<\/article>/g, 6, def.bubbles, at('bubbles'));
  }
  if (def.productsLead) {
    c.products = replaceOnce(c.products, /(<p class="section-lead"[^>]*>)[\s\S]*?(<\/p>)/, m =>
      `${m[1]}\n      ${def.productsLead}\n    ${m[2]}`, at('products lead'));
  }
  if (def.products) {
    c.products = reorder(c.products, /<article class="pcard [\s\S]*?<\/article>/g, 3, def.products, at('products'));
    let n = 0;
    c.products = c.products.replace(/(<div class="pcard-label">PRODUCT )\d+(<\/div>)/g, (_, a, b) => `${a}0${++n}${b}`);
    if (n !== 3) fail(at(`PRODUCT ラベルが ${n} 個（想定 3 個）。`));
  }
  if (def.voices) {
    c.voices = reorder(c.voices, /<article class="voice[ "][\s\S]*?<\/article>/g, 7, def.voices, at('voices'));
    // 7番目は横幅いっぱいのカード（voice-wide）。末尾以外に置くとグリッドが崩れる。
    if (def.voices.includes(7) && def.voices[def.voices.length - 1] !== 7) fail(at('voices の 7 は末尾に置いてください。'));
  }
  if (def.faq) {
    c.faq = reorder(c.faq, /<div class="faq-item">\s*<div class="faq-q">[\s\S]*?<\/div>\s*<div class="faq-a">[\s\S]*?<\/div>\s*<\/div>/g,
      9, def.faq, at('faq'));
  }

  // --- 最終CTA ---
  if (def.finalTitle) {
    c.final = replaceOnce(c.final, /<h2>\s*<span class="line">[\s\S]*?<\/h2>/, () =>
      `<h2>\n        <span class="line">${def.finalTitle[0]}</span>\n        <span class="line accent">${def.finalTitle[1]}</span>\n      </h2>`, at('final title'));
  }
  if (def.finalSub) {
    c.final = replaceOnce(c.final, /(<p class="final-sub">)[\s\S]*?(<\/p>)/, m =>
      `${m[1]}\n        ${def.finalSub}\n      ${m[2]}`, at('final sub'));
  }

  // --- 組み立て ---
  const reserved = new Set(['nav', ...fixedTail]);
  def.sections.forEach(key => {
    if (!(key in c) || reserved.has(key)) fail(at(`sections に不明なキー "${key}"。`));
  });
  if (new Set(def.sections).size !== def.sections.length) fail(at('sections に重複があります。'));
  ['hero', 'heroBelow', 'bundle', 'final'].forEach(key => {
    if (!def.sections.includes(key)) fail(at(`"${key}" は必須です（価格・購入導線・スマホのファーストビューが依存）。`));
  });
  if (def.sections.includes('faq') && !def.sections.includes('inside')) {
    fail(at('FAQ の「サンプルを見る」が #what を指すため、inside を外すなら faq も外してください。'));
  }

  let html = head + c.nav + def.sections.map(key => c[key]).join('') + fixedTail.map(key => c[key]).join('');

  // --- セール設定の差し替え（価格・期間）。index.html の IMPORT_SALE_CONFIG を丸ごと置き換える。 ---
  if (def.sale) {
    html = replaceOnce(html, /window\.IMPORT_SALE_CONFIG = \{[\s\S]*?\n\};/, () =>
      `window.IMPORT_SALE_CONFIG = ${JSON.stringify(def.sale, null, 2)};` + (def.salePreviewBeforeStart ? previewBeforeStartScript : ''), at('sale config'));
  }
  // --- 文言の個別差し替え：[元の文字列, 新しい文字列]。元の文字列はちょうど1回だけ現れること。 ---
  (def.replace || []).forEach(([from, to], i) => {
    const count = html.split(from).length - 1;
    if (count !== 1) fail(at(`replace[${i}] "${from.slice(0, 40)}…" が ${count} 箇所（想定 1 箇所）。`));
    html = html.replace(from, () => to);
  });
  if (def.optimizeMedia) html = optimizeMedia(html, at);
  return html;
}

// optimizeMedia: 表示を軽くする。index.html と元の画像ファイルは変えない。
//  1. images/webp/ に同名の WebP があれば、PNG / JPEG の代わりにそれを使う（scripts/tools/make-webp.py で作る）
//  2. ヒーロー以外の画像は、画面に近づくまで読み込まない（loading="lazy"）
//  3. 中身プレビューの動画は、画面に入ったときに初めて読み込んで再生する（それまではポスター画像を表示）
function optimizeMedia(html, at) {
  const webpDir = path.join(root, 'images', 'webp');
  let swapped = 0;
  html = html.replace(/((?:src|srcset|poster)=")images\/([^"\/]+)\.(?:png|jpe?g)"/g, (m, attr, stem) => {
    if (!fs.existsSync(path.join(webpDir, `${stem}.webp`))) return m;
    swapped += 1;
    return `${attr}images/webp/${stem}.webp"`;
  });
  if (!swapped) fail(at('optimizeMedia: images/webp/ に使える画像がありません。python3 scripts/tools/make-webp.py を実行してください。'));

  // ヒーローの背景（最初に見える絵）だけは先に読み込む。それ以外は遅延させる
  html = html.replace(/<img\b[^>]*>/g, tag => {
    if (/\bloading=/.test(tag)) return tag;
    if (/src="images\/(?:webp\/)?hero-/.test(tag)) return tag.replace('<img', '<img fetchpriority="high" decoding="async"');
    return tag.replace('<img', '<img loading="lazy" decoding="async"');
  });

  const videoTag = '<video class="inside-video" autoplay muted loop playsinline preload="metadata"';
  const videos = html.split(videoTag).length - 1;
  if (videos !== 3) fail(at(`optimizeMedia: 中身プレビューの動画が ${videos} 個（想定 3 個）。`));
  html = html.split(videoTag).join('<video class="inside-video" muted loop playsinline preload="none" data-lazy-autoplay');
  return replaceOnce(html, /<\/body>/, `<script>
// 中身プレビューの動画：画面に入ったら読み込んで再生し、外れたら止める（optimizeMedia）
(function(){
  var videos = document.querySelectorAll('video[data-lazy-autoplay]');
  if (!videos.length) return;
  if (!('IntersectionObserver' in window)) { videos.forEach(function(v){ v.play().catch(function(){}); }); return; }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (e.isIntersecting) e.target.play().catch(function(){});
      else e.target.pause();
    });
  }, { rootMargin: '200px 0px' });
  videos.forEach(function(v){ io.observe(v); });
})();
</script>
</body>`, at('lazy video script'));
}

function main() {
  const check = process.argv.includes('--check');
  const source = splitSource(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  let stale = 0;

  Object.entries(variants).forEach(([name, def]) => {
    if (!/^[a-z0-9-]+$/.test(name) || name === 'index') fail(`ページ名 "${name}" が不正です。`);
    const file = path.join(root, `${name}.html`);
    const html = build(name, def, source);
    if (check) {
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (current !== html) {
        stale += 1;
        console.error(`✗ ${name}.html が古い（node scripts/build-variants.js で再生成）`);
      } else {
        console.log(`✓ ${name}.html`);
      }
      return;
    }
    fs.writeFileSync(file, html);
    console.log(`✓ ${name}.html  /${name}  セクション ${def.sections.length} 個`);
  });

  if (stale) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`build-variants: ${error.message}`);
  process.exit(1);
}
