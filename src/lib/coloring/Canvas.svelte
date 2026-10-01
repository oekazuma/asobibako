<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import { compose, fillImage, type Art } from './art';
  import { regionAt, SIZE, type Regions } from './regions';
  import { FULL, pinch, toContent, type View } from './zoom';

  let {
    art,
    regions,
    colors,
    onfill
  }: { art: Art; regions: Regions; colors: Record<number, string>; onfill: (region: number) => void } = $props();

  /** タップとみなす指の動きの上限（塗る画面の幅に対する割合） */
  const TAP = 0.03;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let fill = $state<HTMLCanvasElement>();
  let view = $state<View>(FULL);
  /** 塗るかもしれない 1 本目の指。2 本目が触れたり大きく動いたりしたら塗らない */
  let tap: { id: number; x: number; y: number } | null = null;
  /** つまみ始めたときの見え方と 2 本の指の位置 */
  let pinching: { view: View; ids: [number, number]; at: [[number, number], [number, number]] } | null = null;

  const point = (id: number): [number, number] => {
    const f = input.fingers.all.get(id);
    return f ? [f.x, f.y] : [0, 0];
  };

  const input = new BoardInput({
    // 触れた瞬間に塗ると、2 本指でつまむときの 1 本目で塗れてしまうので、離したときに塗る
    down: (event, x, y) => {
      const ids = [...input.fingers.all.keys()];
      if (ids.length === 1) tap = { id: event.pointerId, x, y };
      else {
        tap = null;
        const pair: [number, number] = [ids[0], ids[1]];
        pinching = { view, ids: pair, at: [point(pair[0]), point(pair[1])] };
      }
    },
    move: (event, x, y) => {
      if (tap && event.pointerId === tap.id && Math.hypot(x - tap.x, y - tap.y) > TAP) tap = null;
      if (!pinching || !pinching.ids.includes(event.pointerId)) return;
      view = pinch(pinching.view, pinching.at[0], pinching.at[1], point(pinching.ids[0]), point(pinching.ids[1]));
    },
    up: (event, _finger, x, y) => {
      if (pinching?.ids.includes(event.pointerId)) pinching = null;
      if (!tap || event.pointerId !== tap.id) return;
      const start = tap;
      tap = null;
      if (Math.hypot(x - start.x, y - start.y) > TAP) return;
      const [cx, cy] = toContent(view, x, y);
      const region = regionAt(regions, Math.floor(cx * SIZE), Math.floor(cy * SIZE));
      if (region >= 0) onfill(region);
    }
  });

  function draw() {
    if (ctx && fill) compose(ctx, fill, art, canvas.width, view);
  }

  function resize() {
    const [w] = input.px(1, 1);
    canvas.width = canvas.height = Math.round(w * (devicePixelRatio || 1));
    ctx = canvas.getContext('2d');
    draw();
  }

  // 別の絵に替わったら、全体の表示に戻す
  $effect.pre(() => {
    void art;
    view = FULL;
  });

  $effect(() => {
    // 先に読んでおく。fill が無い最初の回に読まないと、この effect が何も追わなくなる
    const next = { art, regions, colors };
    if (!fill) return;
    fillImage(fill.getContext('2d')!, next.regions, next.colors, next.art);
    // draw は view を読むので、追うとつまむたびに塗りを作り直してしまう
    untrack(draw);
  });

  // つまんでいるあいだは見え方だけが変わるので、塗りを作り直さずに描き直す
  $effect(() => {
    void view;
    draw();
  });

  onMount(() => {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    fill = c;
  });
</script>

<div class="wrap">
  <div class="sheet" use:input.board={resize}>
    <canvas bind:this={canvas}></canvas>
  </div>
  {#if view.scale > 1}
    <!-- 盤面の外に置く。盤面の上だと押した指が塗りの指として拾われる -->
    <button class="pill reset" onclick={() => (view = FULL)}>もとに もどす</button>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
  }

  .reset {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 6px 14px;
    font-size: 14px;
  }

  .sheet {
    width: min(100cqw, 100cqh);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    touch-action: none;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
