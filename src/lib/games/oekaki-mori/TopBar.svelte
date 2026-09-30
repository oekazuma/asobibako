<script lang="ts">
  import type { Seat } from '$lib/net/party.svelte';
  import type { View } from './engine';

  let { view, me }: { view: View; me: Seat } = $props();
  const drawing = $derived(view.drawer === me);
</script>

<header class="bar">
  <p class="word" aria-live="polite">
    {#if view.phase === 'ready'}
      {drawing ? 'おだいを みてね' : `${view.drawer}P が じゅんびしています`}
    {:else if view.word}
      {drawing ? 'おだい' : 'こたえ'} <b>{view.word}</b>
    {:else if view.mode === 'hayaoshi'}
      なにを かいているかな？
    {:else}
      <b class="mask">{view.mask}</b> {[...view.mask].length}もじ
    {/if}
  </p>
  <p class="left" class:hurry={view.phase === 'draw' && view.left <= 10}>{view.left}</p>
  <ul class="scores">
    {#each view.players as seat (seat)}
      <li
        class="p{seat}"
        class:drawer={seat === view.drawer}
        class:solved={view.solved.includes(seat)}
        class:out={view.out.includes(seat)}
      >
        {seat}P{seat === me ? '（あなた）' : ''}
        {view.scores[seat]}
      </li>
    {/each}
  </ul>
</header>

<style>
  .bar {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 12px;
    align-items: center;
    padding: max(8px, env(safe-area-inset-top)) 12px 8px;
    border-bottom: 3px solid var(--line);
    background: var(--paper);
    color: var(--line);
    font-weight: 800;
  }

  .word {
    font-size: clamp(18px, 3cqh, 28px);
  }

  .mask {
    letter-spacing: 0.15em;
  }

  .left {
    font-size: clamp(22px, 4cqh, 36px);
  }

  .left.hurry {
    color: var(--p2);
  }

  .scores {
    grid-column: 1 / -1;
    display: flex;
    gap: 8px;
    list-style: none;
  }

  .scores li {
    padding: 2px 10px;
    border: 2px solid var(--line);
    border-radius: 999px;
    font-size: clamp(13px, 2cqh, 17px);
  }

  .scores .p1 {
    background: var(--pastel-p1);
  }

  .scores .p2 {
    background: var(--pastel-p2);
  }

  .scores .p3 {
    background: var(--pastel-p3);
  }

  .scores .drawer {
    outline: 3px solid var(--line);
  }

  .scores .out::after {
    content: ' ×';
  }

  .scores .solved::after {
    content: ' ○';
  }
</style>
