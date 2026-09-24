<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { COURSE, GATE_NAME, OBEDIENCE_ROUNDS, RANK_COLOR, RANKS } from './contest';
  import type { ContestPlay } from './contest-play.svelte';
  import ContestIntro from './ContestIntro.svelte';
  import ContestJudge from './ContestJudge.svelte';
  import ContestResult from './ContestResult.svelte';
  import type { TrickId } from './types';

  let { play, ontrick }: { play: ContestPlay; ontrick: (t: TrickId) => void } = $props();

  const c = $derived(play.contest);
  const live = $derived(play.phase === 'play' || play.phase === 'end');
  const clock = $derived(
    play.id === 'obedience'
      ? `${play.round}/${OBEDIENCE_ROUNDS}もんめ`
      : play.id === 'agility'
        ? `${play.clock.toFixed(1)}びょう`
        : `あと ${Math.ceil(play.clock)}びょう`
  );
  const points = $derived(play.id === 'agility' ? `${play.gate}/${COURSE.length}` : `${play.score}${c.unit}`);
</script>

<div class="hud">
  <header class="bar" class:live>
    <span class="rank" style:--c={RANK_COLOR[play.rank]}><Icon name="trophy" />{RANKS[play.rank]}</span>
    <!-- 競技中は、細い画面でも隅のボタンにかからないよう種目の名前をしまう -->
    {#if !live}
      <span class="name">{c.name} たいかい</span>
    {:else}
      <span class="stat" class:hurry={play.id !== 'agility' && play.id !== 'obedience' && play.clock <= 5}>
        {clock}
      </span>
      <span class="stat score">{points}</span>
    {/if}
  </header>

  {#if play.phase === 'intro'}
    <ContestIntro {play} />
  {:else if play.phase === 'count'}
    {#key play.count}
      <p class="big">{play.count}</p>
    {/key}
  {:else if play.phase === 'result'}
    <ContestResult {play} />
  {/if}

  {#if play.banner}
    {#key play.banner}
      <p class="big banner">{play.banner}</p>
    {/key}
  {/if}

  {#if play.phase === 'play' && play.id === 'agility'}
    <p class="next">つぎは <b>{GATE_NAME[COURSE[play.gate]?.kind ?? 'goal']}</b>。やじるしへ ゆびで さそう</p>
  {/if}

  {#if play.id === 'obedience'}
    <ContestJudge {play} {ontrick} />
  {/if}
</div>

<style>
  .hud {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    color: var(--line);
  }

  .bar {
    pointer-events: auto;
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: 50%;
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.2cqw, 10px);
    padding: 6px 14px 6px 8px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--paper);
    box-shadow: var(--soft-shadow);
    font-weight: 800;
    white-space: nowrap;
    translate: -50% 0;
  }

  .rank {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--c);
    font-size: 13px;
  }

  .name {
    font-size: clamp(14px, 2.4cqw, 18px);
  }

  .stat {
    padding: 2px 10px;
    border-radius: 999px;
    background: #fff;
    font-size: clamp(13px, 2.8cqw, 22px);
    font-variant-numeric: tabular-nums;
  }

  /* 細い画面の競技中は、隅の ✕ と ↻ にかからないよう階級の札もしまう */
  @container (max-width: 520px) {
    .live .rank {
      display: none;
    }
  }

  .score {
    background: var(--pastel-gold);
  }

  .hurry {
    color: #d63031;
  }

  .big {
    position: absolute;
    top: 38%;
    left: 0;
    right: 0;
    margin: 0;
    color: #fff;
    font-size: min(22cqh, 40cqw);
    font-weight: 900;
    text-align: center;
    -webkit-text-stroke: 6px var(--line);
    paint-order: stroke;
    translate: 0 -50%;
    animation: pop 420ms var(--spring);
  }

  .banner {
    color: var(--pastel-gold);
    font-size: min(10cqh, 14cqw);
  }

  .next {
    position: absolute;
    bottom: max(24px, env(safe-area-inset-bottom));
    left: 50%;
    margin: 0;
    padding: 8px 16px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--paper);
    font-weight: 800;
    white-space: nowrap;
    translate: -50% 0;
  }

  @keyframes pop {
    from {
      scale: 0.4;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .big {
      animation: none;
    }
  }
</style>
