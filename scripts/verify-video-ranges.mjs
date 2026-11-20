#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createVideoWorker } from '../cloudflare/video-worker.mjs';

const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
const origin = 'https://fixture.invalid';
const video = '/videos/preview-toeic-vocab.mp4';
const etag = '"video-v1"';
const modified = 'Fri, 20 Nov 2026 00:00:00 GMT';
let assetRequest;
const env = { ASSETS: { async fetch(request) {
  assetRequest = request;
  assert.equal(request.headers.get('Range'), null, 'Pages must receive a full-asset request');
  assert.equal(request.headers.get('If-Range'), null);
  if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304 });
  // Model the production defect: ASSETS itself never implements partial responses.
  return new Response(request.method === 'HEAD' ? null : bytes, { headers: {
    'Content-Type': 'video/mp4', 'Content-Length': String(bytes.length),
    ETag: etag, 'Last-Modified': modified,
  } });
} } };
let forwarded;
const worker = createVideoWorker({ fetch(request) { forwarded = request; return new Response('passthrough'); } }, [video]);
const fetchVideo = (headers = {}, method = 'GET') => worker.fetch(new Request(origin + video + '?v=fixture', { method, headers }), env);
let count = 0;
for (const [range, start, end] of [
  ['bytes=0-', 0, 255], ['bytes=128-', 128, 255], ['bytes=10-19', 10, 19],
  ['bytes=-10', 246, 255], ['bytes=-500', 0, 255], ['bytes=250-999', 250, 255],
]) {
  const response = await fetchVideo({ Range: range });
  assert.equal(response.status, 206, range);
  assert.equal(response.headers.get('Content-Range'), `bytes ${start}-${end}/256`);
  assert.equal(response.headers.get('Content-Length'), String(end - start + 1));
  assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(response.headers.get('Content-Type'), 'video/mp4');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes.slice(start, end + 1));
  assert.equal(new URL(assetRequest.url).search, '?v=fixture');
  count++;
}
for (const range of ['bytes=256-', 'bytes=90-10', 'bytes=-0']) {
  const response = await fetchVideo({ Range: range });
  assert.equal(response.status, 416, range);
  assert.equal(response.headers.get('Content-Range'), 'bytes */256');
  assert.equal((await response.arrayBuffer()).byteLength, 0);
  count++;
}
for (const headers of [{}, ...['bytes=', 'items=0-1', 'bytes=0-1,3-4', 'bytes=9007199254740992-'].map(Range => ({ Range })),
  { Range: 'bytes=10-19', 'If-Range': '"old"' }, { Range: 'bytes=10-19', 'If-Range': 'W/' + etag },
  { Range: 'bytes=10-19', 'If-Range': 'Thu, 19 Nov 2026 00:00:00 GMT' },
]) {
  const response = await fetchVideo(headers);
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  count++;
}
for (const validator of [etag, modified]) {
  const response = await fetchVideo({ Range: 'bytes=10-19', 'If-Range': validator });
  assert.equal(response.status, 206);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes.slice(10, 20));
  count++;
}
const unchanged = await fetchVideo({ Range: 'bytes=10-19', 'If-None-Match': etag });
assert.equal(unchanged.status, 304);
const head = await fetchVideo({ Range: 'bytes=10-19' }, 'HEAD');
assert.equal(head.status, 200);
assert.equal(head.headers.get('Content-Length'), '256');
assert.equal((await head.arrayBuffer()).byteLength, 0);
for (const [pathname, method] of [['/', 'GET'], ['/images/image.webp', 'GET'], ['/videos/unknown.mp4', 'GET'], [video, 'POST']]) {
  const request = new Request(origin + pathname, { method });
  assert.equal(await (await worker.fetch(request, env)).text(), 'passthrough');
  assert.equal(forwarded, request);
}
for (const status of [404, 500]) {
  const response = await worker.fetch(new Request(origin + video), { ASSETS: { fetch: () => new Response('error', { status }) } });
  assert.equal(response.status, status);
}
console.log(`OK video ranges: ${count} range/validator cases, HEAD/304, errors, exact bytes, and route isolation`);
