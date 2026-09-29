<script lang="ts">
  import { onMount } from 'svelte';
  import type { Entry } from './arena-draw';
  import type { Look } from './looks';
  import { portrait } from './paint';
  import { sounds } from './sounds';

  let {
    entries,
    look,
    note,
    flip,
    ondone
  }: {
    entries: [Entry, Entry];
    look: Look;
    /** 名前の上に出す一言（トーナメントの回戦など） */
    note: string;
    /** ふたりで遊ぶ。向かいの子の名札を向かいから読める向きにする */
    flip: boolean;
    ondone: () => void;
  } = $props();

  /** 顔ぶれを見せる秒。押せばすぐ始まる */
  const SHOW = 1800;

  onMount(() => {
    sounds.ready();
    const timer = setTimeout(ondone, SHOW);
    return () => clearTimeout(timer);
  });
</script>

<button class="versus" onclick={ondone} aria-label="はじめる">
  {#snippet side(e: Entry, cls: string, turned: boolean)}
    <span class="side {cls}" class:flip={turned}>
      <img src={portrait(e.strokes, look)} style:background={look.bg} width="160" height="160" alt="" />
      <span class="name">{e.name}</span>
    </span>
  {/snippet}
  {@render side(entries[0], 'p1', false)}
  {@render side(entries[1], 'p2', flip)}
  <span class="vs">VS</span>
  {#if note}<span class="note">{note}</span>{/if}
</button>

<style>
  .versus {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    grid-template-rows: 1fr 1fr;
    padding: 0;
    border: none;
    overflow: hidden;
    background:
      linear-gradient(170deg, transparent 49.5%, #fff 49.5% 50.5%, transparent 50.5%),
      linear-gradient(170deg, var(--p2) 50%, var(--p1) 50%);
    cursor: pointer;
  }

  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    animation: slide 450ms var(--spring) both;
  }

  .side.p2 {
    grid-row: 1;
    --from: 60%;
  }

  .side.p1 {
    grid-row: 2;
    --from: -60%;
  }

  .side.flip {
    rotate: 180deg;
  }

  img {
    width: min(44cqw, 30cqh);
    height: auto;
    aspect-ratio: 1;
    border: 6px solid #fff;
    border-radius: 28px;
    box-shadow: var(--lift);
  }

  .name {
    padding: 4px 18px;
    border-radius: 999px;
    background: #fff;
    color: var(--ink);
    font-size: 22px;
    font-weight: 800;
  }

  .vs {
    position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    color: var(--gold);
    font-size: min(18cqw, 12cqh);
    font-weight: 900;
    font-style: italic;
    -webkit-text-stroke: 6px #fff;
    paint-order: stroke;
    animation: pop 500ms 250ms var(--spring) both;
  }

  .note {
    position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% calc(-50% + min(11cqw, 8cqh));
    padding: 2px 14px;
    border-radius: 999px;
    background: var(--ink);
    color: #fff;
    font-weight: 800;
  }

  @keyframes slide {
    from {
      translate: var(--from) 0;
      opacity: 0;
    }
  }

  @keyframes pop {
    from {
      scale: 3;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .side,
    .vs {
      animation: none;
    }
  }
</style>
