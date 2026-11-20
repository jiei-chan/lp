# images/ 直下の PNG / JPEG から、軽い WebP を images/webp/ に作る（元の画像は残す）。
# optimizeMedia: true の派生ページは、同名の WebP があればそちらを使う（scripts/build-variants.js）。
#   python3 scripts/tools/make-webp.py
# 画像を追加・差し替えたら再実行してコミットする。Cloudflare のビルド環境では実行されない（生成物をコミットしておく）。
import os, sys
from PIL import Image

SRC, OUT = 'images', 'images/webp'
os.makedirs(OUT, exist_ok=True)
# 画面いっぱいに敷く背景は大きめ、それ以外（カードの中の絵など）は小さめに抑える
WIDE = ('about-pc', 'about-mobile', 'final-bg', 'hero-', 'toeic-vo-comp-pack-cta', 'CompleteBundle', 'summer-sale-promo')
total_before = total_after = 0
for name in sorted(os.listdir(SRC)):
    stem, ext = os.path.splitext(name)
    if ext.lower() not in ('.png', '.jpg', '.jpeg'):
        continue
    src = os.path.join(SRC, name)
    im = Image.open(src)
    limit = 2000 if stem.startswith(WIDE) else 1200
    if max(im.size) > limit:
        k = limit / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
    dst = os.path.join(OUT, stem + '.webp')
    im.save(dst, 'WEBP', quality=82, method=6)
    a, b = os.path.getsize(src), os.path.getsize(dst)
    if b >= a:            # 軽くならないものは作らない
        os.remove(dst)
        continue
    total_before += a; total_after += b
    print(f'{a / 1024:7.0f} KB -> {b / 1024:6.0f} KB  {name}')
print(f'合計 {total_before / 1048576:.1f} MB -> {total_after / 1048576:.1f} MB')
