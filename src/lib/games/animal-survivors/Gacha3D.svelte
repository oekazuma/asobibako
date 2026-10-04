<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { capture, toBoardPoint, TURNED_QUERY } from '$lib/board-input';
  import { animate } from '$lib/loop';
  import GachaHint from './GachaHint.svelte';
  import GachaList from './GachaList.svelte';
  import { closing, handleDelta, makeShow, skip, tap, tick, turn, type Phase, type Show } from './gacha-show';
  import { playGacha } from './gacha-sounds';
  import type { GearKey } from './gear';

  type SceneLike = {
    resize(w: number, h: number): void;
    render(s: Show, now: number): void;
    handle(): { x: number; y: number };
    dispose(): void;
  };

  /** scene はテストで差し替える。ふだんは開くときに three を読み込む */
  let {
    gears,
    onclose,
    scene = async (c: HTMLCanvasElement) => new (await import('./gacha3d')).GachaScene(c)
  }: { gears: GearKey[]; onclose: () => void; scene?: (c: HTMLCanvasElement) => Promise<SceneLike> } = $props();

  const show = $derived(makeShow(gears));
  /** 伝説が割れた瞬間の白い閃光（CSS のアニメで薄くして消す） */
  let flash = $state(0);
  let phase = $state<Phase>('ready');
  /** WebGL が作れないときと動きを減らす設定では、3D をやめて 2D の札で見せる */
  let flat = $state(false);
  let ready = $state(false);
  let canvas = $state<HTMLCanvasElement>();
  let three: SceneLike | null = null;
  let stop = () => {};
  /** ハンドルは 1 本の指だけで回す（2 本めの指が触れても角度が飛ばないように） */
  let finger: { id: number; x: number; y: number; moved: number } | null = null;

  const sync = () => (phase = show.phase);
  /** 段取りが出した出来事を音にし、伝説が割れたら閃光を出す */
  const drain = () => {
    for (const e of show.events.splice(0)) {
      playGacha(e);
      if (e === 'pop2') flash += 1;
    }
  };
  const toFlat = () => {
    flat = true;
    skip(show);
    sync();
  };

  function resize() {
    if (canvas) three?.resize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight);
  }

  onMount(() => {
    if (matchMedia?.('(prefers-reduced-motion: reduce)').matches) return toFlat();
    let alive = true;
    scene(canvas!).then((made) => {
      if (!alive) return made.dispose();
      three = made;
      ready = true;
      resize();
      stop = animate((dt, now) => {
        tick(show, dt);
        drain();
        if (show.phase !== phase) sync();
        if (closing(show)) {
          stop();
          onclose();
          return;
        }
        made.render(show, now / 1000);
      });
    }, toFlat);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    if (canvas) ro?.observe(canvas);
    return () => {
      alive = false;
      ro?.disconnect();
    };
  });

  onDestroy(() => {
    stop();
    three?.dispose();
    three = null;
  });

  /** 横向きでは盤面ごと回っているので、画面の指の位置を canvas の向きに直す */
  const at = (e: PointerEvent) => {
    const c = canvas!;
    const turned = matchMedia?.(TURNED_QUERY).matches ?? false;
    const [u, v] = toBoardPoint(e.clientX, e.clientY, c.getBoundingClientRect(), turned);
    return { x: u * c.clientWidth, y: v * c.clientHeight };
  };

  function down(e: PointerEvent) {
    if (finger) return;
    finger = { id: e.pointerId, ...at(e), moved: 0 };
    capture(e);
  }

  function move(e: PointerEvent) {
    if (!finger || e.pointerId !== finger.id) return;
    const q = at(e);
    if (three) turn(show, handleDelta(three.handle(), finger, q));
    drain();
    finger.moved += Math.hypot(q.x - finger.x, q.y - finger.y);
    finger.x = q.x;
    finger.y = q.y;
    sync();
  }

  function up(e: PointerEvent) {
    if (!finger || e.pointerId !== finger.id) return;
    // ほとんど動かさずに離したら押したことにする（回している指を離しても進まない）
    if (finger.moved < 12) tap(show);
    drain();
    finger = null;
    sync();
  }
</script>

<div class="gacha3d" role="dialog" aria-label="ガチャ">
  {#if flat}
    <div class="flat">
      <GachaList {gears} />
      <button class="as-card" data-close onclick={onclose}>とじる</button>
    </div>
  {:else}
    <canvas
      bind:this={canvas}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={(e) => e.pointerId === finger?.id && (finger = null)}
    ></canvas>
    {#if phase !== 'show' && phase !== 'list' && phase !== 'done'}
      <button class="as-card skip" data-skip onclick={() => (skip(show), sync())}>とばす</button>
    {/if}
    <GachaHint {phase} {gears} {ready} {flash} />
  {/if}
</div>

<style>
  .gacha3d {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: #2a2240;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    touch-action: none;
  }

  .flat {
    display: grid;
    gap: 16px;
    align-content: center;
    justify-items: center;
    height: 100%;
  }

  .skip {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: min(4cqw, 2.4cqh, 20px);
  }
</style>
