<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { COLORS, hatch, isBody, isLoop, random, step, type Stroke, type World } from './engine';
  import { blob, creature, pen } from './paint';
  import Palette from './Palette.svelte';
  import { sounds } from './sounds';

  let { onhint }: SoloProps = $props();

  const FIRST = 'まるを かいて、せんを かこう';
  const MORE = 'もう いっぽん！';
  const HATCH = 'ニョキッ！';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let color = $state<string>(COLORS[0]);
  const world: World = { aspect: 1, creatures: [] };
  /** 描き終えて、胴体を待っている頭 */
  let head: Stroke | null = null;
  let drawing: { id: number; stroke: Stroke } | null = null;
  /** 頭にも胴体にもならなかった線。薄れて消える */
  let fading: { stroke: Stroke; left: number }[] = [];
  let hintTimer: ReturnType<typeof setTimeout> | undefined;

  const input = new BoardInput({
    down: (event, x, y) => {
      if (drawing) return;
      drawing = { id: event.pointerId, stroke: { color, pts: [[x * world.aspect, y]] } };
    },
    up: (event) => {
      if (drawing?.id !== event.pointerId) return;
      const { stroke } = drawing;
      drawing = null;
      if (!head && isLoop(stroke.pts)) {
        head = stroke;
        sounds.head();
        onhint?.(MORE);
      } else if (head && isBody(stroke.pts)) {
        world.creatures.push(hatch(head, stroke));
        head = null;
        cheer();
      } else {
        fading.push({ stroke, left: 0.4 });
        sounds.miss();
      }
    }
  });

  function cheer() {
    sounds.hatch();
    onhint?.(HATCH);
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => onhint?.(head ? MORE : FIRST), 1200);
  }

  function summon() {
    world.creatures.push(random(world.aspect));
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
    for (const f of fading) f.left -= dt;
    fading = fading.filter((f) => f.left > 0);
    if (!ctx) return;
    const s = input.px(1, 1)[1] * (devicePixelRatio || 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const c of world.creatures) creature(ctx, c);
    for (const f of fading) pen(ctx, f.stroke.pts, f.stroke.color, f.left / 0.4);
    if (head) blob(ctx, head.pts, head.color);
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

<div class="board" use:input.board={resize} role="application" aria-label="らくがきムシの画用紙">
  <canvas bind:this={canvas}></canvas>
</div>
<Palette bind:color onsummon={summon} />

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
