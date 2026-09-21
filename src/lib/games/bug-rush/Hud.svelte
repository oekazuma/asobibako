<script lang="ts">
  import type { Player } from '$lib/player';
  import { DURATION_S } from './engine';

  let { counts, timeLeft }: { counts: Record<Player, number>; timeLeft: number } = $props();

  const overtime = $derived(timeLeft <= 0);
  const hurry = $derived(timeLeft > 0 && timeLeft <= 5);
</script>

<!-- 残り時間は境界線そのものを縮めて見せる。どちらのプレイヤーからも同じように読める -->
<div class="timer" class:hurry class:overtime style:--left={Math.max(0, timeLeft) / DURATION_S}></div>

{#each [2, 1] as const as player (player)}
  <div class="count p{player}" class:losing={counts[player] > counts[player === 1 ? 2 : 1]}>
    <span class="num sticker">{counts[player]}</span>
    <span class="label">{overtime ? 'えんちょう！' : 'ひき'}</span>
  </div>
{/each}

<style>
  .timer {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 10px;
    border: 3px solid #fff;
    border-radius: 999px;
    background: var(--gold);
    translate: -50% -50%;
    scale: var(--left) 1;
    box-shadow: 0 3px 0 rgb(43 45 66 / 0.15);
    transition: scale 200ms linear;
    pointer-events: none;
  }

  .hurry {
    background: var(--p2);
    animation: blink 500ms steps(2) infinite;
  }

  .overtime {
    scale: 1 1;
    background: var(--p2);
  }

  .count {
    position: absolute;
    left: max(18px, env(safe-area-inset-left));
    display: flex;
    align-items: baseline;
    gap: 4px;
    color: var(--ink);
    pointer-events: none;
  }

  .count.p1 {
    bottom: max(14px, env(safe-area-inset-bottom));
  }

  /* 向かい側は 180 度回すので、その人から見た左下（画面の右上）に来る */
  .count.p2 {
    top: max(14px, env(safe-area-inset-top));
    left: auto;
    right: max(18px, env(safe-area-inset-right));
    rotate: 180deg;
  }

  .num {
    font-size: 44px;
  }

  /* 相手より多いと赤くなる */
  .losing .num {
    color: var(--p2);
  }

  .label {
    font-weight: 800;
  }

  @keyframes blink {
    50% {
      opacity: 0.5;
    }
  }
</style>
