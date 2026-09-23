<script lang="ts">
  import Confetti from '$lib/components/Confetti.svelte';
  import type { Player } from '$lib/player';

  let { winner, wins, onagain }: { winner: Player; wins: Record<Player, number>; onagain: () => void } = $props();
</script>

{#each [2, 1] as const as player (player)}
  <div class="half result p{player}" class:won={winner === player}>
    {#if winner === player}
      <div class="rays" aria-hidden="true"></div>
      <Confetti count={24} fall="120cqh" />
    {/if}
    <span class="outcome yuru" role="status">{winner === player ? 'WIN!' : 'LOSE'}</span>
    <span class="sub">{winner === player ? 'あなたの かち！' : 'あなたの まけ'}</span>
    <span class="tally">{wins[player]}かち {wins[player === 1 ? 2 : 1]}まけ</span>
    <button class="pill p{player} again" onclick={onagain}>もう一度</button>
  </div>
{/each}

<style>
  .half.result {
    /* 光線と紙吹雪を半分の中に閉じ込める */
    overflow: hidden;
    background: var(--paper-dots), #f1ebe4;
    color: var(--line-soft);
  }

  /* 勝った側は、放射状の光で祝う */
  .half.result.won {
    background: radial-gradient(circle, #fff6d6, var(--pastel-gold) 70%);
    color: var(--line);
  }

  .rays {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 180vmax;
    aspect-ratio: 1;
    background: repeating-conic-gradient(from 0deg, rgb(255 255 255 / 0.45) 0deg 10deg, transparent 10deg 20deg);
    translate: -50% -50%;
    animation: spin 24s linear infinite;
  }

  .outcome {
    position: relative;
    font-size: clamp(36px, min(12cqh, 18cqw), 120px);
    white-space: nowrap;
    animation: pop 520ms var(--spring) both;
  }

  .won .outcome {
    --fill: var(--pastel-p2);
  }

  .sub {
    position: relative;
    font-size: clamp(15px, 2.6cqh, 22px);
    font-weight: 800;
  }

  .tally {
    position: relative;
    padding: 4px 16px;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.8);
    font-size: clamp(13px, 2.2cqh, 18px);
    font-weight: 800;
  }

  .again {
    position: relative;
    margin-top: clamp(8px, 2cqh, 24px);
    font-size: clamp(16px, 2.6cqh, 22px);
  }

  @keyframes spin {
    to {
      rotate: 360deg;
    }
  }

  @keyframes pop {
    from {
      scale: 0.3;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rays,
    .outcome {
      animation: none;
    }
  }
</style>
