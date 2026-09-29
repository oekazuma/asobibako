<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import { CONFETTI, label } from '$lib/fx';
  import { animate } from '$lib/loop';
  import { drawFighter, Effects, fighter, fighterSize, hop, spots, type Entry, type Info } from './arena-draw';
  import { Cheerer, Fight, GUARD_COOL, MOVES, stats, type FightEvent } from './battle';
  import CheerPanel from './CheerPanel.svelte';
  import CutIn from './CutIn.svelte';
  import { age } from './engine';
  import type { Look } from './looks';
  import { fitCanvas, wipe } from './paint';
  import { sounds } from './sounds';

  let {
    entries,
    look,
    rival,
    onend
  }: {
    /** 0 が手前（1P） */
    entries: [Entry, Entry];
    look: Look;
    /**
     * 向かいの子をコンピュータが応援するときの、1 秒に押す回数と攻撃を受けたときにガードする確率。
     * 無ければふたりで遊ぶ（向かいの子は上下を逆さに立て、向かいにもボタンを出す）
     */
    rival: { cheer: number; guard: number } | null;
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
  // svelte-ignore state_referenced_locally
  const duo = !rival;
  // svelte-ignore state_referenced_locally
  const fight = new Fight(stats(fighters[0].c), stats(fighters[1].c), Math.random, [0, rival?.guard ?? 0]);
  // svelte-ignore state_referenced_locally
  const cpu = rival && new Cheerer(rival.cheer);
  const effects = new Effects();
  /** ひっさつわざの帯。key は同じ子が続けて出したときに帯を出し直すため */
  let cut = $state<{ side: 0 | 1; key: number } | null>(null);
  let lost = -1;
  let ended = false;
  let info = $state<Info[]>([]);

  /** 子の頭の上に文字を浮かべる。向かいの子の文字は向かいの人から読める向きにする */
  function float(side: 0 | 1, text: string, color: string, size = 0.06) {
    const s = spots(aspect, duo)[side];
    const flip = duo && side === 1;
    const off = fighterSize(aspect, duo) * 0.6;
    effects.float(aspect, s.x, s.y + (flip ? off : -off), flip, text, size, color);
  }

  function handle(e: FightEvent) {
    const sp = spots(aspect, duo);
    if (e.type === 'go') sounds.go();
    if (e.type === 'ready') sounds.ready();
    if (e.type === 'guard') sounds.guard();
    if (e.type === 'charge') {
      const now = { side: e.side, key: fight.t };
      cut = now;
      sounds.charge();
      setTimeout(() => cut === now && (cut = null), 750);
    }
    if (e.type === 'dodge') {
      float(e.side, 'ひらり', '#63a8f7', 0.05);
      sounds.dodge();
    }
    if (e.type === 'hit') {
      const foe = (1 - e.side) as 0 | 1;
      const color = e.special ? CONFETTI : COLORS[e.side];
      effects.fx.burst(sp[foe].x, sp[foe].y, { count: e.special ? 30 : 12, color, speed: 0.5, size: 0.012, life: 0.6 });
      float(foe, `-${e.damage}`, COLORS[e.side]);
      if (e.guarded) float(foe, 'ガード！', '#63a8f7', 0.05);
      else if (e.crit) float(e.side, 'かいしん！', '#f5913e', 0.055);
      if (e.special) effects.rings.add(sp[foe].x, sp[foe].y, COLORS[e.side]);
      effects.shake.add(e.special ? 0.7 : 0.25);
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
    effects.hearts.add(aspect / 2, side ? 0.08 : 0.92, s.x, s.y);
  }

  function resize(a: number) {
    aspect = a;
    ctx = fitCanvas(canvas, input.px(1, 1));
  }

  function frame(dt: number) {
    const events = fight.step(dt);
    if (cpu && fight.started && fight.winner === null)
      for (let n = cpu.step(dt); n; n--) events.push(...fight.cheer(1));
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
    effects.step(dt);
    info = fight.sides.map((s, i) => ({
      name: entries[i].name,
      trait: s.stats.trait,
      hp: s.hp / s.stats.hp,
      gauge: s.gauge,
      cool: s.cool / GUARD_COOL
    }));
    draw(dt);
  }

  function draw(dt: number) {
    if (!ctx) return;
    wipe(ctx, input.px(1, 1)[1], ...effects.shake.offset(dt, 0.02));
    const sp = spots(aspect, duo);
    const size = fighterSize(aspect, duo);
    for (const i of [0, 1] as const) {
      const out = fight.winner !== null && fight.winner !== i ? lost : -1;
      drawFighter(ctx, look, fighters[i], sp[i], sp[1 - i], fight.sides[i], size, out);
    }
    const call = fight.t < 0 ? 'レディ…' : fight.t < 0.8 ? 'ファイト！' : '';
    // ふたりのときは、手前と向かいの人に 1 つずつ、真ん中の線をはさんで出す
    if (call) label(ctx, call, aspect / 2, duo ? 0.545 : 0.28, duo ? 0.07 : 0.09, '#f04438');
    effects.draw(ctx, aspect);
    if (call && duo) label(ctx, call, aspect / 2, 0.545, 0.07, '#f04438');
  }

  onMount(() => animate(frame));
</script>

<div class="arena" use:input.board={resize} style:background={look.bg}>
  <canvas bind:this={canvas}></canvas>
</div>
{#if cut}
  {#key cut.key}
    <CutIn
      strokes={entries[cut.side].strokes}
      move={MOVES[fight.sides[cut.side].stats.kind]}
      {look}
      color={COLORS[cut.side]}
      flip={duo && cut.side === 1}
    />
  {/key}
{/if}
{#if info.length}
  <CheerPanel
    info={info[0]}
    color={COLORS[0]}
    top={false}
    flip={false}
    oncheer={() => cheer(0)}
    onguard={() => fight.guard(0).forEach(handle)}
  />
  <CheerPanel
    info={info[1]}
    color={COLORS[1]}
    top
    flip={duo}
    oncheer={duo ? () => cheer(1) : undefined}
    onguard={duo ? () => fight.guard(1).forEach(handle) : undefined}
  />
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
