/// <reference types="@sveltejs/kit" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// この worker は <meta> の CSP の外で走る（GitHub Pages はヘッダを出せない）。import は $service-worker だけに保つ
import { base, build, files, prerendered, version } from '$service-worker';

const sw = globalThis.self as unknown as ServiceWorkerGlobalScope;

const PREFIX = 'asobibako-';
const CACHE = `${PREFIX}${version}`;
/**
 * ぬりえの「AI で せんを かく」のモデルと実行部分（あわせて約 31MB）。使う人だけが初めて押したときに読みこみ、
 * 版ごとに取り直すと更新のたびに 31MB を落とすので、版の付かない別の入れ物に置いて更新しても残す。
 * 実行部分は Web Worker が読むファイルで、$service-worker の build には載らない
 */
const AI_CACHE = `${PREFIX}ai`;
const WORKERS = '/immutable/workers/';
const heavy = (path: string) => path.startsWith(`${base}/ai/`) || path.includes(WORKERS);
/** worker のファイルは中身が変わると名前の末尾のハッシュだけが変わる。同じ名前の前の版を消すのに使う */
const stem = (path: string) => path.replace(/-[\w-]{8}(\.\w+)$/, '$1');
const ASSETS = [...build, ...files, ...prerendered].filter((path) => !heavy(path));
const PAGES = [...files, ...prerendered].filter((path) => !heavy(path));
const ASSET_PATHS = new Set(ASSETS);
const HEAVY_PATHS = new Set([...build, ...files].filter(heavy));

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // 版の付かない HTML などは HTTP キャッシュ（Pages は max-age=600）に前の版が残っていると、それを拾って
      // 前の版のチャンクを指す HTML を抱えこむ。デプロイ後にそのチャンクが消えると壊れたままになるので、取り直させる
      .then((cache) =>
        cache.addAll([
          ...build.filter((path) => !heavy(path)),
          ...PAGES.map((path) => new Request(path, { cache: 'no-cache' }))
        ])
      )
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // caches はオリジンで共有され、同じ github.io に別のアプリのキャッシュもある。自分の古い版だけを消す
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE && k !== AI_CACHE).map((k) => caches.delete(k))
        )
      )
      // いまの版で使わなくなったモデルを消す。worker のファイルは、新しい版を入れるときに置き換える
      .then(() => caches.open(AI_CACHE))
      .then(async (cache) => {
        for (const request of await cache.keys()) {
          const path = new URL(request.url).pathname;
          if (!path.includes(WORKERS) && !HEAVY_PATHS.has(path)) await cache.delete(request);
        }
      })
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // 扱うのは自分の配信物だけ。ほかのオリジンは素通しにして、キャッシュにも入れない
  if (url.origin !== sw.location.origin) return;

  if (heavy(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(AI_CACHE);
        const hit = await cache.match(url.pathname);
        if (hit) return hit;
        const response = await fetch(event.request);
        if (response.status === 200)
          cache
            .put(url.pathname, response.clone())
            .then(async () => {
              if (!url.pathname.includes(WORKERS)) return;
              for (const request of await cache.keys()) {
                const path = new URL(request.url).pathname;
                if (path !== url.pathname && stem(path) === stem(url.pathname)) await cache.delete(request);
              }
            })
            .catch(() => {});
        return response;
      })()
    );
    return;
  }

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
