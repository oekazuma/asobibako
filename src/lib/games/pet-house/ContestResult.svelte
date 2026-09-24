<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { RANK_COLOR, RANKS, scoreText } from './contest';
  import type { ContestPlay } from './contest-play.svelte';

  let { play }: { play: ContestPlay } = $props();

  const n = $derived(play.board.length);
  const done = $derived(play.shown >= n);
</script>

<section class="card" aria-label="けっか はっぴょう">
  <h2 class="yuru">けっか はっぴょう</h2>
  <ol>
    {#each play.board as e, i (e.name)}
      <!-- 下の順位から 1 つずつ見せる -->
      <li class:you={e.you} class:hidden={i < n - play.shown} class:first={i === 0}>
        <span class="place">{i + 1}い</span>
        <span class="who">{e.name}{e.you ? '（きみ）' : ''}</span>
        <span class="pts">{scoreText(play.id, e.score)}</span>
      </li>
    {/each}
  </ol>
  {#if done && play.prize}
    <div class="prize">
      <p class="headline">
        {play.place === 1 ? 'ゆうしょう！ おめでとう！' : `${play.place}い！ よく がんばったね`}
      </p>
      <p><Icon name="coin" /> しょうきん {play.prize.money}コイン</p>
      {#if play.prize.trophy}
        <p class="trophy" style:--c={RANK_COLOR[play.rank]}>
          <Icon name="trophy" size="1.4em" />{RANKS[play.rank]}の トロフィー！ おへやに かざったよ
        </p>
      {/if}
      {#if play.prize.next !== null}
        <p>つぎは {RANKS[play.prize.next]} クラスに でられるよ</p>
      {/if}
      <button class="pill gold" onclick={() => play.quit()}>おうちへ かえる</button>
    </div>
  {/if}
</section>

<style>
  .card {
    position: absolute;
    top: 50%;
    left: 50%;
    width: min(90%, 480px);
    padding: 18px 20px;
    border: 3px solid var(--line);
    border-radius: 28px;
    background: var(--paper-dots), var(--paper);
    box-shadow: var(--soft-shadow);
    font-weight: 800;
    text-align: center;
    pointer-events: auto;
    translate: -50% -50%;
  }

  h2 {
    --fill: var(--pastel-gold);
    margin: 0 0 10px;
    font-size: clamp(24px, min(3.6cqh, 7cqw), 34px);
  }

  ol {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 3em 1fr auto;
    align-items: center;
    padding: 8px 14px;
    border: 2px solid var(--line);
    border-radius: 16px;
    background: #fff;
    text-align: left;
    transition:
      opacity 300ms,
      scale 400ms var(--spring);
  }

  li.first {
    background: #fff3c4;
    font-size: 1.15em;
  }

  li.you {
    outline: 4px solid var(--pastel-p2);
  }

  li.hidden {
    opacity: 0;
    scale: 0.6;
  }

  .pts {
    font-variant-numeric: tabular-nums;
  }

  .prize p {
    margin: 8px 0 0;
  }

  .headline {
    font-size: 1.3em;
  }

  .trophy {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--c) 45%, #fff);
  }

  .prize button {
    margin-top: 14px;
  }

  @media (prefers-reduced-motion: reduce) {
    li {
      transition: none;
    }
  }
</style>
