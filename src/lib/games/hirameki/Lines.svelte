<script lang="ts">
  import { circle, LINE } from './fig';
  import Figure from './Figure.svelte';
  import { sounds } from './sounds';
  import type { Figure as Fig, LinesQ, Point, Shape } from './types';

  let {
    p,
    fig,
    path = $bindable()
  }: {
    p: LinesQ;
    fig?: Fig;
    /** 線を曲げた pegs の添え字 */
    path: number[];
  } = $props();

  const PEN = '#1f9bff';

  /** 図があれば点は図の座標。なければ点の並び（方眼の目など）を幅 300 くらいの図に広げる */
  const view = $derived.by(() => {
    if (fig) return { fig, at: (q: Point) => q };
    const all = [...p.dots, ...p.pegs];
    const [minX, minY] = [Math.min(...all.map((q) => q.x)), Math.min(...all.map((q) => q.y))];
    const [spanX, spanY] = [Math.max(...all.map((q) => q.x)) - minX, Math.max(...all.map((q) => q.y)) - minY];
    const k = 240 / (Math.max(spanX, spanY) || 1);
    const pad = 30;
    return {
      fig: { w: spanX * k + pad * 2, h: spanY * k + pad * 2, s: [] },
      at: (q: Point) => ({ x: (q.x - minX) * k + pad, y: (q.y - minY) * k + pad })
    };
  });

  const pegs = $derived(p.pegs.map(view.at));

  /** 押せる丸の大きさ。見た目の点より大きくし、となりの peg とは重ならないようにする */
  const hit = $derived.by(() => {
    let near = Infinity;
    for (const a of pegs) for (const b of pegs) if (a !== b) near = Math.min(near, Math.hypot(a.x - b.x, a.y - b.y));
    return Math.min(44, near * 0.9);
  });

  const drawn = $derived.by(() => {
    const line = path.map((i) => pegs[i]);
    const last = line.at(-1);
    const s: Shape[] = [
      ...view.fig.s,
      ...pegs.map((q) => circle(q.x, q.y, 4, '#d9cbbf', { stroke: 'none' })),
      ...p.dots.map(view.at).map((q) => circle(q.x, q.y, 9, LINE, { stroke: 'none' })),
      {
        el: 'polyline',
        a: {
          points: line.map((q) => `${q.x},${q.y}`).join(' '),
          fill: 'none',
          stroke: PEN,
          'stroke-width': 5,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          opacity: 0.85
        }
      },
      ...(last ? [circle(last.x, last.y, 8, '#fff', { stroke: PEN, 'stroke-width': 4 })] : [])
    ];
    return { ...view.fig, s };
  });

  function press(i: number) {
    if (path.at(-1) === i) return;
    if (path.length > p.segments) return sounds.wrong();
    path = [...path, i];
    sounds.pick();
  }
</script>

<Figure fig={drawn}>
  {#each { length: pegs.length }, i (i)}
    {@const q = pegs[i]}
    <button
      class="peg"
      style:left="{(q.x / drawn.w) * 100}%"
      style:top="{(q.y / drawn.h) * 100}%"
      style:width="{(hit / drawn.w) * 100}%"
      aria-label="点 {i + 1}"
      onclick={() => press(i)}
    ></button>
  {/each}
</Figure>

<style>
  .peg {
    position: absolute;
    aspect-ratio: 1;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    translate: -50% -50%;
    cursor: pointer;
  }
</style>
