/// <reference types="@sveltejs/kit" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// この worker は <meta> の CSP の外で走る（GitHub Pages はヘッダを出せない）。import は $service-worker だけに保つ
import { build, files, prerendered, version } from '$service-worker';

const sw = globalThis.self as unknown as ServiceWorkerGlobalScope;

const PREFIX = 'asobibako-';
const CACHE = `${PREFIX}${version}`;
const ASSETS = [...build, ...files, ...prerendered];
const ASSET_PATHS = new Set(ASSETS);

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // 版の付かない HTML などは HTTP キャッシュ（Pages は max-age=600）に前の版が残っていると、それを拾って
      // 前の版のチャンクを指す HTML を抱えこむ。デプロイ後にそのチャンクが消えると壊れたままになるので、取り直させる
      .then((cache) =>
        cache.addAll([...build, ...[...files, ...prerendered].map((path) => new Request(path, { cache: 'no-cache' }))])
      )
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // caches はオリジンで共有され、同じ github.io に別のアプリのキャッシュもある。自分の古い版だけを消す
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // 扱うのは自分の配信物だけ。ほかのオリジンは素通しにして、キャッシュにも入れない
  if (url.origin !== sw.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      // ビルド成果物はバージョン付きなので、キャッシュのものと必ず同一
      if (ASSET_PATHS.has(url.pathname)) {
        const hit = await cache.match(url.pathname);
        if (hit) return hit;
      }

      try {
        const response = await fetch(event.request);
        // クエリ違いを別々に溜めない。容量超過は握って、次からネットワークだけで動く
        if (response.status === 200 && !url.search) cache.put(event.request, response.clone()).catch(() => {});
        return response;
      } catch (err) {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        throw err;
      }
    })()
  );
});
