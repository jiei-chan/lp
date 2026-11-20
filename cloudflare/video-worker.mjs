// Pages static assets ignore Range. Restrict partial responses to published videos.
export function createVideoWorker(next, videoPaths) {
  const videos = new Set(videoPaths);
  return {
    async fetch(request, env) {
      if (!videos.has(new URL(request.url).pathname)
        || !['GET', 'HEAD'].includes(request.method)) return next.fetch(request, env);

      const assetHeaders = new Headers(request.headers);
      assetHeaders.delete('Range');
      assetHeaders.delete('If-Range');
      assetHeaders.set('Accept-Encoding', 'identity');
      const response = await env.ASSETS.fetch(new Request(request, { headers: assetHeaders }));
      if (response.status !== 200 || response.headers.has('Content-Encoding')) return response;
      const headers = new Headers(response.headers);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('X-Content-Type-Options', 'nosniff');
      const full = () => new Response(request.method === 'HEAD' ? null : response.body, {
        status: 200, headers,
      });
      if (request.method === 'HEAD') return full();

      const range = request.headers.get('Range');
      const match = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      // Ignore malformed or multipart ranges rather than returning an incorrect fragment.
      if (!match || (!match[1] && !match[2])) return full();
      const first = match[1] ? Number(match[1]) : null;
      const last = match[2] ? Number(match[2]) : null;
      if ([first, last].some(value => value !== null && !Number.isSafeInteger(value))) return full();

      const ifRange = request.headers.get('If-Range');
      if (ifRange) {
        const etag = headers.get('ETag');
        const modified = headers.get('Last-Modified');
        const sameTag = !ifRange.startsWith('W/') && ifRange.startsWith('"') && ifRange === etag;
        const sameDate = modified && Number.isFinite(Date.parse(ifRange))
          && Date.parse(ifRange) === Date.parse(modified);
        if (!sameTag && !sameDate) return full();
      }

      // Build already caps each public asset at 25 MiB; the largest preview is 6.3 MiB.
      const bytes = await response.arrayBuffer();
      const size = bytes.byteLength;
      const start = first === null ? Math.max(0, size - last) : first;
      const end = first === null || last === null ? size - 1 : Math.min(last, size - 1);
      headers.delete('Content-Length');
      if (start > end || start >= size) {
        headers.set('Content-Range', `bytes */${size}`);
        return new Response(null, { status: 416, headers });
      }
      headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
      headers.set('Content-Length', String(end - start + 1));
      return new Response(bytes.slice(start, end + 1), { status: 206, headers });
    },
  };
}
