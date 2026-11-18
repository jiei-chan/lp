# 横長のヒーロー画像（2000x1129）の右側（キャラクターと商品カード）を切り出し、
# スマホ用の縦長画像（1200x2880 = ヒーローの表示比率 1:2.4）を作る。
import sys
from PIL import Image, ImageFilter, ImageDraw
src = Image.open(sys.argv[1]).convert('RGB')
W, H = 1200, 2880
crop = src.crop((980, 0, 2000, 1129))                 # 1020 x 1129
scale = 1.03
cw, ch = round(1020 * scale), round(1129 * scale)     # 1051 x 1163
crop = crop.resize((cw, ch), Image.LANCZOS)
x0, y0 = W - cw, 260                                  # 右寄せ。キャラクターの頭が元のスマホ画像と同じ高さに来る位置

# 背景：切り出しの端の色を上下左右に引き伸ばしてから強くぼかし、同じ空間が続いているように見せる
bg = Image.new('RGB', (W, H))
bg.paste(crop, (x0, y0))
bg.paste(crop.crop((0, 0, cw, 6)).resize((cw, y0)), (x0, 0))                       # 上
bg.paste(crop.crop((0, ch - 6, cw, ch)).resize((cw, H - y0 - ch)), (x0, y0 + ch))  # 下
bg.paste(bg.crop((x0, 0, x0 + 6, H)).resize((x0, H)), (0, 0))                      # 左
bg = bg.filter(ImageFilter.GaussianBlur(70))

# 切り出しの縁をぼかして背景になじませる（左・上・下。右は画面端なのでそのまま）
mask = Image.new('L', (cw, ch), 255)
d = ImageDraw.Draw(mask)
for i in range(140):   # 左
    d.line([(i, 0), (i, ch)], fill=int(255 * i / 140))
px = mask.load()
for y in range(110):   # 上
    f = y / 110
    for x in range(cw): px[x, y] = int(px[x, y] * f)
for y in range(70):    # 下
    f = y / 70
    for x in range(cw): px[x, ch - 1 - y] = int(px[x, ch - 1 - y] * f)
bg.paste(crop, (x0, y0), mask)
bg.save(sys.argv[2], 'WEBP', quality=86, method=6)
print(bg.size)
