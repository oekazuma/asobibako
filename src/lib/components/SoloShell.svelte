<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { audio, sfx, toggleMute, wake } from '$lib/audio.svelte';
  import type { SoloMeta, SoloModule } from '$lib/games';
  import { saveLevel, savedLevel } from '$lib/levels';
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
  let hint = $state('');
  const settle = new Settle();

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

  function finish(won: boolean) {
    // 演出中に ✕ で抜けたあとに届く遅れた onfinish は捨てる
    if (screen !== 'playing') return;
    cleared = won;
    complete = won && level >= meta.levels;
    if (won) {
      best = Math.max(best, level + 1);
      saveLevel(meta.id, best);
      if (!complete) level += 1;
    }
    screen = 'result';
    settle.begin();
  }

  onMount(() => {
    best = savedLevel(meta.id, meta.levels);
    level = Math.min(meta.levels, best);
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
  {:else}
    {#if screen === 'title'}
      <SoloTitle {meta} {Howto} {best} bind:level onlevels={() => (screen = 'levels')} onstart={start} />
    {:else if screen === 'levels'}
      <LevelSelect
        levels={meta.levels}
        name={meta.levelName}
        {best}
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
  .retry {
    right: max(12px, env(safe-area-inset-right));
  }

  .retry {
    background: var(--pastel-gold);
    font-size: 24px;
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
    white-space: nowrap;
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
