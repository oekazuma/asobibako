<script module lang="ts">
  import type { Seat } from '$lib/net/party.svelte';

  export interface Bubble {
    id: number;
    seat: Seat;
    text: string;
    /** 答えではないお知らせ（じかんぎれ）。かぎかっこで囲まない */
    note?: boolean;
  }
</script>

<script lang="ts">
  import { who } from './looks';

  let { bubbles, looks = {} }: { bubbles: Bubble[]; looks?: Record<number, string> } = $props();
</script>

<ul class="bubbles" aria-live="polite">
  {#each bubbles as b (b.id)}
    <li class="bubble p{b.seat}">
      {b.note ? `${who(b.seat, looks)} ${b.text}` : `${who(b.seat, looks)}「${b.text}」`}
    </li>
  {/each}
</ul>

<style>
  .bubbles {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    list-style: none;
    pointer-events: none;
  }

  .bubble {
    padding: 4px 12px;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--line);
    font-weight: 800;
    animation: pop 240ms var(--spring) both;
  }

  .bubble.p1 {
    background: var(--pastel-p1);
  }

  .bubble.p2 {
    background: var(--pastel-p2);
  }

  .bubble.p3 {
    background: var(--pastel-p3);
  }

  @keyframes pop {
    from {
      scale: 0.6;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bubble {
      animation: none;
    }
  }
</style>
