<script lang="ts">
  import { onMount } from 'svelte';
  import type { SoloProps } from '$lib/games';

  let { onquit }: SoloProps = $props();
  let portrait = $state(false);

  onMount(() => {
    const mq = matchMedia('(orientation: portrait)');
    const sync = () => (portrait = mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  });
</script>

<div class="chameleon">
  {#if portrait}
    <p class="notice">横向きにしてください</p>
  {:else}
    <p class="notice">準備中</p>
  {/if}
  <button class="quit" onclick={() => onquit?.()} aria-label="タイトルへ">✕</button>
</div>

<style>
  .chameleon {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: #1d1a17;
  }

  .notice {
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 28px;
    text-shadow: 0 2px 4px #000;
  }

  .quit {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    width: 48px;
    height: 48px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font-size: 22px;
  }
</style>
