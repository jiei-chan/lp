# Black Friday 自動切替・価格検証

## 作業ブランチと統合方針

- 2026-11-20、`origin/feature/black-friday` の `a888f30` から `codex/black-friday-readiness` を作成しました。
- 作業場所は `/private/tmp/lp-black-friday-readiness`。正本repo `/Users/uchida/projects/lp` の別案件の未コミット変更は保持しています。
- 先にこのブランチの差分を `feature/black-friday` 宛てにレビューし、取り込んだ元ブランチを `main` 宛てにレビューする順序を推奨します。元ブランチの開発者が更新した場合は、差分を確認してから取り込みます。
- 元ブランチはペルソナ別5ページも含みます。最終的なmainへの差分にはこれらも入るため、公開対象として確認が必要です。
- commit・push・PR作成・merge・公開は未実施です。mainへのマージ前に公開先と自動デプロイ設定を確認します。

## 確定済みの設定

| 期間（日本時間） | トップページ | 完全版価格 | 単品合計との差額 | 割引率（四捨五入） |
| --- | --- | --- | --- | --- |
| 11/20 18:00より前 | 通常版 | 14,980円 | 5,360円 | 26% |
| 11/20 18:00以上、12/1 0:00未満 | Black Friday版 | 11,980円 | 8,360円 | 41% |
| 12/1 0:00以降 | 通常版 | 14,980円 | 5,360円 | 26% |

単品合計は20,340円です。セール設定の正本は `scripts/variants.config.js` の `blackFridaySale`。期間外の14,980円は既存の通常オファーを引き継いでいます。Shopifyの販売価格は別管理で、このコードでは変更しません。

## 実装

- `scripts/pages.config.js`: `home: 'scheduled', scheduledPage: 'blackfriday'`。
- `scripts/build-pages.js`: 生成HTMLの鮮度を確認し、共通の販売期間から `dist/_worker.js` と `dist/_routes.json` を生成します。開始前のビルドでも開始・終了の再デプロイは不要です。
- `cloudflare/home-worker.mjs`: Cloudflare Pagesのサーバー時刻で `/`、`/index`、`/index.html` の内容を選びます。ブラウザのURLは変えません。トップの応答は `no-store` にし、変更前のETag等を引き継ぎません。セール版の `noindex` はトップに出す場合だけ除きます。
- 画像・ペルソナ別ページは従来どおり静的配信します。動画は部分取得・シーク対応のため、実ファイルを列挙してFunctions対象に含めます（[修正詳細](video-seeking.md)）。
- トップの価格・カウントダウンはサーバー時刻からの経過時間で動きます。期限到達時、タブ復帰時、戻る操作によるキャッシュ復元時にトップを再取得します。JavaScript無効時も新規リクエストで正しい版を返しますが、開いたままの画面は自動更新されません。
- `/blackfriday` への直接アクセスは既存の専用ページを維持します。開始前・終了後は通常価格になり、セール告知バナーとカウントダウンは非表示です。直接アクセスの日時判定は従来どおり端末時計です。
- ローカル／プレビューの `/blackfriday` では、既存仕様どおり開始前でもセール中扱いです。自動切替するトップはプレビューでも実際の期間に従います。
- 最終CTAの3つ目のカウントダウンは元のデザイン方針どおり非表示。表示するのはオファーカードと固定バーの2か所です。

## ローカル検査

```bash
node scripts/build-variants.js
node scripts/build-pages.js
python3 -m http.server 4187 --bind 127.0.0.1 --directory dist
# 別ターミナル
node scripts/verify-black-friday.js http://127.0.0.1:4187
node scripts/verify-home-schedule.mjs
node scripts/verify-price-ladder.js http://127.0.0.1:4187
MOBILE_NAV=none node scripts/verify-mobile-hero.js http://127.0.0.1:4187/blackfriday.html
```

- `verify-black-friday.js`: 本番ホストをローカルHTMLで模擬し、320 / 390 / 1440pxで開始前・開始瞬間・開始後、終了前・終了瞬間・終了後を検査します。全価格表示、3組のタイマー値、2か所のタイマー表示、バナー、6購入導線、横overflowを確認します。
- `verify-home-schedule.mjs`: 生成されたWorkerにローカルASSETSアダプターを接続します。36件の日時・URL別名・GET/HEADの応答と、6件のブラウザでの通常版↔セール版切替を検査します。誤った端末時計、UTM・gclid・ハッシュ保持、タブ復元も確認します。Cloudflare実サービスへのデプロイ検査とは区別します。
- Chrome検査では外部通信を遮断し、Shopify遷移や広告計測の実送信は行いません。
- 型チェック・lintの専用設定はありません。変更JSの構文検査、生成物整合、`git diff --check` を併用します。

### 2026-11-20 の検証結果

