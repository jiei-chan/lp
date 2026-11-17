// 公開サイトのトップ（/）に何を出すか。
//   'index'       … 通常どおり index.html
//   'blackfriday' … Black Friday 版を / に出す（index.html 自体は書き換えない。/blackfriday でも同じ内容が開く）
// 切り替えはこの1行を変えて main に入れるだけ。戻すときは 'index' に戻す。
// placeholder: true（仮値）のページは / に出せない（scripts/build-pages.js がエラーで止める）。
module.exports = { home: 'index' };
