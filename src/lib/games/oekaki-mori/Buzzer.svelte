<script lang="ts">
  import type { Message } from '$lib/net/link';
  import type { Seat } from '$lib/net/party.svelte';
  import type { View } from './engine';

  let { view, me, act }: { view: View; me: Seat; act: (message: Message) => void } = $props();

  const out = $derived(view.out.includes(me));
</script>

<div class="buzzer">
  {#if view.options}
    <p class="ask">どれかな？ <b>{view.answerLeft}</b></p>
    <div class="options">
      {#each view.options as word, i (word)}
        <button class="pill gold option" onclick={() => act({ t: 'answer', index: i })}>{word}</button>
      {/each}
    </div>
  {:else if view.buzzer !== null}
    <p class="wait" role="status">{view.buzzer}P が こたえています</p>
  {:else}
    <button
      class="buzz"
      disabled={view.phase !== 'draw' || out}
      onpointerdown={(event) => {
        event.preventDefault();
        act({ t: 'buzz' });
      }}>{out ? 'おてつき' : 'はやおし！'}</button
    >
  {/if}
</div>

<style>
  .buzzer {
    display: grid;
    place-items: center;
    gap: 10px;
    min-height: clamp(150px, 26cqh, 260px);
    padding: 12px 12px max(12px, env(safe-area-inset-bottom));
    border-top: 3px solid var(--line);
    background: var(--paper);
    color: var(--line);
    font-weight: 800;
  }

  .buzz {
    width: min(80%, 420px);
    aspect-ratio: 3 / 1;
    border: 4px solid var(--line);
    border-radius: 999px;
    background: var(--p2);
    box-shadow: 0 8px 0 var(--p2-deep);
    color: #fff;
    font-size: clamp(28px, 6cqh, 48px);
    font-weight: 900;
    cursor: pointer;
  }

  .buzz:active {
    translate: 0 6px;
    box-shadow: 0 2px 0 var(--p2-deep);
  }

  .buzz:disabled {
    background: #ccc;
    box-shadow: none;
    color: var(--line);
  }

  .ask,
  .wait {
    font-size: clamp(18px, 3.4cqh, 28px);
  }

  .options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: min(100%, 560px);
  }

  .option {
    font-size: clamp(18px, 3.4cqh, 28px);
  }
</style>
