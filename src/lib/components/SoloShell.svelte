<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { resolve } from '$app/paths';
  import { audio, sfx, toggleMute, wake } from '$lib/audio.svelte';
  import type { SoloMeta, SoloModule } from '$lib/games';
  import { nextOpen, saveLevel, savedLevel, saveSolved, savedSolved } from '$lib/levels';
  import { Settle } from '$lib/settle.svelte';
  import LevelSelect from './LevelSelect.svelte';
  import SoloResult from './SoloResult.svelte';
  import SoloTitle from './SoloTitle.svelte';

  let { meta, Game, Howto }: { meta: SoloMeta } & SoloModule = $props();

  let screen = $state<'title' | 'levels' | 'playing' | 'result'>('title');
  let cleared = $state(false);
  /** 最後のレベルまでクリアした */
  let complete = $state(false);
  let round = $state(0);
  let level = $state(1);
  /** たどり着いたいちばん先のレベル。最後のレベルをクリアすると levels + 1 になり、ここまでは選び直せる */
  let best = $state(1);
  const solved = new SvelteSet<number>(); // meta.anyOrder のときだけ使う、解いた面の集合。SvelteSet 自体が反応するので $state にしない
  let hint = $state('');
  const settle = new Settle();
  const titleBest = $derived(meta.anyOrder ? meta.levels : best); // anyOrder はどの面でも選べるので best で縛らない

  function start() {
    wake();
    sfx.start();
    hint = '';
    round += 1;
    screen = 'playing';
  }

  /** 同じレベルをやり直す。ゲームは {#key round} で作り直され、演出中のタイマーは unmount で消える */
  function retry() {
    hint = '';
    round += 1;
  }

  /** まだ解いていない次の面へ進む（今の面は解いたことにしない） */
  function skip() {
    level = nextOpen(level, solved, meta.levels);
    retry();
  }

  function finish(won: boolean) {
    // 演出中に ✕ で抜けたあとに届く遅れた onfinish は捨てる
    if (screen !== 'playing') return;
    cleared = won;
    complete = meta.anyOrder ? false : won && level >= meta.levels;
    if (won) {
      best = Math.max(best, level + 1);
      saveLevel(meta.id, best);
      if (meta.anyOrder) {
        solved.add(level);
        saveSolved(meta.id, solved);
        complete = solved.size >= meta.levels;
        if (!complete) level = nextOpen(level, solved, meta.levels);
      } else if (!complete) level += 1;
    }
    if (meta.ownResult && !complete) {
      start();
      return;
    }
    screen = 'result';
    settle.begin();
  }

  onMount(() => {
    best = savedLevel(meta.id, meta.levels);
    if (meta.anyOrder) for (const n of savedSolved(meta.id, meta.levels, best)) solved.add(n);
    level = meta.anyOrder ? nextOpen(0, solved, meta.levels) : Math.min(meta.levels, best);
    return settle.listen();
  });
</script>

<main class="stage solo" class:settling={settle.active}>
  {#if screen === 'playing'}
    {#key round}
      <Game {level} onfinish={finish} onhint={(text) => (hint = text)} />
    {/key}
    {#if hint}
      {#key hint}
        <p class="hint" role="status">{hint}</p>
      {/key}
    {/if}
    <!-- 遊んでいる途中でもやめられるよう、小さく隅に置く。一覧ではなくタイトルへ戻る -->
    <button class="round corner quit" onclick={() => (screen = 'title')} aria-label="やめる">✕</button>
    <button class="round corner retry" onclick={retry} aria-label="やりなおし">↻</button>
    {#if meta.anyOrder}
      <button class="round corner skip" onclick={skip} aria-label="とばす">
        <Icon name="arrow" size="26px" rotate={90} />
      </button>
    {/if}
  {:else}
    {#if screen === 'title'}
      <SoloTitle {meta} {Howto} best={titleBest} bind:level onlevels={() => (screen = 'levels')} onstart={start} />
    {:else if screen === 'levels'}
      <LevelSelect
        levels={meta.levels}
        name={meta.levelName}
        {best}
        solved={meta.anyOrder ? solved : undefined}
        current={level}
        onpick={(n) => {
          level = n;
          start();
        }}
      />
    {:else}
      <SoloResult {cleared} {complete} {level} name={meta.levelName} onagain={start} />
    {/if}
    {#if screen === 'levels'}
      <button class="round corner back" onclick={() => (screen = 'title')} aria-label="タイトルへ戻る">✕</button>
    {:else}
      <a class="round corner back" href={resolve('/')} aria-label="ゲーム選択へ戻る">✕</a>
    {/if}
    <button class="round corner mute" onclick={toggleMute} aria-label="ミュート" aria-pressed={audio.muted}>
      <Icon name={audio.muted ? 'mute' : 'speaker'} size="26px" />
    </button>
  {/if}
</main>

<style>
  .corner {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    z-index: 5;
  }

  .back,
  .quit {
    left: max(12px, env(safe-area-inset-left));
  }

  .quit {
    opacity: 0.7;
  }

  .mute,
  .retry,
  .skip {
    right: max(12px, env(safe-area-inset-right));
  }

  .retry {
    background: var(--pastel-gold);
    font-size: 24px;
  }
  .skip {
    top: calc(max(12px, env(safe-area-inset-top)) + 60px);
  }

  /* いまやることの吹き出し。変わるたびに弾んで出る */
  .hint {
    position: absolute;
    top: max(72px, calc(env(safe-area-inset-top) + 60px));
    left: 50%;
    z-index: 5;
    padding: 8px 20px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--pastel-gold);
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-weight: 800;
    letter-spacing: 0.06em;
    font-size: clamp(14px, min(2.6cqh, 4.6cqw), 24px);
    /* 細い画面で長い一言（ペットの名前入りなど）が画面の外へはみ出さないよう、分かち書きの空白で折り返す */
    width: max-content;
    max-width: calc(100% - 32px);
    text-align: center;
    word-break: keep-all;
    translate: -50% 0;
    pointer-events: none;
    animation: pop 420ms var(--spring);
  }

  @keyframes pop {
    from {
      scale: 0.4;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hint {
      animation: none;
    }
  }

  .settling .corner,
  .settling :global(.go) {
    pointer-events: none;
  }
</style>
