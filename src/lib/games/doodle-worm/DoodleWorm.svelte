<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { add, COLORS, hatch, random, step, type Stroke, type World } from './engine';
  import { creature, pen, sketch } from './paint';
  import Palette from './Palette.svelte';
  import { sounds } from './sounds';

  let { onhint }: SoloProps = $props();

  const FIRST = 'すきな えを かいてね';
  const MORE = 'かけたら「うごけ！」';
  const HATCH = 'うごいた！';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let color = $state<string>(COLORS[2].hex);
  const world: World = { aspect: 1, creatures: [] };
  /** 描き終えて、「うごけ！」を待っている線 */
  let lines = $state.raw<Stroke[]>([]);
  let drawing: { id: number; stroke: Stroke } | null = null;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;

  const input = new BoardInput({
    down: (event, x, y) => {
      if (drawing) return;
      drawing = { id: event.pointerId, stroke: { color, pts: [[x * world.aspect, y]] } };
    },
    up: (event) => {
      if (drawing?.id !== event.pointerId) return;
      lines = [...lines, drawing.stroke];
      drawing = null;
      sounds.line();
      if (lines.length === 1) onhint?.(MORE);
    }
  });

  function cheer() {
    sounds.hatch();
    onhint?.(HATCH);
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => onhint?.(lines.length ? MORE : FIRST), 1200);
  }

  function go() {
    const c = hatch(lines);
    if (!c) return;
    add(world, c);
    lines = [];
    cheer();
  }

  function undo() {
    lines = lines.slice(0, -1);
    sounds.undo();
    if (!lines.length) onhint?.(FIRST);
  }

  function summon() {
    add(world, random(world.aspect));
    cheer();
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
    const finger = drawing && input.fingers.all.get(drawing.id);
    if (drawing && finger) {
      const pts = drawing.stroke.pts;
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
    if (drawing) pen(ctx, drawing.stroke.pts, drawing.stroke.color);
  }

  onMount(() => {
    onhint?.(FIRST);
    const stop = animate(frame);
    return () => {
      stop();
      clearTimeout(hintTimer);
    };
  });
</script>

<div class="board" use:input.board={resize} role="application" aria-label="らくがきパレードの画用紙">
  <canvas bind:this={canvas}></canvas>
</div>
<Palette bind:color ready={lines.length > 0} ongo={go} onundo={undo} onsummon={summon} />

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
