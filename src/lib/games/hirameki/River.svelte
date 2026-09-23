<script lang="ts">
  import { onDestroy } from 'svelte';
  import { cross, riverDone, riverStart } from './engine';
  import Rider from './Rider.svelte';
  import { sounds } from './sounds';
  import type { Crosser, RiverQ } from './types';

  let {
    p,
    onwarn,
    onsolve,
    onfail
  }: { p: RiverQ; onwarn: (text: string) => void; onsolve: () => void; onfail: (why: string) => void } = $props();

  let s = $state.raw(riverStart());
  /** ボート（橋ならランタンといっしょに行く人）に乗っているもの */
  let load = $state<string[]>([]);
  /** わたっている途中。絵のボートだけ先に動かし、着いてから s を進める */
  let moving = $state(false);
  let boatAt = $state<0 | 1>(0);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  const here = (c: Crosser, side: 0 | 1) => s.far.has(c.id) === (side === 1) && !load.includes(c.id);
  const riders = $derived(p.crossers.filter((c) => load.includes(c.id)));

  function toggle(c: Crosser) {
    if (moving) return;
    if (load.includes(c.id)) load = load.filter((id) => id !== c.id);
    else if (s.far.has(c.id) === (s.boat === 1)) load = [...load, c.id];
    else return onwarn(p.bridge ? '渡れるのはランタンのある側の人だけ' : 'ボートのある岸から乗せてください');
    sounds.pick();
  }

  function go() {
    if (moving) return;
    const r = cross(p, s, load);
    if ('warn' in r) return onwarn(r.warn);
    sounds.boat();
    moving = true;
    boatAt = r.next.boat;
    timer = setTimeout(() => {
      s = r.next;
      load = [];
      moving = false;
      if ('fail' in r) onfail(r.fail);
      else if (riverDone(p, s)) onsolve();
    }, 900);
  }
</script>

<div class="scene" class:bridge={p.bridge}>
  {#each [1, 0] as const as side (side)}
    <div class="bank" class:far={side === 1}>
      <span class="label">{side ? '向こう岸' : '手前'}</span>
      <!-- いないものも場所だけ取って、残った顔が横へずれないようにする -->
      {#each p.crossers as c (c.id)}<Rider {c} ghost={!here(c, side)} onpick={() => toggle(c)} />{/each}
    </div>
    {#if side === 1}
      <div class="water">
        {#if p.limit !== undefined}<span class="clock">{s.time} / {p.limit}分</span>{/if}
        <div class="boat" class:far={boatAt === 1} class:moving>
          {#each riders as c (c.id)}<Rider {c} small onpick={() => toggle(c)} />{/each}
          {#if p.bridge}<span class="lamp" aria-hidden="true"></span>{/if}
        </div>
        <button class="pill gold cross" onclick={go} disabled={moving}>渡る</button>
      </div>
    {/if}
  {/each}
</div>

<style>
  .scene {
    --face: min(15cqh, 17cqw);
    display: grid;
    grid-template-rows: 1fr 1.3fr 1fr;
    width: 100cqw;
    height: 100cqh;
    border-radius: 10px;
    overflow: hidden;
    color: var(--line);
  }

  .bank {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 2px 10px;
    background: #c5e8a6;
  }

  .label {
    position: absolute;
    top: 4px;
    left: 8px;
    font-size: 13px;
    font-weight: 800;
    opacity: 0.7;
  }

  .water {
    position: relative;
    background:
      radial-gradient(ellipse 18px 5px, #fff8 60%, transparent 65%) 0 0 / 70px 36px,
      #8fd0f7;
  }

  .bridge .water {
    background:
      linear-gradient(90deg, transparent 38%, #b98a5c 38% 62%, transparent 62%),
      repeating-linear-gradient(transparent 0 14px, #8a6a55 14px 16px), #6f5647;
  }

  .boat {
    position: absolute;
    left: 50%;
    top: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: calc(var(--face) * 2.4);
    min-height: calc(var(--face) * 1.3);
    padding: 0 10px;
    border: 3px solid var(--line);
    border-radius: 8px 8px 50% 50% / 8px 8px 60% 60%;
    background: #e0a86b;
    box-shadow: var(--soft-shadow);
    translate: -50% -108%;
    transition:
      top 900ms ease-in-out,
      translate 900ms ease-in-out;
  }

  .boat.far {
    top: 0;
    translate: -50% 8%;
  }

  .bridge .boat {
    border: none;
    background: none;
    box-shadow: none;
  }

  .boat.moving {
    animation: rock 300ms ease-in-out infinite alternate;
  }

  @keyframes rock {
    to {
      rotate: 4deg;
    }
  }

  .lamp {
    width: calc(var(--face) * 0.4);
    height: calc(var(--face) * 0.55);
    border: 3px solid var(--line);
    border-radius: 40% 40% 30% 30%;
    background: radial-gradient(circle, #fff6b0, #ffc233);
    box-shadow: 0 0 18px 6px #ffe27a;
  }

  .clock {
    position: absolute;
    top: 6px;
    left: 8px;
    padding: 2px 10px;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: #fff;
    font-weight: 800;
  }

  .cross {
    position: absolute;
    right: 8px;
    bottom: 8px;
    padding: 10px 22px;
    font-size: clamp(16px, 5cqh, 24px);
  }

  @media (prefers-reduced-motion: reduce) {
    .boat {
      transition: none;
    }

    .boat.moving {
      animation: none;
    }
  }
</style>
