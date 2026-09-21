<script lang="ts">
  import type { Player } from '$lib/player';
  import type { Action, GameState } from './engine';
  import Stats from './Stats.svelte';

  let {
    player,
    game,
    beats,
    nudge,
    guarding
  }: { player: Player; game: GameState; beats: number; nudge: number; guarding: boolean } = $props();

  const ICON: Record<Action, string> = { charge: '⚡', attack: '⚔️', guard: '🛡️', none: '💤' };
  const opponent = $derived<Player>(player === 1 ? 2 : 1);

  const result = $derived.by(() => {
    const last = game.last;
    if (!last) return null;
    const mine = last.act[player];
    let text = { charge: 'チャージ', guard: 'ガード', none: '…', attack: 'あいうち' }[mine];
    if (last.hit[player]) text = 'くらった！';
    else if (last.blocked[player]) text = 'ふせいだ！';
    else if (last.hit[opponent]) text = 'ヒット！';
    else if (last.blocked[opponent]) text = 'ふせがれた';
    return { icon: ICON[mine], text, bad: last.hit[player], good: last.hit[opponent] || last.blocked[player] };
  });
</script>

<div class="side p{player}">
  <div class="stage-area">
    {#key beats}
      {#if result}
        <div class="bubble" class:bad={result.bad} class:good={result.good}>
          <span class="icon">{result.icon}</span>
          <span class="text">{result.text}</span>
        </div>
      {/if}
    {/key}
  </div>

  <p class="plan">
    {#key nudge}
      {#if nudge > 0}<span class="warn">ためてから！</span>{/if}
    {/key}
    {#if guarding}
      <span class="tag guard">🛡️ ガード中</span>
    {:else if game.pending[player]}
      <span class="tag">✓ きめた</span>
    {/if}
  </p>

  <Stats {player} {game} />
</div>

<style>
  .side {
    position: absolute;
    left: 0;
    right: 0;
    height: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 70px 16px max(16px, env(safe-area-inset-bottom));
    pointer-events: none;
  }

  .side.p1 {
    bottom: 0;
    background: var(--dots), var(--zone-1);
  }

  .side.p2 {
    top: 0;
    rotate: 180deg;
    background: var(--dots), var(--zone-2);
  }

  .stage-area {
    flex: 1;
    display: grid;
    place-items: center;
  }

  .bubble {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 14px 28px;
    border: 5px solid #fff;
    border-radius: 28px;
    background: var(--card);
    box-shadow: var(--lift);
    animation: pop 300ms var(--spring);
  }

  .bubble.bad {
    background: var(--p2);
    color: #fff;
    animation: shake 360ms;
  }

  .bubble.good {
    background: var(--gold);
  }

  .icon {
    font-size: clamp(44px, 9dvh, 88px);
    line-height: 1;
  }

  .text {
    font-size: clamp(20px, 3.6dvh, 32px);
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  .plan {
    display: flex;
    gap: 8px;
    min-height: 34px;
    margin-bottom: 10px;
  }

  .tag,
  .warn {
    padding: 4px 14px;
    border: 3px solid #fff;
    border-radius: 999px;
    background: var(--card);
    font-weight: 800;
  }

  .tag.guard {
    background: var(--gold);
  }

  .warn {
    background: var(--p2);
    color: #fff;
    animation: fade 900ms forwards;
  }

  @keyframes pop {
    from {
      scale: 0.5;
    }
  }

  @keyframes shake {
    25% {
      translate: -10px 0;
    }
    75% {
      translate: 10px 0;
    }
  }

  @keyframes fade {
    70% {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bubble,
    .warn {
      animation: none;
    }
  }
</style>
