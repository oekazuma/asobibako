<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { chart, type Difficulty } from './dance';
  import { bestKey, type Best } from './dance-best';
  import { LEVELS } from './dance-songs';
  import DifficultyTabs from './DifficultyTabs.svelte';
  import Jacket from './Jacket.svelte';

  let {
    best,
    song = 0,
    difficulty = 0,
    onstart
  }: {
    best: Best;
    /** はじめに選んでおく曲と難しさ（前に遊んだもの） */
    song?: number;
    difficulty?: Difficulty;
    onstart: (song: number, difficulty: Difficulty) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let focus = $state(song);
  // svelte-ignore state_referenced_locally
  let chosen = $state<Difficulty>(difficulty);
  let rail: HTMLUListElement;
  const level = $derived(LEVELS[focus]);
  const counts = $derived(([0, 1, 2] as const).map((d) => chart(level, d).notes.length));

  /** 横にすべらせたら、まんなかに来たジャケットを選ぶ */
  function scrolled() {
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    const items = [...rail.children] as HTMLElement[];
    const gap = (el: HTMLElement) => Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
    focus = items.reduce((best, el, i) => (gap(el) < gap(items[best]) ? i : best), 0);
  }

  function show(i: number, behavior: 'smooth' | 'instant' = 'smooth') {
    const el = rail.children[i] as HTMLElement;
    rail.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - rail.clientWidth / 2, behavior });
    focus = i;
  }

  onMount(() => show(focus, 'instant'));
</script>

<h2 class="banner yuru">きょくを えらんでね</h2>
<div class="shelf">
  <button class="arrow" aria-label="まえの きょく" disabled={focus === 0} onclick={() => show(focus - 1)}>
    <Icon name="arrow" size="60%" rotate={-90} />
  </button>
  <ul class="rail" bind:this={rail} onscroll={scrolled}>
    {#each LEVELS as l, i (l.id)}
      <li class:on={i === focus}>
        <button class="pick" aria-label={l.name} aria-current={i === focus} onclick={() => show(i)}>
          <Jacket level={l} />
        </button>
      </li>
    {/each}
  </ul>
  <button
    class="arrow next"
    aria-label="つぎの きょく"
    disabled={focus === LEVELS.length - 1}
    onclick={() => show(focus + 1)}
  >
    <Icon name="arrow" size="60%" rotate={90} />
  </button>
</div>
<p class="name">{level.name}</p>
<p class="meta">BPM {level.bpm}{level.credit ? ` / ${level.credit}` : ''}</p>
<DifficultyTabs bind:chosen {counts} ranks={([0, 1, 2] as const).map((d) => best[bestKey(level.id, d)]?.rank ?? '-')} />
<button class="pill p2 go" onclick={() => onstart(focus, chosen)}>スタート！</button>

<style>
  .banner {
    margin: 0 0 8px;
    font-size: clamp(22px, min(4cqh, 6cqw), 36px);
  }

  .shelf {
    --w: min(48cqw, 30cqh, 280px);
    position: relative;
    margin: 0 -16px;
  }

  .rail {
    display: flex;
    gap: 12px;
    margin: 0;
    padding: 16px calc(50% - var(--w) / 2) 22px;
    overflow-x: auto;
    list-style: none;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    touch-action: pan-x;
  }

  li {
    flex: none;
    width: var(--w);
    scroll-snap-align: center;
    opacity: 0.55;
    scale: 0.8;
    transition:
      scale 250ms var(--spring),
      opacity 250ms;
  }

  li.on {
    opacity: 1;
    scale: 1;
  }

  .pick {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }

  .arrow {
    position: absolute;
    top: 50%;
    left: 12px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 3px solid var(--line);
    border-radius: 50%;
    background: #fff;
    translate: 0 -50%;
    cursor: pointer;
  }

  .arrow.next {
    right: 12px;
    left: auto;
  }

  .arrow:disabled {
    opacity: 0.3;
  }

  .name {
    margin: 0;
    font-size: clamp(22px, min(3.6cqh, 6cqw), 32px);
    font-weight: 900;
  }

  .meta {
    margin: 2px 0 14px;
    font-size: 13px;
    font-weight: 700;
    opacity: 0.75;
  }

  .go {
    font-size: 22px;
    padding-inline: 40px;
  }

  @media (prefers-reduced-motion: reduce) {
    li {
      transition: none;
    }
  }
</style>
