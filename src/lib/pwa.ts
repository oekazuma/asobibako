/** 新しい Service Worker を取りに行き、取り込み（オフライン用の保存）が終わってから読み直す */
export async function updateApp(): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) {
    await registration.update();
    const worker = registration.installing ?? registration.waiting;
    if (worker) {
      await new Promise<void>((done) => {
        // 取り込みが終わらないまま待ち続けないよう、30 秒で見切って読み直す
        const timer = setTimeout(done, 30_000);
        worker.addEventListener('statechange', () => {
          if (worker.state !== 'activated' && worker.state !== 'redundant') return;
          clearTimeout(timer);
          done();
        });
      });
    }
  } else {
    // 名前を asobibako に変える前の端末にも table-duel- のキャッシュが残っているので両方消す
    const keys = (await caches?.keys()) ?? [];
    await Promise.all(
      keys.filter((k) => k.startsWith('table-duel-') || k.startsWith('asobibako-')).map((k) => caches.delete(k))
    );
  }
  location.reload();
}

export type PwaStatus = { standalone: boolean; swActive: boolean; cached: boolean };

/** ホーム画面から起動しているか / Service Worker が有効か / オフライン用の保存があるか */
export async function pwaStatus(): Promise<PwaStatus> {
  // 安全でない接続などでは caches や serviceWorker そのものが生えていないので、globalThis から辿る
  const standalone =
    globalThis.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const swActive = !!(await navigator.serviceWorker?.getRegistration())?.active;
  const key = ((await globalThis.caches?.keys()) ?? []).find((k) => k.startsWith('asobibako-'));
  const cached = !!key && (await (await caches.open(key)).keys()).length > 0;
  return { standalone, swActive, cached };
}
