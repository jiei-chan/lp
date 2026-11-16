# SmartNews LP計測（PRレビュー）

2026-11-14確認。対象は `promo.import-language.com` の `index.html` のみです。Shopify側は変更していません。最新mainを基準に専用ブランチへ分離し、元作業ツリーの未コミット差分は保持しています。

## 実装

- headに公式v1.0.1ブートストラップと `ea7ac8b73db4d3663fc7db75` のPageView呼び出しを追加しました。SDKはHTTPSで非同期ロードします。
- 本番ホスト限定。ページ内の再実行防止フラグと公式の既存SDK判定で、今回のコードの重複ロード・PageView再送を防ぎます。別途導入された他タグが独自送信するイベントの抑止までは保証しません。
- Purchase・ViewContent・CTAイベントは追加していません。既存Meta・Google・TikTok、リンク、文言、CSSは変更していません。
- JavaScript無効時のnoscript画像は追加していません。静的HTMLではホスト制限を適用できず、ローカル／プレビューからの誤送信を避けるためです。JS無効時はSmartNews計測対象外です。

## 公式仕様とリンクの判断

[日本語Pixel仕様（2026-03-30更新）](https://help-ads.smartnews.com/item-3056/) と [Shopifyガイド](https://help-ads.smartnews.com/en/item-5730/) の `SmartnewsAds.p(ID, "PageView")` 形式を使用しました。

[公式URLマクロ仕様](https://help-ads.smartnews.com/en/item-3457/) は `{click_id}` などを広告URLの任意のパラメータ名へ展開する仕組みです。マクロ名が、そのままPixelの必須URLキーになるという意味ではありません。既存コードは `utm_source/medium/campaign/content/term/id` を引き継ぎますが、例示されている `utm_click_id` や `utm_campaign_id` 等は引き継ぎません。実際の広告URL設定は未確認です。

補助的な一次証拠として [公式配信SDK](https://cdn.smartnews-ads.com/i/pixel.js) を取得して確認しました。2026-11-14取得版は `snuuid` をURL・referrer・Cookie・localStorage・親ドメインCookieから取得し、親ドメインCookieにも保存します。これはSDKの観察結果であり、将来不変の公開仕様ではありません。

現状のLPリンクは `snuuid` を引き継ぎません。`promo.import-language.com` と `www.import-language.com` は同一親ドメインなので、通常のブラウザではSDKの親ドメインCookieを共有できます（架空値によるブラウザ検証済み）。Shopifyカスタムピクセルのsandbox内で同様に取得できるかは未確認です。公式ガイドだけから「リンク変更不要で購入帰属まで保証できる」とは結論できません。

**変更案（今回未適用）:** 実際の広告流入URLで `snuuid` が付く場合、現在URLからだけ購入CTA6箇所・その他Shopifyリンクへ転送する許可リストに追加します。LP独自の永続保存やCookie値のURL化は行いません。広告URLで `utm_click_id` 等のマクロキーを使用している場合は、その実キーも必要に応じて追加します。Shopify sandboxでの取り込み可否は別途検証が必要です。

## 検証

- `node scripts/verify-smartnews-pixel.js`: 8件成功。PageViewのみ、再実行、SDK再利用、ローカル・別ホスト抑止、全inline JS構文を確認。
- `node scripts/verify-attribution.js`: 32件成功。既存流入引き継ぎ・6つのCTA計測・遷移を確認。
- `node scripts/verify-tiktok-pixel.js`: 13件成功。
- `node scripts/verify-smartnews-browser.js /tmp/lp-smartnews-pixel.js`: 公式SDKをローカル応答で供給し、全外部リクエストを遮断して2ケース成功。通常時とSDKブロック時を確認。
- SDKは1回ロード、`i.smartnews-ads.com/p` のPageView要求は1回。SDK自身は同じイベントの補助要求を `i6.smartnews-ads.com` にも生成します。これはLPコードによる二重PageView呼び出しではありません。
- 同じ模擬ブラウザでGoogle config・Meta PageView各1回、CTA6箇所、JS実行エラーなし、CTA操作でSmartNews追加イベントなしを確認。
- `git diff --check` 成功。型チェック・lintの設定はないため、inline JSの構文検査と上記実行検証で代替しました。レイアウト変更はありません。
- 初回Chrome起動はsandbox制限で失敗し、許可された実行で解消しました。ブラウザ検証の初稿で模擬クリックが遷移したため、検証側で既定遷移を遮断して再検証しました。

## 公開前後の残事項

ユーザーの依頼によりPRまで作成します。マージはユーザーが行います。本番への直接デプロイは行いません。実行コードの差分はLPのhead追加のみです。

PRは最新mainから分離しています。公開後はSmartNewsのPixel検証／管理画面受信、LPをPurchase等に対応させるURLルールがないこと、実広告→LP→Shopifyの識別子引き継ぎを確認します。購入帰属やShopifyの設定済みカスタムピクセルの実動作は今回検証していません。
