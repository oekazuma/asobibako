<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { ContestPlay } from './contest-play.svelte';
  import { trickName, tricksFor } from './engine';
  import type { TrickId } from './types';

  /** しつけ大会の審判の吹き出しと、芸のボタン */
  let { play, ontrick }: { play: ContestPlay; ontrick: (t: TrickId) => void } = $props();
</script>

{#if play.judge}
  <div class="judge">
    <span class="face"><Icon name="adult" size="100%" /></span>
    {#key play.judge}
      <p class="bubble" role="status">{play.judge}</p>
    {/key}
  </div>
{/if}

{#if play.phase === 'play'}
  <div class="tricks">
    {#each tricksFor(play.dog ? 'dog' : 'cat') as t (t.id)}
      <button class="trick" onclick={() => ontrick(t.id)}>{trickName(t, play.dog ? 'dog' : 'cat')}</button>
    {/each}
  </div>
{/if}

<style>
  .judge {
    position: absolute;
    top: 13%;
    left: 50%;
    display: flex;
    align-items: center;
    gap: 8px;
    translate: -50% 0;
  }

  .face {
    width: 56px;
    height: 56px;
    padding: 4px;
    border: 3px solid var(--line);
    border-radius: 50%;
    background: #fff;
  }

  .bubble {
    margin: 0;
    padding: 10px 18px;
    border: 3px solid var(--line);
    border-radius: 22px 22px 22px 6px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    font-size: clamp(22px, 4.5cqw, 34px);
    font-weight: 900;
    white-space: nowrap;
    animation: pop 320ms var(--spring);
  }

  .tricks {
    position: absolute;
    bottom: max(16px, env(safe-area-inset-bottom));
    left: 50%;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    width: min(96%, 640px);
    translate: -50% 0;
  }

  .trick {
    min-width: 84px;
    padding: 12px 10px;
    border: 3px solid var(--line);
    border-radius: 20px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-size: clamp(16px, 3cqw, 20px);
    font-weight: 800;
    pointer-events: auto;
    cursor: pointer;
  }

  .trick:active {
    translate: 0 3px;
    box-shadow: var(--soft-press);
  }

  @keyframes pop {
    from {
      scale: 0.4;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bubble {
      animation: none;
    }
  }
</style>
