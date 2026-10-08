<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Play } from './play.svelte';

  let { play }: { play: Play } = $props();
  const shown = $derived(play.timer === null ? null : Math.ceil(play.timer));
</script>

<button class="timer" onclick={() => (shown === null ? play.startTimer() : play.stopTimer())}>
  {#if shown === null}
    隠れタイム計測
  {:else}
    <Icon name="hourglass" size="30px" />
    <span class="num">{shown}</span>
    {#if play.mode !== 'paint'}<span class="word">探索開始まで</span>{/if}
  {/if}
</button>
{#key play.timerRuns}
  {#if play.timerRuns && shown !== null}
    <p class="splash">隠れタイム</p>
  {/if}
{/key}

<style>
  .timer {
    position: absolute;
    top: max(8px, env(safe-area-inset-top));
    left: 50%;
    translate: -50% 0;
    display: grid;
    justify-items: center;
    padding: 4px 16px;
    border: 0;
    background: transparent;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 15px;
    text-shadow: 0 1px 3px #000;
  }

  .num {
    font-size: 40px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .splash {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: min(12cqh, 9cqw);
    text-shadow: 0 3px 10px #000;
    pointer-events: none;
    animation: splash 1.8s forwards;
  }

  @keyframes splash {
    0%,
    60% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
