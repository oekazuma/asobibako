<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { capture, toBoardPoint, TURNED_QUERY } from '$lib/board-input';
  import { animate } from '$lib/loop';
  import Capsule from './Capsule.svelte';
  import { closing, handleDelta, makeShow, skip, tap, tick, turn, type Phase, type Show } from './gacha-show';
  import { parseKey, RARITY_NAME, type GearKey } from './gear';

  type SceneLike = {
    resize(w: number, h: number): void;
    render(s: Show, now: number): void;
    handle(): { x: number; y: number };
    dispose(): void;
  };

  /** scene はテストで差し替える。ふだんは開くときに three を読み込む */
  let {
    gear,
    onclose,
    scene = async (c: HTMLCanvasElement) => new (await import('./gacha3d')).GachaScene(c)
  }: { gear: GearKey; onclose: () => void; scene?: (c: HTMLCanvasElement) => Promise<SceneLike> } = $props();

  const show = $derived(makeShow(gear));
  const p = $derived(parseKey(gear));
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
    finger.moved += Math.hypot(q.x - finger.x, q.y - finger.y);
    finger.x = q.x;
    finger.y = q.y;
    sync();
  }

  function up(e: PointerEvent) {
    if (!finger || e.pointerId !== finger.id) return;
    // ほとんど動かさずに離したら押したことにする（回している指を離しても進まない）
    if (finger.moved < 12) tap(show);
    finger = null;
    sync();
  }
</script>

<div class="gacha3d" role="dialog" aria-label="ガチャ">
  {#if flat}
    <div class="flat">
      <Capsule {gear} delay={0} />
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
    {#if phase !== 'show' && phase !== 'done'}
      <button class="as-card skip" data-skip onclick={() => (skip(show), sync())}>とばす</button>
    {/if}
    <p class="hint">
      {#if !ready}じゅんびちゅう…
      {:else if phase === 'ready'}ハンドルを まわしてね
      {:else if phase === 'wait'}カプセルを おしてね
      {:else if (phase === 'show' || phase === 'done') && p}<b class="r{p.rarity}">{RARITY_NAME[p.rarity]}</b>
        {p.def.name}<small>おして とじる</small>{/if}
    </p>
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
    place-content: center;
    height: 100%;
  }

  .skip {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: min(4cqw, 2.4cqh, 20px);
  }

  .hint {
    position: absolute;
    right: 0;
    bottom: 10%;
    left: 0;
    display: grid;
    gap: 4px;
    justify-items: center;
    margin: 0;
    color: #fff8ec;
    font-size: min(5.4cqw, 3.2cqh, 28px);
    font-weight: 900;
    text-shadow: 0 2px 0 #24151f;
    pointer-events: none;
  }

  .hint small {
    color: #d8d0e8;
    font-size: 0.6em;
  }

  .r1 {
    color: #5ab0ff;
  }

  .r2 {
    color: #ffd84a;
  }
</style>
