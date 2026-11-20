// Build-time configuration is appended by scripts/build-pages.js.
export function createHomeWorker(schedule, now = Date.now) {
  const start = Date.parse(schedule.startAt);
  const end = Date.parse(schedule.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end
    || !/^[a-z0-9-]+$/.test(schedule.page)) throw new Error('Invalid home schedule');

  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (!['/', '/index', '/index.html'].includes(url.pathname)
        || !['GET', 'HEAD'].includes(request.method)) return env.ASSETS.fetch(request);

      const serverNow = now();
      const active = serverNow >= start && serverNow < end;
      const boundary = serverNow < start ? start : (active ? end : null);
      const assetUrl = new URL(url);
      assetUrl.pathname = active ? `/${schedule.page}` : '/';
      // Fetch the full static body even for conditional or HEAD requests.
      const assetRequest = new Request(assetUrl, { method: 'GET' });
      const response = await env.ASSETS.fetch(assetRequest);
      if (!response.ok) return response;
      let html = await response.text();
      if (active) {
        html = html.replace('<meta name="robots" content="noindex" />\n', '');
        // Match the initial HTML to the active offer, including before JavaScript runs.
        const { regularPrice, salePrice, savings, percent } = schedule.offer;
        const number = value => value.toLocaleString('ja-JP');
        const values = {
          'regular-price': `¥${number(regularPrice)}`, 'price': `¥${number(salePrice)}`,
          'price-plain': number(salePrice), 'savings-price': `¥${number(savings)}`,
          'savings-minus': `−¥${number(savings)}`, 'savings-yen': `${number(savings)}円`, 'percent': String(percent),
        };
        for (const [key, value] of Object.entries(values)) {
          html = html.replace(new RegExp(`(<[^>]+\\sdata-sale-${key}(?:\\s[^>]*)?>)[^<]*(</[^>]+>)`, 'g'), (_, open, close) => open + value + close);
        }
      }
      // Use elapsed time from the server response, never the visitor's wall clock.
      const clockScript = `<script>
(function(){
  const serverNow = ${serverNow};
  const started = performance.now();
  const boundary = ${boundary};
  let reloading = false;
  window.IMPORT_SALE_CLOCK = function(){ return new Date(serverNow + performance.now() - started); };
  function refreshHome(){
    if (reloading) return;
    reloading = true;
    window.location.reload();
  }
  function checkBoundary(){
    if (!reloading && boundary !== null && window.IMPORT_SALE_CLOCK().getTime() >= boundary){
      refreshHome();
    }
  }
  if (boundary !== null) setInterval(checkBoundary, 1000);
  window.addEventListener('pageshow', function(event){ if (event.persisted) refreshHome(); else checkBoundary(); });
  document.addEventListener('visibilitychange', function(){ if (!document.hidden && boundary !== null) refreshHome(); });
})();
</script>`;
      html = html.replace('</head>', `${clockScript}\n</head>`);
      const headers = new Headers(response.headers);
      for (const name of ['etag', 'last-modified', 'content-length', 'content-encoding', 'expires']) headers.delete(name);
      // Functions responses need their own headers; _headers covers static responses only.
      headers.set('Content-Type', 'text/html; charset=utf-8');
      headers.set('Cache-Control', 'no-store');
      headers.set('CDN-Cache-Control', 'no-store');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('X-Frame-Options', 'SAMEORIGIN');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      return new Response(request.method === 'HEAD' ? null : html, { status: response.status, headers });
    },
  };
}
