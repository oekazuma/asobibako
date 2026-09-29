<script lang="ts">
  import { onMount } from 'svelte';
  import { bus } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import { CONFETTI, Floaters, label, Particles } from '$lib/fx';
  import { animate } from '$lib/loop';
  import { SongClock } from '$lib/music/clock';
  import { score, Tune } from '$lib/music/tune';
  import { fighter } from './arena-draw';
  import { chart, Judge, type DanceEvent, type Grade, type Level, type Result } from './dance';
  import { lights, noteRadius, notes, placer } from './dance-draw';
  import { age, type Stroke } from './engine';
  import type { Look } from './looks';
  import { creature, fitCanvas, wipe } from './paint';
  import { sounds } from './sounds';

  let { dancer, level, look, onend }: { dancer: Stroke[]; level: Level; look: Look; onend: (r: Result) => void } =
    $props();

  /**
   * 端末が教える遅れ（outputLatency・baseLatency）に足す秒。実機で音と輪がずれて聞こえたら、
   * ここを増やす（音が遅れて聞こえる）か減らす（音が早い）
   */
  const EXTRA_LATENCY = 0;
  const GRADES: Record<Grade, [string, string]> = {
    great: ['すごい！', '#ff4d8d'],
    good: ['いいね！', '#1f9bff'],
    near: ['おしい', '#8a8fa8'],
    miss: ['ミス', '#8a8fa8']
  };
  /** 踊る子がスペシャルアピールで回る秒 */
  const SPIN = 0.9;

  // 曲と踊る子は、この画面を開いたときに決まる
  // svelte-ignore state_referenced_locally
  const c = chart(level, score(level.song).notes.length / score(level.song).perBar);
  // svelte-ignore state_referenced_locally
  const tune = new Tune(level.song, level.bpm);
  // svelte-ignore state_referenced_locally
  const star = fighter(dancer);
  const clock = new SongClock(-(c.lead + 1));
  let aspect = 1;
  // 押したとみなす広さはノーツより広くとる。向きが変わっても判定を作り直さないよう、場所はいまの aspect で読む
  const judge = new Judge(c.notes, (spot) => placer(aspect)(spot), 0.09);
  let latency = 0;
  let spin = -1;
  let ended = false;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  const fx = new Particles();
  const floaters = new Floaters();

  /** いま聞こえている曲の秒。指の出来事のたびにも読み直す（前のフレームの値は最大 1 コマ古い） */
  function time(): number {
    const a = bus();
    latency = a ? Math.min(0.5, (a.outputLatency || 0) + (a.baseLatency || 0) + EXTRA_LATENCY) : 0;
    return clock.read(a ? a.currentTime - latency : null, performance.now() / 1000);
  }

  const input = new BoardInput({
    down: (event, x, y) => handle(judge.press(event.pointerId, time(), x * aspect, y)),
    up: (event) => handle(judge.release(event.pointerId, time()))
  });

  function handle(events: DanceEvent[]) {
    for (const e of events) {
      if (e.type === 'appeal') {
        spin = 0;
        floaters.add('スペシャルアピール！', aspect / 2, 0.14, 0.06, '#ff4d8d');
        fx.burst(aspect / 2, 0.3, { count: 40, color: CONFETTI, speed: 0.7, size: 0.012, life: 1 });
        sounds.win();
        continue;
      }
      const [x, y] = placer(aspect)(c.notes[e.note].spot);
      if (e.type === 'hold') {
        sounds.tap();
        continue;
      }
      const [text, color] = GRADES[e.grade];
      floaters.add(text, x, y - noteRadius(aspect) * 1.4, 0.04, color);
      if (e.grade === 'great' || e.grade === 'good') {
        fx.burst(x, y, { count: e.grade === 'great' ? 14 : 8, color, speed: 0.35, size: 0.009, life: 0.45 });
        if (star.c.jump < 0 && e.grade === 'great') star.c.jump = 0;
        sounds.tap();
      }
    }
  }

  function resize(a: number) {
    aspect = a;
    ctx = fitCanvas(canvas, input.px(1, 1));
  }

  function frame(dt: number) {
    const now = time();
    handle(judge.advance(now));
    tune.tick(bus(), now, latency);
    age(star.c, dt);
    if (spin >= 0) spin = spin + dt < SPIN ? spin + dt : -1;
    fx.step(dt);
    floaters.step(dt);
    if (now > c.length + 0.5 && judge.done && !ended) {
      ended = true;
      tune.stop();
      onend(judge.result());
    }
    draw(now);
  }

  function draw(now: number) {
    if (!ctx) return;
    wipe(ctx, input.px(1, 1)[1]);
    const beat = now > 0 ? (now / c.beat) % 1 : 0;
    lights(ctx, aspect, beat);
    const size = Math.min(aspect * 0.42, 0.28);
    const turn = spin >= 0 ? Math.sin((spin / SPIN) * Math.PI) : 0;
    ctx.save();
    ctx.translate(aspect / 2, 0.3 - Math.abs(Math.sin(Math.PI * beat)) * 0.025);
    ctx.rotate(spin >= 0 ? (spin / SPIN) * Math.PI * 2 : Math.sin((Math.PI * now) / c.beat) * 0.1);
    ctx.scale((size / star.extent) * (1 + turn * 0.25), (size / star.extent) * (1 + turn * 0.25));
    creature(ctx, look, star.c);
    ctx.restore();
    notes(ctx, aspect, c, judge, now);
    fx.draw(ctx);
    floaters.draw(ctx);
    if (judge.combo >= 3) label(ctx, `${judge.combo} コンボ`, aspect / 2, 0.52, 0.04, '#ffc233');
    if (now < 0) label(ctx, level.name, aspect / 2, 0.52, 0.05, '#ff4d8d');
  }

  onMount(() => {
    const stop = animate(frame);
    return () => {
      stop();
      tune.stop();
    };
  });
</script>

<div class="stage-floor" use:input.board={resize} role="application" aria-label="ダンスの ぶたい">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .stage-floor {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    background:
      radial-gradient(ellipse 80% 45% at 50% 30%, rgb(255 126 182 / 0.45), transparent 70%),
      linear-gradient(#2a1650, #4b2a7a 60%, #2a1650);
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
