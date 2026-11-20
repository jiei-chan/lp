# import LP（本番）

ブランド **import**（日本人英語学習者向け教材・物販）の広告 / 販売 LP の正本。単一 HTML（CSS/JS 埋め込み）で構成。作業規約は `AGENTS.md` を参照。

## ローカル確認

```bash
# 動画のシークにも対応するローカルプレビュー
python3 scripts/preview.py
# → http://localhost:4174/blackfriday.html
# 通常版: http://localhost:4174/index.html

# Node.jsがあるなら
npx serve .
```

動画の確認には `scripts/preview.py` を使います。`python3 -m http.server` は部分取得（Range）に対応しないため、動画を途中へ飛ばせない場合があります。3本のプレビューは共通のプレイヤーを使用しており、今後の動画差し替え時も、このサーバーで前方・後方へのシークを確認してください。本番配信は別途、動画のRangeリクエストが `206 Partial Content` と正しい `Content-Range` を返すことを確認します。

## レイアウト検査

Hero / CTA / header を触った後は、スマホのファーストビューが崩れていないか確認する。

```bash
node scripts/verify-mobile-hero.js http://localhost:4173

# スクリーンショットも残す場合
SCREENSHOT_DIR=/tmp/import-lp-mobile-hero node scripts/verify-mobile-hero.js http://localhost:4173
```

この検査は 320px / 390px 幅で、Hero 見出し、スマホヘッダーCTAの固定表示、初期 sticky CTA 非表示、横 overflow、Hero 高さ、ヘッダーCTAと見出しの距離、下部コピーとの距離を確認する。

## 動画配信とシーク

本番動画の部分取得・シークはPages Workerで対応します。前回のPythonプレビュー修正との違い、検証コマンドは [動画シークの修正](docs/video-seeking.md) を参照してください。

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

- 価格・期間は `scripts/variants.config.js` の `blackFridaySale`。**11,980円・11/20 18:00〜11/30 23:59 で設定**（2026-11-20更新、日本時間）。購入先の Shopify 商品の価格も同じ値にそろえる。
- テーマは `scripts/variant-themes/blackfriday.css`。
- `/` は `scripts/pages.config.js` の `home: 'scheduled'` で自動切替する。Cloudflare Pagesのリクエスト時刻で、11/20 18:00からBlack Friday版、12/1 0:00から通常版になる（日本時間）。期間は価格設定と共通。開いたままのページも期限到達時に再読み込みし、URL・広告パラメーター・ハッシュを維持する。
- 自動切替は `node scripts/build-pages.js` が出力するPages Workerで動く。Pythonの静的サーバーや従来のVercel設定では動かない。`home: 'index'` にすると通常版固定、`'blackfriday'` にするとセール版固定に戻せる。仮値・不正な期間・古い生成HTMLはビルドエラーになる。
- `/` を切り替えている間、`verify-price-ladder.js` などトップの価格を前提にした検査は期待値が変わる。
- 本番のドメイン以外（Cloudflare のプレビューやローカル）では、開始日時より前でもセール中の表示（11,980円・カウントダウン）になる（`salePreviewBeforeStart`）。本番のドメインでは開始日時どおりに切り替わる。
- 表示を軽くする処理（`optimizeMedia`）：`images/webp/` の WebP を使い、ヒーロー以外の画像と中身プレビューの動画は画面に近づくまで読み込まない。`images/` の PNG / JPEG を追加・差し替えたら `python3 scripts/tools/make-webp.py` を実行して `images/webp/` をコミットする（要 Pillow。Cloudflare のビルドでは実行されない）。
- スマホでは上部の固定ヘッダーを出さない。スマホのファーストビュー検査は `MOBILE_NAV=none node scripts/verify-mobile-hero.js <URL>/blackfriday` で実行する。

自動切替・価格・カウントダウンの検証と公開前確認は [Black Friday引き継ぎ](docs/black-friday-readiness.md) を参照。LPの価格設定はShopifyの商品価格を更新しない。

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
