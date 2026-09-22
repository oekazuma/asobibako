<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { audio, sfx, toggleMute, wake } from '$lib/audio.svelte';
  import type { SoloMeta, SoloModule } from '$lib/games';
  import { ALL_CLEAR, MAX_LEVEL, saveLevel, savedLevel } from '$lib/levels';
  import { Settle } from '$lib/settle.svelte';
  import SoloResult from './SoloResult.svelte';
  import SoloTitle from './SoloTitle.svelte';

  let { meta, Game, Howto }: { meta: SoloMeta } & SoloModule = $props();

  let screen = $state<'title' | 'playing' | 'result'>('title');
  let cleared = $state(false);
  /** レベル 100 までクリアした */
  let complete = $state(false);
  let round = $state(0);
  let level = $state(1);
  /** たどり着いたいちばん先のレベル。タイトルでここまでは選び直せる */
  let best = $state(1);
  const settle = new Settle();

  function start() {
    wake();
    sfx.start();
    round += 1;
    screen = 'playing';
  }

  function finish(won: boolean) {
    // 演出中に ✕ で抜けたあとに届く遅れた onfinish は捨てる
    if (screen !== 'playing') return;
    cleared = won;
    complete = won && level >= MAX_LEVEL;
    if (won) {
      // 100 をクリアしたら ALL_CLEAR を残し、一覧で「ぜんぶクリア」と出せるようにする
      saveLevel(meta.id, Math.max(savedLevel(meta.id), complete ? ALL_CLEAR : level + 1));
      if (!complete) {
        level += 1;
        best = Math.max(best, level);
      }
    }
    screen = 'result';
    settle.begin();
  }

  onMount(() => {
    best = level = Math.min(MAX_LEVEL, savedLevel(meta.id));
    return settle.listen();
  });
</script>

<main class="stage solo" class:settling={settle.active}>
  {#if screen === 'playing'}
    {#key round}
      <Game {level} onfinish={finish} />
    {/key}
    <!-- 遊んでいる途中でもやめられるよう、小さく隅に置く。一覧ではなくタイトルへ戻る -->
    <button class="round corner quit" onclick={() => (screen = 'title')} aria-label="やめる">✕</button>
  {:else}
    {#if screen === 'title'}
      <SoloTitle {meta} {Howto} {best} bind:level onstart={start} />
    {:else}
      <SoloResult {cleared} {complete} {level} onagain={start} />
    {/if}
    <a class="round corner back" href={resolve('/')} aria-label="ゲーム選択へ戻る">✕</a>
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

  .mute {
    right: max(12px, env(safe-area-inset-right));
  }

  .settling .corner,
  .settling :global(.go) {
    pointer-events: none;
  }
</style>
