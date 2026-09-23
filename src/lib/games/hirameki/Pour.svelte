<script lang="ts">
  import { onDestroy } from 'svelte';
  import { pour } from './engine';
  import { sounds } from './sounds';
  import type { PourQ } from './types';

  let { p, onsolve }: { p: PourQ; onsolve: () => void } = $props();

  // p はゲームごと作り直されるので、最初の値だけ使えばよい
  const start = () => [...p.start];
  let amounts = $state(start());
  let from = $state<number | null>(null);
  let done = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  const biggest = $derived(Math.max(...p.caps));

  function press(i: number) {
    if (done) return;
    if (from === null || from === i) {
      from = from === i || amounts[i] === 0 ? null : i;
      sounds.pick();
      return;
    }
    const next = pour(amounts, p.caps, from, i);
    from = null;
    if (next.every((a, k) => a === amounts[k])) return sounds.wrong();
    amounts = next;
    sounds.pour();
    if (p.goal(next)) {
      done = true;
      // 水が落ちつくのを見せてから
      timer = setTimeout(onsolve, 800);
    }
  }
</script>

<div class="shelf">
  {#each { length: p.caps.length }, i (i)}
    {@const cap = p.caps[i]}
    <button
      class="jug"
      class:from={from === i}
      style:height="{20 + (cap / biggest) * 62}%"
      aria-label="容量 {cap} の入れもの（今は {amounts[i]}）"
      aria-pressed={from === i}
      onclick={() => press(i)}
    >
      <span class="cap">{cap}</span>
      <span class="water" style:height="{(amounts[i] / cap) * 100}%"></span>
      <span class="now">{amounts[i]}</span>
    </button>
  {/each}
</div>

<style>
  .shelf {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 6cqw;
    width: 100cqw;
    height: 100cqh;
    padding: 0 4cqw 4cqh;
    border-radius: 10px;
    background: linear-gradient(transparent 88%, #e8c79a 88%);
  }

  .jug {
    position: relative;
    display: grid;
    place-items: center;
    width: min(22cqw, 160px);
    padding: 0;
    border: 3px solid var(--line);
    border-top-width: 0;
    border-radius: 6px 6px 22px 22px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    cursor: pointer;
    transition: translate 160ms var(--spring);
  }

  .jug.from {
    translate: 0 -12px;
    outline: 4px solid var(--pastel-gold);
    outline-offset: 3px;
  }

  .cap {
    position: absolute;
    top: 0;
    left: 50%;
    z-index: 1;
    padding: 0 12px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--pastel-gold);
    color: var(--line);
    font-size: clamp(16px, 5cqh, 28px);
    font-weight: 800;
    translate: -50% -60%;
  }

  .water {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    border-radius: 0 0 19px 19px;
    background: linear-gradient(#bfe6ff, #6cbcf2);
    transition: height 600ms ease-in-out;
  }

  .now {
    position: relative;
    color: var(--line);
    font-size: clamp(18px, 7cqh, 40px);
    font-weight: 800;
    paint-order: stroke fill;
    -webkit-text-stroke: 0.14em #fff;
  }

  @media (prefers-reduced-motion: reduce) {
    .jug,
    .water {
      transition: none;
    }
  }
</style>
