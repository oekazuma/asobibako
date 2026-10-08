<script lang="ts">
  import { onMount } from 'svelte';
  import type { Play } from './play.svelte';
  import { POSES, STAND } from './poses';

  let { play }: { play: Play } = $props();
  let page = $state(0);
  let lit = $state<number | null>(null);
  let wheel: HTMLDivElement;
  const PER = 6;
  const items = $derived(POSES.slice(page * PER, page * PER + PER));

  function choose(id: string) {
    play.setPose(id);
    play.closeWheel();
  }

  function aim(e: PointerEvent) {
    const r = wheel.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < 50) return (lit = null);
    const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
    lit = Math.round(a / ((Math.PI * 2) / PER)) % PER;
  }

  onMount(() => {
    const move = (e: PointerEvent) => {
      if (play.wheel?.id === e.pointerId) aim(e);
    };
    const up = (e: PointerEvent) => {
      if (play.wheel?.id !== e.pointerId) return;
      if (lit !== null) choose(items[lit].id);
      else play.openWheel(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });
</script>

<div class="veil" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && play.closeWheel()}>
  <div class="wheel" bind:this={wheel}>
    {#each items as p, i (p.id)}
      <button
        class="item"
        class:lit={lit === i}
        class:now={play.pose === p.id}
        style:rotate="{(i * 360) / PER}deg"
        onclick={() => choose(p.id)}
      >
        <span style:rotate="{(-i * 360) / PER}deg">{p.label}</span>
      </button>
    {/each}
    <button class="arrow prev" onclick={() => (page = (page + 1) % 2)} aria-label="前のページ">‹</button>
    <button class="arrow next" onclick={() => (page = (page + 1) % 2)} aria-label="次のページ">›</button>
    <button class="clear" onclick={() => choose(STAND.id)} aria-label="ポーズを解く">×</button>
  </div>
</div>

<style>
  .veil {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.25);
  }

  .wheel {
    position: relative;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: rgb(20 18 16 / 0.6);
    font-family: 'Hiragino Mincho ProN', serif;
  }

  .item {
    position: absolute;
    left: 50%;
    top: 0;
    width: 96px;
    height: 200px;
    margin-left: -48px;
    padding-top: 26px;
    transform-origin: 50% 100%;
    border: 0;
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 17px;
    text-shadow: 0 1px 3px #000;
  }

  .item span {
    display: inline-block;
    padding: 8px 10px;
    border: 2px solid rgb(255 255 255 / 0.7);
    border-radius: 12px;
    background: rgb(0 0 0 / 0.35);
  }

  .item.lit span {
    border-color: #6ec6ff;
    background: rgb(40 130 220 / 0.85);
  }

  .item.now span {
    border-color: #fff;
  }

  .arrow,
  .clear {
    position: absolute;
    width: 48px;
    height: 48px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
    background: rgb(0 0 0 / 0.45);
    color: #fff;
    font-size: 26px;
  }

  .prev {
    left: -64px;
    top: calc(50% - 24px);
  }

  .next {
    right: -64px;
    top: calc(50% - 24px);
  }

  .clear {
    left: calc(50% - 24px);
    bottom: -64px;
  }
</style>
