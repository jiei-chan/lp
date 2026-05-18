# import LP working rules

この repo は import の広告 / 販売 LP の正本です。

## Repo Identity

- 正本 path: `/Users/uchida/projects/lp`
- GitHub remote: `git@github.com:jiei-chan/lp.git`
- 主ファイル: `index.html`
- 旧検討用 repo `/Users/uchida/projects/import-gw-lp` と混同しない。

LP の作業を始める前に、必ず次を確認する。

```bash
pwd
git remote -v
git status --short --branch
```

`pwd` が `/Users/uchida/projects/lp` ではない、または `origin` が `git@github.com:jiei-chan/lp.git` ではない場合は、作業を進めず正しい repo に移動する。

## Implementation Notes

- `index.html` は単一HTMLの LP。CSS / JS も同ファイル内にある。
- 購入導線は静的な `href` だけでなく、下部 JS が `data-purchase-cta` を持つリンクの `href` を再生成する。CTA 変更時は両方を確認する。
- 商品ページURLは Obsidian の `10_Projects/import/decisions/2026-05-18-lp-shopify-routing-and-repo.md` を参照する。

## Validation

- 文言削除や導線変更後は `rg` で対象文言が残っていないことを確認する。
- レイアウト変更後はローカルHTTPサーバーで表示し、少なくとも 320px / 390px / desktop 相当で横 overflow を確認する。
- 静的確認は例として `python3 -m http.server 4173` を使える。
