<script lang="ts">
  import type { Player } from '$lib/player';
  import type { Command, GameState } from './engine';

  let { player, game }: { player: Player; game: GameState } = $props();

  const LOOK: Record<Command, { icon: string; label: string }> = {
    tap: { icon: '👆', label: 'タップ' },
    hold: { icon: '✊', label: 'ながおし' },
    two: { icon: '✌️', label: '2本指タップ' },
    up: { icon: '⬆️', label: 'スワイプ' },
    down: { icon: '⬇️', label: 'スワイプ' },
    left: { icon: '⬅️', label: 'スワイプ' },
    right: { icon: '➡️', label: 'スワイプ' },
    skull: { icon: '💀', label: 'さわるな！' }
  };

  const locked = $derived(game.locked[player]);
  const look = $derived(LOOK[game.command]);
  const result = $derived.by(() => {
    if (game.scorer === player) return 'ゲット！';
    if (game.scorer !== null) return 'とられた…';
    return game.command === 'skull' ? 'セーフ' : 'じかんぎれ';
  });
</script>

<!-- 各プレイヤーの陣地の真ん中に、その人に向けた指示を出す。向かい側は 180 度回す -->
<div class="slot p{player}">
  {#if locked === 'early' && game.phase !== 'show'}
    <div class="card bad"><span class="label">おてつき！</span></div>
  {:else if game.phase === 'wait'}
    <div class="card idle"><span class="label">…まて…</span></div>
  {:else if game.phase === 'go' && locked === 'miss'}
    <div class="card bad"><span class="label">ミス！</span></div>
  {:else if game.phase === 'go'}
    <div class="card go" class:skull={game.command === 'skull'}>
      <span class="icon">{look.icon}</span>
      <span class="label">{look.label}</span>
    </div>
  {:else}
    <div class="card" class:win={game.scorer === player}>
      <span class="label">{result}</span>
    </div>
  {/if}
</div>

<style>
  .slot {
    position: absolute;
    left: 0;
    right: 0;
    height: 50%;
    display: grid;
    place-items: center;
    pointer-events: none;
  }

  .slot.p1 {
    bottom: 0;
  }

  .slot.p2 {
    top: 0;
    rotate: 180deg;
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: min(60%, 320px);
    padding: clamp(14px, 3dvh, 28px) 28px;
    border: 5px solid #fff;
    border-radius: 28px;
    background: var(--card);
    box-shadow: var(--lift);
  }

  .icon {
    font-size: clamp(56px, 12dvh, 120px);
    line-height: 1;
  }

  .label {
    font-weight: 800;
    letter-spacing: 0.06em;
    font-size: clamp(22px, 4.4dvh, 40px);
  }

  .idle {
    background: rgb(255 255 255 / 0.6);
    box-shadow: none;
    color: var(--ink-soft);
  }

  .go {
    animation: pop 260ms var(--spring);
  }

  .skull {
    background: var(--ink);
    color: var(--p2);
  }

  .bad {
    background: var(--p2);
    color: #fff;
  }

  .win {
    background: var(--gold);
  }

  @keyframes pop {
    from {
      scale: 0.4;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .go {
      animation: none;
    }
  }
</style>
