<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { createState, step, WORLD_H, WORLD_W, type CampEvent } from './engine';
  import { CampFx } from './effects';
  import { ground, paint } from './paint';
  import { sounds } from './sounds';

  let { level, onfinish }: SoloProps = $props();

  /** 画面の幅に映す雪原の幅。キャンプの端のパッドまで見えるよう、横は全部映して縦だけ追いかける */
  const VIEW_W = WORLD_W;
  /** 指をこれだけ（ピクセル）ずらすと全速力 */
  const STICK = 60;
  let board: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  // level はゲームごと作り直されるので、最初の値だけ使えばよい
  const fresh = () => createState(level);
  const game = fresh();
  let wallet = $state(0);
  let goal = $state(game.pads.find((p) => p.id === 'home')!.cost);
  /** 仮想スティック。指を置いた位置からずらした向きへ歩く */
  let stick: { id: number; x: number; y: number } | null = null;
  const fx = new CampFx();
  /** 動かない地面は、大きさが変わったときだけ描き直す */
  let bg: HTMLCanvasElement | undefined;
  let now = 0;

  const input = new BoardInput({
    down: (event, x, y) => {
      if (stick) return;
      const [px, py] = input.px(x, y);
      stick = { id: event.pointerId, x: px, y: py };
    },
    up: (event) => {
      if (stick?.id === event.pointerId) stick = null;
    }
  });

  function resize() {
    const [w, h] = input.px(1, 1);
    canvas.width = Math.round(w * devicePixelRatio);
    canvas.height = Math.round(h * devicePixelRatio);
    ctx = canvas.getContext('2d');
    const scale = (w / VIEW_W) * devicePixelRatio;
    bg ??= document.createElement('canvas');
    bg.width = Math.round(WORLD_W * scale);
    bg.height = Math.round(WORLD_H * scale);
    const b = bg.getContext('2d')!;
    b.scale(scale, scale);
    ground(b);
  }

  function stickVector() {
    const finger = stick && input.fingers.all.get(stick.id);
    if (!stick || !finger) return { x: 0, y: 0, px: 0, py: 0 };
    const [fx, fy] = input.px(finger.x, finger.y);
    const dx = fx - stick.x;
    const dy = fy - stick.y;
    const len = Math.hypot(dx, dy);
    const k = len < 6 ? 0 : Math.min(1, len / STICK) / len;
    return { x: dx * k, y: dy * k, px: fx, py: fy };
  }

  function play(events: CampEvent[]) {
    for (const event of events) {
      fx.handle(event, game);
      if (event.type === 'hit') sounds.hit();
      else if (event.type === 'clear') {
        sfx.finish();
        setTimeout(() => onfinish(true), 1500);
      } else if (event.type !== 'cooked') sounds[event.type]();
    }
  }

  function frame(dt: number) {
    now += dt;
    const move = stickVector();
    play(step(game, dt, move));
    fx.step(dt, game);
    if (wallet !== game.wallet) wallet = game.wallet;
    const home = game.pads.find((p) => p.id === 'home')!;
    if (goal !== home.cost - home.paid) goal = home.cost - home.paid;
    if (!ctx) return;
    const [w, h] = input.px(1, 1);
    const scale = w / VIEW_W;
    const halfH = h / scale / 2;
    const cam = {
      x: Math.min(WORLD_W - VIEW_W / 2, Math.max(VIEW_W / 2, game.hero.x)),
      y: Math.min(WORLD_H - halfH, Math.max(halfH, game.hero.y)),
      scale
    };
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    paint(ctx, game, w, h, cam, bg, now, move.x !== 0 || move.y !== 0);
    ctx.save();
    ctx.translate(w / 2 - cam.x * scale, h / 2 - cam.y * scale);
    ctx.scale(scale, scale);
    fx.drawWorld(ctx);
    ctx.restore();
    fx.drawSnow(ctx, w, h);
    if (stick) {
      ctx.beginPath();
      ctx.arc(stick.x, stick.y, STICK, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(255 255 255 / 0.35)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(stick.x + move.x * STICK, stick.y + move.y * STICK, 22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(31 155 255 / 0.6)';
      ctx.fill();
    }
  }

  onMount(() => {
    const unobserve = input.observe(board, resize);
    const stop = animate(frame);
    return () => {
      stop();
      unobserve();
    };
  });
</script>

<div
  class="board"
  bind:this={board}
  onpointerdown={input.down}
  onpointermove={input.move}
  onpointerup={input.up}
  onpointercancel={input.up}
  role="application"
  aria-label="雪原サバイバルの雪原"
>
  <canvas bind:this={canvas}></canvas>
  <div class="hud">
    <span class="chip sticker">レベル {level}</span>
    <span class="chip wallet" role="status">💰 {wallet}</span>
    <span class="chip goal">🏠 まで あと {goal}</span>
  </div>
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    background: #e3eefb;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .hud {
    position: absolute;
    top: 14px;
    left: 72px;
    right: 16px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    pointer-events: none;
  }

  .chip {
    padding: 4px 14px;
    border: 3px solid #fff;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.85);
    box-shadow: 0 3px 0 rgb(43 45 66 / 0.12);
    font-size: 18px;
    font-weight: 800;
  }

  .wallet {
    background: var(--gold);
  }
</style>
