<script lang="ts">
  import type { Player } from '$lib/player';
  import { LIFE, MAX_ENERGY, SHIELD, type GameState } from './engine';

  let { player, game }: { player: Player; game: GameState } = $props();

  const count = (n: number) => Array.from({ length: n }, (_, i) => i);
</script>

<div class="stats">
  <span class="row" role="img" aria-label="体力 {game.life[player]}">
    {#each count(LIFE) as i (i)}<span class="heart" class:off={i >= game.life[player]}>♥</span>{/each}
  </span>
  <span class="row" role="img" aria-label="エネルギー {game.energy[player]}">
    {#each count(MAX_ENERGY) as i (i)}<span class="pip energy" class:on={i < game.energy[player]}>⚡</span>{/each}
  </span>
  <span class="row" role="img" aria-label="盾 {game.shield[player]}">
    {#each count(SHIELD) as i (i)}<span class="pip shield" class:on={i < game.shield[player]}>🛡️</span>{/each}
  </span>
</div>

<style>
  .stats {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 18px;
  }

  .row {
    display: flex;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--card);
    box-shadow: 0 3px 0 rgb(43 45 66 / 0.1);
  }

  .heart {
    color: var(--p2);
    font-size: 26px;
    line-height: 1;
  }

  .heart.off {
    color: rgb(43 45 66 / 0.15);
  }

  .pip {
    font-size: 20px;
    filter: grayscale(1);
    opacity: 0.25;
  }

  .pip.on {
    filter: none;
    opacity: 1;
  }
</style>
