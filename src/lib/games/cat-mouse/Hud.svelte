<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Player } from '$lib/player';
  import { type Phase, ROUND_S } from './engine';

  let {
    phase,
    cat,
    round,
    caught,
    scores,
    timeLeft
  }: { phase: Phase; cat: Player; round: number; caught: boolean; scores: Record<Player, number>; timeLeft: number } =
    $props();

  function banner(player: Player): [string, string] | null {
    const isCat = player === cat;
    if (phase === 'ready') {
      const head = round > 2 ? 'えんちょう！ ' : '';
      return isCat ? [`${head}ネコ`, 'ネズミをつかまえろ！'] : [`${head}ネズミ`, 'チーズを食べて にげろ！'];
    }
    if (phase === 'end') {
      const next = round % 2 === 0 && scores[1] !== scores[2] ? 'けっちゃく！' : 'こうたい！';
      if (caught) return [isCat ? 'つかまえた！' : 'つかまった…', next];
      return [isCat ? 'にげられた…' : 'にげきった！', next];
    }
    return null;
  }
</script>

<!-- 残り時間は真ん中の線を縮めて見せる。どちらのプレイヤーからも同じように読める -->
<div class="timer" class:hurry={phase === 'play' && timeLeft <= 3} style:--left={timeLeft / ROUND_S}></div>

{#each [2, 1] as const as player (player)}
  {@const text = banner(player)}
  <div class="tag p{player}">
    <Icon name={player === cat ? 'cat' : 'mouse'} size="34px" />
    <Icon name="cheese" size="26px" />
    <span class="num sticker">{scores[player]}</span>
  </div>
  {#if text}
    {#key `${phase}${round}`}
      <div class="banner p{player}">
        <p class="big sticker">{text[0]}</p>
        <p class="small">{text[1]}</p>
      </div>
    {/key}
  {/if}
{/each}

<p class="sr-only" role="status">
  {cat === 1 ? '手前がネコ' : '向かいがネコ'}。チーズ 手前 {scores[1]}こ、向かい {scores[2]}こ
</p>

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
  }

  .tag {
    position: absolute;
    left: max(14px, env(safe-area-inset-left));
    display: flex;
    align-items: center;
    gap: 6px;
    pointer-events: none;
  }

  .tag.p1 {
    bottom: max(14px, env(safe-area-inset-bottom));
  }

  /* 向かい側は 180 度回すので、その人から見た左下（画面の右上）に来る */
  .tag.p2 {
    top: max(14px, env(safe-area-inset-top));
    left: auto;
    right: max(14px, env(safe-area-inset-right));
    rotate: 180deg;
  }

  .num {
    font-size: 36px;
  }

  .banner {
    position: absolute;
    z-index: 2;
    left: 50%;
    display: grid;
    justify-items: center;
    gap: 4px;
    width: 100%;
    translate: -50% -50%;
    text-align: center;
    pointer-events: none;
    animation: pop 360ms var(--spring) both;
  }

  .banner.p1 {
    top: 64%;
  }

  .banner.p2 {
    top: 36%;
    rotate: 180deg;
  }

  .big {
    margin: 0;
    font-size: min(7cqh, 11cqw);
  }

  .small {
    margin: 0;
    font-size: min(2.6cqh, 4.4cqw);
    font-weight: 800;
    color: var(--ink);
  }

  @keyframes pop {
    from {
      scale: 0.4;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .banner {
      animation: none;
    }

    .timer {
      transition: none;
    }
  }
</style>
