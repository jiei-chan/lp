# Cloudflare Pages移行

## 決定事項（2026-11-16）

- 公開URLは `https://promo.import-language.com/` を維持する。
- HTML・画像・動画を同じPagesプロジェクトに配置する。動画の相対URLを維持し、R2やStreamには分離しない。
- ユーザー承認によりSmartNews PageView追加を移行と同じ本番公開に含める。既存のTikTok・価格等の差分もあるため、公開対象の差分を確認して版を固定する。
- Shopifyの `www` とメールDNSは変更しない。
- 各動画は2.45〜6.26MiBで25MiB以内。転送量1.17TBの期間・対象・動画割合は未確認。サイズ検査は無制限の配信保証ではない。

## 公開前

1. Vercelの現行デプロイID、公開ブランチ、Gitコミット（CLI公開ならその成果物）、DNSの値とTTLを記録する。現行デプロイは切戻し用に保持する。
2. `git diff` と未追跡ファイルをレビューし、SmartNewsを含む公開版を確定する。コミット・pushは明示指示を受けて行う。VercelのGit自動公開が反応するブランチへのpushは既存本番にも影響するため、連携を先に確認する。
3. `node scripts/build-pages.js` で `dist/` を生成する。出力HTML・動画がソースと同一であり、内部資料が混入していないことを確認する。
4. PagesのGit連携で `jiei-chan/lp` と確定したブランチを選択する。Framework: None、Build command: `node scripts/build-pages.js`、Output: `dist`、Root: リポジトリルート。
5. 仮URLで画面、画像、動画再生・シーク、購入導線、クエリ付きURL、HTTPS、レスポンスヘッダーを確認する。ローカルHTTPサーバーは `_headers` を適用しないため、ヘッダーはPages上で別途確認する。

## ローカル検査

```bash
node --check scripts/build-pages.js
node scripts/build-pages.js
node scripts/verify-smartnews-pixel.js
node scripts/verify-tiktok-pixel.js
node scripts/verify-attribution.js
python3 -m http.server 4173 --directory dist
# In a second terminal:
node scripts/verify-price-ladder.js http://localhost:4173
node scripts/verify-mobile-hero.js http://localhost:4173
node scripts/verify-attribution-browser.js http://localhost:4173
```

型チェック・lintの専用設定はない。Nodeの構文検査と既存のinline JS構文検査を使用する。外部送信を遮断する既存ブラウザ検査で、320px・390px・1440px、CTA、流入情報の引き継ぎを確認する。

SmartNews・TikTokは本番ホスト限定のため、`pages.dev` で発火しないことが正常。既存の模擬ホスト検査と切替後の実受信確認を分ける。SmartNewsはLP PageViewのみで、Shopify購入帰属は未検証。詳細は `smartnews-measurement.md` を参照する。

## DNS切替と切戻し

1. PagesのCustom domainsで `promo.import-language.com` を追加してから、案内に従いGoDaddyのCNAME `promo` を `cname.vercel-dns.com` から実際のPagesプロジェクトの `*.pages.dev` へ変更する。登録完了だけで証明書が有効とは限らないため、DNS変更後にActive・HTTPSを確認する。
2. `www`、MX、TXTやネームサーバーは変更しない。現行TTLは切替時に再取得する。
3. 本番の表示、動画、購入リンク、広告パラメーター、SmartNews・TikTokの管理画面受信を確認する。仮URLでの検査成功は実広告・購入帰属の成功を意味しない。
4. 問題があれば `promo` のCNAMEを記録済みの旧値へ戻す。DNSキャッシュにより切戻しも即時ではない。旧Vercelドメイン接続とデプロイを残しておく。
5. 実広告流入を含む安定稼働確認後にVercelの対象プロジェクトを停止する。有料契約の解約は他プロジェクトの利用を確認して別途判断する。

切替日時は未決定。11月20〜30日のセール開催が確定している場合は、直前・開催中を避ける案を維持する。

## 現在の状態

ローカルの移行準備段階。未コミット・未push・未公開。Cloudflareアカウント、Pagesプロジェクト名、公開ブランチ、Vercel本番デプロイIDは未確認。

### 2026-11-16 ローカル検証結果

- 公開ファイル43点と `_headers` の計44点を生成。全点でコピー元とのバイト一致、25MiB以内、出力先のGit除外を確認。
- SmartNews 8件・TikTok 9件・広告流入引き継ぎ29件に成功。全inline JSと追加ビルドスクリプトの構文検査、`git diff --check` に成功。
- 生成した `dist/` をローカル配信し、320px・390pxのHero検査、320px・390px・1440px × 3媒体の購入導線検査、価格表示28ケースに成功。外部広告・Shopifyへの通信は遮断した模擬検査。
- MP4全4本のChromeでの再生・シークに成功。Cloudflare上でのRange応答・キャッシュ・HTTPSは未検証。
- 初回価格検査はサーバー未起動で失敗。サーバー起動後、一部Chrome起動がsandboxで失敗したため、許可された実行で再検証して成功。購入導線検査では動画通信がnetworkidleを遅延させたため、動画を別検査に分け、既存検査にmedia遮断のみ追加した。
- `images/inf-tiktok-01.png` と `images/inf-instagram-01.png` はソース時点から欠落しており、HTMLに既存のonerror代替表示がある。今回のコピー漏れではない。素材追加は未実施。
- Cloudflare管理画面は未ログイン。仮公開にはアカウントへのログインが必要。

### 今回の変更の復元

`.gitignore` と `README.md` の変更前コピーは `/tmp/lp-cloudflare-backup-20261116/` に保存。復元する場合はその後の編集がないことを確認してから戻す。追加した `cloudflare/_headers`、`scripts/build-pages.js`、本手順書と生成物 `dist/` を除き、`verify-attribution-browser.js` の今回追加したmedia遮断2行だけを戻せばよい。既存のHTML・TikTok・SmartNews・価格関連差分は今回変更していないため保持する。

## 公式資料

- [Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Developer Platform規約](https://www.cloudflare.com/service-specific-terms-developer-platform/)

## 最新mainへの統合

2026-11-16、origin/main dc03976を基に別worktreeで公開版を準備。価格14,980円固定・カウントダウン停止とレビュー済みTikTok実装を維持し、SmartNewsとCloudflare設定だけを追加。前述の46件等は旧作業ツリーの検査履歴であり、この統合版の検査とは区別する。公開用worktreeは `/tmp/lp-cloudflare-release`。未コミット・未push。
