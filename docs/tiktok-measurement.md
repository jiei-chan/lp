# 外部LPのTikTok計測と公開手順

2026-11-08。レーンL・単独、昇格なし。commit・push・PR作成はユーザー承認済みです。マージ・本番公開・広告作成・配信・決済は未実施です。

## 公開元の確認

ローカルのパス名や別チャットの作業結果だけでは判断せず、以下を照合しました。

| 項目 | 確認結果 |
| --- | --- |
| 対象 | `https://promo.import-language.com/` |
| GitHub | `jiei-chan/lp`、default branch `main` |
| 公開基準コミット | `d396c1a8cbe5621ce5a20760e8832d437a7b2e1c`（PR #24のマージ） |
| GitHub Production deployment | `7594331711`、2026-11-06、同じコミット、status `success` |
| Production deployment URL | `https://lp-dc2wijtbs-imports-projects.vercel.app` |
| ホスティング | 公開HTTPレスポンスの `server: Vercel`、repoの `vercel.json`、GitHub deployment履歴が整合 |
| 公開HTML | 取得したHTMLと最新 `origin/main:index.html` がバイト単位で一致 |
| 公開HTML SHA-256 | `13e13c2c6fb33a872bc89a8f87764560c64ce37d51386b4eb1463501c7e716ff` |

確認用の一次情報:

