# 横長の最終CTA画像（1920x1280：中央に箱3つ、左にアイコンとソファのキャラクター、右にカードとヘッドホンのキャラクター）から、
# スマホ用の縦長画像を作る。現行ページのスマホ版と同じ並び（上に見出しの余白 → 箱3つを横幅いっぱい → その下に左右の群）にする。
#   python3 scripts/tools/make-mobile-final.py images/final-bf.webp images/final-bf-mobile.webp
import sys
from PIL import Image, ImageFilter, ImageDraw

src = Image.open(sys.argv[1]).convert('RGB')
sw, sh = src.size
fx, fy = sw / 1920, sh / 1280          # 元画像の大きさが変わっても同じ割合で切る
W, H = 1200, 2160
BG = (2, 12, 34)                        # 絵の上端とほぼ同じ濃紺
canvas = Image.new('RGB', (W, H), BG)

def feather_mask(w, h, f):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rectangle([f, f, w - f, h - f], fill=255)
    return m.filter(ImageFilter.GaussianBlur(f / 2))

BOXES = (398, 300, 1502, 838)           # 元画像の中で箱3つが占める範囲（1920x1280 基準）

def place(box, x, y, width, feather, hide_boxes=False):
    l, t, r, b = box
    part = src.crop((round(l * fx), round(t * fy), round(r * fx), round(b * fy)))
    k = width / part.width
    height = round(part.height * k)
    part = part.resize((width, height), Image.LANCZOS)
    mask = feather_mask(width, height, feather)
    if hide_boxes:
        # 左右の群を切り出すと箱の端が写り込むので、箱の範囲だけ透明にする（境目はぼかす）
        cut = Image.new('L', (width, height), 255)
        bl, bt, br, bb = BOXES
        ImageDraw.Draw(cut).rectangle([round((bl - l) * fx * k), round((bt - t) * fy * k), round((br - l) * fx * k), round((bb - t) * fy * k)], fill=0)
        cut = cut.filter(ImageFilter.GaussianBlur(14))
        mask = Image.composite(mask, Image.new('L', (width, height), 0), cut)
    canvas.paste(part, (x, y), mask)
    return y + height

# 箱3つ：横幅いっぱい
place((350, 300, 1550, 860), -30, 400, 1260, 46)
# 左の群（アイコンとソファのキャラクター）と右の群（カードとヘッドホンのキャラクター）
place((40, 330, 570, 1110), 80, 955, 490, 56, hide_boxes=True)
place((1340, 250, 1860, 1030), 640, 935, 490, 56, hide_boxes=True)

canvas.save(sys.argv[2], 'WEBP', quality=86, method=6)
print(canvas.size)
