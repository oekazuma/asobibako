<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { HALF, halfAt } from './course';
  import { direct } from './director';
  import { RunFx } from './effects';
  import { BODY, boost, COMBO_TIME, createState, GAUGE, rank, score, step } from './engine';
  import ComboBadge from './ComboBadge.svelte';
  import Hud from './Hud.svelte';
  import LiveCard from './LiveCard.svelte';
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
  let shoutNext = false;
  /** 手ごたえのために画面を止めている残りの秒 */
  let stop = 0;
  let ready = $state(false);
  let time = $state(game.time);
  let combo = $state(0);
  let keep = $state(0);
  let followers = $state(0);
  let fans = $state(0);
  let speedUp = $state(1);
  let face = $state<string | null>(null);
  let gauge = $state(0);
  let endTimer: ReturnType<typeof setTimeout> | undefined;

  /** 走る向きをつかんでいる指と、つかんだときの指の位置・走る子の位置 */
  let grab: { id: number; from: number; x: number } | null = null;
  const input = new BoardInput({
    down: (event, x) => {
      if (!grab) grab = { id: event.pointerId, from: x, x: game.target };
    },
    up: (event) => {
      if (grab?.id === event.pointerId) grab = null;
    }
  });

  /**
   * 指を置いた位置ではなく、置いてからずらした量で動かす（数のゲートと同じ）。
   * 置いた位置へ飛ぶと、指を置いただけで思わぬほうへ走ってしまう。画面の幅の 3/4 ほどで道の端から端まで
   */
  function steer(): number | null {
    const finger = grab && input.fingers.all.get(grab.id);
    if (!grab || !finger) return null;
    const gain = (HALF * 2) / 0.75;
    const want = grab.x + (finger.x - grab.from) * gain;
    const edge = halfAt(game.z) - BODY;
    const x = Math.max(-edge, Math.min(edge, want));
    // 端より先へずらした分はつかみ直す。そうしないと、戻すときにしばらく動かない幅ができる
    grab.from += (want - x) / gain;
    return x;
  }

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
      fx.end({ kind: 'rank', rank: rank(game), points: score(game) });
      endTimer = setTimeout(() => onfinish(true), 2200);
    } else {
      fx.end({ kind: 'timeout' });
      endTimer = setTimeout(() => onfinish(false), 1000);
    }
  }

  function syncHud() {
    const t = Math.ceil(game.time * 10) / 10;
    if (time !== t) time = t;
    if (fans !== game.fans) fans = game.fans;
    const sp = Math.round((1 + boost(game.combo)) * 10) / 10;
    if (speedUp !== sp) speedUp = sp;
    if (combo !== game.combo) combo = game.combo;
    if (followers !== game.followers) followers = game.followers;
    const k = Math.round(Math.max(0, 1 - game.since / COMBO_TIME) * 20) / 20;
    if (keep !== k) keep = k;
    const g = Math.round((game.gauge / GAUGE) * 40) / 40;
    if (gauge !== g) gauge = g;
  }

  function frame(dt: number) {
    if (!ready) return;
    if (stop > 0) {
      stop -= dt;
      dt *= 0.08;
    }
    if (!game.result) {
      const events = step(game, dt, { target: steer(), shout: shoutNext });
      shoutNext = false;
      stop = Math.max(stop, direct(events, game, world, fx));
      if (game.result) finish();
    }
    syncHud();
    fx.step(dt, game);
    world?.update(game, dt);
    world?.render(game);
    if (!ctx || !world) return;
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    fx.draw(ctx, (x, rel) => world!.project(x, game.z + rel, 1.3, w, h), w, h, game);
  }

  onMount(() => {
    world = new RunWorld(gl, game);
    resize();
    face = world.portrait();
    let alive = true;
    const go = () => {
      if (alive) ready = true;
    };
    // compileAsync が落ちても始められるよう、先に見切りのタイマーを仕掛ける
    const giveUp = setTimeout(go, 1500);
    world.precompile().then(go, go);
    const stopLoop = animate(frame);
    return () => {
      alive = false;
      stopLoop();
      clearTimeout(giveUp);
      clearTimeout(endTimer);
      world?.dispose();
    };
  });
</script>

<div class="board" use:input.board={resize} role="application" aria-label="メガホンダッシュの通学路">
  <canvas bind:this={gl}></canvas>
  <canvas bind:this={canvas}></canvas>
  <Hud {time} {followers} {gauge} onshout={() => (shoutNext = true)} />
  <LiveCard {face} {fans} />
  <ComboBadge {combo} speed={speedUp} {keep} />
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
    background: #8fd0ff;
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
