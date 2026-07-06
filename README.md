# import LP（本番）

ブランド **import**（日本人英語学習者向け教材・物販）の広告 / 販売 LP の正本。単一 HTML（CSS/JS 埋め込み）で構成。作業規約は `AGENTS.md` を参照。

## ローカル確認

```bash
# Pythonがあるなら
python3 -m http.server 4173
# → http://localhost:4173

# Node.jsがあるなら
npx serve .
```

## レイアウト検査

Hero / CTA / header を触った後は、スマホのファーストビューが崩れていないか確認する。

```bash
node scripts/verify-mobile-hero.js http://localhost:4173

# スクリーンショットも残す場合
SCREENSHOT_DIR=/tmp/import-lp-mobile-hero node scripts/verify-mobile-hero.js http://localhost:4173
```

この検査は 320px / 390px 幅で、Hero 見出し、スマホヘッダーCTAの固定表示、初期 sticky CTA 非表示、横 overflow、Hero 高さ、ヘッダーCTAと見出しの距離、下部コピーとの距離を確認する。

## Vercelへのデプロイ

### 方法A: Vercel CLI（推奨・最速）

```bash
npm i -g vercel
vercel              # 初回はログイン → プロジェクト作成
vercel --prod       # 本番デプロイ
```

### 方法B: GitHub経由

1. このフォルダをGitHubリポジトリにpush
2. https://vercel.com/new でリポジトリをimport
3. Frameworkは「Other」を選択
4. デフォルト設定のままDeploy

## ファイル構成

- `index.html` — LP本体（CSS/JSすべて埋め込み済み）
- `vercel.json` — Vercel設定（セキュリティヘッダー、cleanUrls等）
- `README.md` — このファイル
