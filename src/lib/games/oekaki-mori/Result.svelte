<script module lang="ts">
  import type { Seat } from '$lib/net/party.svelte';
  import type { Stroke } from './strokes';

  export interface Drawing {
    word: string;
    by: Seat;
    strokes: Stroke[];
  }
</script>

<script lang="ts">
  import Board from './Board.svelte';
  import type { View } from './engine';

  let {
    view,
    me,
    gallery,
    host,
    onagain
  }: { view: View; me: Seat; gallery: Drawing[]; host: boolean; onagain: () => void } = $props();

  const ranking = $derived(
    Object.entries(view.scores)
      .map(([seat, points]) => ({ seat: Number(seat) as Seat, points }))
      .sort((a, b) => b.points - a.points)
  );
  const rank = (points: number) => 1 + ranking.filter((r) => r.points > points).length;
</script>

<div class="result">
  <h2 class="yuru">けっか</h2>
  <ol class="ranking">
    {#each ranking as r (r.seat)}
      <li class="pill p{r.seat}">{rank(r.points)}い {r.seat}P{r.seat === me ? '（あなた）' : ''} {r.points}てん</li>
    {/each}
  </ol>
  <ul class="gallery">
    {#each gallery as d (d)}
      <li>
        <div class="thumb"><Board strokes={d.strokes} /></div>
        <span class="p{d.by}">{d.by}P「{d.word}」</span>
      </li>
    {/each}
  </ul>
  {#if host}
    <button class="pill gold" onclick={onagain}>あそびを えらぶ</button>
  {:else}
    <p role="status">おやが つぎの あそびを えらぶのを まってね</p>
  {/if}
</div>

<style>
  .result {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
    overflow-y: auto;
    touch-action: pan-y;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 800;
  }

  .ranking {
    display: grid;
    gap: 8px;
    list-style: none;
  }

  .gallery {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    width: min(100%, 560px);
    list-style: none;
  }

  .gallery li {
    display: grid;
    gap: 4px;
    justify-items: center;
    font-size: 14px;
  }

  .thumb {
    width: 100%;
    aspect-ratio: 1;
    container-type: size;
  }
</style>
