<script lang="ts">
  import type { Seat } from '$lib/net/party.svelte';
  import type { View } from './engine';

  let { view, me, typing = {} }: { view: View; me: Seat; typing?: Record<number, string> } = $props();
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
        class:answering={seat === view.buzzer}
      >
        {seat}P{seat === me ? '（あなた）' : ''}
        {view.scores[seat]}
        {#if typing[seat]}<span class="typing">{typing[seat]}</span>{/if}
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
    /* 右上の ≡ に重ならないよう空けておく */
    padding: max(8px, env(safe-area-inset-top)) 72px 8px 12px;
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

  .typing {
    margin-left: 6px;
    padding: 0 6px;
    border-radius: 6px;
    background: #fff;
    letter-spacing: 0.08em;
  }

  .typing::after {
    content: '▍';
    animation: blink 1s steps(1) infinite;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .typing::after {
      animation: none;
    }
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

  .scores .answering {
    outline: 3px solid var(--p2);
  }

  .scores .answering::after {
    content: ' こたえ中';
  }

  .scores .out::after {
    content: ' ×';
  }

  .scores .solved::after {
    content: ' ○';
  }
</style>
