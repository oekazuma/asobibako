<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { Stroke } from './engine';
  import type { Look } from './looks';
  import { portrait } from './paint';

  let {
    headline,
    winner,
    look,
    trophy,
    duo,
    children
  }: {
    headline: string;
    winner: Stroke[];
    look: Look;
    trophy: boolean;
    /** ふたりで遊んだ。向かいの人にも読めるよう、上にも逆さの見出しを出す */
    duo: boolean;
    children: Snippet;
  } = $props();
</script>

{#if duo}
  <h2 class="yuru headline flip">{headline}</h2>
{/if}
<div class="winner">
  {#if trophy}
    <span class="trophy"><Icon name="trophy" size="100%" /></span>
  {/if}
  <img src={portrait(winner, look)} style:background={look.bg} width="160" height="160" alt="" />
  <span class="ribbon">WIN!</span>
</div>
<h2 class="yuru headline">{headline}</h2>
<div class="actions">
  {@render children()}
</div>

<style>
  .headline {
    margin: 8px 0 16px;
    font-size: clamp(28px, min(5cqh, 8cqw), 48px);
    animation: pop 500ms var(--spring) both;
  }

  .flip {
    rotate: 180deg;
  }

  .winner {
    position: relative;
    width: min(56cqw, 280px);
    margin: 0 auto;
    animation: pop 600ms 100ms var(--spring) both;
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    border: 6px solid #fff;
    border-radius: 32px;
    box-shadow: var(--lift);
  }

  .trophy {
    position: absolute;
    top: -36px;
    left: -24px;
    width: 84px;
    height: 84px;
    rotate: -14deg;
  }

  .ribbon {
    position: absolute;
    right: -14px;
    bottom: 14px;
    padding: 4px 16px;
    border: 3px solid #fff;
    border-radius: 999px;
    background: var(--p2);
    color: #fff;
    font-size: 22px;
    font-weight: 900;
    rotate: -8deg;
  }

  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  @keyframes pop {
    from {
      scale: 0.4;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .headline,
    .winner {
      animation: none;
    }
  }
</style>
