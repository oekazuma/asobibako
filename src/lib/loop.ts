/**
 * requestAnimationFrame で frame(dt 秒, now) を回す。戻り値で止める。
 * タブが裏に回った復帰直後などに物体が一気にワープしないよう、dt は 0.05 秒までに抑える
 */
export function animate(frame: (dt: number, now: number) => void): () => void {
  let raf = 0;
  let last = performance.now();
  const tick = (now: number) => {
    frame(Math.min(0.05, (now - last) / 1000), now);
    last = now;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
