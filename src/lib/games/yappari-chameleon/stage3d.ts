import { wake } from '$lib/audio.svelte';
import { animate } from '$lib/loop';
import { layAtlas } from './atlas';
import { buildDoll } from './doll';
import { makeDoll, type DollRig } from './doll3d';
import { buildMansion } from './mansion/build';
import { COLOR_SIZE } from './paint-gpu';
import type { Play } from './play.svelte';
import { World } from './world3d';

export interface Hooks {
  /** 3D ができた。makeRig はほかの人の体を、自分と同じ面と升目で作る */
  ready(world: World, makeRig: () => DollRig): void;
  frame(dt: number, now: number): void;
  /** 縦持ちになった・裏に回った。押している指とボタンを捨てる */
  interrupt(): void;
  /** WebGL のコンテキストが戻った。塗りを列から作り直す */
  restore(): void;
  /** 3D を作れなかった */
  fail(): void;
  portrait(on: boolean): void;
  /** 3D を捨てる前に、上に載せた物を外す */
  dispose?(): void;
}

/** 屋敷と人形の 3D を canvas に作り、横持ちのあいだだけ描く。戻り値で片付ける */
export function mount3d(canvas: HTMLCanvasElement, box: HTMLElement, h: Hooks): () => void {
  const mq = matchMedia('(orientation: portrait)');
  let stop: (() => void) | null = null;
  let world: World | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const size = () => world?.resize(box.clientWidth, box.clientHeight);
  const run = () => {
    stop?.();
    stop = null;
    h.portrait(mq.matches);
    if (mq.matches) h.interrupt();
    if (mq.matches || !world) return;
    size();
    stop = animate(h.frame);
  };
  const build = () => {
    const s = buildDoll();
    const atlas = layAtlas(s.pos, s.idx, COLOR_SIZE);
    try {
      world = new World(
        canvas,
        (r) => makeDoll(r, s, atlas),
        () => h.restore()
      );
    } catch {
      // WebGL2 が作れない端末やメモリ不足では、準備中のまま固まらず理由を見せる
      h.fail();
      return;
    }
    const w = world;
    w.setStage(buildMansion());
    size();
    h.ready(w, () => makeDoll(w.renderer, s, atlas));
    run();
  };
  // 人形の面と升目を作るのに数百 ms 止まるので、「準備中」を 1 度描かせてから作る
  const raf = requestAnimationFrame(() => (timer = setTimeout(build)));
  mq.addEventListener('change', run);
  // 裏に回ると pointerup が届かないことがあるので、押している指とボタンを捨てる
  const hide = () => document.hidden && h.interrupt();
  document.addEventListener('visibilitychange', hide);
  const ro = new ResizeObserver(size);
  ro.observe(box);
  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    mq.removeEventListener('change', run);
    document.removeEventListener('visibilitychange', hide);
    ro.disconnect();
    stop?.();
    h.dispose?.();
    world?.dispose();
  };
}

/** 盤面の指を Play へ渡す。指を置いたときに音を起こす（iOS は操作の中でしか鳴らし始められない） */
export function touch(play: Play, box: HTMLElement, kind: 'down' | 'move' | 'up' | 'cancel', e: PointerEvent): void {
  if (kind === 'down') {
    wake();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // 合成イベントでは掴めないが、指の追跡は続けてよい
    }
  }
  const r = box.getBoundingClientRect();
  play.pointer(kind, e.pointerId, e.clientX - r.left, e.clientY - r.top, r.width);
}

/** 盤面に重ねる .pad の指の口。play は 3D ができるまで無く、box は bind:this で後から入るので、どちらも押したときに引く */
export function pad(play: () => Play | null | undefined, box: () => HTMLElement) {
  const on = (kind: 'down' | 'move' | 'up' | 'cancel') => (e: PointerEvent) => {
    const p = play();
    if (p) touch(p, box(), kind, e);
  };
  return { onpointerdown: on('down'), onpointermove: on('move'), onpointerup: on('up'), onpointercancel: on('cancel') };
}
