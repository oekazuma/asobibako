<script lang="ts">
  import type { Player } from '$lib/player';

  let { winner, wins, onagain }: { winner: Player; wins: Record<Player, number>; onagain: () => void } = $props();
</script>

{#each [2, 1] as const as player (player)}
  <div class="half result p{player}" class:won={winner === player}>
    <span class="outcome sticker" role="status">{winner === player ? 'WIN!' : 'LOSE'}</span>
    <span class="sub">{winner === player ? 'あなたの かち！' : 'あなたの まけ'}</span>
    <span class="tally">{wins[player]}かち {wins[player === 1 ? 2 : 1]}まけ</span>
    <button class="pill p{player} again" onclick={onagain}>もう一度</button>
  </div>
{/each}

<style>
  .half.result {
    background: #e9eaf2;
    color: var(--ink-soft);
  }

  /* 勝った側は、放射状の光で祝う */
  .half.result.won {
    background:
      repeating-conic-gradient(from 0deg, rgb(255 255 255 / 0.45) 0deg 10deg, transparent 10deg 20deg),
      radial-gradient(circle, #fff3c4, var(--gold) 70%);
    color: var(--ink);
  }

  .outcome {
    font-size: clamp(36px, min(12cqh, 18cqw), 120px);
    white-space: nowrap;
    animation: pop 520ms var(--spring) both;
  }

  .won .outcome {
    color: var(--gold-deep);
  }

  .sub {
    font-size: clamp(15px, 2.6cqh, 22px);
    font-weight: 800;
  }

  .tally {
    padding: 4px 16px;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.7);
    font-size: clamp(13px, 2.2cqh, 18px);
    font-weight: 800;
  }

  .again {
    margin-top: clamp(8px, 2cqh, 24px);
    font-size: clamp(16px, 2.6cqh, 22px);
  }

  @keyframes pop {
    from {
      scale: 0.3;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .outcome {
      animation: none;
    }
  }
</style>
