<script lang="ts">
  import type { Player } from '$lib/player';
  import type { Color, GameState, Shape } from './engine';
  import Glyph from './Glyph.svelte';

  let { player, game }: { player: Player; game: GameState } = $props();

  const COLOR_NAME: Record<Color, string> = { green: 'みどり', purple: 'むらさき', orange: 'オレンジ' };
  const SHAPE_NAME: Record<Shape, string> = { circle: 'まる', triangle: 'さんかく', star: 'ほし' };

  const knowsColor = $derived(game.know[player] === 'color');
  const name = $derived(knowsColor ? COLOR_NAME[game.target.color] : SHAPE_NAME[game.target.shape]);
  const result = $derived.by(() => {
    const r = game.result;
    if (!r) return '';
    if (r.kind === 'score') return r.player === player ? 'ゲット！' : 'とられた…';
    return r.player === player ? 'おてつき！' : 'あいてが おてつき';
  });
</script>

<!-- 自分の手元にだけ、条件の半分を出す。向かい側は 180 度回す -->
<div class="slot p{player}">
  {#if game.phase === 'memo'}
    <div class="card memo">
      <span class="lead">きみだけの ヒント・おぼえて！</span>
      <span class="row">
        {#if knowsColor}
          <Glyph color={game.target.color} size="44px" />
        {:else}
          <Glyph shape={game.target.shape} size="44px" />
        {/if}
        <span class="name">{knowsColor ? 'いろ' : 'かたち'}は {name}</span>
      </span>
    </div>
  {:else if game.phase === 'signal'}
    <div class="card hidden">
      <span class="lead">もう半分は あいてだけが知っている</span>
    </div>
  {:else}
    <div class="card" class:good={result === 'ゲット！'} class:bad={result === 'おてつき！'}>
      <span class="name">{result}</span>
      <span class="row">
        こたえ <Glyph color={game.target.color} shape={game.target.shape} size="40px" />
      </span>
    </div>
  {/if}
</div>

<style>
  .slot {
    position: absolute;
    left: 0;
    right: 0;
    height: 50%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: max(60px, calc(env(safe-area-inset-bottom) + 48px));
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
    gap: 8px;
    padding: 12px 22px;
    border: 4px solid #fff;
    border-radius: 22px;
    background: var(--card);
    box-shadow: var(--lift);
    font-weight: 800;
  }

  .memo {
    animation: pop 300ms var(--spring);
  }

  .hidden {
    background: rgb(255 255 255 / 0.6);
    box-shadow: none;
    color: var(--ink-soft);
  }

  .good {
    background: var(--gold);
  }

  .bad {
    background: var(--p2);
    color: #fff;
  }

  .lead {
    font-size: clamp(12px, 1.8cqh, 15px);
    color: var(--ink-soft);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .name {
    font-size: clamp(20px, 3.4cqh, 30px);
    letter-spacing: 0.06em;
  }

  @keyframes pop {
    from {
      scale: 0.5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .memo {
      animation: none;
    }
  }
</style>
