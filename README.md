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

## ペルソナ別LP

`index.html`（正本）から、訴求と構成を変えた派生ページを生成する。正本は書き換えない。

| URL | 想定する相手 | 先頭に出す教材 |
| --- | --- | --- |
| `/toeic` | TOEICのスコアを上げたい大学生・社会人 | TOEIC® - VOCAB COMPLETE |
| `/kaiwa` | 単語は知っているのに会話で出てこない社会人 | Essential Verbs |
| `/yarinaoshi` | 学び直したいが続かなかった人 | Essential Verbs |
| `/eiga` | 映画・ドラマ・SNSの英語を楽しみたい人 | NativeDose |
| `/v2` | 現行と同じ相手（コピーは現行のまま構成だけ変更） | 現行どおり |

```bash
node scripts/build-variants.js          # 各 <name>.html を再生成
node scripts/build-variants.js --check  # 生成物が最新か検査
```

- 定義は `scripts/variants.config.js`（見出し・セクションの並び・カードの並び）。`<name>.html` は生成物なので直接編集しない。
- **`index.html` を直したら（価格・締切・計測など）必ず再生成する。** 再生成しないと派生ページだけ古い価格のまま残る。
- 購入リンクの `lp_page` にページのパス（`/toeic` など）が入るので、Shopify側でページ別に成果を分けられる。
- 派生ページは `noindex` と正本への canonical 付き。広告のリンク先として使う。
- スマホのファーストビュー検査は見出しを指定して実行する。

```bash
HERO_KEY_COPY="映像で忘れない" node scripts/verify-mobile-hero.js http://localhost:4173/toeic
```

## Black Friday 版

`/blackfriday` は Black Friday 用の派生ページ（黒×金のテーマ、セール用の構成）。`index.html` は書き換えない。

- 価格・期間は `scripts/variants.config.js` の `blackFridaySale`。**現在は仮値**で、ページ右下に「仮の価格・期間です」と出る。確定したら値を直し、`blackfriday` の `placeholder` を `false` にする。購入先の Shopify 商品の価格も同じ値にそろえる。
- テーマは `scripts/variant-themes/blackfriday.css`。
- 期間中に `/` を Black Friday 版にするには、`scripts/pages.config.js` の `home` を `'blackfriday'` にして main に入れる。終了後は `'index'` に戻す。仮値のままでは切り替えられない（ビルドがエラーで止まる）。
- `/` を切り替えている間、`verify-price-ladder.js` などトップの価格を前提にした検査は期待値が変わる。

## Vercelへのデプロイ

広告流入情報の引き継ぎ仕様・架空値による検査・今回の公開手順は [docs/attribution-forwarding.md](docs/attribution-forwarding.md) を参照。

既存のGitHub連携を使います。2026-11-08時点で `jiei-chan/lp` の `main` とGitHub Production deployment、公開HTMLの一致を確認しています。新しいVercelプロジェクトを作成する必要はありません。

1. 対象差分をレビューし、commit・pushの承認後に作業ブランチをpushします。
2. base `main` のPRを作成し、Vercel Previewと必要な検査を確認します。
3. マージ前に対象ドメイン・Production Branch・既存ビルド設定を確認します。**mainへのマージは本番自動公開につながるため、公開承認後に実行します。**
4. GitHub Production deploymentのコミット・成功状態と公開HTMLを照合します。

CLIの接続スコープによっては本番プロジェクトが見つかりません。不明な接続先で `vercel --prod` を実行しないでください。公開元の証拠、管理設定の未確認事項、TikTok計測の検査・公開手順は [docs/tiktok-measurement.md](docs/tiktok-measurement.md) を参照してください。

## ファイル構成

- `index.html` — LP本体（CSS/JSすべて埋め込み済み）
- `vercel.json` — Vercel設定（セキュリティヘッダー、cleanUrls等）
- `README.md` — このファイル

## Cloudflare Pagesへの移行準備

動画も同じPagesプロジェクトの `videos/` から配信します。SmartNews追加を含む現在のHTMLを、そのまま公開用フォルダへコピーします。

```bash
node scripts/build-pages.js
python3 -m http.server 4173 --directory dist
```

Cloudflare PagesのGit連携では、Framework presetを `None`、Build commandを `node scripts/build-pages.js`、Build output directoryを `dist`、Root directoryをリポジトリルートに設定します。公開ブランチは実際に公開する変更を確定してから指定します。

`dist/` は毎回再生成する出力専用フォルダです。ソースを置かないでください。HTML・画像・動画・`_headers` だけを含み、ドキュメントや検証スクリプトは配信しません。各ファイルの25MiB制限をビルド時に検査します。

移行・検証・DNS切替・切戻しは [Cloudflare移行手順](docs/cloudflare-migration.md) を参照してください。現時点ではCloudflare上のプロジェクト作成・公開・DNS変更は未実施です。
