<script lang="ts">
  import type { Player } from '$lib/player';

  let { winner, onagain }: { winner: Player; onagain: () => void } = $props();
</script>

{#each [2, 1] as const as player (player)}
  <div class="half result p{player}" class:won={winner === player}>
    <span class="outcome" role="status">{winner === player ? 'WIN' : 'LOSE'}</span>
    <span class="sub">{winner === player ? '相手を押し切った' : '押し切られた'}</span>
    <button class="again" onclick={onagain}>もう一度</button>
  </div>
{/each}

<style>
  .half.result {
    background: #2a1113;
  }

  .half.result.won {
    background: #0d3b34;
  }

  .outcome {
    font-size: clamp(40px, 11dvh, 110px);
    font-weight: 800;
    letter-spacing: 0.1em;
  }

  .sub {
    font-size: clamp(13px, 2.2dvh, 20px);
    opacity: 0.8;
  }

  .again {
    margin-top: clamp(8px, 2dvh, 24px);
    padding: 14px 30px;
    border: 1px solid #ffffff44;
    border-radius: 14px;
    background: #ffffff1a;
    font-size: clamp(15px, 2.4dvh, 20px);
    cursor: pointer;
  }
</style>
