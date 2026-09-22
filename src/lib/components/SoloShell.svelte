<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { audio, sfx, toggleMute, wake } from '$lib/audio.svelte';
  import type { SoloMeta, SoloModule } from '$lib/games';
  import { MAX_LEVEL } from '$lib/levels';
  import { Settle } from '$lib/settle.svelte';
  import SoloResult from './SoloResult.svelte';
  import SoloTitle from './SoloTitle.svelte';

  let { meta, Game, Howto }: { meta: SoloMeta } & SoloModule = $props();

  const key = $derived(`table-duel:level:${meta.id}`);
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
    cleared = won;
    complete = won && level >= MAX_LEVEL;
    if (won && !complete) {
      level += 1;
      best = Math.max(best, level);
      try {
        localStorage.setItem(key, String(best));
      } catch {
        // 保存できなくても、この場では次のレベルへ進める
      }
    }
    screen = 'result';
    settle.begin();
  }

  onMount(() => {
    try {
      best = level = Math.min(MAX_LEVEL, Math.max(1, Number(localStorage.getItem(key)) || 1));
    } catch {
      // プライベートブラウズでは 1 から
    }
    return settle.listen();
  });
</script>

<main class="stage solo" class:settling={settle.active}>
  {#if screen === 'playing'}
    {#key round}
      <Game {level} onfinish={finish} />
    {/key}
    <!-- 遊んでいる途中でもやめられるよう、小さく隅に置く。一覧ではなくタイトルへ戻る -->
    <button class="corner quit" onclick={() => (screen = 'title')} aria-label="やめる">✕</button>
  {:else}
    {#if screen === 'title'}
      <SoloTitle {meta} {Howto} {best} bind:level onstart={start} />
    {:else}
      <SoloResult {cleared} {complete} {level} onagain={start} />
    {/if}
    <a class="corner back" href={resolve('/')} aria-label="ゲーム選択へ戻る">✕</a>
    <button class="corner mute" onclick={toggleMute} aria-label="ミュート" aria-pressed={audio.muted}>
      <Icon name={audio.muted ? 'mute' : 'speaker'} size="26px" />
    </button>
  {/if}
</main>

<style>
  .corner {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    z-index: 5;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--card);
    box-shadow: var(--lift);
    color: var(--ink);
    font-size: 18px;
    font-weight: 800;
    text-decoration: none;
    cursor: pointer;
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