- [基準コミット](https://github.com/jiei-chan/lp/commit/d396c1a8cbe5621ce5a20760e8832d437a7b2e1c)
- [Production deployment](https://api.github.com/repos/jiei-chan/lp/deployments/7594331711)
- [Deployment status](https://api.github.com/repos/jiei-chan/lp/deployments/7594331711/statuses)

実運用は `main` マージ → Vercel Production の履歴が確認できます。ただし、Vercel管理設定のProduction Branch、Root Directory、Build/Output設定、ドメイン割当、自動デプロイの現在のスイッチ値は直接取得できていません。CLIは `teddy-edu` のみアクセスでき、対象 `imports-projects` を取得できませんでした。GitHub上の履歴と管理設定の直接確認を区別します。ブラウザー操作はユーザーの指示に合わせて終了しました。

`vercel.json` は静的サイト向けで、`cleanUrls: true`、`trailingSlash: false` とセキュリティヘッダーを定義しています。リポジトリにはビルド工程、独自リダイレクト、GTMコンテナー、CMPの連携は見当たりません。

## 作業の分離

- 元フォルダ `/Users/uchida/projects/lp` の別チャットによる未コミット変更は編集・移動・削除していません。
- 最新 `origin/main` を基準に、同じGitリポジトリのworktree `/Users/uchida/.codex/worktrees/lp-tiktok-reviewed/lp` を作成しました。
- PR準備ブランチは `codex/tiktok-lp-reviewed` です。価格変更コミットはすでにmainにマージされており、この差分には含めません。
- ユーザーの最新指定に従い、同意ボタンは追加しません。本番ホストでの自動ページ閲覧計測とSDKの既存設置検出を実装しています。

## 実装と既存のプライバシー設定

- 同じ公開Pixelコード `DBNU0BJC77UBRT4SAQK0` を `IMPORT_ANALYTICS_CONFIG.tiktokPixelId` へ設定します。
- HTTPSの `promo.import-language.com` を開くとSDKを読み込み、`page()` を1回呼びます。localhost・Vercel Preview・Shopifyホスト・空の設定値では読み込みません。
- ユーザーの「今まで同意ボタンを入れていないなら入れなくてよい」という指定に従い、初稿で追加した同意UI・同意待ち・同意状態の保存を削除しました。未公開の初稿なので、本番利用者の同意状態を移行する処理は不要です。
- 表示用のHTML（scriptを除く）・CSSは公開mainと一致します。新しいボタンやプライバシー文言は画面へ追加していません。
- 既存の `ttq`（SDKまたはキュー）やTikTok SDK scriptがあれば、上書き・再読み込み・追加ページイベントを避けます。スクリプト再評価による重複も防ぎます。
- SDK失敗時はconsoleへ警告し、購入リンクは動作します。自動再試行はしません。
- LPから `Purchase` / `AddToCart` / `InitiateCheckout` / `identify` は呼びません。購入等はShopify公式TikTok連携に任せます。既存のGA4 `purchase_cta_click` とMeta `PurchaseCtaClick` はそのままです。

公開HTMLにはGA4とMetaがあり、同意UI・CMPの連携はありませんでした。プライバシーポリシーには一般的なCookie等の説明がありますが、取得本文にTikTok共有の具体的説明は見当たりませんでした。既存のポリシーリンクと本文は変更していません。今回の実装は既存の自動読み込み方式に合わせたもので、プライバシー説明が十分であることを判定したものではありません。

Shopifyの同意設定が外部LPにも適用されるとはみなしていません。Shopify側設定・共有Pixel側の自動マッチングやEvent Builder設定も変更していません。

## ttclid・UTMと購入導線

既存の処理で要件を満たすため、帰属ロジック自体は変更していません。

- 全6購入CTAの静的URLと、下部JSで再生成するURLの購入先は同じShopify商品ページです。
- `ttclid` と `utm_source / medium / campaign / content / term / id` を購入リンクへ転送します。通常のShopify向けリンクも装飾します。
- 現在の流入に許可パラメータがある場合は、その流入だけで既存値を置換します。過去のMeta・Google識別子を混入させません。
- パラメータなし再訪は、既存の90日以内の保存値を復元します。この保存期間は広告管理画面のアトリビューション期間とは別です。
- 通常クリックの120ms後遷移、修飾クリック、新しいタブで開く導線を維持しています。
- 購入先へクエリなしのHEADを送り、HTTP 200でLocationヘッダーなしを確認しました。LP取得もHTTPSの対象URLで200です。JSやPixelは実行していません。
- ローカルでは特殊文字を含む架空の `ttclid` / 日本語UTMを使い、実際のクリックハンドラが生成するShopify遷移URLを遮断して検査します。
- 実TikTokクリック識別子、Shopifyの地域・言語依存リダイレクト、決済までの帰属、実広告での購入照合は未確認です。実識別子や注文を作って確認していません。

## ローカル検査

```bash
node scripts/verify-tiktok-pixel.js
node scripts/verify-attribution.js
python3 -m http.server 4192 --bind 127.0.0.1
# 別ターミナル
node scripts/verify-attribution-browser.js http://127.0.0.1:4192
node scripts/verify-tiktok-browser.js
SCREENSHOT_DIR=/tmp/import-tiktok-reviewed-screenshots node scripts/verify-mobile-hero.js http://127.0.0.1:4192
git diff --check
```

`verify-tiktok-browser.js` は本番ホスト名をローカルHTMLの応答で模擬します。ネットワーク要求をすべてローカルファイル・テスト応答・遮断のいずれかにし、TikTok SDKも空の応答に置換します。実SDKの挙動や実受信を検証するものではありません。既存の帰属ブラウザー検査はlocalhost以外を遮断し、Shopify遷移はテスト応答に置換します。無関係な動画も遮断しています。

検証結果（同意UI削除後）:

- Pixel単体13件が成功しました。本番で自動的にページ閲覧を1回キューへ追加し、プレビュー除外・既存SDKの重複防止・失敗時の挙動を確認しています。同意用保存領域の参照がないことも検査しています。
- 320 / 390 / 1440pxの外部送信遮断ブラウザー検査で、自動PageView、全6CTAでTikTokイベント追加なし、特殊文字入りttclid・UTM、再訪、購入遷移、SDK失敗時の導線を確認し、全件成功しました。
- 追加IIFEのTypeScript 7.0.2 checkJs、追加IIFE・変更した2検査スクリプトのESLint 10.14.0が成功しました。動的SDKキューは明示的なany、Window拡張は検査用宣言で補っています。
- 表示用HTML（scriptを除く）・CSSと既存の帰属・GA4・Meta・CTAハンドラが公開mainと一致することを確認しました。フッターを含め表示変更はありません。
- 帰属32件・既存導線9ケース・mobile Hero2幅の検査は前回成功済みです。該当コードは変更していないため再実行していません。
- 初稿の同意・撤回検査および同意欄スクリーンショットは削除前の仕様で、現行版の証拠には使いません。
- 検証済みHTMLのSHA-256: `be6ee6d7f47cb001289d54363aef8fb37e970e6badce9cebd5b0d0b59f9e8c9f`。

検査の一時資材は `/tmp/import-tiktok-reviewed-check` です。PRには含めません。

## PRからの公開手順

1. このブランチの差分をレビューします。同意UIは追加せず、本番LPで自動ページ閲覧計測を行います。
2. ユーザーがcommit・push・PR作成を承認した後、このworktreeの対象ファイルだけを選んでcommitし、`codex/tiktok-lp-reviewed` をpush、base `main` のPRを作成します。元フォルダの未コミット変更を混ぜません。
3. GitHubのVercelチェックが **Preview** であることを確認します。PreviewではTikTok送信はホスト条件で無効ですが、他媒体の既存タグもあるため、広告タグを実行しない検証を使います。
4. マージ前に `imports-projects / lp` の管理権限がある環境でProduction Branch=`main`、対象ドメイン、既存ビルド設定を最終確認します。今回のCLIスコープでは確認できません。新規Vercelプロジェクト作成や、不明な接続先への `vercel --prod` は行いません。
5. ユーザーのマージ・本番公開承認後にmainへマージします。既存履歴どおりなら自動でProductionへ公開されるため、**マージ自体を公開操作として扱います**。広告配信開始は別の明示指示が必要です。
6. GitHub Production deploymentのコミットと成功状態を確認し、公開HTMLをクエリなしで取得して、マージした `index.html` とSHA-256を照合します。
7. 実送信を伴う確認の承認後、同じPixelのEvents Managerで、LPを開くとPageView、CTAで購入・カートイベントなし、Shopify側で購入イベントを受ける分担を確認します。LPに対するEvent Builderの自動イベント・自動マッチング設定は今回未確認のため、LPクリックが購入等に分類されないことも確認します。共有Pixel全体の設定を無断変更しません。

### PR本文案

外部LPのTikTok計測を、Shopify公式連携と同じPixelへ接続します。本番LPを開くとページ閲覧を1回送り、LPのCTAから購入・カートイベントは送りません。同意ボタンはユーザー指定により追加しません。既存SDKの重複設置を避け、ttclid / UTMの全購入CTAへの転送と再訪を検査します。

公開元は最新main・GitHub Production deployment・本番HTMLの一致で確認済みです。Vercel管理設定の直接確認と、実Pixel受信・Shopifyサーバー受信・重複排除は未確認です。GA4・Meta・既存の帰属保存・プライバシーポリシーのリンクは変更していません。

## 残課題と復元

- 0円テスト注文のJPY・value 0.00が実決済額と一致するというユーザー提供情報を保持します。金額を架空の正数に変えません。「購入価値が無効」の警告原因、サーバー受信、ブラウザー/サーバー重複排除は未解決です。
- 実SDK受信・Event Builderの設定・広告帰属は未確認です。ローカルのキュー確認を実受信成功と読み替えません。
- 公開前の基準は上記mainコミットです。このworktreeの対象差分だけを戻せば復元でき、元フォルダにある別チャットの変更を戻す必要はありません。
- 公開後に問題があれば、承認のうえPR差分をrevertするか、確認済み直前のVercel Production deploymentへ戻します。ShopifyアプリやPixel自体を削除しません。

## 公式仕様

- [TikTok Pixel Cookie consent mode](https://business-api.tiktok.com/portal/docs/pixel-cookie-consent-mode/v1.3): `holdConsent` / `grantConsent` / `revokeConsent` の意味を確認しました。
- [How to use cookies with TikTok Pixel](https://ads.tiktok.com/resources/help/article/how-to-use-cookies-with-tiktok-pixel): 通知・必要な同意とタグ発火制御の案内です。
- [TikTok Click ID](https://ads.tiktok.com/help/article/tiktok-click-id): 広告クリックとイベントの関連付けに使われるURLパラメータです。
