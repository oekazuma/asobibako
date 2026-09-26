import { remember } from './last-error';

/**
 * requestAnimationFrame で frame(dt 秒, now) を回す。戻り値で止める。
 * タブが裏に回った復帰直後などに物体が一気にワープしないよう、dt は 0.05 秒までに抑える
 */
export function animate(frame: (dt: number, now: number) => void): () => void {
  let raf = 0;
  let last = performance.now();
  let failed = false;
  const tick = (now: number) => {
    // 先に予約しておく。frame が投げても次のフレームは回り、ゲームが固まったままにならない
    raf = requestAnimationFrame(tick);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    try {
      frame(dt, now);
    } catch (e) {
      // 毎フレーム投げ続けることもあるので、残すのは最初の 1 回だけ
      if (failed) return;
      failed = true;
      console.error(e);
      remember(e instanceof Error ? e.message : String(e));
    }
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
