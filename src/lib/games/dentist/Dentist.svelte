<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { browser } from '$app/environment';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { advice, ORDER_TEXT, spent, wrongText, type Advice } from './advice';
  import {
    createState,
    expression,
    lift,
    rub,
    select,
    step,
    TIP,
    touch,
    WORLD_H,
    type DentistEvent,
    type ToolId
  } from './engine';
  import { Effects } from './effects';
  import { introduces, levelFor } from './levels';
  import { backdrop, paint } from './paint';
  import PainMeter from './PainMeter.svelte';
  import { sounds } from './sounds';
  import Tray from './Tray.svelte';

  let { level, onfinish, onhint }: SoloProps = $props();

  /** 上の隅に SoloShell のボタン、中央にいたいメーターと吹き出しが来るぶん、盤面を下げる */
  const TOP = 130;
  const IDLE_S = 5;
  const DEMO_S = 2.5;
  const SAY_S = 2.5;
  // level はゲームごと作り直されるので、最初の値だけ使えばよい
  const n = untrack(() => level);
  const stage = levelFor(n);
  const game = createState(stage);
  const fresh = introduces(n);
  const still = browser && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fx = new Effects(still);
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let view = { scale: 1, ox: 0, oy: 0 };
  let finger: number | null = null;
  let tool = $state(game.tool);
  let pain = $state(game.pain);
  let face = $state(expression(game));
  let nudge = $state<ToolId | null>(null);
  let dim = $state<ToolId[]>([]);
  let say: { text: string; until: number; tool: ToolId | null } = { text: '', until: -1, tool: null };
  let hint = '';
  const demoed: ToolId[] = [];
  let demoUntil = -1;
  let finishTimer: ReturnType<typeof setTimeout> | undefined;

  const toWorld = (bx: number, by: number) => {
    const [px, py] = input.px(bx, by);
    return [(px - view.ox) / view.scale, (py - view.oy) / view.scale - TIP] as const;
  };

  const input = new BoardInput({
    down: (event, x, y) => {
      if (finger !== null) return;
      finger = event.pointerId;
      handle(touch(game, ...toWorld(x, y)));
    },
    up: (event, _finger, x, y) => {
      if (event.pointerId !== finger) return;
      finger = null;
      handle(lift(game, ...toWorld(x, y)));
    }
  });

  function choose(next: ToolId) {
    if (select(game, next)) sounds.select();
    tool = game.tool;
  }

  function handle(events: DentistEvent[]) {
    for (const e of events) {
      if (e.type === 'wrong') say = { text: wrongText(e.need), until: game.time + SAY_S, tool: e.need };
      else if (e.type === 'order') say = { text: ORDER_TEXT, until: game.time + SAY_S, tool: 'tweezers' };
      else if (e.type === 'clear' || e.type === 'cry') {
        if (e.type === 'clear') sfx.finish();
        const cleared = e.type === 'clear';
        finishTimer = setTimeout(() => onfinish(cleared), cleared ? 1400 : 1800);
      }
    }
    fx.handle(events, game);
  }

  function resize() {
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const scale = Math.min(w, (h - TOP) / WORLD_H);
    view = { scale, ox: (w - scale) / 2, oy: TOP + (h - TOP - scale * WORLD_H) / 2 };
    ctx = canvas.getContext('2d');
  }

  /** 手助けの表示を決める。吹き出しは効かない道具のひとことを優先し、なければいまやることを出す */
  function guide(next: Advice | null): Advice | null {
    const talking = game.time < say.until;
    const text = talking ? say.text : (next?.text ?? '');
    if (text !== hint) onhint?.((hint = text));
    const idle = game.idle >= IDLE_S;
    const want = talking ? say.tool : idle ? (next?.tool ?? null) : null;
    if (want !== nudge) nudge = want;
    if (next && fresh.includes(next.tool) && !demoed.includes(next.tool)) {
      demoed.push(next.tool);
      demoUntil = game.time + DEMO_S;
    }
    return next && (idle || game.time < demoUntil) ? next : null;
  }

  function frame(dt: number) {
    const f = finger === null ? undefined : input.fingers.all.get(finger);
    if (f) handle(rub(game, ...toWorld(f.x, f.y), dt));
    handle(step(game, dt));
    fx.step(dt);
    const ghost = guide(advice(game));
    const shown = Math.round(game.pain * 50) / 50;
    if (shown !== pain) pain = shown;
    const now = expression(game);
    if (now !== face) face = now;
    const idle = spent(game);
    if (idle.join() !== dim.join()) dim = idle;
    if (!ctx) return;
    const dpr = devicePixelRatio || 1;
    const [w, h] = input.px(1, 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(ctx, w, h);
    const [sx, sy] = fx.shake.offset(dt, 10);
    const s = view.scale * dpr;
    ctx.setTransform(s, 0, 0, s, (view.ox + sx) * dpr, (view.oy + sy) * dpr);
    paint(ctx, game, { tip: f ? toWorld(f.x, f.y) : null, ghost, lid: fx.lid, still });
    fx.draw(ctx);
  }

  onMount(() => {
    const stop = animate(frame);
    return () => {
      stop();
      clearTimeout(finishTimer);
      onhint?.('');
    };
  });
</script>

<div class="dentist">
  <div class="view" use:input.board={resize} role="application" aria-label="はいしゃさんの画面">
    <canvas bind:this={canvas}></canvas>
    <PainMeter {pain} {face} />
  </div>
  <Tray tools={stage.tools} current={tool} {nudge} spent={dim} onselect={choose} />
</div>

<style>
  .dentist {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #fbf5e8;
  }

  .view {
    position: relative;
    flex: 1;
    overflow: hidden;
    touch-action: none;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
