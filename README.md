# WorldOrb LP

映像で覚える英単語学習プログラム「WorldOrb」のランディングページ。

## ローカル確認

```bash
# Pythonがあるなら
python3 -m http.server 8000
# → http://localhost:8000

# Node.jsがあるなら
npx serve .
```

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
