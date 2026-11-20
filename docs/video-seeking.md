# 動画の再生・シーク修正（2026-11-20）

## 原因と前回の修正との違い

TOEICの元MP4と本番配信の全バイトは一致し、ffmpegの全編デコードでエラーはありませんでした。H.264/AAC、先頭moovの構成も他2教材と同じです。

本番のCloudflare PagesはRangeリクエストに200で全体を返していました。Chromeでは通常再生が進んでも `seekable` が0〜0秒となり、シークすると0秒へ戻ります。LPを介さない動画単独再生でも、TOEIC・Essential Verbs・NativeDoseの3本で再現しました。TOEICは約6.3MiBと最も大きく、初期バッファは約31秒まででした。

前回の `549d0fe` は `scripts/preview.py` に206/416対応を追加したローカル専用修正です。同じ3本はこのサーバー上では前後シークに成功しますが、このPythonサーバーはCloudflare本番では動きません。本番の修正として不十分だった点を今回対応します。

Cloudflareの[Pages配信仕様](https://developers.cloudflare.com/pages/configuration/serving-pages/#behavior)にもRange要求に200を返す旨が記載されています。一般的なCloudflare CDNのRange対応とは区別します。

## 修正

- `cloudflare/video-worker.mjs` で公開動画へのGET/HEADを処理します。単一の閉区間・末尾省略・suffix Rangeを206と正しいContent-Rangeで返し、範囲外は416、不正形式・複数範囲は全体応答に戻します。
- ETag/Last-ModifiedによるIf-Range、不一致時の全体応答、304、HEAD、元のエラー応答を保持します。
- `scripts/build-pages.js` が動画の実ファイルから対象URLを列挙し、動画と既存のトップ切替だけをFunctions対象にします。画像や専用HTMLは従来の静的配信です。動画リクエストもWorker実行枠を使用します。
- ファイル内容・画質・再生時間・プレイヤー・価格設定は変更しません。現在の最大動画は約6.3MiBで、ビルドの25MiB上限も維持します。Range応答時はASSETSから全体を取得してメモリ上で必要部分を返します。
- `home: 'index'` または `'blackfriday'` の固定表示に戻しても、動画用Workerは残ります。トップ切替のロールバックでシーク修正が外れない構成です。

## 検証

```bash
node scripts/build-pages.js
node scripts/verify-video-ranges.mjs
node scripts/verify-video-browser.mjs
node scripts/verify-home-schedule.mjs
# 公開先の実応答・実動画を確認（広告/Shopifyへの通信は遮断）
node scripts/verify-video-browser.mjs https://promo.import-language.com
```

プロトコル検査は19件の範囲・条件付き応答に加え、HEAD/304/エラー/対象外URLを確認します。ブラウザ検査は実際の生成Worker・ルート定義を使用し、Rangeを無視するASSETSを再現します。3本の部分応答の実バイト一致と、390/1440pxのカード再生・モーダル再生・75%地点への移動・3秒への巻き戻しを確認します。

型チェック・lintの専用設定はありません。変更JSの構文、生成物整合、差分検査を併用します。Safari/iPhone実機は別途確認が必要です。

2026-11-20のローカル検証では、上記の部分応答・390/1440pxの3動画再生と前後シーク・トップ36応答＋6ブラウザ境界ケースが成功しました。別の一時コピーで通常版／Black Friday版の固定表示もビルドし、トップHTMLの一致と動画206対応の維持を確認しました。修正後のCloudflare上での検証は公開反映後に行います。

## 切戻し

この修正コミットをrevertして再デプロイすれば、従来の静的動画配信に戻せます。ただしシーク不具合も戻ります。動画経路の障害だけを切り戻す場合も、セール日時・価格は変更しません。
