/// <reference types="@sveltejs/kit" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// この worker は <meta> の CSP の外で走る（GitHub Pages はヘッダを出せない）。import は $service-worker だけに保つ
import { build, files, prerendered, version } from '$service-worker';

const sw = globalThis.self as unknown as ServiceWorkerGlobalScope;

const CACHE = `table-duel-${version}`;
const ASSETS = [...build, ...files, ...prerendered];
const ASSET_PATHS = new Set(ASSETS);

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
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