- ユーザー指定により11,980円・11月20日18:00 JST開始に更新し、バナーの41% OFF、生成Worker、開始終了の3幅検証、トップ36応答ケース＋6ブラウザケースを再確認しました。差額は8,360円です。以下の公式runtime・帰属・Hero・切戻し検査は設定更新前の実施結果で、今回変更した設定の検証とは区別します。
- 上記境界テスト、トップの36応答ケース＋6ブラウザケース、通常価格4ケース、既存の広告帰属32件、スマホHero2幅、全7ページのinline JS構文検査に成功しました。
- 通常版／セール版の固定表示、通常版への切戻しでWorkerが残らないこと、古い生成HTMLをビルドで拒否することも別の一時コピーで確認しました。
- Wrangler 4.165.0 / compatibility date 2026-11-18 の公式ローカルruntimeで、Pages ASSETS、トップのGET/HEAD・URL別名・ヘッダー、noindex、画像、320 / 390 / 1440pxの価格・カウントダウン・CTAを確認しました。トップの初期HTML価格もサーバー側で合わせています。
- 動画Rangeの検査は、ローカルruntimeで206を期待したところ200になり不合格でした。動画はFunctions対象外で、転送コードは変更していません。公開先での部分取得・シークは別途確認します。
- Hero検査ではアニメーション完了を待つように修正し、「英単語は忘れない」が描画されたスクリーンショットを確認しました。320pxでは見出し2行目がキャラクターに重なる既存デザインが残っています。今回、配置や素材は変更していません。

## 公開前に残る確認

1. Shopifyの購入先商品が期間中11,980円、終了後14,980円になる運用を確認します。2026-11-20の読み取りではHTTP 429になり、実売価格は未確認です。注文・決済・管理画面更新はしていません。
2. 実際の公開元がCloudflare Pagesであり、ビルドが `node scripts/build-pages.js`、出力が `dist` になっていることを確認します。現在の管理画面設定は未確認です。Vercelや静的サーバーだけに配置しても自動切替Workerは実行されません。
3. 公開承認後のPages Previewでルート・画像・動画・HTTPヘッダー・購入導線を確認します。Functionsの利用枠と上限時の挙動も確認します。
4. プレビュー確認後にmainへの公開を承認し、公開HTML・価格・購入先価格を照合します。11月20日18:00（日本時間）より前に公開すれば通常版から自動切替します。期間中に公開した場合はすぐにセール版になります。

## 切戻し

`scripts/pages.config.js` を `module.exports = { home: 'index' };` にして再ビルド・承認後に再公開すると通常版に固定できます。トップ切替処理とそのルートは外れますが、動画シーク対応のWorkerは残ります。今回の設定変更前バックアップは `/private/tmp/lp-bf-config-backup/pages.config.js`。他の開発者の変更を戻す必要はありません。

## 公式仕様

- [Cloudflare Pages Advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/): `_worker.js` と `env.ASSETS.fetch()`。
- [Functions routing](https://developers.cloudflare.com/pages/functions/routing/): `_routes.json` による実行範囲。
- [Pages headers](https://developers.cloudflare.com/pages/configuration/headers/): Functionsの応答にはヘッダーをコード側で付与します。

## 2026-11-20 統合検証と反映承認

- 統合先候補は `feature/black-friday`。開発者側の最新 `dab1728`（最終CTAのPC/スマホ画像）と、`codex/black-friday-readiness` の `549d0fe` および未コミット18ファイルを、`codex/black-friday-integration` で統合しました。
- 作業場所: `/private/tmp/lp-black-friday-integration`。検証時はmergeを `--no-commit` で停止し、確認後にコミットします。元の2作業フォルダとmainは変更していません。
- 変更対象の重複・Git競合なし。価格11,980円・41% OFF・11月20日18時開始・12月1日0時終了（JST）、最新の最終CTA画像、Range対応ローカルプレビューを保持しました。
- 生成物チェック・Pagesビルド、JS構文、差分検査、トップ36応答＋6ブラウザケース、Black Friday開始終了境界の320/390/1440px、Hero2幅、通常価格4ケース、広告帰属32件に成功しました。外部通信を遮断したローカル検証です。型チェック・lintの専用設定はありません。
- サンドボックス内ではChrome起動とNodeのローカルlistenが制限されました。必要な権限で再実行し、全検査が成功しました。
- 320pxのHero見出しとキャラクターの既存の重なりは残ります。Shopify実売価格と公開環境・本番動画Rangeは未確認です。
- 元の未コミット変更のバックアップ: `/private/tmp/lp-black-friday-integration-backup`。patchと18ファイルのコピー、SHA-256一覧を保存しました。統合作業を破棄する場合も、このバックアップと元作業フォルダは保持します。
- ユーザーから統合結果のcommitと `feature/black-friday` へのpushを明示承認済みです。統合コミットで更新するのはこのLP用ブランチだけです。mainへのマージ・本番公開は別途扱います。
