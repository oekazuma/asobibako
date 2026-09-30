<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { direct } from './director';
  import { RunFx } from './effects';
  import { createState, rank, score, speed, step, type RunInput } from './engine';
  import { Gestures, type Gesture } from './gesture';
  import Hud from './Hud.svelte';
  import { RunWorld } from './world3d';

  let { level, onfinish }: SoloProps = $props();

  let gl: HTMLCanvasElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let world: RunWorld | undefined;
  // level はゲームごと作り直されるので、最初の値だけ使えばよい
  const fresh = () => createState(level);
  const game = fresh();
  const fx = new RunFx();
  const gestures = new Gestures();
  /** 次の step() に渡す入力。指の出来事はフレームの合間に届くので、ここへためる */
  let pending: RunInput = {};
  let ready = $state(false);
  let time = $state(game.time);
  let combo = $state(0);
  let followers = $state(0);
  let mps = $state(0);
  let boss = $state<{ hp: number; max: number } | null>(null);
  let endTimer: ReturnType<typeof setTimeout> | undefined;

  function apply(list: Gesture[]) {
    for (const g of list) {
      if (g === 'shoot') pending.shoot = true;
      else if (g === 'jump') pending.jump = true;
      else pending.move = (pending.move ?? 0) + (g === 'right' ? 1 : -1);
    }
  }

  const input = new BoardInput({
    down: (event, x, y) => apply(gestures.down(event.pointerId, ...input.px(x, y))),
    up: (event, _finger, x, y) => apply(gestures.up(event.pointerId, ...input.px(x, y)))
  });

  function resize() {
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx = canvas.getContext('2d');
    world?.resize(w, h);
  }

  function finish() {
    if (game.result === 'clear') {
      fx.end({ kind: 'rank', rank: rank(score(game), game.rule.best), points: score(game) });
      endTimer = setTimeout(() => onfinish(true), 2000);
    } else {
      fx.end({ kind: 'timeout' });
      endTimer = setTimeout(() => onfinish(false), 1000);
    }
  }

  /** Svelte の状態は変わったときだけ書く。残り時間は 0.1 秒ごとに間引く */
  function syncHud() {
    const t = Math.ceil(game.time * 10) / 10;
    if (time !== t) time = t;
    if (combo !== game.combo) combo = game.combo;
    if (followers !== game.followers) followers = game.followers;
    const v = Math.round(speed(game) * 10) / 10;
    if (mps !== v) mps = v;
    const b = game.boss?.phase === 'fight' ? game.boss : null;
    if (!b) boss = null;
    else if (boss?.hp !== b.hp) boss = { hp: b.hp, max: b.max };
  }

  function frame(dt: number) {
    for (const [id, f] of input.fingers.all) apply(gestures.move(id, ...input.px(f.x, f.y)));
    if (!ready) {
      pending = {};
      return;
    }
    if (!game.result) {
      const events = step(game, dt, pending);
      pending = {};
      direct(events, game, world, fx);
      if (game.result) finish();
    } else pending = {};
    syncHud();
    fx.step(dt);
    world?.update(game, dt);
    world?.render();
    if (!ctx || !world) return;
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio || 1;
    const [sx, sy] = fx.shake.offset(dt, 10);
    ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
    ctx.clearRect(-20, -20, w + 40, h + 40);
    fx.draw(ctx, (lane, dist) => world!.project(lane, dist, 1.3, w, h), w, h);
  }

  onMount(() => {
    world = new RunWorld(gl, game);
    resize();
    let alive = true;
    const go = () => {
      if (alive) ready = true;
    };
    // compileAsync が落ちても始められるよう、先に見切りのタイマーを仕掛ける
    const giveUp = setTimeout(go, 1500);
    world.precompile().then(go, go);
    const stop = animate(frame);
    return () => {
      alive = false;
      stop();
      clearTimeout(giveUp);
      clearTimeout(endTimer);
      world?.dispose();
    };
  });
</script>

<div class="board" use:input.board={resize} role="application" aria-label="メガホンダッシュの通学路">
  <canvas bind:this={gl}></canvas>
  <canvas bind:this={canvas}></canvas>
  <Hud {level} {time} {combo} {followers} {mps} {boss} />
  {#if !ready}
    <p class="wait sticker">じゅんびちゅう…</p>
  {/if}
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    background: #a9d6f5;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .wait {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    font-size: min(4cqh, 7cqw);
    background: rgb(255 255 255 / 0.6);
  }
</style>
