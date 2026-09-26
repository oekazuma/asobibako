<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import {
    add,
    COLORS,
    fit,
    groups,
    hatch,
    parade,
    poke,
    random,
    speck,
    step,
    type Stroke,
    type World
  } from './engine';
  import { creature, pen, sketch } from './paint';
  import Palette from './Palette.svelte';
  import { sounds } from './sounds';
  import Stock from './Stock.svelte';
  import { loadStock, pack, place, saveStock, type Doodle } from './stock';

  // 自由あそびで指示文も出さないので、シェルから受ける level と onhint は使わない
  const _props: SoloProps = $props();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let color = $state<string>(COLORS[2].hex);
  const world: World = { aspect: 1, creatures: [] };
  /** 描き終えて、「うごけ！」を待っている線 */
  let lines = $state.raw<Stroke[]>([]);
  /** 描いている途中の線。2 人で同時に描けるよう、指ごとに持つ */
  let drawing: { id: number; stroke: Stroke }[] = [];
  let stock = $state.raw<Doodle[]>([]);
  let stockOpen = $state(false);

  const input = new BoardInput({
    down: (event, x, y) => {
      drawing.push({ id: event.pointerId, stroke: { color, pts: [[x * world.aspect, y]] } });
    },
    up: (event) => {
      const stroke = drawing.find((d) => d.id === event.pointerId)?.stroke;
      if (!stroke) return;
      drawing = drawing.filter((d) => d.stroke !== stroke);
      if (poke(world, lines, stroke)) {
        sounds.boing();
        return;
      }
      lines = [...lines, stroke];
      sounds.line();
    }
  });

  /** 離れて描いた絵はそれぞれ別の子になる */
  function go() {
    const kids = groups(lines);
    if (!kids.length) return;
    for (const strokes of kids) add(world, hatch(strokes)!);
    const kept = kids.filter((strokes) => !speck(strokes));
    if (kept.length) stock = saveStock([...kept.map((strokes) => pack(strokes)).reverse(), ...stock], kept.length);
    lines = [];
    sounds.hatch();
  }

  function undo() {
    lines = lines.slice(0, -1);
    sounds.undo();
  }

  function call(d: Doodle) {
    stockOpen = false;
    const x = world.aspect * (0.2 + Math.random() * 0.6);
    add(world, fit(hatch(place(d, x, 0.2 + Math.random() * 0.5))!, world.aspect));
    sounds.hatch();
  }

  function star(d: Doodle) {
    stock = saveStock(stock.map((other) => (other === d ? { ...d, star: !d.star } : other)));
  }

  function remove(d: Doodle) {
    stock = saveStock(stock.filter((other) => other !== d));
    sounds.undo();
  }

  function tidy() {
    world.creatures = [];
    stockOpen = false;
  }

  function march() {
    parade(
      world,
      stock.map((d) => d.strokes)
    );
    stockOpen = false;
    sounds.parade();
  }

  function summon() {
    add(world, random(world.aspect));
    sounds.hatch();
  }

  function resize(aspect: number) {
    world.aspect = aspect;
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx = canvas.getContext('2d');
  }

  function frame(dt: number) {
    // ずかんを開いているあいだは止めておく。裏で全画面を描き直し続けると、iPad でずかんのスクロールがかくつく
    if (stockOpen) return;
    for (const {
      id,
      stroke: { pts }
    } of drawing) {
      const finger = input.fingers.all.get(id);
      if (!finger) continue;
      const [lx, ly] = pts[pts.length - 1];
      const x = finger.x * world.aspect;
      if (Math.hypot(x - lx, finger.y - ly) > 0.004) pts.push([x, finger.y]);
    }
    step(world, dt);
    if (!ctx) return;
    const s = input.px(1, 1)[1] * (devicePixelRatio || 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const c of world.creatures) creature(ctx, c);
    sketch(ctx, lines);
    for (const { stroke } of drawing) pen(ctx, stroke.pts, stroke.color);
  }

  onMount(() => {
    stock = loadStock();
    return animate(frame);
  });
</script>

<div class="board" use:input.board={resize} role="application" aria-label="らくがきパレードの画用紙">
  <canvas bind:this={canvas}></canvas>
</div>
<Palette
  bind:color
  ready={lines.length > 0}
  ongo={go}
  onundo={undo}
  onsummon={summon}
  onstock={() => (stockOpen = true)}
/>
{#if stockOpen}
  <Stock
    doodles={stock}
    oncall={call}
    onremove={remove}
    onstar={star}
    onclear={tidy}
    onparade={march}
    onclose={() => (stockOpen = false)}
  />
{/if}

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    background: #fff4f6;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
