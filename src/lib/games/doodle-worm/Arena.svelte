<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import { CONFETTI, Floaters, label, Particles, Shake } from '$lib/fx';
  import { animate } from '$lib/loop';
  import { drawFighter, fighter, fighterSize, hop, spots, type Entry, type Info } from './arena-draw';
  import { Cheerer, Fight, stats, type FightEvent } from './battle';
  import CheerPanel from './CheerPanel.svelte';
  import { age } from './engine';
  import type { Look } from './looks';
  import { fitCanvas, wipe } from './paint';
  import { sounds } from './sounds';

  let {
    entries,
    look,
    duo,
    cpu,
    onend
  }: {
    /** 0 が手前（1P） */
    entries: [Entry, Entry];
    look: Look;
    /** ふたりで遊ぶ。向かいの子は上下を逆さに立て、向かいにも応援のボタンを出す */
    duo: boolean;
    /** ひとりのとき、向かいの子を応援する速さ（1 秒に押す回数） */
    cpu: number;
    onend: (winner: 0 | 1) => void;
  } = $props();

  const COLORS = ['#1f9bff', '#ff4d5e'];
  const input = new BoardInput();
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let aspect = 1;
  // 戦う子と相手の応援は、この画面を開いたときの entries と cpu で決まる
  // svelte-ignore state_referenced_locally
  const fighters = entries.map((e) => fighter(e.strokes));
  const fight = new Fight(stats(fighters[0].c), stats(fighters[1].c));
  // svelte-ignore state_referenced_locally
  const rival = duo ? null : new Cheerer(cpu);
  const fx = new Particles();
  const floaters = new Floaters();
  /** ふたりのときの向かいの人に向けた文字。盤面を半回転して描く */
  const flipped = new Floaters();
  const shake = new Shake();
  let lost = -1;
  let ended = false;
  let info = $state<Info[]>([]);

  function float(side: 0 | 1, text: string, color: string, size = 0.06) {
    const s = spots(aspect, duo)[side];
    const [x, y] = duo && side === 1 ? [aspect - s.x, 1 - s.y] : [s.x, s.y];
    (duo && side === 1 ? flipped : floaters).add(text, x, y - fighterSize(aspect, duo) * 0.6, size, color);
  }

  function handle(e: FightEvent) {
    const sp = spots(aspect, duo);
    if (e.type === 'go') sounds.go();
    if (e.type === 'ready') sounds.ready();
    if (e.type === 'dodge') {
      float(e.side, 'ひらり', '#63a8f7', 0.05);
      sounds.dodge();
    }
    if (e.type === 'hit') {
      const foe = (1 - e.side) as 0 | 1;
      const color = e.special ? CONFETTI : COLORS[e.side];
      fx.burst(sp[foe].x, sp[foe].y, { count: e.special ? 30 : 12, color, speed: 0.5, size: 0.012, life: 0.6 });
      float(foe, `-${e.damage}`, COLORS[e.side]);
      if (e.special) float(e.side, 'ひっさつ！', '#ffc233', 0.07);
      else if (e.crit) float(e.side, 'かいしん！', '#f5913e', 0.055);
      shake.add(e.special ? 0.7 : 0.25);
      if (e.special) sounds.special();
      else sounds.hit();
    }
    if (e.type === 'end') {
      sounds.win();
      lost = 0;
    }
  }

  function cheer(side: 0 | 1) {
    const events = fight.cheer(side);
    if (!fight.started || fight.winner !== null) return;
    events.forEach(handle);
    hop(fighters[side]);
    sounds.cheer();
    const s = spots(aspect, duo)[side];
    fx.burst(s.x, s.y, { count: 3, color: COLORS[side], speed: 0.25, size: 0.008, life: 0.4 });
  }

  function resize(a: number) {
    aspect = a;
    ctx = fitCanvas(canvas, input.px(1, 1));
  }

  function frame(dt: number) {
    const events = fight.step(dt);
    if (rival && fight.started && fight.winner === null)
      for (let n = rival.step(dt); n; n--) events.push(...fight.cheer(1));
    events.forEach(handle);
    for (const f of fighters) age(f.c, dt);
    if (fight.winner !== null) {
      lost += dt;
      if (Math.floor(lost * 2.5) !== Math.floor((lost - dt) * 2.5)) hop(fighters[fight.winner]);
      if (lost > 2 && !ended) {
        ended = true;
        onend(fight.winner);
      }
    }
    fx.step(dt);
    floaters.step(dt);
    flipped.step(dt);
    info = fight.sides.map((s, i) => ({
      name: entries[i].name,
      trait: s.stats.trait,
      hp: s.hp / s.stats.hp,
      gauge: s.gauge
    }));
    draw(dt);
  }

  function draw(dt: number) {
    if (!ctx) return;
    wipe(ctx, input.px(1, 1)[1], ...shake.offset(dt, 0.02));
    const sp = spots(aspect, duo);
    const size = fighterSize(aspect, duo);
    for (const i of [0, 1] as const) {
      const out = fight.winner !== null && fight.winner !== i ? lost : -1;
      drawFighter(ctx, look, fighters[i], sp[i], sp[1 - i], fight.sides[i], size, out);
    }
    fx.draw(ctx);
    floaters.draw(ctx);
    const call = fight.t < 0 ? 'レディ…' : fight.t < 0.8 ? 'ファイト！' : '';
    // ふたりのときは、手前と向かいの人に 1 つずつ、真ん中の線をはさんで出す
    if (call) label(ctx, call, aspect / 2, duo ? 0.545 : 0.28, duo ? 0.07 : 0.09, '#f04438');
    ctx.translate(aspect, 1);
    ctx.rotate(Math.PI);
    flipped.draw(ctx);
    if (call && duo) label(ctx, call, aspect / 2, 0.545, 0.07, '#f04438');
  }

  onMount(() => animate(frame));
</script>

<div class="arena" use:input.board={resize} style:background={look.bg}>
  <canvas bind:this={canvas}></canvas>
</div>
{#if info.length}
  <CheerPanel info={info[0]} color={COLORS[0]} top={false} flip={false} oncheer={() => cheer(0)} />
  <CheerPanel info={info[1]} color={COLORS[1]} top flip={duo} oncheer={duo ? () => cheer(1) : undefined} />
{/if}

<style>
  .arena {
    position: absolute;
    inset: 0;
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
